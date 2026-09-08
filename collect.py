#!/usr/bin/env python3
"""주간 소비 트렌드 보드 수집기.

자동 카테고리(음악·영화·넷플릭스·뮤지컬·콘서트·전시/행사·도서)를 그날 긁어
보드가 그대로 먹는 xlsx 한 개를 만든다. 수동 카테고리(유튜브·TV·무신사 등)는
현재 트렌드 보드 HTML 의 기본 차트를 그대로 옮겨 채운다("일단 현재 내용으로").

  python collect.py                         # 이번 주, KOBIS 는 지난 완료 주
  python collect.py --week 40 --target-dt 20260928
  python collect.py --selftest              # 네트워크 없이 HTML 파싱만 확인

결과: data/weekly/week{n}.xlsx  (1행=카테고리, 2~11행=순위)
키·정보는 전부 .env 를 참조한다.
"""
import os, re, sys, json, time, argparse
import datetime as dt
import xml.etree.ElementTree as ET
import requests
from openpyxl import Workbook

ROOT = os.path.dirname(os.path.abspath(__file__))

try:  # 윈도우 콘솔(cp949)에서도 한글·기호가 깨지지 않게 stdout 을 UTF-8 로.
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def load_env(path):
    # .env 를 직접 읽는다 — python-dotenv 의존성을 더하지 않는다.
    env = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'").strip('"')
    return env


ENV = load_env(os.path.join(ROOT, ".env"))
FIRECRAWL_KEY = ENV.get("FIRECRWAL_API") or ENV.get("FIRECRAWL_API")  # .env 오탈자(FIRECRWAL) 대응
KOBIS_KEY = ENV.get("KOBIS_API_KEY")


def with_retry(fn, *a, **k):
    # 외부 호출은 3회까지 지수 대기 후 재시도, 그 뒤 건너뛴다 (CLAUDE.md §7).
    for i in range(3):
        try:
            return fn(*a, **k)
        except Exception as e:
            if i == 2:
                raise
            time.sleep(2 ** i)


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


# ── Firecrawl 로 순위 목록을 구조화 추출한다 ───────────────────────────
KR_LOC = {"country": "KR", "languages": ["ko"]}  # 한국 로케일 — 아티스트·제목이 한글로 온다


def firecrawl_json(url, prompt, props, wait=4000, location=None):
    body = {"url": url, "onlyMainContent": False, "waitFor": wait,
            "formats": [{"type": "json", "prompt": prompt,
                         "schema": {"type": "object", "properties": props}}]}
    if location:
        body["location"] = location
    r = requests.post(
        "https://api.firecrawl.dev/v2/scrape",
        headers={"Authorization": f"Bearer {FIRECRAWL_KEY}", "Content-Type": "application/json"},
        json=body, timeout=180,
    )
    r.raise_for_status()
    b = r.json()
    return (b.get("data") or {}).get("json") or b.get("json") or {}


def firecrawl_ranked(url, prompt, extra_props, wait=4000, location=None):
    props = {"items": {"type": "array", "items": {
        "type": "object", "properties": {"rank": {"type": "integer"}, **extra_props},
        "required": ["rank"]}}}
    data = firecrawl_json(url, prompt, props, wait, location)
    return sorted(data.get("items", []), key=lambda x: x.get("rank", 99))[:10]


# ── 카테고리별 수집기 — 각자 순위대로 10개의 항목 문자열을 돌려준다 ────
def get_youtube_music():
    # 멜론은 봇에게 엉뚱한 차트를 줘 폐기했다. 유튜브 차트(주간 인기곡)로 대체 — 실제
    # 아이돌 차트가 깨끗하게 나오고, 로케일 KR 로 아티스트명도 한글로 받는다 (lesson.md).
    items = firecrawl_ranked(
        "https://charts.youtube.com/charts/TopSongs/kr/weekly",
        "유튜브 차트 대한민국 주간 인기곡(Top songs) 목록이다. 1~10위의 곡 제목(title)과 "
        "아티스트(artist)를 순위대로 짝지어 뽑아라. 표에 없는 값을 지어내지 마라.",
        {"title": {"type": "string"}, "artist": {"type": "string"}},
        wait=7000, location=KR_LOC)
    out = []
    for it in items:
        t, a = clean(it.get("title")), clean(it.get("artist"))
        out.append(f"{t} - {a}" if a else t)
    return out


def get_interpark(genre, kind):
    items = firecrawl_ranked(
        f"https://tickets.interpark.com/contents/ranking?genre={genre}",
        f"NOL 인터파크 {kind} 랭킹이다. 1~10위 공연/전시의 제목(title)을 순위대로 뽑아라.",
        {"title": {"type": "string"}})
    return [clean(it.get("title")) for it in items]


def get_kyobo():
    items = firecrawl_ranked(
        "https://store.kyobobook.co.kr/bestseller/total/weekly",
        "교보문고 주간 베스트셀러다. 1~10위 도서의 제목(title)을 순위대로 뽑아라. 부제·저자는 빼고 제목만.",
        {"title": {"type": "string"}})
    return [clean(it.get("title")) for it in items]


NETFLIX_URL = "https://www.netflix.com/tudum/top10/south-korea/tv"


def _norm(s):
    return re.sub(r"[^a-z0-9가-힣]", "", str(s or "").lower())


def _strip_season(t):
    # ': Limited Series' / ': Season 1' / ': Part 33' / ': 2026 Part 2' 꼬리표를 뗀다.
    return re.sub(r"\s*[:\-–]\s*(limited series$|season\b.*|part\b.*|\d{4}\s+part\b.*)", "", t, flags=re.I).strip()


def _netflix_ko(link, tudum_title):
    # Tudum 은 영어 제목만 준다. /watch|/title/{id} 로 넷플릭스 한국 상세를 되짚어
    # 한글 제목을 얻는다. 단 id 가 회차라 엉뚱한 작품으로 풀릴 수 있어(시리즈),
    # 그 페이지의 영어 제목이 Tudum 제목과 맞을 때만 한글을 믿는다 — 아니면 None → 영어로 남긴다.
    m = re.search(r"/(?:watch|title)/(\d+)", link or "")
    if not m:
        return None
    url = f"https://www.netflix.com/kr/title/{m.group(1)}"
    tud = _norm(tudum_title)
    for wait in (5000, 9000):  # 상세가 늦게 렌더돼 빈 응답이면 더 오래 기다려 한 번 더
        try:
            d = firecrawl_json(
                url, "이 넷플릭스 작품의 한국어 제목(title_ko)과 영어 제목(title_en). 시즌·회차 빼고 작품명만.",
                {"title_ko": {"type": "string"}, "title_en": {"type": "string"}}, wait=wait, location=KR_LOC)
        except Exception:
            return None
        ko, en = clean(d.get("title_ko")), _norm(d.get("title_en"))
        if not ko and not en:
            continue  # 페이지가 안 떴다 — 재시도
        # 영어 제목이 Tudum 과 맞을 때만 한글을 믿는다. 안 맞으면(엉뚱한 회차) 영어로 남긴다.
        return ko if (ko and en and (en in tud or tud in en)) else None
    return None


def get_netflix():
    items = firecrawl_ranked(
        NETFLIX_URL,
        "넷플릭스 남한 TV 주간 Top10 이다. 각 작품의 순위(rank), 화면 제목(title), 상세 링크 URL(link)을 순위대로.",
        {"title": {"type": "string"}, "link": {"type": "string"}}, location=KR_LOC)
    out = []
    for it in items:
        en = _strip_season(clean(it.get("title")))
        out.append(_netflix_ko(it.get("link"), it.get("title")) or en)
    return out


def get_kobis(target_dt):
    # KOBIS 는 공식 JSON API — 스크래핑하지 않는다. weekGb=0 은 주간(월~일).
    def call():
        r = requests.get(
            "https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchWeeklyBoxOfficeList.json",
            params={"key": KOBIS_KEY, "targetDt": target_dt, "weekGb": "0"}, timeout=30)
        r.raise_for_status()
        return r.json()
    data = call()
    lst = data.get("boxOfficeResult", {}).get("weeklyBoxOfficeList", [])
    lst = sorted(lst, key=lambda x: int(x.get("rank", "99")))[:10]
    return [clean(x.get("movieNm")) for x in lst]


def _clean_tv(t):
    # 닐슨 표기 '채널장르(프로그램명)<본>' 에서 프로그램명만 남긴다.
    t = re.sub(r"<[^>]*>", "", t).strip()          # <본> <생> 제거
    m = re.search(r"\(([^()]+)\)\s*$", t)          # 끝에 (제목) 이 붙으면 그 안만
    return m.group(1).strip() if m else t


def get_nielsen(sub_menu, kind):
    month = dt.date.today().strftime("%Y%m")
    items = firecrawl_ranked(
        f"https://www.nielsenkorea.co.kr/tv_terrestrial_day.asp?menu=Tit_1&sub_menu={sub_menu}&area=00&begin_date={month}",
        f"닐슨코리아 {kind} 일일 시청률 순위표다. 1~10위 프로그램명(title)을 순위대로. "
        "채널·장르 접두어와 <본>·<생> 표시는 빼고, 괄호 안에 제목이 있으면 그 제목만.",
        {"title": {"type": "string"}}, wait=5000, location=KR_LOC)
    return [_clean_tv(clean(it.get("title"))) for it in items]


def get_playboard():
    items = firecrawl_ranked(
        "https://playboard.co/chart/video/most-liked-all-videos-in-south-korea-weekly",
        "플레이보드 대한민국 주간 '좋아요 많은 영상' 차트다. 1~10위 영상 제목(title)을 순위대로.",
        {"title": {"type": "string"}}, wait=6000, location=KR_LOC)
    return [clean(it.get("title")) for it in items]


def get_naver_webtoon():
    items = firecrawl_ranked(
        "https://comic.naver.com/webtoon",
        "네이버 웹툰 인기 순위다. 상위 10개 웹툰 제목(title)을 순위대로.",
        {"title": {"type": "string"}}, wait=6000, location=KR_LOC)
    return [clean(it.get("title")) for it in items]


def get_gamemeca():
    items = firecrawl_ranked(
        "https://www.gamemeca.com/ranking.php",
        "게임메카 게임 순위표다. 1~10위 게임명(title)을 순위(rank)대로 빠짐없이 10개.",
        {"title": {"type": "string"}}, wait=8000, location=KR_LOC)
    return [clean(it.get("title")) for it in items]


def get_mobileindex_apps():
    # 모바일인덱스 주간 사용자 순위 '전체'에서 상승률(전주 대비 증감률) 상위 10을 뽑는다.
    d = firecrawl_json(
        "https://www.mobileindex.com/mi-chart/weekly-rank/user",
        "모바일인덱스 주간 사용자수 순위표다. 표의 모든 앱에 대해 앱 이름(name)과 "
        "상승률(rise, 전주 대비 증감률 숫자; +면 양수 -면 음수)을 빠짐없이 뽑아라.",
        {"items": {"type": "array", "items": {"type": "object", "properties": {
            "name": {"type": "string"}, "rise": {"type": "number"}}}}},
        wait=8000, location=KR_LOC)
    rows = [it for it in d.get("items", []) if clean(it.get("name")) and isinstance(it.get("rise"), (int, float))]
    rows.sort(key=lambda x: x["rise"], reverse=True)
    return [clean(it["name"]) for it in rows[:10]]


def get_google_trends():
    # 구글 트렌드 실시간 인기 검색어 RSS — Firecrawl 아님, 순수 XML 파싱.
    # RSS 는 <item> 하나에 검색어(<title>)와 관련 뉴스 제목(<ht:news_item_title>)이
    # 섞여 있으므로 <item>/<title>(검색어)만 꺼낸다.
    r = requests.get("https://trends.google.co.kr/trending/rss?geo=KR",
                     headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    r.raise_for_status()
    root = ET.fromstring(r.text)
    out = []
    for item in root.findall(".//item"):
        t = item.find("title")
        if t is not None and clean(t.text):
            out.append(clean(t.text))
    return out[:10]


# ── 수동 카테고리는 보드의 기본 차트(app/public/js/data.mjs 의 DEMO_MATRIX)를 그대로 옮긴다 ──
def load_manual_columns():
    txt = open(os.path.join(ROOT, "app", "public", "js", "data.mjs"), encoding="utf-8").read()
    block = txt.split("const DEMO_MATRIX = {", 1)[1].split("\n};", 1)[0]
    strip = lambda s: re.sub(r",\s*([\]}])", r"\1", s)  # JS 트레일링 콤마는 JSON 이 못 읽는다
    cats = json.loads(strip(re.search(r"categories:\s*(\[.*?\])", block, re.S).group(1)))
    rows = json.loads(strip(re.search(r"rows:\s*(\[.*\])", block, re.S).group(1)))
    col = {}
    for i, c in enumerate(cats):
        col[c] = [clean(rows[r][i]) if i < len(rows[r]) else "" for r in range(min(10, len(rows)))]
    return col


# 출력 열 순서 (보드 그룹 순서를 따른다). 연극은 뺀다 — 공연은 3종만.
ORDER = ["음악", "영화", "넷플릭스", "유튜브 영상", "유튜브 검색", "지상파 TV", "케이블 TV",
         "뮤지컬", "콘서트", "전시/행사", "도서", "네이버 웹툰", "무신사", "KREAM",
         "렉스몬드", "Jente", "구글 플레이 앱", "게임"]

# 열별 출처 — xlsx 데이터(1~11행) 아래에 적는다. 보드는 2~11행만 읽으므로 무시된다.
SOURCE_LABEL = {
    "음악": "YouTube Charts (KR 주간)", "영화": "KOBIS 박스오피스", "넷플릭스": "Netflix Tudum",
    "유튜브 영상": "Playboard (KR 주간)", "유튜브 검색": "Google Trends (RSS)",
    "지상파 TV": "Nielsen Korea", "케이블 TV": "Nielsen Korea",
    "뮤지컬": "NOL 인터파크", "콘서트": "NOL 인터파크", "전시/행사": "NOL 인터파크",
    "도서": "교보문고", "네이버 웹툰": "네이버웹툰",
    "무신사": "무신사(수동)", "KREAM": "KREAM(수동)", "렉스몬드": "렉스몬드(수동)", "Jente": "Jente(수동)",
    "구글 플레이 앱": "MobileIndex 상승률", "게임": "게임메카",
}

# 결과 메일 — funtime 의 Gmail 자격증명을 그대로 빌려 쓴다(별도 키 안 만든다).
FUNTIME_ENV = r"C:\pjt\funtime\.env"


def mail_to():
    # 수신자는 .env 의 MAIL_TO(쉼표 구분). 저장소에 주소를 두지 않는다 — 이 저장소 .env 먼저, 없으면 funtime .env.
    for p in (os.path.join(ROOT, ".env"), FUNTIME_ENV):
        v = load_env(p).get("MAIL_TO")
        if v:
            return [x.strip() for x in v.split(",") if x.strip()]
    return []

# 자동 수집 카테고리 → 수집 함수
def auto_collectors(target_dt):
    return {
        "음악": get_youtube_music,
        "영화": lambda: get_kobis(target_dt),
        "넷플릭스": get_netflix,
        "뮤지컬": lambda: get_interpark("MUSICAL", "뮤지컬"),
        "콘서트": lambda: get_interpark("CONCERT", "콘서트"),
        "전시/행사": lambda: get_interpark("EXHIBIT", "전시/행사"),
        "도서": get_kyobo,
        "지상파 TV": lambda: get_nielsen("1_2", "지상파"),
        "케이블 TV": lambda: get_nielsen("3_2", "케이블(종합편성·유료방송)"),
        "유튜브 영상": get_playboard,
        "유튜브 검색": get_google_trends,
        "네이버 웹툰": get_naver_webtoon,
        "구글 플레이 앱": get_mobileindex_apps,   # 모바일인덱스 주간 사용자 순위의 상승률 탑10
        "게임": get_gamemeca,
    }


def run(week, target_dt):
    autos = auto_collectors(target_dt)
    try:
        manual = load_manual_columns()
    except Exception as e:
        print(f"[경고] 수동 카테고리(HTML 기본 차트) 로드 실패 — 빈 칸으로 둔다: {e}")
        manual = {}

    cols, ok, fail = {}, [], []
    for cat in ORDER:
        if cat in autos:
            try:
                vals = with_retry(autos[cat])
                cols[cat] = vals
                ok.append(f"{cat}({len(vals)})")
            except Exception as e:
                cols[cat] = []
                fail.append(f"{cat}: {e}")
        else:
            cols[cat] = manual.get(cat, [])

    out = ws_write(week, cols, target_dt)
    print("\n=== 수집 결과 ===")
    print("자동 성공:", ", ".join(ok) or "없음")
    if fail:
        print("자동 실패(그 열은 사람이 채운다):")
        for f in fail:
            print("  -", f)
    print("수동 이관:", ", ".join(c for c in ORDER if c not in autos))
    return out, ok, fail


def ws_write(week, cols, target_dt):
    wb = Workbook()
    ws = wb.active
    ws.title = f"WEEK{week}"
    ws.append(["순위"] + ORDER)
    for r in range(10):
        ws.append([r + 1] + [cols[c][r] if r < len(cols.get(c, [])) else "" for c in ORDER])
    stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    # 데이터 아래(12행~)에 출처를 적는다 — 보드는 2~11행만 읽어 무시한다.
    ws.append([])
    ws.append(["출처"] + [SOURCE_LABEL.get(c, "") for c in ORDER])
    ws.append([f"수집 {stamp} · WEEK {week} · KOBIS targetDt {target_dt}"])
    out = os.path.join(ROOT, "data", "weekly", f"week{week}.xlsx")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    wb.save(out)
    print(f"저장: {out}  (수집 시각 {stamp}, KOBIS targetDt {target_dt})")
    return out


def send_mail(xlsx_path, week, ok, fail):
    # funtime/.env 의 GMAIL_USER·GMAIL_APP_PASSWORD 로 결과 xlsx 를 첨부해 보낸다.
    import smtplib
    from email.message import EmailMessage
    creds = load_env(FUNTIME_ENV)
    user, pw = creds.get("GMAIL_USER"), creds.get("GMAIL_APP_PASSWORD")
    if not user or not pw:
        print(f"[경고] {FUNTIME_ENV} 에 GMAIL_USER/GMAIL_APP_PASSWORD 가 없어 메일을 건너뛴다.")
        return
    to = mail_to()
    if not to:
        print("[경고] .env 에 MAIL_TO 가 없어 메일을 건너뛴다.")
        return
    msg = EmailMessage()
    msg["From"] = user
    msg["To"] = ", ".join(to)
    msg["Subject"] = f"[트렌드 보드] WEEK {week} 랭킹"
    body = (f"WEEK {week} 소비 트렌드 랭킹입니다. 첨부 xlsx 를 보드에 업로드하세요.\n\n"
            f"자동 수집: {', '.join(ok) or '없음'}\n"
            + (f"실패(사람이 채울 열): {', '.join(f.split(':')[0] for f in fail)}\n" if fail else "")
            + "수동 유지: 무신사·KREAM·렉스몬드·Jente")
    msg.set_content(body)
    with open(xlsx_path, "rb") as f:
        msg.add_attachment(f.read(), maintype="application",
                           subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                           filename=os.path.basename(xlsx_path))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(user, pw)
        smtp.send_message(msg)
    print(f"메일 발송: {', '.join(to)} ← {os.path.basename(xlsx_path)}")


def selftest():
    # 파서가 깨지면 여기서 큰 소리로 실패한다 (네트워크 없이).
    col = load_manual_columns()
    assert "유튜브 영상" in col, "유튜브 영상 열을 못 찾음"
    assert len(col["유튜브 영상"]) == 10, f"유튜브 영상 행 수가 10이 아님: {len(col['유튜브 영상'])}"
    assert col["무신사"][0], "무신사 1위가 비어 있음"
    autos = set(auto_collectors("20260101").keys())
    manual = [c for c in ORDER if c not in autos]
    for cat in manual:
        assert cat in col, f"수동 카테고리 {cat} 가 기본 차트에 없음"
    print(f"selftest OK — 자동 {len(autos)}개 / 수동 {len(manual)}개({', '.join(manual)}), 각 10행 확인")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", type=int, default=dt.date.today().isocalendar()[1])
    ap.add_argument("--target-dt", default=(dt.date.today() - dt.timedelta(days=7)).strftime("%Y%m%d"),
                    help="KOBIS 주간 박스오피스 기준일 YYYYMMDD (기본: 7일 전 = 지난 완료 주)")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--email", action="store_true", help="수집 후 결과 xlsx 를 메일로 보낸다(funtime 자격증명)")
    args = ap.parse_args()
    if args.selftest:
        selftest()
        return
    if not FIRECRAWL_KEY:
        sys.exit("[중단] .env 에 FIRECRWAL_API 가 없다.")
    if not KOBIS_KEY:
        print("[경고] KOBIS_API_KEY 가 없어 영화는 건너뛴다.")
    out, ok, fail = run(args.week, args.target_dt)
    if args.email:
        send_mail(out, args.week, ok, fail)


if __name__ == "__main__":
    main()

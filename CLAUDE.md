# 대한민국 소비 트렌드 보드 — CLAUDE.md

## 0. 이 문서의 역할

이 저장소에서 작업하는 Claude Code가 따르는 유일한 지침이다.
제품 정의, 보드가 하는 일, 수집 설계, 코드 규칙, 금지 사항을 담는다.
판단이 갈리면 이 문서가 우선한다.

> 이 저장소는 한때 **이슈 창발 발산 엔진**(이슈 어휘를 충돌시켜 트렌드 워딩을 발산하는 파이썬 파이프라인)이었다.
> 2026-09-07 방향을 전면 전환해 지금은 **주간 소비 트렌드 보드**다. 옛 코드는 삭제했다. 배경은 `lesson.md`.
>
> **2026-09-08 구조 전환:** 보드를 **Claude Artifact → 로컬 웹앱**(`app/`)으로 바꿨다. 단일파일·CDN·`window.claude` 제약을 걷어내 편집성을 확보하고, 이유 생성은 **구독제 `claude -p`**(헤드리스)로 돌린다(API 키·과금 안 씀). 발행/공유는 나중 호스팅 과제다. 옛 단일 HTML(`WEEK37…html`)은 `app/public/index.html` 의 소스다.

---

## 1. 제품 정의

**한 줄 정의**
매주 대한민국 각 카테고리의 상위 랭킹을 한 화면에 모아, 각 항목이 **왜 떴는지**와 **무엇이 돈이 되는지**를 광고대행사(제일기획 기획자) 시점으로 읽어 주는 주간 소비 트렌드 보드.

**이것은 무엇이 아닌가**
- 순위 심사기가 아니다. 순위는 **출처가 매긴 것을 그대로 옮긴다.** 우리가 다시 매기지 않는다.
- 뉴스 요약기가 아니다. 사건을 요약하지 않고, 그 항목이 상위에 오른 **구조**를 읽는다.
- 예측기가 아니다. 순위 변동은 **지난주와의 뺄셈**이지 추정이 아니다.

**성공 기준**
한 화면에서 "이번 주 지갑이 어디에 열렸나"가 한 문장으로 잡힌다.
그리고 그 관찰이 담당 광고주의 과제로 바로 이어지는 실행안까지 내려간다(Client Connect).

---

## 2. 핵심 원리

보드(`app/public/`)에 이미 녹아 있는 규칙이다. 새 코드·프롬프트도 이걸 지킨다.

### 2.1 순위는 옮기고, 해석만 생성한다
출처가 매긴 순위·항목 텍스트를 손대지 않는다(오탈자·표기 포함). LLM은 "왜 떴나"만 쓴다.

### 2.2 추정이 아니라 뺄셈
순위 변동(▲▼·NEW·유지)은 지난주 스냅샷과 이번 주의 **차이**다. 근거 없는 상승/하락 서사를 붙이지 않는다.

### 2.3 원본은 원본대로, 그룹만 묶는다
같은 대상이 여러 표기로 올라오면(예: "민주당 티비" / "민주당 tv") 차트는 원본대로 두고 **variant 그룹**으로만 묶어 표시한다. 데이터를 고쳐 하나로 합치지 않는다.

### 2.4 사건이 아니라 태도의 이동을 읽는다
"무슨 일이 있었나"가 아니라 "사람들의 선택이 어디로 옮겨갔나"를 본다. 그 이동은 사건이 잊힌 뒤에도 남고, 전혀 다른 카테고리에서 다시 나타난다.

### 2.5 냉소의 과녁은 사람이 아니라 구조
어투는 차갑고 정확하다. 특정 인물·집단을 조롱하지 않는다. 특히 죽음·재난·범죄·정치 갈등이 얽힌 항목을 **캠페인 소재로 쓰자는 제안은 하지 않는다.**

---

## 3. 저장소 구조

```
issue-emergence/                 (폴더명은 옛 이름을 유지한다)
├── CLAUDE.md
├── lesson.md                    # 교훈·설계결정 로그
├── app/                         # 로컬 웹앱 (보드)
│   ├── server.mjs               #   Node 로컬 서버 — 의존성 0. 정적 서빙 + POST /api/sample
│   └── public/
│       ├── index.html           #   보드 셸 (React UMD · CDN)
│       ├── css/board.css        #   스타일
│       └── js/*.mjs             #   data · prompts · board (ES 모듈)
├── collect.py                   # 주간 랭킹 수집기 (자동 카테고리 → 보드용 xlsx + 메일)
├── run_collect.bat              # 스케줄러가 부르는 실행기 (collect.py --email + 로그)
└── data/weekly/week{n}.xlsx     # 수집기 출력. 이 파일을 보드에 업로드한다
```
※ 메일 자격증명은 이 저장소에 두지 않고 `C:\pjt\funtime\.env`(GMAIL_*)를 빌려 쓴다.

- **실행:** `cd app && node server.mjs` → `http://localhost:5178`. 브라우저에서 열고 xlsx 를 업로드한다.
- **이유 생성은 구독제 `claude -p`** 로 돈다. `server.mjs` 의 `POST /api/sample` 이 보드가 만든 프롬프트를 받아 헤드리스 claude 로 돌리고 파싱된 JSON 을 돌려준다(옛 `window.claude.use("sample")` 대체). API 키 안 씀.
- `server.mjs` 는 **stdlib 만** 쓴다(의존성 0). React·XLSX 는 CDN 에서 로드(로컬이라 허용).
- 옛 Artifact 제약(단일파일·CDN 금지·`window.claude`)은 이제 없다. 로컬 서빙이므로 ES 모듈·다분할이 자유롭다.

---

## 4. 보드가 하는 일

### 4.1 입력 — 카테고리 × TOP10 매트릭스
두 경로가 있다.
- **기본 차트**: 코드 안의 `DEMO_MATRIX`(순위 매트릭스) + `PREFILLED`(미리 써 둔 이유) + `PREFILLED_BUNDLES`. 켜자마자 완성된 화면이 보이게 하는 용도.
- **엑셀 업로드**(`handleFile`): 이번 주 실제 랭킹을 올린다.

**엑셀 형식 계약** (이걸 어기면 파싱이 깨진다)
- 1행 = 헤더. `[아무거나, 카테고리1, 카테고리2, …]` — 첫 칸은 무시(순위 라벨 자리), 그 뒤가 카테고리 이름.
- 2~11행 = 순위 1~10. `[순위, 항목1, 항목2, …]` — 첫 칸(순위 숫자)은 무시, 카테고리별로 한 칸씩.
- 한 칸 = `"제목 - 아티스트"` 또는 그냥 `"제목"`. 하이픈이 있으면 `parseRawTitle`이 제목/아티스트로 쪼갠다.
- 관련 함수: `handleFile` → `buildItemsFromMatrix` → `parseRawTitle`.

### 4.2 처리 — LLM은 로컬 서버를 거쳐 구독제 claude -p 로 돈다
- 브라우저의 `sampleFn.json(prompt, opts)` → `POST /api/sample` → `server.mjs` 가 `claude -p`(구독제) 실행 → 파싱 JSON 반환. 모든 LLM 기능(이유·토플라인·묶음·Client Connect)이 이 **단일 seam** 을 지난다.
- 카테고리별로 호출해 항목마다 이유(`headline`/`summary`/`reasons`/`keywords`/`confidence`)를 받는다(`runCategory`). 동시성은 서버가 게이트한다(`TREND_CONCURRENCY`, 기본 3).
- 항목 이유가 4개 이상 모이면 주간 한 줄(`makeTopline`)을 한 번 뽑는다.
- 이미 이유가 붙은 항목은 다시 부르지 않는다. 빈 카테고리만 부른다.
- **claude -p 주의:** node spawn 시 `stdio:['ignore',...]`(stdin 대기 방지), 상위 **배열** `--json-schema` 는 거부되니 안 쓰고 `.result` 에서 JSON 파싱, `--system-prompt` 로 CC 기본 프롬프트를 대체해 웹검색·과한 턴을 없앤다.

### 4.3 순위 변동 — 뺄셈
- `PREV_KEY` localStorage에 지난주 스냅샷을 남겨 두고 이번 주와 제목 기준으로 대조한다(`snapshotChart`/`loadPrevChart`).
- 같은 차트를 다시 올리면 지난주로 밀어내지 않는다(`sameChart`).

### 4.4 부가 기능
- **묶음 추론(bundles)**: 카테고리를 가로지르는 패턴을 묶어 한 편의 글로 만든다.
- **Client Connect**: 좋아요한 인사이트를 담당 광고주 과제와 엮어 매니페스토(기·승·전·결) + 실행안 3개를 만든다.
- **취향 학습**: 묶음 카드의 좋아요/싫어요를 localStorage에만 쌓아 다음 프롬프트에 실어 준다. **서버로는 아무것도 안 간다.** 모델을 학습시키는 게 아니다.
- **내보내기**: 화면에 있는 그대로 CSV로 뽑는다(`buildChartCsv` → 브라우저 Blob 다운로드).

### 4.5 STORAGE 키 규칙
- 상태는 `STORAGE_KEY`, 지난주 스냅샷은 `PREV_KEY`에 저장한다.
- **기본 차트(DEMO_MATRIX)를 이번 주 실제 데이터로 교체할 때는 `STORAGE_KEY` 버전을 올린다.** 안 그러면 그 브라우저에 저장돼 있던 낡은 데이터가 새 기본 차트를 계속 가린다.

---

## 5. 카테고리와 출처

상위 그룹(`CATEGORY_GROUPS`) 아래 카테고리(`CATEGORY_SOURCES`)가 붙는다. 자동 수집 대상과 수동 유지 대상을 구분한다.

규칙: **무신사·KREAM·렉스몬드·Jente 만 수동, 나머지는 전부 자동 파이프라인.**

| 그룹 | 카테고리 | 출처 | 수집 |
|---|---|---|---|
| 음악 | 음악 | **YouTube Charts (KR 주간 인기곡)** | 자동 |
| 영화 | 영화 | **KOBIS 박스오피스 API** | 자동 |
| OTT | 넷플릭스 | Netflix Tudum + 항목별 KR 재조회 | 자동 |
| 유튜브 | 유튜브 영상 | **Playboard (KR 주간 좋아요)** | 자동 |
| 유튜브 | 유튜브 검색 | **Google Trends RSS (geo=KR)** | 자동 |
| TV | 지상파 TV / 케이블 TV | **Nielsen Korea (일일 시청률)** | 자동 |
| 공연·전시 | 뮤지컬 / 콘서트 / 전시·행사 | NOL Interpark 랭킹 | 자동 |
| 출판·웹툰 | 도서 | **교보문고 주간 베스트** | 자동 |
| 출판·웹툰 | 네이버 웹툰 | **comic.naver.com 인기** | 자동 |
| 앱·게임 | 구글 플레이 앱 | **MobileIndex 주간 사용자 순위의 상승률 탑10** | 자동 |
| 앱·게임 | 게임 | **게임메카 순위** | 자동 |
| 패션·리테일 | 무신사 / KREAM / 렉스몬드 / Jente | 각 사이트 | 수동 |

**현 HTML과의 차이 (데이터 교체 시 라벨도 함께 고칠 것)**
- 영화 출처가 `CGV`로, 도서가 `예스24`로 박혀 있다 → 각각 **KOBIS**, **교보문고**로 바꾼다.
- 공연이 지금 4종(콘서트·뮤지컬·연극·전시)이다 → **3종(뮤지컬·콘서트·전시)으로 줄이고 연극은 뺀다.**
- 이 HTML 수정은 이번 문서 작업 범위 밖이다. 실제 데이터를 넣는 회차에 `CATEGORY_SOURCES`·`CATEGORY_GROUPS`·`DEMO_MATRIX`를 함께 손본다.

---

## 6. 자료 자동 수집 (`collect.py` · 구현 완료)

수집기의 일은 하나다 — **매주 한 번, 보드가 그대로 먹을 수 있는 xlsx 한 개를 만든다.** 그 xlsx를 사람이 보드에 업로드한다.

```
python collect.py                       # 이번 주(ISO 주차), KOBIS 는 7일 전(지난 완료 주)
python collect.py --week 37 --target-dt 20260831
python collect.py --selftest            # 네트워크 없이 HTML 파싱만 확인
```

### 6.1 공통
- 매주 지정한 요일 **오전 10시 기준**으로 각 랭킹을 스냅샷한다(랭킹은 시점에 따라 흔들리므로 기준 시각을 못 박는다). 수집기는 실행 시점의 랭킹을 그대로 찍는다 — 10시 기준은 **언제 실행하느냐**의 문제이고 스케줄러가 맡는다.
- 도구: **Firecrawl v2 `/scrape` + JSON 추출**(유튜브차트·교보·인터파크·넷플릭스·Nielsen·Playboard·네이버웹툰). 사이트마다 파서를 따로 짜지 않고 스키마 하나로 통일한다. **KOBIS는 공식 JSON API**, **유튜브 검색은 Google Trends RSS(XML)** 라 스크래핑이 아니라 `requests`+파싱으로 받는다. 키는 `.env`(`FIRECRWAL_API`·`KOBIS_API_KEY`).
- 결과물: `data/weekly/week{n}.xlsx` — §4.1 엑셀 형식 그대로. **자동 열은 새로 긁고, 수동 열은 현재 보드 HTML 의 `DEMO_MATRIX` 를 그대로 옮겨 채운다**(보드 업로드는 매트릭스 전체를 갈아끼우므로, 한 파일에 전 카테고리가 다 있어야 수동 카테고리가 사라지지 않는다).
- 데이터(1~11행) 아래 13행에 **열별 출처**, 14행에 수집 시각을 적는다(`SOURCE_LABEL`). 보드는 2~11행만 읽어 무시하므로 업로드에 지장 없다.
- 실패한 출처는 **건너뛰고 로그에 남긴다.** 그 열은 사람이 수동으로 채운다. 개수를 맞추려 억지로 재시도하지 않는다(외부 호출은 3회까지만).
- 스케줄: Windows 작업 스케줄러 또는 `/schedule`로 매주 그 요일 10:00 실행.

### 6.2 출처별
| 카테고리 | URL / API | 방식 | 항목 텍스트 |
|---|---|---|---|
| 음악 | `https://charts.youtube.com/charts/TopSongs/kr/weekly` (로케일 KR) | 스크래핑 | `곡명 - 아티스트` |
| 영화 | KOBIS openAPI (주간 박스오피스) | JSON API · 키 필요 | 영화명 |
| 뮤지컬 | `https://tickets.interpark.com/contents/ranking?genre=MUSICAL` | 스크래핑 | 공연명 |
| 콘서트 | `https://tickets.interpark.com/contents/ranking?genre=CONCERT` | 스크래핑 | 공연명 |
| 전시·행사 | `https://tickets.interpark.com/contents/ranking?genre=EXHIBIT` | 스크래핑 | 공연·전시명 |
| 도서 | `https://store.kyobobook.co.kr/bestseller/total/weekly` | 스크래핑 | 도서명 |
| 넷플릭스 | `https://www.netflix.com/tudum/top10/south-korea/tv` + 항목별 `netflix.com/kr/title/{id}` 재조회 | 스크래핑 | 작품명(검증되면 한글, 아니면 영어) |
| 지상파 TV | `nielsenkorea.co.kr/tv_terrestrial_day.asp?…&sub_menu=1_2&…&begin_date={YYYYMM}` | 스크래핑 | 프로그램명 |
| 케이블 TV | 같은 URL, `sub_menu=3_2` | 스크래핑 | 프로그램명 |
| 유튜브 영상 | `https://playboard.co/chart/video/most-liked-all-videos-in-south-korea-weekly` | 스크래핑 | 영상 제목 |
| 유튜브 검색 | `https://trends.google.co.kr/trending/rss?geo=KR` | RSS(XML) | 검색어 |
| 네이버 웹툰 | `https://comic.naver.com/webtoon` | 스크래핑 | 웹툰 제목 |
| 구글 플레이 앱 | `https://www.mobileindex.com/mi-chart/weekly-rank/user` | 스크래핑 | 앱 이름(상승률 상위 10) |
| 게임 | `https://www.gamemeca.com/ranking.php` | 스크래핑 | 게임명 |

앱은 표 전체를 받아 **상승률(전주 대비 증감률) 내림차순 상위 10**을 코드에서 골라낸다(순위 그대로가 아님).

**수동 유지(현재 보드 값 그대로, 자동 수집 제외)** — 이 4개만 수동.
- 무신사 `https://www.musinsa.com/main/musinsa/ranking?gf=A&storeCode=musinsa&sectionId=200&categoryCode=000&ageBand=AGE_BAND_ALL`
- KREAM `https://kream.co.kr/content/ranking_all-rising`
- 렉스몬드 / Jente

### 6.3 실측으로 드러난 것 (2026-09-07~08)
- **자동 14개 전부 실측 확인**: 음악(유튜브차트)·영화(KOBIS)·넷플릭스·뮤지컬·콘서트·전시/행사·도서(교보)·지상파/케이블 TV(Nielsen)·유튜브 영상(Playboard)·유튜브 검색(Trends RSS)·네이버 웹툰·구글 플레이 앱(MobileIndex 상승률)·게임(게임메카). 수동은 무신사·KREAM·렉스몬드·Jente 4개뿐.
- **음악 = 멜론 폐기 → 유튜브 차트.** `melon.com/chart/week` 는 봇에게 엉뚱한 차트를 줬다(가수 자리에 '순위상승수1·새진입' 변동 표시). `charts.youtube.com` 을 로케일 KR 로 긁으니 실제 아이돌 차트 + 한글 아티스트명.
- **TV(Nielsen)** = 닐슨 표기 `채널장르(프로그램명)<본>` 에서 `_clean_tv()` 로 프로그램명만 남긴다.
- **유튜브 검색(Trends RSS)** = RSS `<item>` 하나에 검색어(`<title>`)와 관련 뉴스 제목(`ht:news_item_title`)이 섞여 있다. `<item>/<title>` 만 꺼내야 검색어만 나온다.
- **넷플릭스 = 검증된 것만 한글.** Tudum 은 영어 제목만 주고(로케일 KR/ko·FlixPatrol 모두 영어) 한 출처로 한글을 주는 곳이 없다. Tudum 링크의 `{id}` 를 `netflix.com/kr/title/{id}` 로 되짚되, **그 페이지 영어 제목이 Tudum 과 맞을 때만 한글을 믿는다**(시리즈는 id 가 회차라 엉뚱하게 풀림) — 안 맞으면 영어. 넷플릭스 상세가 클라이언트 렌더라 회당 2~5개만 한글로 풀린다. 나머지는 보드에서 사람이 손본다.
- **구글 플레이 앱·게임 = 출처 교체 후 해결.** 처음 시도한 `play.google.com/store/apps`(범용 목록)·`thelog.co.kr`(터널 오류)는 폐기하고, MobileIndex(상승률 탑10)·게임메카로 바꾸니 깨끗했다.
- **네이버 웹툰·게임메카는 렌더 위젯에 따라 목록이 조금 달라질 수 있다** — 값은 다 실제 작품/게임이라 문제는 아니다.

### 6.4 결과 발송 (메일)
- `python collect.py --email` 이면 완성한 xlsx 를 첨부해 메일로 보낸다.
- 자격증명은 **funtime 것을 그대로 빌려 쓴다** — `C:\pjt\funtime\.env` 의 `GMAIL_USER`·`GMAIL_APP_PASSWORD`, `smtplib.SMTP_SSL("smtp.gmail.com", 465)`. 이 저장소에 메일 키를 따로 두지 않는다(값은 로그에 안 찍는다).
- 받는 사람: `mk.kansas@gmail.com`, `luc.kim@samsung.com` (`MAIL_TO`).
- 스케줄러(`run_collect.bat`)가 `--email` 로 돌아 **매주 월 10시 수집 직후 자동 발송**한다.

### 6.5 아직 사람이 정할 것
- (선택) 넷플릭스 한글 적중률 — 지금 방식의 천장은 회당 2~5개.

---

## 7. 코드 규칙

**로컬 앱(`app/`)**
- `server.mjs` 는 **stdlib 만** 쓴다(의존성 0). 새 npm 의존성을 함부로 늘리지 않는다 — 정 필요하면 이유를 남긴다.
- 프런트는 ES 모듈로 관심사별 분할(`js/data.mjs`·`js/prompts.mjs`·`js/board.mjs`). React·XLSX 만 CDN.
- 이유 생성은 **구독제 `claude -p`** 만 쓴다(API 키·Agent SDK·Batch = 과금, 금지). 프롬프트 빌더는 보드가 갖고 서버는 프록시만.
- 주석·로그는 한글. 순위·항목 텍스트는 절대 손대지 않는다.

**수집기(`collect.py`)**
- Python 3.11 이상. 수집기 의존성은 `requests`, `openpyxl`(xlsx 쓰기), firecrawl/exa 클라이언트로 제한한다. 새 의존성을 함부로 늘리지 않는다.
- 터미널에서 쓸 키는 `.env`에만 둔다. 커밋 금지.
- **순위·항목 텍스트를 절대 손대지 않는다**(오탈자·표기·부제 포함). 정리·묶음은 보드가 한다. 수집기는 있는 그대로 옮긴다.
- 외부 호출은 실패 시 3회까지 지수 대기 후 재시도, 그 뒤 건너뛴다.
- 모든 중간 산출물은 파일로 남긴다. 사람이 중간을 열어볼 수 있어야 한다.
- 스크립트는 각각 독립 실행 가능해야 한다.
- 주석과 로그 메시지는 한글로 쓴다.
- 함수는 짧게. 파일이 훑어보기 어려워지면 나눈다 — `collect.py` 는 한 벌로 도는 수집기라 한 파일로 둔다(현재 ~290줄, 대부분 주석).

---

## 8. 하지 말 것

- **순위를 다시 매기지 않는다.** 출처의 순위를 그대로 옮긴다.
- **순위 변동을 추정하지 않는다.** 지난주와의 뺄셈만 쓴다.
- 항목 텍스트를 다듬거나 합치지 않는다. 같은 대상은 그룹으로만 묶는다.
- 이유 생성에 **API 키(과금)** 를 쓰지 않는다. 구독제 `claude -p` 만 쓴다(Agent SDK·Batch 는 API 키 전용이라 금지).
- 광고주 제언(Client Connect)에서 죽음·재난·범죄·정치 이슈를 캠페인 소재로 제안하지 않는다.
- 없는 시장 수치·점유율을 지어내지 않는다. 세대론으로 때우지 않는다. 광고 상투어(진정성·공감·소통·새로운 패러다임·고객 중심) 금지.
- 이 CLAUDE.md 전체를 LLM 프롬프트에 넣지 않는다.

---

## 9. 표현 경계

- 정치·범죄·죽음·사회 갈등을 **재료로 다루는 것**은 허용된다. 상위 랭킹에는 그런 항목이 오른다.
- 단, 다음은 생성하지 않는다: 특정 개인·집단을 향한 비하·혐오·차별 표현, 성적 표현, 괴롭힘을 부추기는 표현.
- 기준은 소재가 아니라 **대상**이다. 부고가 오른 항목을 담담히 전하는 것과, 특정인을 조롱하는 이름을 붙이는 것은 다르다.
- 경계에 걸리는 표현은 조용히 제외한다. 왜 제외했는지 장황하게 쓰지 않는다.

---

## 10. 실행

**보드 열기 (로컬 앱)**
- `cd app && node server.mjs` → 브라우저에서 `http://localhost:5178`. `claude login` 세션이 있어야 이유 생성이 된다(구독제).
- 켜면 이번 주 기본 차트가 이미 채워져 있다. xlsx 를 업로드하고 "분석하기"를 누르면 빈 이유를 채우고, 묶음 추론·Client Connect로 내려간다.

**주간 갱신 (매주 월 10시 자동)**
- Windows 작업 스케줄러 `IssueEmergence-TrendCollect` 가 `run_collect.bat` → `python collect.py --email` 을 돌린다.
- `data/weekly/week{n}.xlsx` 생성(자동 14 / 수동 4, 아래에 출처) → `mk.kansas@gmail.com`·`luc.kim@samsung.com` 로 첨부 발송(§6.4). 로그는 `data/weekly/collect.log`.
- xlsx 를 로컬 앱(`node server.mjs`)에 업로드 → 지난주와 자동 대조 → "분석하기"(구독제 claude -p). 넷플릭스 영어 잔여분만 필요하면 손본다.
- 수동 실행: `python collect.py`(메일 없이) / `python collect.py --email`(메일까지) / `python collect.py --selftest`.

---

## 11. 최종 원칙

모은다 → 출처가 매긴 순위를 그대로 옮긴다 → 왜 떴는지, 무엇이 돈이 되는지를 읽는다 → 지난주와 뺄셈한다 → 광고주 과제로 잇는다.

순위를 다시 매기지 않는다.
데이터를 고치지 않는다.
없는 것을 지어내지 않는다.
냉소의 과녁은 사람이 아니라 구조다.

시스템은 재료를 모으고 구조를 읽는다. 판단은 사람이 한다.

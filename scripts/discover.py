# -*- coding: utf-8 -*-
"""이슈 후보 찾기. 많이 본 영상 제목을 모아 이슈로 묶는다.

  python scripts/discover.py                              # 지금 뜨는 것
  python scripts/discover.py --start 2026-08-18 --end 2026-08-25   # 그 기간의 것

고르는 것은 사람이 한다. 이 스크립트는 후보를 늘어놓기만 한다 (CLAUDE.md 4.1).
결과: data/discover/{run_id}.json
"""
from __future__ import annotations

import argparse
import html
import json
import os
from datetime import datetime

from collect_youtube import video_details
from common import ROOT, Log, call_json, http_get, load_config, new_run_id, read_prompt

VIDEOS = "https://www.googleapis.com/youtube/v3/videos"
SEARCH = "https://www.googleapis.com/youtube/v3/search"

# 인기 차트를 갈래별로 긁는다. 호출 하나가 쿼터 1유닛이라 싸다.
CHARTS = [("25", "뉴스·정치"), ("24", "연예"), (None, "전체")]


def clean(title: str) -> str:
    return html.unescape(title or "").strip()


def popular(key: str, category: str | None, log: Log) -> list[dict]:
    params = {"part": "snippet,statistics", "chart": "mostPopular",
              "regionCode": "KR", "maxResults": 50, "key": key}
    if category:
        params["videoCategoryId"] = category
    data = http_get(VIDEOS, params, log, f"인기 차트 {category or '전체'}")
    if not data:
        return []
    return [{
        "video_id": it["id"],
        "title": clean(it["snippet"]["title"]),
        "channel": it["snippet"]["channelTitle"],
        "view_count": int(it.get("statistics", {}).get("viewCount", 0)),
    } for it in data.get("items", [])]


def search_ids(key: str, q: str, start: str, end: str, limit: int, log: Log) -> list[str]:
    """기간 안에서 조회수 높은 순으로 영상 id를 긁는다. 호출 하나가 100유닛이다."""
    params = {"part": "snippet", "type": "video", "q": q, "videoCategoryId": "25",
              "regionCode": "KR", "relevanceLanguage": "ko", "order": "viewCount",
              "maxResults": min(50, limit), "key": key,
              "publishedAfter": f"{start}T00:00:00Z", "publishedBefore": f"{end}T23:59:59Z"}
    data = http_get(SEARCH, params, log, f"기간 검색 '{q}'")
    if not data:
        return []
    return [it["id"]["videoId"] for it in data.get("items", []) if it.get("id", {}).get("videoId")]


def collect_now(key: str, log: Log) -> list[dict]:
    """지금 뜨는 것. 갈래별 인기 차트를 합치고 같은 영상은 한 번만 남긴다."""
    seen, out = set(), []
    for category, label in CHARTS:
        got = popular(key, category, log)
        new = [v for v in got if v["video_id"] not in seen]
        seen.update(v["video_id"] for v in got)
        out += new
        log(f"  {label}: {len(got)}개 (새것 {len(new)}개)")
    return out


def collect_period(key: str, cfg: dict, start: str, end: str, log: Log) -> list[dict]:
    """정해진 기간의 것. 씨앗 검색어로 훑고 조회수를 따로 받아 온다."""
    dcfg = cfg.get("discover") or {}
    queries = dcfg.get("seed_queries") or ["논란", "속보", "의혹"]
    per = dcfg.get("per_query", 50)

    ids: list[str] = []
    for q in queries:
        got = search_ids(key, q, start, end, per, log)
        new = [v for v in got if v not in ids]
        ids += new
        log(f"  '{q}': {len(got)}개 (새것 {len(new)}개)")
    if not ids:
        return []
    log(f"  조회수 확인 중… (영상 {len(ids)}개)")
    videos = video_details(key, ids, log)
    for v in videos:
        v["title"] = clean(v["title"])
    return videos


def build_material(videos: list[dict]) -> str:
    lines = ["## 많이 본 영상 제목 (조회수 / 채널)"]
    for v in sorted(videos, key=lambda x: -x["view_count"]):
        lines.append(f"- {v['title']}  ({v['view_count']:,} / {v['channel']})")
    return "\n".join(lines)


def normalize(items: list) -> list[dict]:
    out, seen = [], set()
    for i, it in enumerate(items, start=1):
        if not isinstance(it, dict):
            continue
        keyword = str(it.get("keyword", "")).strip()
        if not keyword:
            continue
        iid = "".join(c for c in str(it.get("id", "")).strip().lower()
                      if c.isalnum() or c == "-") or f"issue-{i}"
        while iid in seen:
            iid += "-2"
        seen.add(iid)
        out.append({
            "id": iid,
            "keyword": keyword,
            "title": str(it.get("title", "")).strip() or keyword,
            "why": str(it.get("why", "")).strip()[:25],
            "proper_nouns": [str(w).strip() for w in (it.get("proper_nouns") or []) if str(w).strip()],
            "mentions": int(it.get("mentions") or 0),
        })
    return out


def discover(cfg: dict, log: Log, start: str = "", end: str = "") -> list[dict]:
    key = os.getenv("YOUTUBE_API_KEY")
    if not key:
        raise SystemExit("YOUTUBE_API_KEY 가 없습니다. .env 파일이나 화면 설정을 확인하세요.")

    if start and end:
        log(f"기간 {start} ~ {end} 안에서 찾습니다.")
        videos = collect_period(key, cfg, start, end, log)
    else:
        log("지금 뜨는 것에서 찾습니다.")
        videos = collect_now(key, log)

    if not videos:
        log("영상을 하나도 받지 못했습니다. 기간을 넓혀 보세요.")
        return []
    log(f"영상 제목 {len(videos)}개를 모았습니다. 이슈로 묶는 중…")

    items = call_json(cfg, read_prompt("discover_issues.md"), build_material(videos),
                      log, "이슈 찾기")
    return normalize(items or [])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None)
    ap.add_argument("--start", default=os.getenv("IEE_DISCOVER_START", ""), help="YYYY-MM-DD")
    ap.add_argument("--end", default=os.getenv("IEE_DISCOVER_END", ""), help="YYYY-MM-DD")
    args = ap.parse_args()

    run_id = args.run or new_run_id()
    log = Log(run_id)
    cfg = load_config()
    log(f"=== 이슈 찾기 시작 run_id={run_id} ===")

    issues = discover(cfg, log, args.start.strip(), args.end.strip())
    out_dir = ROOT / "data" / "discover"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{run_id}.json"
    path.write_text(json.dumps({
        "run_id": run_id,
        "found_at": datetime.now().isoformat(timespec="seconds"),
        "period": {"start": args.start, "end": args.end},
        "issues": issues,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    log(f"=== 이슈 후보 {len(issues)}개 → data/discover/{run_id}.json ===")
    for it in issues:
        log(f"  · {it['keyword']}  ({it['mentions']}개 영상) — {it['why']}")
    log("고르는 것은 사람이 합니다.")


if __name__ == "__main__":
    main()

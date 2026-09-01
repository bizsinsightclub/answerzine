# -*- coding: utf-8 -*-
"""YouTube Data API v3로 이슈별 영상 제목과 댓글을 모은다.

  python scripts/collect_youtube.py --run 20260901-0900
  python scripts/collect_youtube.py --issue issue-a

결과: data/raw/{run_id}/{이슈id}_youtube.json
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime

from common import ROOT, Log, http_get, load_config, load_issues, new_run_id

API = "https://www.googleapis.com/youtube/v3"


def search_videos(key: str, keyword: str, period: dict, pool: int, log: Log) -> list[str]:
    """기간 안에서 조회수 높은 순으로 영상 id를 긁는다."""
    ids: list[str] = []
    page = None
    while len(ids) < pool:
        params = {
            "part": "snippet", "q": keyword, "type": "video", "order": "viewCount",
            "maxResults": min(50, pool - len(ids)), "regionCode": "KR",
            "relevanceLanguage": "ko", "key": key,
        }
        if period.get("start"):
            params["publishedAfter"] = f"{period['start']}T00:00:00Z"
        if period.get("end"):
            params["publishedBefore"] = f"{period['end']}T23:59:59Z"
        if page:
            params["pageToken"] = page
        data = http_get(f"{API}/search", params, log, f"검색 '{keyword}'")
        if not data:
            break
        ids += [it["id"]["videoId"] for it in data.get("items", []) if it.get("id", {}).get("videoId")]
        page = data.get("nextPageToken")
        if not page:
            break
    return ids


def video_details(key: str, ids: list[str], log: Log) -> list[dict]:
    """제목·채널·조회수를 받아 온다. 검색 결과에는 조회수가 없다."""
    out = []
    for i in range(0, len(ids), 50):
        params = {"part": "snippet,statistics", "id": ",".join(ids[i:i + 50]), "key": key}
        data = http_get(f"{API}/videos", params, log, "영상 정보")
        if not data:
            continue
        for it in data.get("items", []):
            out.append({
                "video_id": it["id"],
                "title": it["snippet"]["title"],
                "channel": it["snippet"]["channelTitle"],
                "published_at": it["snippet"].get("publishedAt", ""),
                "view_count": int(it.get("statistics", {}).get("viewCount", 0)),
            })
    return out


def pick_videos(videos: list[dict], prefer: list[str], limit: int) -> list[dict]:
    """방송사 뉴스 채널을 앞으로 당기고, 그 안에서 조회수 순으로 자른다."""
    def rank(v):
        is_news = any(p in v["channel"] for p in prefer)
        return (0 if is_news else 1, -v["view_count"])
    return sorted(videos, key=rank)[:limit]


def fetch_comments(key: str, video_id: str, limit: int, log: Log) -> list[dict]:
    """상위 댓글을 좋아요 수와 함께 받아 온다. 댓글이 막힌 영상은 조용히 건너뛴다."""
    params = {
        "part": "snippet", "videoId": video_id, "order": "relevance",
        "maxResults": min(100, limit), "textFormat": "plainText", "key": key,
    }
    data = http_get(f"{API}/commentThreads", params, log, f"댓글 {video_id}")
    if not data:
        return []
    out = []
    for it in data.get("items", []):
        s = it["snippet"]["topLevelComment"]["snippet"]
        out.append({"text": s.get("textDisplay", "").strip(), "likes": int(s.get("likeCount", 0))})
    return [c for c in out if c["text"]]


def collect_issue(key: str, issue: dict, cfg: dict, log: Log) -> dict:
    yt = (cfg.get("collect") or {}).get("youtube") or {}
    period = cfg.get("period") or {}
    log(f"[{issue['id']}] '{issue['keyword']}' 검색 시작")

    ids = search_videos(key, issue["keyword"], period, yt.get("search_pool", 50), log)
    log(f"[{issue['id']}] 검색된 영상 {len(ids)}개")
    if not ids:
        return {"issue_id": issue["id"], "keyword": issue["keyword"],
                "source": issue["source"], "videos": []}

    details = video_details(key, ids, log)
    chosen = pick_videos(details, yt.get("prefer_channels") or [], yt.get("videos_per_issue", 10))

    total = 0
    for v in chosen:
        v["comments"] = fetch_comments(key, v["video_id"], yt.get("comments_per_video", 100), log)
        total += len(v["comments"])
        log(f"  · {v['channel']} | {v['title'][:40]} | 조회 {v['view_count']:,} | 댓글 {len(v['comments'])}")

    log(f"[{issue['id']}] 영상 {len(chosen)}개 / 댓글 {total}개 수집 완료 "
        f"(쿼터 약 {100 + 1 + len(chosen)}유닛)")
    return {
        "issue_id": issue["id"], "keyword": issue["keyword"], "source": issue["source"],
        "collected_at": datetime.now().isoformat(timespec="seconds"),
        "period": period, "videos": chosen,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None, help="run_id (없으면 현재 시각으로 새로 만든다)")
    ap.add_argument("--issue", default=None, help="이슈 id 또는 키워드 하나만 수집")
    args = ap.parse_args()

    run_id = args.run or new_run_id()
    log = Log(run_id)
    cfg = load_config()
    issues = load_issues(cfg, args.issue)
    if not issues:
        raise SystemExit("config.yaml 에 수집할 이슈가 없습니다.")

    key = os.getenv("YOUTUBE_API_KEY")
    if not key:
        raise SystemExit("YOUTUBE_API_KEY 가 없습니다. .env 파일을 확인하세요.")

    out_dir = ROOT / "data" / "raw" / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    log(f"=== 수집 시작 run_id={run_id} 이슈 {len(issues)}개 ===")

    for issue in issues:
        result = collect_issue(key, issue, cfg, log)
        path = out_dir / f"{issue['id']}_youtube.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        log(f"[{issue['id']}] 저장 → {path.relative_to(ROOT)}")

    log(f"=== 수집 끝. 다음: python scripts/extract_vocab.py --run {run_id} ===")


if __name__ == "__main__":
    main()

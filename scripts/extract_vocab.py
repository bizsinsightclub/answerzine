# -*- coding: utf-8 -*-
"""수집 원본에서 이슈별 '활성 어휘 표'를 뽑는다. LLM 1회/이슈.

  python scripts/extract_vocab.py --run 20260901-0900

결과: data/vocab/{run_id}/{이슈id}.csv, {이슈id}_summary.txt
"""
from __future__ import annotations

import argparse
import csv
import json

from common import (ROOT, Log, call_json, latest_run, load_config, load_issues,
                    read_prompt)

COLUMNS = ["expression", "source", "frequency", "polarity", "type", "note"]


def load_raw(run_id: str, issue_id: str) -> dict:
    """유튜브 수집 결과를 읽는다. 뉴스 파일(1단계)이 있으면 함께 읽는다."""
    base = ROOT / "data" / "raw" / run_id
    yt_path = base / f"{issue_id}_youtube.json"
    raw = {"videos": [], "articles": []}
    if yt_path.exists():
        raw.update(json.loads(yt_path.read_text(encoding="utf-8")))
    news_path = base / f"{issue_id}_news.json"
    if news_path.exists():
        raw["articles"] = json.loads(news_path.read_text(encoding="utf-8")).get("articles", [])
    return raw


def build_material(raw: dict, comment_limit: int) -> tuple[str, int]:
    """LLM에 넣을 재료를 만든다. 댓글은 좋아요 많은 순으로 자른다."""
    lines = []

    articles = raw.get("articles") or []
    if articles:
        lines.append("## 기사 제목")
        lines += [f"- {a.get('title', '')}" for a in articles[:300]]

    lines.append("\n## 영상 제목 (조회수 / 채널)")
    for v in raw.get("videos", []):
        lines.append(f"- {v['title']}  ({v.get('view_count', 0):,} / {v.get('channel', '')})")

    comments = []
    for v in raw.get("videos", []):
        comments += v.get("comments", [])
    comments.sort(key=lambda c: c.get("likes", 0), reverse=True)
    comments = comments[:comment_limit]

    lines.append("\n## 댓글 (좋아요 순, [좋아요] 본문)")
    for c in comments:
        text = " ".join(c["text"].split())[:200]
        lines.append(f"- [{c.get('likes', 0)}] {text}")

    return "\n".join(lines), len(comments)


def write_csv(path, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in COLUMNS})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None)
    ap.add_argument("--issue", default=None)
    args = ap.parse_args()

    run_id = args.run or latest_run("raw")
    if not run_id:
        raise SystemExit("수집 결과가 없습니다. 먼저 collect_youtube.py 를 실행하세요.")

    log = Log(run_id)
    cfg = load_config()
    vcfg = cfg.get("vocab") or {}
    issues = load_issues(cfg, args.issue)
    system = read_prompt("vocab_extract.md") \
        .replace("{ROWS_MIN}", str(vcfg.get("rows_min", 20))) \
        .replace("{ROWS_MAX}", str(vcfg.get("rows_max", 30)))

    out_dir = ROOT / "data" / "vocab" / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    log(f"=== 어휘 추출 시작 run_id={run_id} 이슈 {len(issues)}개 ===")

    for issue in issues:
        raw = load_raw(run_id, issue["id"])
        if not raw.get("videos") and not raw.get("articles"):
            log(f"[{issue['id']}] 수집 원본이 없어 건너뜁니다.")
            continue

        material, n_comments = build_material(raw, vcfg.get("comment_limit", 1000))
        user = (f"# 이슈 키워드\n{issue['keyword']}\n\n{material}")
        log(f"[{issue['id']}] 영상 {len(raw.get('videos', []))}개 / 댓글 {n_comments}개 → LLM 호출")

        data = call_json(cfg, system, user, log, f"vocab {issue['id']}", kind="dict")
        if not data:
            continue

        rows = [r for r in (data.get("vocab") or []) if r.get("expression")]
        write_csv(out_dir / f"{issue['id']}.csv", rows)

        # 요약: config.yaml에 손으로 적어 둔 게 있으면 그것을 우선한다
        summary = issue["summary"] or "\n".join(data.get("summary") or [])
        (out_dir / f"{issue['id']}_summary.txt").write_text(summary, encoding="utf-8")

        log(f"[{issue['id']}] 어휘 {len(rows)}행 저장 → data/vocab/{run_id}/{issue['id']}.csv")

    log(f"=== 어휘 추출 끝. 다음: python scripts/generate.py --run {run_id} ===")


if __name__ == "__main__":
    main()

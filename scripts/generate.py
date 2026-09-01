# -*- coding: utf-8 -*-
"""발산. 메커니즘 하나당 호출 하나. 이슈당 9회.

  python scripts/generate.py --run 20260901-0900

결과: data/out/{run_id}/generated.csv, raw/{이슈id}_{메커니즘}.json
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter

import yaml

from common import (ROOT, Log, call_json, latest_run, load_config, load_issues,
                    read_prompt)

COLUMNS = ["candidate", "mechanism", "source_word", "active_word", "one_line", "issue"]


def mech_prompt(mech: str) -> str | None:
    """mech_01 → prompts/mech_01_*.md 를 찾는다."""
    hits = sorted((ROOT / "prompts").glob(f"{mech}*.md"))
    return hits[0].read_text(encoding="utf-8") if hits else None


def read_vocab(run_id: str, issue_id: str) -> list[dict]:
    p = ROOT / "data" / "vocab" / run_id / f"{issue_id}.csv"
    if not p.exists():
        return []
    with open(p, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def vocab_block(rows: list[dict]) -> str:
    head = "expression | source | frequency | polarity | type | note"
    body = [
        " | ".join([r.get("expression", ""), r.get("source", ""), str(r.get("frequency", "")),
                    r.get("polarity", ""), r.get("type", ""), r.get("note", "")])
        for r in rows
    ]
    return "\n".join([head] + body)


def strong_words_block(exclude: set[str]) -> str:
    p = ROOT / "data" / "lexicon" / "strong_words.yaml"
    if not p.exists():
        return "(없음)"
    pool = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    lines = []
    for cat, words in pool.items():
        keep = [w for w in (words or []) if w not in exclude]
        if keep:
            lines.append(f"{cat}: " + ", ".join(keep))
    return "\n".join(lines)


def build_exclude(run_id: str, lookback: int, min_count: int, log: Log) -> set[str]:
    """직전 라운드들에서 자주 쓰인 원본 단어를 모은다. 같은 단어에 매달리지 않기 위해서다."""
    base = ROOT / "data" / "out"
    if not base.exists():
        return set()
    dirs = sorted((d for d in base.iterdir() if d.is_dir() and d.name < run_id),
                  key=lambda d: d.name, reverse=True)[:lookback]
    counts: Counter[str] = Counter()
    for d in dirs:
        p = d / "candidates.csv"
        if not p.exists():
            continue
        with open(p, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                w = (row.get("source_word") or "").strip()
                if w:
                    counts[w] += 1
    out = {w for w, n in counts.items() if n >= min_count}
    if out:
        log(f"제외 단어 {len(out)}개 (직전 {len(dirs)}라운드 기준): {', '.join(sorted(out))}")
    return out


def build_user(issue: dict, vocab: list[dict], exclude: set[str],
               summary: str, partner: dict | None) -> str:
    parts = [
        f"# 이슈\n{issue['keyword']}",
        f"\n## 이슈 요약\n{summary or '(요약 없음)'}",
        f"\n## 활성 어휘 표\n{vocab_block(vocab)}",
    ]
    if partner:
        parts.append(f"\n## 두 번째 이슈: {partner['keyword']}\n"
                     f"### 요약\n{partner['summary'] or '(요약 없음)'}\n"
                     f"### 활성 어휘 표\n{vocab_block(partner['vocab'])}")
    parts.append(f"\n## 강한 원본 어휘 풀\n{strong_words_block(exclude)}")
    if exclude:
        parts.append(f"\n## 제외 단어 (쓰지 말 것)\n{', '.join(sorted(exclude))}")
    return "\n".join(parts)


def append_stream(path, rows: list[dict], keyword: str, mech_title: str) -> None:
    """후보를 만드는 족족 한 줄씩 덧붙인다. 화면이 이 파일을 보고 실시간으로 쌓아 보여준다."""
    with open(path, "a", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps({**r, "keyword": keyword, "mech_title": mech_title},
                               ensure_ascii=False) + "\n")


def normalize(items: list, mech: str, issue_id: str) -> list[dict]:
    """키를 맞추고 one_line 길이만 자른다. 품질 판단은 하지 않는다."""
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        cand = str(it.get("candidate", "")).strip()
        if not cand:
            continue
        out.append({
            "candidate": cand,
            "mechanism": mech,
            "source_word": str(it.get("source_word", "")).strip(),
            "active_word": str(it.get("active_word", "")).strip(),
            "one_line": str(it.get("one_line", "")).strip()[:20],
            "issue": issue_id,
        })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None)
    ap.add_argument("--issue", default=None)
    args = ap.parse_args()

    run_id = args.run or latest_run("vocab")
    if not run_id:
        raise SystemExit("활성 어휘 표가 없습니다. 먼저 extract_vocab.py 를 실행하세요.")

    log = Log(run_id)
    cfg = load_config()
    gcfg = cfg.get("generate") or {}
    all_issues = load_issues(cfg)
    targets = load_issues(cfg, args.issue)

    # 이슈별 재료를 미리 읽어 둔다 (mech_09가 다른 이슈의 표를 쓴다)
    for it in all_issues:
        it["vocab"] = read_vocab(run_id, it["id"])
        sp = ROOT / "data" / "vocab" / run_id / f"{it['id']}_summary.txt"
        it["summary"] = it["summary"] or (sp.read_text(encoding="utf-8") if sp.exists() else "")

    exclude = build_exclude(run_id, gcfg.get("exclude_lookback_runs", 3),
                            gcfg.get("exclude_min_count", 3), log)

    out_dir = ROOT / "data" / "out" / run_id
    (out_dir / "raw").mkdir(parents=True, exist_ok=True)
    (out_dir / "excluded_words.txt").write_text("\n".join(sorted(exclude)), encoding="utf-8")
    stream = out_dir / "stream.jsonl"
    stream.unlink(missing_ok=True)

    core = read_prompt("_core.md")
    out_tpl = read_prompt("_output.md")
    rows: list[dict] = []
    log(f"=== 발산 시작 run_id={run_id} 이슈 {len(targets)}개 ===")

    for issue in targets:
        cur = next(x for x in all_issues if x["id"] == issue["id"])
        if not cur["vocab"]:
            log(f"[{cur['id']}] 활성 어휘 표가 비어 있어 건너뜁니다.")
            continue
        made = 0
        for mech in gcfg.get("mechanisms") or []:
            body = mech_prompt(mech)
            if not body:
                log(f"[{cur['id']}] {mech} 프롬프트 파일이 없어 건너뜁니다.")
                continue

            # mech_09만 다른 이슈 하나를 짝으로 붙인다. 목록에서 바로 다음 이슈를 쓴다.
            partner = None
            if mech == "mech_09":
                idx = all_issues.index(cur)
                for k in range(1, len(all_issues)):
                    cand = all_issues[(idx + k) % len(all_issues)]
                    if cand["vocab"]:
                        partner = cand
                        break
                if partner is None:
                    log(f"[{cur['id']}] mech_09: 짝지을 다른 이슈가 없어 건너뜁니다.")
                    continue

            system = "\n\n".join([
                "# 핵심 원리", core, body,
                out_tpl.replace("{N_MIN}", str(gcfg.get("per_call_min", 15)))
                       .replace("{N_MAX}", str(gcfg.get("per_call_max", 25)))
                       .replace("{MECH}", mech),
            ])
            user = build_user(cur, cur["vocab"], exclude, cur["summary"], partner)

            items = call_json(cfg, system, user, log, f"{cur['id']}/{mech}")
            got = normalize(items or [], mech, cur["id"])
            rows += got
            made += len(got)
            (out_dir / "raw" / f"{cur['id']}_{mech}.json").write_text(
                json.dumps(items or [], ensure_ascii=False, indent=2), encoding="utf-8")
            append_stream(stream, got, cur["keyword"], body.splitlines()[0].lstrip("# ").strip())
            log(f"[{cur['id']}] {mech} → {len(got)}개")
        log(f"[{cur['id']}] 합계 {made}개")

    with open(out_dir / "generated.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    log(f"=== 발산 끝. 총 {len(rows)}개. 다음: python scripts/filter.py --run {run_id} ===")


if __name__ == "__main__":
    main()

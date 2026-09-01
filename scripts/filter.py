# -*- coding: utf-8 -*-
"""자동 정리. 코드만 쓴다. LLM을 부르지 않고, 품질 판단도 하지 않는다.

삭제 규칙은 셋뿐이다.
  1. 완전 중복 (공백·조사 차이 무시)
  2. 이슈의 고유명사·사건명을 원형 그대로 포함
  3. 5어절 초과

  python scripts/filter.py --run 20260901-0900

결과: data/out/{run_id}/candidates.csv, candidates.md
"""
from __future__ import annotations

import argparse
import csv
import re
from collections import Counter, defaultdict

from common import ROOT, Log, latest_run, load_config, load_issues

COLUMNS = ["candidate", "mechanism", "source_word", "active_word", "one_line", "issue"]

# 뒤에 붙는 조사. 긴 것부터 본다.
JOSA = ["으로", "에서", "에게", "라는", "이라", "은", "는", "이", "가", "을", "를",
        "의", "에", "도", "와", "과", "로", "만"]


def strip_josa(word: str) -> str:
    """끝에 붙은 조사 하나를 뗀다. 떼고 나서 두 글자보다 짧아지면 두지 않는다."""
    for j in JOSA:
        if word.endswith(j) and len(word) - len(j) >= 2:
            return word[: -len(j)]
    return word


def dedupe_keys(text: str) -> tuple[str, str]:
    """공백을 지운 형태와, 끝 조사까지 뗀 형태 둘 다 만든다.

    조사를 뗀 형태만 쓰면 '개그외도'가 '개그외'가 되어 '개그외도를'과 어긋난다.
    그래서 두 형태를 모두 기억하고, 둘 중 하나라도 겹치면 같은 후보로 본다.
    """
    parts = text.split()
    raw = "".join(parts)
    parts[-1] = strip_josa(parts[-1])
    return raw, "".join(parts)


def mech_title(mech: str) -> str:
    """프롬프트 파일 첫 줄에서 사람이 읽을 이름을 가져온다."""
    hits = sorted((ROOT / "prompts").glob(f"{mech}*.md"))
    if not hits:
        return mech
    first = hits[0].read_text(encoding="utf-8").splitlines()[0]
    return first.lstrip("# ").strip() or mech


def read_generated(run_id: str) -> list[dict]:
    p = ROOT / "data" / "out" / run_id / "generated.csv"
    if not p.exists():
        raise SystemExit(f"{p} 가 없습니다. 먼저 generate.py 를 실행하세요.")
    with open(p, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_md(path, rows: list[dict], issues: list[dict], run_id: str) -> None:
    by_issue = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by_issue[r["issue"]][r["mechanism"]].append(r["candidate"])

    label = {i["id"]: i["keyword"] for i in issues}
    out = [f"# 후보 {len(rows)}개 — {run_id}", ""]
    for issue_id, mechs in by_issue.items():
        out += [f"## {label.get(issue_id, issue_id)}", ""]
        for mech in sorted(mechs):
            out.append(f"### {mech_title(mech)}")
            out += [f"- {c}" for c in mechs[mech]]
            out.append("")
    path.write_text("\n".join(out), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None)
    args = ap.parse_args()

    run_id = args.run or latest_run("out")
    if not run_id:
        raise SystemExit("발산 결과가 없습니다. 먼저 generate.py 를 실행하세요.")

    log = Log(run_id)
    cfg = load_config()
    max_eojeol = (cfg.get("filter") or {}).get("max_eojeol", 5)

    issues = load_issues(cfg)
    banned = {i["id"]: [w for w in ([i["keyword"]] + list(i["proper_nouns"])) if w.strip()]
              for i in issues}

    rows = read_generated(run_id)
    kept: list[dict] = []
    seen: set[str] = set()
    dropped = Counter()

    for r in rows:
        cand = (r.get("candidate") or "").strip()
        if not cand:
            dropped["빈 후보"] += 1
            continue
        if len(cand.split()) > max_eojeol:
            dropped[f"{max_eojeol}어절 초과"] += 1
            continue
        if any(w in cand for w in banned.get(r.get("issue", ""), [])):
            dropped["고유명사 원형 포함"] += 1
            continue
        keys = dedupe_keys(cand)
        if seen.intersection(keys):
            dropped["중복"] += 1
            continue
        seen.update(keys)
        kept.append(r)

    out_dir = ROOT / "data" / "out" / run_id
    with open(out_dir / "candidates.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(kept)
    write_md(out_dir / "candidates.md", kept, issues, run_id)

    log(f"=== 정리 끝: 들어온 {len(rows)}개 → 남은 {len(kept)}개 ===")
    for reason, n in dropped.most_common():
        log(f"  삭제 {reason}: {n}개")
    log(f"결과: data/out/{run_id}/candidates.md")


if __name__ == "__main__":
    main()

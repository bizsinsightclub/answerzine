# -*- coding: utf-8 -*-
"""발산이 끝난 뒤, 하나를 골라 글을 쓴다.

  python scripts/pick.py --run 20260901-0900

주의: 이것은 발산 파이프라인이 아니라 그 뒤에 붙는 편집 단계다.
엔진은 여전히 점수를 매기지 않는다 (CLAUDE.md 8). 여기서만 사람이 시켜서 하나를 집는다.

결과: data/out/{run_id}/pick.json, pick.md
"""
from __future__ import annotations

import argparse
import csv
import json
import re

from common import (ROOT, Log, call_json, latest_run, llm_call, load_config,
                    load_issues, read_prompt)

LENS_DIR = ROOT / "data" / "lenses"
MIN_CHARS = 2400  # 이보다 짧으면 한 번 더 쓰게 한다 (목표는 2,800~3,500자)


def with_korean(prompt: str, korean: str) -> str:
    return prompt.rstrip() + "\n\n---\n\n" + korean


def clean_column(text: str | None) -> str:
    """맨 위에 붙는 큰 제목(# )만 걷어낸다. 소제목(## Chapter)은 살린다."""
    return re.sub(r"^# [^#].*$", "", text or "", flags=re.MULTILINE).strip()


def read_candidates(run_id: str) -> list[dict]:
    p = ROOT / "data" / "out" / run_id / "candidates.csv"
    if not p.exists():
        raise SystemExit(f"{p} 가 없습니다. 먼저 filter.py 까지 돌리세요.")
    with open(p, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


QUOTE_HEAD = "## 실제 발언"


def lens_cards() -> tuple[str, dict]:
    """렌즈 카드를 읽어, 인용마다 번호를 붙인 프롬프트용 글과 조회용 표를 만든다.

    번호로 고르게 하면 베껴 쓰다 틀리거나 지어낼 여지가 없다.
    """
    if not LENS_DIR.exists():
        return "", {}
    blocks, meta = [], {}
    for p in sorted(LENS_DIR.glob("LENS-*.md")):
        text = p.read_text(encoding="utf-8")
        head, body = text.split(QUOTE_HEAD, 1) if QUOTE_HEAD in text else (text, "")
        quotes = [ln.strip()[2:].strip() for ln in body.splitlines() if ln.strip().startswith("- ")]

        m = re.match(r"#\s*(LENS-\d+)\s*—\s*(.+)", text.splitlines()[0])
        pm = re.search(r"^인물:\s*(.+)$", text, re.MULTILINE)
        if not m:
            continue
        view = ""
        vm = re.search(r"## 이 렌즈가 보는 것\n(.+?)(?=\n##|\Z)", text, re.DOTALL)
        if vm:
            view = vm.group(1).strip()
        lens_id = m.group(1)
        meta[lens_id] = {"field": m.group(2).strip(),
                         "person": pm.group(1).strip() if pm else "",
                         "view": view, "quotes": quotes}
        numbered = "\n".join(f"Q{i}. {q}" for i, q in enumerate(quotes, start=1))
        blocks.append(f"{head.rstrip()}\n\n## 실제 발언 (번호로 고른다)\n{numbered}")
    return "\n\n---\n\n".join(blocks), meta


def issue_label(cfg: dict) -> dict:
    return {i["id"]: i["keyword"] for i in load_issues(cfg)}


def summaries(run_id: str, cfg: dict) -> str:
    """선정 단계용 — 그 실행의 이슈 요약을 전부 모은다."""
    label = issue_label(cfg)
    out = []
    for p in sorted((ROOT / "data" / "vocab" / run_id).glob("*_summary.txt")):
        issue_id = p.name[:-len("_summary.txt")]
        out.append(f"## {label.get(issue_id, issue_id)}\n{p.read_text(encoding='utf-8').strip()}")
    return "\n\n".join(out)


def one_summary(run_id: str, issue_id: str) -> str:
    """글쓰기용 — 고른 후보가 나온 이슈 하나의 요약만."""
    p = ROOT / "data" / "vocab" / run_id / f"{issue_id}_summary.txt"
    return p.read_text(encoding="utf-8").strip() if p.exists() else ""


def one_vocab(run_id: str, issue_id: str, limit: int = 20) -> str:
    """그 이슈에서 사람들이 실제로 쓰는 말. 글의 재료가 된다."""
    p = ROOT / "data" / "vocab" / run_id / f"{issue_id}.csv"
    if not p.exists():
        return ""
    with open(p, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))[:limit]
    return "\n".join(f"- {r.get('expression', '')} ({r.get('polarity', '')}·{r.get('type', '')})"
                     f" — {r.get('note', '')}" for r in rows if r.get("expression"))


def lens_voice(lens_id: str) -> str:
    p = LENS_DIR / "voice" / f"{lens_id}.md"
    return p.read_text(encoding="utf-8").strip() if p.exists() else ""


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s or "")


def resolve_quote(lens: dict, meta: dict) -> str:
    """고른 번호로 실제 인용을 꺼내 온다. 번호가 없으면 글자 대조로 한 번 더 본다.

    어느 쪽도 맞지 않으면 빈 문자열이다. 지어낸 말은 싣지 않는다.
    """
    quotes = (meta.get(lens.get("id", "")) or {}).get("quotes", [])
    if not quotes:
        return ""
    try:
        n = int(str(lens.get("quote_no", "")).strip().lstrip("Qq"))
        if 1 <= n <= len(quotes):
            return quotes[n - 1]
    except (TypeError, ValueError):
        pass
    said = norm(lens.get("quote", ""))
    return next((q for q in quotes if said and norm(q) in said or said and said in norm(q)), "")


def build_pick_user(rows: list[dict], cards: str, summary: str) -> str:
    table = "\n".join(
        f"{r['issue']} | {r['mechanism']} | {r['candidate']} | "
        f"{r['source_word']} × {r['active_word']} | {r['one_line']}" for r in rows)
    return (f"# 후보 전부 ({len(rows)}개)\n"
            f"이슈 | 메커니즘 | 후보 | 원본어 × 활성어 | 메모\n{table}\n\n"
            f"# 이슈 요약\n{summary or '(없음)'}\n\n"
            f"# 렌즈 목록\n{cards or '(렌즈가 없습니다. lens 항목은 비워 두세요.)'}")


def anchor_best(best: dict, rows: list[dict]) -> dict:
    """고른 후보를 후보 표의 실제 행에 맞춘다.

    모델이 이슈 id 대신 검색어를 돌려주거나 메커니즘을 잘못 적는 일이 있다.
    후보 글자가 일치하는 행이 있으면 그 행을 정답으로 삼는다.
    """
    cand = (best.get("candidate") or "").strip()
    row = next((r for r in rows if (r.get("candidate") or "").strip() == cand), None)
    if not row:
        return best
    return {**best, "issue": row["issue"], "mechanism": row["mechanism"],
            "source_word": row["source_word"], "active_word": row["active_word"]}


def build_column_user(pick: dict, lens: dict, run_id: str, cfg: dict) -> str:
    """글쓰기 입력. 다룰 이슈 하나의 재료만 넣는다. 여러 이슈를 주면 글이 흩어진다."""
    best = pick.get("best") or {}
    reading = pick.get("reading") or {}
    issue_id = best.get("issue", "")
    keyword = issue_label(cfg).get(issue_id, issue_id)

    parts = [f"# 너는 누구인가\n{lens.get('person') or '(렌즈 없음)'} · {lens.get('field', '')}\n"
             f"{lens.get('view', '')}"]
    if lens.get("voice"):
        parts.append(f"# 어떻게 쓰는가\n{lens['voice']}")
    parts += [
        f"# 다룰 이슈 — 오직 이것 하나\n{keyword}\n\n## 무슨 일이 있었나\n"
        f"{one_summary(run_id, issue_id) or '(요약 없음)'}",
        f"# 사람들이 이 일을 두고 실제로 쓰는 말\n{one_vocab(run_id, issue_id) or '(없음)'}",
        f"# 이 글이 놓을 이름\n{best.get('candidate', '')}\n"
        f"빌려온 말: {best.get('source_word', '')} / 이 이슈에서 온 말: {best.get('active_word', '')}\n"
        f"처음 읽히는 방식: {reading.get('first', '')}\n"
        f"알고 나면: {reading.get('then', '')}\n"
        f"무엇이 무엇으로 바뀌었나: {pick.get('why', '')}",
    ]
    if lens.get("quote"):
        parts.append(f"# 글 맨 위에 이미 붙어 있는 인용 (본문에서 다시 인용하지 마라)\n"
                     f"{lens.get('quote_ko') or lens['quote']}")
    return "\n\n".join(parts)


def render_md(pick: dict, lens: dict, column: str) -> str:
    best = pick.get("best") or {}
    reading = pick.get("reading") or {}
    out = [f"# {best.get('candidate', '')}", ""]
    if lens.get("person"):
        out += [f"글 · **{lens['person']}** — {lens.get('field', '')}", ""]
    if lens.get("quote"):
        out += [f"> {lens.get('quote_ko') or lens['quote']}", ""]
        if lens.get("quote_ko"):
            out += [f"<sub>{lens['quote']}</sub>", ""]
        if lens.get("bridge"):
            out += [f"*{lens['bridge']}*", ""]
    out += [column.strip(), ""]
    if lens.get("person"):
        out += [f"<sub>이 글은 magilite의 {lens.get('field', '')} 렌즈로 썼습니다. "
                f"맨 위 인용만 실제 발언이고 본문은 그 렌즈로 쓴 것입니다.</sub>", ""]
    out += ["---", "", "## 왜 이것인가", pick.get("why", ""), ""]
    if reading:
        out += [f"처음엔 「{reading.get('first', '')}」, 알고 나면 「{reading.get('then', '')}」.", ""]
    ru = pick.get("runners_up") or []
    if ru:
        out += ["## 아깝게 밀린 것"]
        out += [f"- **{r.get('candidate', '')}** — {r.get('why', '')}" for r in ru]
    out += ["", f"*{best.get('issue', '')} / {best.get('mechanism', '')} / "
                f"{best.get('source_word', '')} × {best.get('active_word', '')}*"]
    return "\n".join(out) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None)
    args = ap.parse_args()

    run_id = args.run or latest_run("out")
    if not run_id:
        raise SystemExit("결과가 없습니다. 먼저 발산부터 돌리세요.")

    log = Log(run_id)
    cfg = load_config()
    rows = read_candidates(run_id)
    cards, meta = lens_cards()
    summary = summaries(run_id, cfg)
    log(f"=== 하나 고르기 시작 run_id={run_id} 후보 {len(rows)}개 / 렌즈 {len(meta)}개 ===")

    korean = read_prompt("_korean.md")
    system = with_korean(read_prompt("select_best.md"), korean)
    user = build_pick_user(rows, cards, summary)

    pick = call_json(cfg, system, user, log, "선정", kind="dict")
    if not pick:
        raise SystemExit("고르기에 실패했습니다.")
    lens = dict(pick.get("lens") or {})
    lens["quote"] = resolve_quote(lens, meta)
    if meta and not lens["quote"]:
        log(f"  인용을 짚지 못했습니다 ({lens.get('id', '?')}) — 인용 없이 갑니다")

    info = meta.get(lens.get("id", "")) or {}
    lens["person"], lens["field"] = info.get("person", ""), info.get("field", "")
    lens["view"] = info.get("view", "")
    lens["voice"] = lens_voice(lens.get("id", ""))
    best = anchor_best(pick.get("best") or {}, rows)
    pick["best"] = best
    log(f"골랐습니다: {best.get('candidate', '')}  ({best.get('issue', '')} / {best.get('mechanism', '')})")
    if lens.get("quote"):
        log(f"렌즈: {lens['field']} — {lens['person']}")

    log("글을 쓰는 중…")
    system_col = with_korean(read_prompt("write_column.md"), korean)
    user_col = build_column_user(pick, lens, run_id, cfg)
    column = clean_column(llm_call(cfg, system_col, user_col, log, "칼럼", want_json=False))
    if not column:
        raise SystemExit("글쓰기에 실패했습니다.")

    # 짧게 나오면 한 번만 더 늘려 쓴다. 설명을 붙이는 게 아니라 장면을 더 넣게 시킨다.
    if len(column) < MIN_CHARS:
        log(f"  {len(column)}자로 짧습니다 — 장면을 더 넣어 한 번 더 씁니다")
        longer = clean_column(llm_call(
            cfg, system_col,
            f"{user_col}\n# 방금 쓴 글 ({len(column)}자 — 너무 짧다)\n{column}\n\n"
            f"이 글은 분량이 모자란다. 톤과 구조는 그대로 두고, 이 키워드가 진짜일 때 "
            f"벌어질 장면을 더 넣어 3,200자 이상으로 다시 써라. "
            f"설명을 덧붙이거나 요약을 달지 말고, 새 문단으로 늘려라.",
            log, "칼럼 다시", want_json=False))
        if longer and len(longer) > len(column):
            column = longer

    out_dir = ROOT / "data" / "out" / run_id
    pick["lens"] = lens
    pick["column"] = column
    (out_dir / "pick.json").write_text(json.dumps(pick, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "pick.md").write_text(render_md(pick, lens, column), encoding="utf-8")
    log(f"=== 끝. {len(column)}자 → data/out/{run_id}/pick.md ===")


if __name__ == "__main__":
    main()

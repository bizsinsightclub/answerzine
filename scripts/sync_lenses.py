# -*- coding: utf-8 -*-
"""magilite 저장소의 렌즈에서 필요한 부분만 뽑아 온다.

  python scripts/sync_lenses.py
  python scripts/sync_lenses.py --from "C:\\pjt\\magilite"

렌즈 원본은 magilite가 주인이다. 여기서는 고치지 않는다.
가져오는 것은 셋뿐이다 — 그 사람이 누구이고, 무엇을 볼 수 있고, 실제로 무슨 말을 했는가.
결과: data/lenses/LENS-0X.md
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from common import ROOT

DEFAULT_SOURCE = Path("C:/pjt/magilite")


def section(text: str, start: str, end: str) -> str:
    a = text.find(start)
    if a == -1:
        return ""
    b = text.find(end, a + len(start))
    return text[a + len(start): b if b != -1 else len(text)].strip()


def parse_lens(lens_file: Path, persona_file: Path | None) -> dict | None:
    head = lens_file.read_text(encoding="utf-8").splitlines()[0]
    m = re.match(r"#\s*(LENS-\d+)[:\s]+(.+?)(?:\s+—|\s*$)", head)
    if not m:
        return None
    lens_id, field = m.group(1), m.group(2).strip()

    body = lens_file.read_text(encoding="utf-8")
    role = section(body, "# 역할", "\n#").strip()

    person, one_line, quotes, tools = "", "", [], ""
    if persona_file and persona_file.exists():
        p = persona_file.read_text(encoding="utf-8")
        pm = re.match(r"#\s*LENS-\d+[^—]*—\s*(.+)", p.splitlines()[0])
        person = pm.group(1).strip() if pm else ""
        one_line = section(p, "## 카드 한 줄", "\n##").strip().strip('"')
        raw = section(p, "# 2. 실제 발언 (검증된 인용)", "\n# 3.")
        quotes = [ln.strip()[2:].strip() for ln in raw.splitlines() if ln.strip().startswith("- ")]
        tools = "\n".join(ln for ln in section(p, "# 3. 고유 어휘·개념", "\n# 4.").splitlines()[:6])

    voice = {}
    if persona_file and persona_file.exists():
        p = persona_file.read_text(encoding="utf-8")
        for label, start, end in (("시대 좌표", "# 1. 시대 좌표", "\n# 2."),
                                  ("말버릇·문장 리듬", "# 4. 말버릇·문장 리듬", "\n# 5."),
                                  ("시그니처 무브", "# 5. 시그니처 무브", "\n# 6."),
                                  ("멈추는 자리", "# 7. 멈추는 자리", "\n# 8."),
                                  ("절대 안 하는 말", "# 8. 절대 안 하는 말", "\n# 9.")):
            got = section(p, start, end)
            if got:
                voice[label] = got.strip("`\n ")

    return {"id": lens_id, "field": field, "person": person, "role": role,
            "one_line": one_line, "quotes": quotes, "tools": tools, "voice": voice}


def card(lens: dict) -> str:
    out = [f"# {lens['id']} — {lens['field']}"]
    if lens["person"]:
        out.append(f"인물: {lens['person']}")
    if lens["role"]:
        out += ["", "## 이 렌즈가 보는 것", lens["role"].strip("`\n ")]
    if lens["tools"]:
        out += ["", "## 도구", lens["tools"]]
    if lens["one_line"]:
        out += ["", "## 카드 한 줄", lens["one_line"]]
    if lens["quotes"]:
        out += ["", "## 실제 발언 (검증된 인용 — 글자 그대로만 쓸 것)"]
        out += [f"- {q}" for q in lens["quotes"]]
    return "\n".join(out) + "\n"


def voice_card(lens: dict) -> str:
    """글을 쓸 때 그 사람처럼 쓰기 위한 카드. 선정 단계에는 넣지 않는다."""
    out = [f"# {lens['person'] or lens['field']} — 어떻게 쓰는가"]
    for label, body in lens["voice"].items():
        out += ["", f"## {label}", body]
    return "\n".join(out) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="source", default=str(DEFAULT_SOURCE))
    args = ap.parse_args()

    src = Path(args.source) / "lenses"
    if not src.exists():
        raise SystemExit(f"렌즈 폴더를 찾지 못했습니다: {src}")

    out_dir = ROOT / "data" / "lenses"
    (out_dir / "voice").mkdir(parents=True, exist_ok=True)
    n = 0
    for lens_file in sorted(src.glob("LENS-*.md")):
        lens_id = lens_file.name.split("_")[0]
        lens = parse_lens(lens_file, src / "personas" / f"{lens_id}.md")
        if not lens:
            continue
        (out_dir / f"{lens_id}.md").write_text(card(lens), encoding="utf-8")
        if lens["voice"]:
            (out_dir / "voice" / f"{lens_id}.md").write_text(voice_card(lens), encoding="utf-8")
        n += 1
        print(f"  {lens['id']} {lens['field']} — 인용 {len(lens['quotes'])}개 / "
              f"문체 {len(lens['voice'])}항"
              f"{' / ' + lens['person'] if lens['person'] else ' / 인물 없음'}")
    print(f"렌즈 {n}개를 data/lenses/ 에 가져왔습니다.")


if __name__ == "__main__":
    main()

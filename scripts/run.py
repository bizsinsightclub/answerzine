# -*- coding: utf-8 -*-
"""전체 실행. 아래 스크립트를 순서대로 부르는 것 말고는 아무것도 하지 않는다.

  python scripts/run.py
  python scripts/run.py --run 20260901-0900
"""
from __future__ import annotations

import argparse
import subprocess
import sys

from common import ROOT, new_run_id

STEPS = ["collect_youtube.py", "extract_vocab.py", "generate.py", "filter.py"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default=None)
    ap.add_argument("--issue", default=None)
    args = ap.parse_args()

    run_id = args.run or new_run_id()
    for step in STEPS:
        cmd = [sys.executable, str(ROOT / "scripts" / step), "--run", run_id]
        if args.issue and step != "filter.py":
            cmd += ["--issue", args.issue]
        print(f"\n>>> {step}")
        result = subprocess.run(cmd)
        if result.returncode != 0:
            print(f"{step} 에서 멈췄습니다.")
            sys.exit(result.returncode)

    print(f"\n완료: data/out/{run_id}/candidates.md")


if __name__ == "__main__":
    main()

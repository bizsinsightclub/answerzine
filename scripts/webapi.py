# -*- coding: utf-8 -*-
"""웹 화면이 부르는 일들 — 설정 저장, 실행, 진행 상황, 결과 조립.

HTTP 처리는 serve.py가 하고, 실제 일은 여기서 한다.
파이프라인 자체는 손대지 않는다. 기존 스크립트를 그대로 하위 프로세스로 부른다.
"""
from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
import sys
import threading
from collections import defaultdict
from pathlib import Path

import llm
from common import ROOT, latest_run, load_config, load_issues, new_run_id

STEPS = ["discover.py", "collect_youtube.py", "extract_vocab.py", "generate.py",
         "filter.py", "pick.py"]
STEP_LABEL = {"discover.py": "이슈 찾기", "collect_youtube.py": "수집",
              "extract_vocab.py": "활성 어휘 추출", "generate.py": "발산",
              "filter.py": "자동 정리", "pick.py": "하나 고르고 글쓰기"}

RUNS: dict[str, dict] = {}
LOCK = threading.Lock()


# ── 현재 상태 ─────────────────────────────────────────

def state() -> dict:
    cfg = load_config()
    return {
        "period": cfg.get("period") or {},
        "issues": [{"id": i["id"], "keyword": i["keyword"],
                    "proper_nouns": i["proper_nouns"], "summary": i["summary"]}
                   for i in load_issues(cfg)],
        "provider": (cfg.get("llm") or {}).get("provider", "claude_agent"),
        "claude_cli": bool(llm.claude_cli_path()),
        "env_keys": {"gemini": bool(os.getenv("GEMINI_API_KEY")),
                     "youtube": bool(os.getenv("YOUTUBE_API_KEY")),
                     "anthropic": bool(os.getenv("ANTHROPIC_API_KEY"))},
        "runs": list_runs(),
        "discover": latest_discover(),
    }


def list_runs() -> list[dict]:
    base = ROOT / "data" / "out"
    if not base.exists():
        return []
    out = []
    for d in sorted((x for x in base.iterdir() if x.is_dir()), key=lambda x: x.name, reverse=True)[:20]:
        n = 0
        p = d / "candidates.csv"
        if p.exists():
            with open(p, encoding="utf-8-sig", newline="") as f:
                n = sum(1 for _ in csv.DictReader(f))
        out.append({"run_id": d.name, "count": n,
                    "has_vocab": (ROOT / "data" / "vocab" / d.name).exists()})
    for d in sorted((ROOT / "data" / "vocab").glob("*"), reverse=True)[:20]:
        if d.is_dir() and not any(r["run_id"] == d.name for r in out):
            out.append({"run_id": d.name, "count": 0, "has_vocab": True})
    return sorted(out, key=lambda r: r["run_id"], reverse=True)[:20]


# ── config.yaml 저장 (주석을 지우지 않도록 해당 블록만 갈아 끼운다) ──

def _q(v) -> str:
    return json.dumps(str(v or ""), ensure_ascii=False)


def _replace_block(text: str, key: str, block: str) -> str:
    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if l.startswith(key + ":")), None)
    if start is None:
        return text.rstrip() + "\n\n" + block + "\n"
    end = start + 1
    while end < len(lines) and (not lines[end].strip() or lines[end][0] in " \t"):
        end += 1
    while end > start + 1 and not lines[end - 1].strip():
        end -= 1
    return "\n".join(lines[:start] + block.splitlines() + lines[end:]) + "\n"


def save_issues(payload: dict) -> dict:
    issues = payload.get("issues") or []
    if not issues:
        raise ValueError("이슈가 하나도 없습니다.")
    seen = set()
    for i, it in enumerate(issues, start=1):
        it["id"] = (it.get("id") or f"issue-{i}").strip() or f"issue-{i}"
        if not (it.get("keyword") or "").strip():
            raise ValueError(f"{it['id']} 의 검색어가 비어 있습니다.")
        if it["id"] in seen:
            raise ValueError(f"이슈 id가 겹칩니다: {it['id']}")
        seen.add(it["id"])

    block = ["issues:"]
    for it in issues:
        pn = ", ".join(_q(w) for w in (it.get("proper_nouns") or []) if str(w).strip())
        block += [f"  - id: {_q(it['id'])}",
                  f"    keyword: {_q(it['keyword'].strip())}",
                  f"    proper_nouns: [{pn}]",
                  f"    summary: {_q(it.get('summary', ''))}"]

    p = ROOT / "config.yaml"
    text = p.read_text(encoding="utf-8")
    period = payload.get("period") or {}
    if period.get("start") or period.get("end"):
        text = _replace_block(text, "period",
                              f"period:\n  start: {_q(period.get('start'))}\n  end: {_q(period.get('end'))}")
    text = _replace_block(text, "issues", "\n".join(block))
    p.write_text(text, encoding="utf-8")
    return state()


# ── 실행 ──────────────────────────────────────────────

def start_run(payload: dict) -> str:
    steps = [s for s in STEPS if s in (payload.get("steps") or STEPS)]
    if not steps:
        raise ValueError("실행할 단계가 없습니다.")

    source = (payload.get("reuse_vocab_from") or "").strip()
    run_id = (payload.get("run_id") or "").strip() or new_run_id()
    if source and source != run_id:
        src = ROOT / "data" / "vocab" / source
        if not src.exists():
            raise ValueError(f"{source} 의 활성 어휘 표가 없습니다.")
        shutil.copytree(src, ROOT / "data" / "vocab" / run_id, dirs_exist_ok=True)

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["IEE_PROVIDER"] = payload.get("provider") or "claude_agent"
    if payload.get("model"):
        env["IEE_MODEL"] = payload["model"]
    if payload.get("effort"):
        env["IEE_EFFORT"] = payload["effort"]
    period = payload.get("discover_period") or {}
    if period.get("start") and period.get("end"):
        env["IEE_DISCOVER_START"] = period["start"]
        env["IEE_DISCOVER_END"] = period["end"]
    for name, var in (("gemini", "GEMINI_API_KEY"), ("youtube", "YOUTUBE_API_KEY"),
                      ("anthropic", "ANTHROPIC_API_KEY")):
        v = (payload.get("keys") or {}).get(name)
        if v:
            env[var] = v  # 키는 하위 프로세스 환경에만 있고 디스크에 쓰지 않는다

    with LOCK:
        RUNS[run_id] = {"lines": [], "done": False, "code": None, "step": ""}
    threading.Thread(target=_worker, args=(run_id, steps, env), daemon=True).start()
    return run_id


def _emit(run_id: str, text: str) -> None:
    with LOCK:
        RUNS[run_id]["lines"].append(text)


def _worker(run_id: str, steps: list[str], env: dict) -> None:
    provider = llm.provider_label(env.get("IEE_PROVIDER", ""))
    _emit(run_id, f"### {run_id} 시작 — {provider}")
    code = 0
    for step in steps:
        with LOCK:
            RUNS[run_id]["step"] = STEP_LABEL.get(step, step)
        _emit(run_id, f"### {STEP_LABEL.get(step, step)}")
        cmd = [sys.executable, "-u", str(ROOT / "scripts" / step), "--run", run_id]
        try:
            proc = subprocess.Popen(cmd, cwd=str(ROOT), env=env, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, text=True,
                                    encoding="utf-8", errors="replace", bufsize=1)
        except Exception as e:
            _emit(run_id, f"### 실행 실패: {e}")
            code = 1
            break
        for line in proc.stdout:
            _emit(run_id, line.rstrip())
        code = proc.wait()
        if code != 0:
            _emit(run_id, f"### {STEP_LABEL.get(step, step)} 에서 멈췄습니다 (코드 {code})")
            break
    _emit(run_id, "### 끝" if code == 0 else "### 중단됨")
    with LOCK:
        RUNS[run_id]["done"] = True
        RUNS[run_id]["code"] = code
        RUNS[run_id]["step"] = ""


def read_stream(run_id: str, frm: int) -> list[dict]:
    """발산 중인 후보를 만들어지는 대로 읽는다."""
    p = ROOT / "data" / "out" / run_id / "stream.jsonl"
    if not p.exists():
        return []
    out = []
    with open(p, encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= frm and line.strip():
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass  # 아직 다 써지지 않은 줄
    return out


def run_status(run_id: str, frm: int, cand_from: int = 0) -> dict:
    cands = read_stream(run_id, cand_from)
    with LOCK:
        r = RUNS.get(run_id)
        base = {"cands": cands, "cand_next": cand_from + len(cands)}
        if not r:
            return {**base, "lines": [], "done": True, "code": None, "step": "", "next": frm}
        return {**base, "lines": r["lines"][frm:], "done": r["done"], "code": r["code"],
                "step": r["step"], "next": len(r["lines"])}


def read_discover(run_id: str) -> dict:
    p = ROOT / "data" / "discover" / f"{run_id}.json"
    if not p.exists():
        return {"run_id": run_id, "issues": []}
    return json.loads(p.read_text(encoding="utf-8"))


def read_pick(run_id: str) -> dict:
    p = ROOT / "data" / "out" / run_id / "pick.json"
    if not p.exists():
        return {}
    data = json.loads(p.read_text(encoding="utf-8"))
    data["run_id"] = run_id
    return data


def latest_discover() -> dict:
    base = ROOT / "data" / "discover"
    files = sorted(base.glob("*.json"), reverse=True) if base.exists() else []
    return json.loads(files[0].read_text(encoding="utf-8")) if files else {"issues": []}


# ── 결과 ──────────────────────────────────────────────

def mech_title(mech: str) -> str:
    hits = sorted((ROOT / "prompts").glob(f"{mech}*.md"))
    if not hits:
        return mech
    return hits[0].read_text(encoding="utf-8").splitlines()[0].lstrip("# ").strip() or mech


def read_result(run_id: str) -> dict:
    p = ROOT / "data" / "out" / run_id / "candidates.csv"
    if not p.exists():
        return {"run_id": run_id, "total": 0, "issues": []}
    with open(p, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    label = {i["id"]: i["keyword"] for i in load_issues(load_config())}
    grouped: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        grouped[r["issue"]][r["mechanism"]].append(r)

    issues = []
    for issue_id, mechs in grouped.items():
        issues.append({
            "id": issue_id,
            "keyword": label.get(issue_id, issue_id),
            "count": sum(len(v) for v in mechs.values()),
            "mechs": [{"id": m, "title": mech_title(m),
                       "items": [{"candidate": x["candidate"], "source_word": x["source_word"],
                                  "active_word": x["active_word"], "one_line": x["one_line"]}
                                 for x in mechs[m]]}
                      for m in sorted(mechs)],
        })
    return {"run_id": run_id, "total": len(rows), "issues": issues}


def latest_result_run() -> str | None:
    return latest_run("out")

# -*- coding: utf-8 -*-
"""공통 도구 — 설정 읽기, 경로, 로그, 외부 호출, JSON 파싱.

모든 스크립트가 이 파일을 함께 쓴다. 여기에는 판단 로직을 넣지 않는다.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# 콘솔이 한글 밖의 기호를 못 찍어도 죽지 않게 한다. 로그 파일은 항상 UTF-8이다.
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass


# ── 설정 ──────────────────────────────────────────────

def load_config(path: str | None = None) -> dict:
    """config.yaml을 읽는다."""
    p = Path(path) if path else ROOT / "config.yaml"
    with open(p, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_issues(cfg: dict, only: str | None = None) -> list[dict]:
    """이슈 목록을 정규화한다. id가 없으면 issue-1 식으로 채운다.

    only 가 주어지면 id 또는 keyword가 일치하는 이슈만 남긴다.
    """
    out = []
    for i, raw in enumerate(cfg.get("issues") or [], start=1):
        item = dict(raw)
        item.setdefault("id", f"issue-{i}")
        item["proper_nouns"] = item.get("proper_nouns") or []
        item["summary"] = (item.get("summary") or "").strip()
        item["source"] = "user"  # 사람이 준 이슈다 (CLAUDE.md 4.1)
        out.append(item)
    if only:
        out = [x for x in out if only in (x["id"], x["keyword"])]
    return out


def new_run_id() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M")


def latest_run(subdir: str) -> str | None:
    """data/{subdir} 아래에서 가장 최근 run 폴더 이름을 돌려준다."""
    base = ROOT / "data" / subdir
    if not base.exists():
        return None
    dirs = sorted((d.name for d in base.iterdir() if d.is_dir()), reverse=True)
    return dirs[0] if dirs else None


def read_prompt(name: str) -> str:
    return (ROOT / "prompts" / name).read_text(encoding="utf-8")


# ── 로그 ──────────────────────────────────────────────

class Log:
    """화면과 runs/{run_id}.log 에 동시에 남긴다."""

    def __init__(self, run_id: str):
        self.path = ROOT / "runs" / f"{run_id}.log"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def __call__(self, msg: str) -> None:
        line = f"[{datetime.now():%m-%d %H:%M:%S}] {msg}"
        print(line, flush=True)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(line + "\n")


# ── 외부 HTTP 호출 ────────────────────────────────────

def http_get(url: str, params: dict, log: Log, label: str = "") -> dict | None:
    """실패하면 3회까지 지수 대기 후 재시도하고, 그래도 안 되면 건너뛴다."""
    for attempt in range(1, 4):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.json()
            # 댓글 사용 중지 같은 정상적인 거절은 재시도해도 소용없다
            if r.status_code in (403, 404):
                log(f"  건너뜀 {label}: HTTP {r.status_code} {r.text[:120]}")
                return None
            raise RuntimeError(f"HTTP {r.status_code} {r.text[:200]}")
        except Exception as e:
            if attempt == 3:
                log(f"  실패 {label}: {e}")
                return None
            wait = 2 ** attempt
            log(f"  재시도 {attempt}/3 {label}: {e} — {wait}초 대기")
            time.sleep(wait)
    return None


# ── LLM 호출 ──────────────────────────────────────────

def llm_call(cfg: dict, system: str, user: str, log: Log, label: str = "",
             want_json: bool = True) -> str | None:
    """제공자 계층(llm.py)에 넘긴다.

    어느 제공자로 도는지는 config.yaml의 llm.provider 와
    환경변수 IEE_PROVIDER / IEE_MODEL 이 정한다. 부르는 쪽은 몰라도 된다.
    """
    import llm
    return llm.call_text(cfg, system, user, log, label, want_json)


_FENCE = re.compile(r"```(?:json)?", re.IGNORECASE)


def parse_json(text: str | None, kind: str = "list"):
    """코드 펜스를 걷어내고 JSON을 파싱한다. 실패하면 None."""
    if not text:
        return None
    s = _FENCE.sub("", text).replace("```", "").strip()
    o, c = ("[", "]") if kind == "list" else ("{", "}")
    if not s.startswith(o):
        a, b = s.find(o), s.rfind(c)
        if a == -1 or b == -1 or b < a:
            return None
        s = s[a:b + 1]
    try:
        v = json.loads(s)
    except json.JSONDecodeError:
        return None
    want = list if kind == "list" else dict
    return v if isinstance(v, want) else None


def call_json(cfg: dict, system: str, user: str, log: Log,
              label: str = "", kind: str = "list"):
    """LLM을 부르고 JSON으로 파싱한다. 파싱 실패 시 1회만 다시 부른다."""
    for tries in range(2):
        text = llm_call(cfg, system, user, log, label)
        data = parse_json(text, kind)
        if data is not None:
            return data
        if tries == 0:
            log(f"  JSON 파싱 실패 {label} — 1회 재시도")
    log(f"  JSON 파싱 최종 실패 {label} — 건너뜀")
    return None

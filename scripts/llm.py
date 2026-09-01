# -*- coding: utf-8 -*-
"""LLM 제공자 계층 — 어느 것을 쓰든 부르는 쪽 코드는 같다.

  claude_agent : 설치된 Claude Code를 그대로 쓴다. 구독으로 돌아가며 API 키가 필요 없다.
  gemini       : 사용자가 발급받은 Gemini API 키로 돈다.
  anthropic    : Anthropic API 키로 돈다 (종량제).

제공자와 모델은 config.yaml에서 읽되, 환경변수(IEE_PROVIDER / IEE_MODEL)가 있으면
그쪽이 이긴다. 웹 화면에서 고른 값을 하위 프로세스로 넘길 때 이 경로를 쓴다.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import requests

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Claude Code에게 도구를 주지 않는다. 글만 받으면 된다.
NO_TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep",
            "WebFetch", "WebSearch", "Task", "NotebookEdit", "TodoWrite"]


class LLMError(Exception):
    """kind: key / quota / model / overload / network / blocked / empty / cli / unknown"""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind


# ── 설정 ──────────────────────────────────────────────

def resolve(cfg: dict) -> tuple[str, dict]:
    """쓸 제공자와 그 제공자의 설정을 고른다."""
    llm = cfg.get("llm") or {}
    provider = os.getenv("IEE_PROVIDER") or llm.get("provider") or "claude_agent"
    settings = dict(llm.get(provider) or {})
    settings["max_tokens"] = llm.get("max_tokens", 16000)
    if os.getenv("IEE_MODEL"):
        settings["model"] = os.getenv("IEE_MODEL")
    if os.getenv("IEE_EFFORT"):
        settings["effort"] = os.getenv("IEE_EFFORT")
    return provider, settings


def provider_label(provider: str) -> str:
    return {"claude_agent": "Claude Code 구독", "gemini": "Gemini API",
            "anthropic": "Anthropic API"}.get(provider, provider)


def claude_cli_path() -> str | None:
    return shutil.which("claude")


# ── 공통 입구 ─────────────────────────────────────────

def call_text(cfg: dict, system: str, user: str, log, label: str = "",
              want_json: bool = True) -> str | None:
    """한 번 물어보고 글을 받는다. 못 받으면 None을 돌려주고 파이프라인은 계속 간다.

    want_json=False 면 JSON이 아니라 그냥 글을 받는다 (칼럼 쓰기 같은 일).
    """
    provider, settings = resolve(cfg)
    fn = {"gemini": _gemini, "claude_agent": _claude_agent, "anthropic": _anthropic}.get(provider)
    if fn is None:
        log(f"  알 수 없는 제공자 '{provider}' — 건너뜀")
        return None

    for attempt in range(1, 4):
        try:
            return fn(settings, system, user, want_json)
        except LLMError as e:
            # 키·할당량·차단은 다시 불러도 결과가 같다. 바로 알린다.
            if e.kind in ("key", "quota", "blocked", "model", "cli"):
                log(f"  중단 {label}: {e}")
                return None
            if attempt == 3:
                log(f"  실패 {label}: {e}")
                return None
            wait = 2 ** attempt
            log(f"  재시도 {attempt}/3 {label}: {e} — {wait}초 대기")
            time.sleep(wait)
        except Exception as e:
            if attempt == 3:
                log(f"  실패 {label}: {e}")
                return None
            time.sleep(2 ** attempt)
    return None


# ── Gemini ────────────────────────────────────────────

def _gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise LLMError("key", "Gemini API 키가 없습니다. 화면에서 키를 넣거나 .env에 적어 주세요.")
    return key


def _gemini_error(status: int, msg: str) -> LLMError:
    if status == 400 and ("API key not valid" in msg or "API_KEY_INVALID" in msg):
        return LLMError("key", "API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.")
    if status == 403:
        return LLMError("key", "API 키 권한 오류입니다. 키가 유효한지, 사용 설정이 되어 있는지 확인해 주세요.")
    if status == 429:
        return LLMError("quota", "무료 사용 할당량을 초과했습니다. 잠시 후 다시 시도하거나 가성비 모델로 바꿔 보세요.")
    if status == 404:
        return LLMError("model", "선택한 모델을 쓸 수 없습니다. 화면에서 다른 모델을 골라 주세요.")
    if status in (500, 503):
        return LLMError("overload", f"모델이 일시적으로 혼잡합니다 (오류 {status}).")
    return LLMError("unknown", f"요청이 실패했습니다 (오류 {status}). {msg}".strip())


def _gemini(settings: dict, system: str, user: str, want_json: bool = True) -> str:
    model = settings.get("model") or "gemini-flash-latest"
    body = {
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {
            "temperature": settings.get("temperature", 1.0),
            "maxOutputTokens": settings.get("max_tokens", 16000),
        },
    }
    if want_json:
        body["generationConfig"]["responseMimeType"] = "application/json"
    try:
        res = requests.post(GEMINI_URL.format(model=model),
                            params={"key": _gemini_key()}, json=body, timeout=300)
    except requests.RequestException:
        raise LLMError("network", "네트워크 오류입니다. 인터넷 연결을 확인해 주세요.")

    if res.status_code != 200:
        msg = ""
        try:
            msg = (res.json().get("error") or {}).get("message", "")
        except Exception:
            pass
        raise _gemini_error(res.status_code, msg)

    data = res.json()
    cand = (data.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") for p in (cand.get("content") or {}).get("parts", []))
    if not text:
        if (data.get("promptFeedback") or {}).get("blockReason") or cand.get("finishReason") == "SAFETY":
            raise LLMError("blocked", "입력이 안전 필터에 걸렸습니다. 이슈나 어휘를 바꿔 다시 시도해 주세요.")
        raise LLMError("empty", "응답이 비어 있습니다.")
    return text


def list_gemini_models(key: str) -> list[dict]:
    """이 키로 실제 쓸 수 있는 모델만 골라 돌려준다. 모델 id를 추측하지 않기 위해서다."""
    try:
        res = requests.get(GEMINI_LIST_URL, params={"key": key, "pageSize": 1000}, timeout=60)
    except requests.RequestException:
        raise LLMError("network", "네트워크 오류입니다. 인터넷 연결을 확인해 주세요.")
    if res.status_code != 200:
        msg = ""
        try:
            msg = (res.json().get("error") or {}).get("message", "")
        except Exception:
            pass
        raise _gemini_error(res.status_code, msg)

    out = []
    for m in res.json().get("models", []):
        name = m.get("name", "")
        if "generateContent" not in (m.get("supportedGenerationMethods") or []):
            continue
        if any(w in name for w in ("embedding", "aqa", "imagen", "veo", "-tts", "image-generation")):
            continue
        out.append({"id": name.replace("models/", ""), "label": m.get("displayName", "")})
    return out


# ── Claude Code 구독 ──────────────────────────────────

def _claude_agent(settings: dict, system: str, user: str, want_json: bool = True) -> str:
    exe = claude_cli_path()
    if not exe:
        raise LLMError("cli", "claude 명령을 찾지 못했습니다. Claude Code가 설치되어 있어야 합니다.")

    # 빈 임시 폴더에서 돌린다. 이 저장소의 CLAUDE.md가 프롬프트에 딸려 들어가지 않게 하기 위해서다.
    with tempfile.TemporaryDirectory() as work:
        sys_file = Path(work) / "system.txt"
        sys_file.write_text(system, encoding="utf-8")
        cmd = [exe, "-p", "--output-format", "json",
               "--system-prompt-file", str(sys_file),
               "--strict-mcp-config", "--disallowed-tools", *NO_TOOLS]
        if settings.get("model"):
            cmd += ["--model", settings["model"]]
        # 생각을 얼마나 오래 할지. 발산은 깊이보다 양과 다양성이 우선이라 낮춰도 된다.
        if settings.get("effort"):
            cmd += ["--effort", settings["effort"]]
        try:
            proc = subprocess.run(cmd, input=user, cwd=work, capture_output=True,
                                  text=True, encoding="utf-8", errors="replace", timeout=900)
        except subprocess.TimeoutExpired:
            raise LLMError("overload", "Claude Code 응답이 15분을 넘겨 중단했습니다.")

    if proc.returncode != 0:
        raise LLMError("cli", f"claude 실행 실패: {(proc.stderr or '').strip()[:300]}")
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise LLMError("unknown", f"claude 출력을 읽지 못했습니다: {proc.stdout[:200]}")
    if data.get("is_error"):
        raise LLMError("unknown", f"claude 오류: {str(data.get('result'))[:300]}")
    text = data.get("result") or ""
    if not text:
        raise LLMError("empty", "응답이 비어 있습니다.")
    return text


# ── Anthropic API (종량제) ────────────────────────────

_client = None


def _anthropic(settings: dict, system: str, user: str, want_json: bool = True) -> str:
    global _client
    if _client is None:
        import anthropic
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise LLMError("key", "ANTHROPIC_API_KEY 가 없습니다. .env 파일을 확인하세요.")
        _client = anthropic.Anthropic()

    kwargs = {
        "model": settings.get("model") or "claude-opus-5",
        "max_tokens": settings.get("max_tokens", 16000),
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if settings.get("effort"):
        kwargs["output_config"] = {"effort": settings["effort"]}
    # 최신 모델과 최신 SDK는 temperature를 다루지 않는다. 값이 있을 때만 우회로로 싣는다.
    if settings.get("temperature") is not None:
        kwargs["extra_body"] = {"temperature": settings["temperature"]}

    with _client.messages.stream(**kwargs) as stream:
        msg = stream.get_final_message()
    return "".join(b.text for b in msg.content if b.type == "text")

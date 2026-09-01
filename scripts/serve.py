# -*- coding: utf-8 -*-
"""로컬 웹 화면을 띄운다. 표준 라이브러리만 쓴다 (새 의존성 없음).

  python scripts/serve.py
  → http://127.0.0.1:8765 이 자동으로 열린다.

바깥에서는 접속되지 않는다. 127.0.0.1 에만 붙는다.
"""
from __future__ import annotations

import argparse
import json
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import llm
import webapi
from common import ROOT

WEB = ROOT / "web"
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8"}


class Handler(BaseHTTPRequestHandler):
    server_version = "IssueEmergence"

    def log_message(self, *args):  # 콘솔은 파이프라인 로그만 보이게 둔다
        pass

    # ── 보내기 ──
    def _json(self, obj, status: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path, mime: str, download: str | None = None) -> None:
        if not path.exists():
            return self._json({"error": "파일이 없습니다."}, 404)
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        if download:
            self.send_header("Content-Disposition",
                             f"attachment; filename*=UTF-8''{download}")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    # ── 라우팅 ──
    def do_GET(self) -> None:
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if u.path in ("/", "/index.html"):
                return self._file(WEB / "index.html", MIME[".html"])
            if u.path in ("/app.js", "/style.css"):
                name = u.path.lstrip("/")
                return self._file(WEB / name, MIME[".js" if name.endswith(".js") else ".css"])
            if u.path == "/api/state":
                return self._json(webapi.state())
            if u.path == "/api/run":
                return self._json(webapi.run_status(q.get("id", [""])[0],
                                                    int(q.get("from", ["0"])[0]),
                                                    int(q.get("cand", ["0"])[0])))
            if u.path == "/api/discover":
                run_id = q.get("id", [""])[0]
                return self._json(webapi.read_discover(run_id) if run_id else webapi.latest_discover())
            if u.path == "/api/pick":
                run_id = q.get("id", [""])[0] or webapi.latest_result_run() or ""
                return self._json(webapi.read_pick(run_id))
            if u.path == "/api/result":
                run_id = q.get("id", [""])[0] or webapi.latest_result_run() or ""
                return self._json(webapi.read_result(run_id))
            if u.path == "/api/download":
                run_id, kind = q.get("id", [""])[0], q.get("kind", ["md"])[0]
                name = {"csv": "candidates.csv", "pick": "pick.md"}.get(kind, "candidates.md")
                mime = "text/csv; charset=utf-8" if kind == "csv" else "text/markdown; charset=utf-8"
                return self._file(ROOT / "data" / "out" / run_id / name, mime,
                                  download=f"{run_id}-{name}")
            self._json({"error": "없는 주소입니다."}, 404)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def do_POST(self) -> None:
        u = urlparse(self.path)
        try:
            if u.path == "/api/issues":
                return self._json(webapi.save_issues(self._body()))
            if u.path == "/api/gemini/models":
                key = (self._body().get("key") or "").strip()
                if not key:
                    return self._json({"error": "키를 먼저 넣어 주세요."}, 400)
                return self._json({"models": llm.list_gemini_models(key)})
            if u.path == "/api/run":
                return self._json({"run_id": webapi.start_run(self._body())})
            if u.path == "/api/discover":
                body = self._body()
                body["steps"] = ["discover.py"]
                return self._json({"run_id": webapi.start_run(body)})
            self._json({"error": "없는 주소입니다."}, 404)
        except llm.LLMError as e:
            self._json({"error": str(e), "kind": e.kind}, 400)
        except ValueError as e:
            self._json({"error": str(e)}, 400)
        except Exception as e:
            self._json({"error": str(e)}, 500)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-open", action="store_true", help="브라우저를 자동으로 열지 않는다")
    args = ap.parse_args()

    # 포트가 이미 쓰이고 있으면 다음 번호로 옮겨 붙는다
    for port in range(args.port, args.port + 10):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    else:
        raise SystemExit(f"{args.port}번부터 10개 포트가 모두 사용 중입니다.")

    url = f"http://127.0.0.1:{port}"
    print(f"화면 주소: {url}   (끄려면 Ctrl+C)")
    if not args.no_open:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")


if __name__ == "__main__":
    main()

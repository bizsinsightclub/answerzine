// 로컬 트렌드 보드 서버.
// 하는 일: (1) app/public 정적 서빙, (2) POST /api/sample — 보드의 window.claude.use("sample")
// 를 대체하는 제네릭 프록시. 프롬프트를 받아 구독제 claude -p(헤드리스)로 돌리고 파싱된 JSON 을 돌려준다.
// API 키 안 씀(§ 구독제). 순위·항목 텍스트는 보드가 만들고 서버는 손대지 않는다(§7).
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(HERE, "public");
const PORT = process.env.PORT || 5178;
const CONCURRENCY = Number(process.env.TREND_CONCURRENCY || 3);
// opts.modelTier → 모델. complex 는 품질 우선.
const MODEL = { complex: process.env.TREND_MODEL || "claude-sonnet-5", fast: "claude-haiku-4-5" };
const SYSTEM =
  "너는 대한민국 소비 트렌드 애널리스트다. 주어진 지시대로 학습된 배경지식만으로 분석해 JSON 만 출력한다. " +
  "도구·웹검색·파일접근을 절대 쓰지 말고 즉시 답하라. 순위·항목 텍스트는 고치지 않는다.";

// ── 동시 실행 게이트: claude.exe 는 무거우니 N개까지만 ──────────────────
let active = 0;
const waiters = [];
async function gate() {
  if (active >= CONCURRENCY) await new Promise((r) => waiters.push(r));
  active++;
}
function release() {
  active--;
  waiters.shift()?.();
}

// result 텍스트에서 JSON(배열 또는 객체)만 꺼낸다.
function extractJSON(result) {
  const s = String(result || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!m) throw new Error("JSON 없음: " + s.slice(0, 200));
  return JSON.parse(m[0]);
}

function runClaude(prompt, model) {
  return new Promise((resolve, reject) => {
    const args = ["-p", prompt, "--model", model, "--system-prompt", SYSTEM, "--output-format", "json"];
    const cp = spawn("claude", args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    cp.stdout.on("data", (d) => (out += d));
    cp.stderr.on("data", (d) => (err += d));
    cp.on("error", reject);
    cp.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${(err || out).slice(0, 300)}`));
      try {
        const j = JSON.parse(out);
        if (j.is_error) return reject(new Error(j.subtype || "claude error"));
        resolve(extractJSON(j.result));
      } catch (e) { reject(new Error(`parse: ${e.message} | ${out.slice(0, 200)}`)); }
    });
  });
}

async function sample(prompt, opts) {
  const model = MODEL[opts?.modelTier] || MODEL.complex;
  await gate();
  try { return await runClaude(prompt, model); }
  finally { release(); }
}

// ── HTTP ────────────────────────────────────────────────────────────
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const file = normalize(join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return res.writeHead(403).end("no");
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404).end("not found"); }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/api/sample") {
    try {
      const { prompt, opts } = JSON.parse((await readBody(req)).toString("utf8"));
      if (!prompt) throw new Error("prompt 없음");
      const data = await sample(prompt, opts);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  serveStatic(req, res);
});

// CLI 셀프테스트: node server.mjs --test  → 프롬프트 한 번 돌려본다
if (process.argv.includes("--test")) {
  const r = await sample("항목 '골든 - 헌트릭스'(음악 1위)가 왜 떴는지 {\"headline\":string,\"reasons\":[string]} JSON 으로만.", { modelTier: "complex" });
  console.log("샘플 응답:", JSON.stringify(r, null, 2).slice(0, 400));
  process.exit(0);
}

server.listen(PORT, () => console.log(`트렌드 보드 로컬 서버 → http://localhost:${PORT}  (동시성 ${CONCURRENCY}, 모델 ${MODEL.complex})`));

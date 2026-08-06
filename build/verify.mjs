#!/usr/bin/env node
/**
 * 빌드 산출물 검증.
 *
 * tools/qa.mjs가 "입력"(issues/*.json)을 검사한다면, 여기는 "출력"(dist/)을 검사한다.
 * CLAUDE.md §8에서 [자동]이라 표기됐지만 실제로는 구현되지 않았던 항목들이다.
 *
 *   #14 콘솔 에러 0건        → 헤드리스로 실측
 *   #15 A4 정확히 1페이지    → 헤드리스 PDF 렌더 후 /Type /Page 카운트
 *   #17 인쇄·웹 문자열 일치  → 같은 값을 참조하므로 검사가 필요 없다. 그래도 확인한다.
 *
 * Playwright가 없으면 브라우저 검사는 건너뛰되 그 사실을 출력한다.
 * node_modules 없이 클론한 사람도 링크·이스케이프 검사는 받을 수 있어야 한다.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

import { loadIssues, loadRegistry, allStories } from "./lib/data.mjs";
import { cmapSet, FONTS, usedCharset, UI_CHARS } from "./lib/assets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

const C = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", x: "\x1b[0m" };
let fails = 0;
let warns = 0;
const fail = (where, msg) => { fails++; console.log(`${C.r}  ✕ ${C.x}${where}  ${msg}`); };
const warn = (where, msg) => { warns++; console.log(`${C.y}  ! ${C.x}${where}  ${msg}`); };
const ok = (msg) => console.log(`${C.g}  ✓ ${C.x}${msg}`);
const head = (t) => console.log(`\n${C.d}── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}${C.x}`);

if (!existsSync(DIST)) {
  console.error("dist/가 없다. 먼저 `node build/build.mjs`를 실행한다.");
  process.exit(1);
}

const htmlFiles = [];
(function walk(d) {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".html")) htmlFiles.push(p);
  }
})(DIST);

/* ══════════════ 1. 내부 링크 ══════════════ */
head("내부 링크");
{
  const broken = [];
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
      const t = m[1];
      const cands = t.endsWith("/") ? [join(DIST, t, "index.html")] : [join(DIST, t), join(DIST, t, "index.html")];
      if (!cands.some(existsSync)) broken.push(`${file.replace(DIST, "")} → ${t}`);
    }
  }
  if (broken.length) for (const b of broken) fail("링크", b);
  else ok(`HTML ${htmlFiles.length}개의 내부 링크 전부 해석됨`);
}

/* ══════════════ 2. 이스케이프 ══════════════ */
head("이스케이프");
{
  // 본문 텍스트에서 나올 수 없는 태그가 렌더됐는지 본다.
  const suspicious = /<script>alert|<img src=x|javascript:/i;
  let bad = 0;
  for (const file of htmlFiles) {
    if (suspicious.test(readFileSync(file, "utf8"))) { fail("이스케이프", file.replace(DIST, "")); bad++; }
  }
  // onclick 보간이 부활하지 않았는지 확인 (§9.7)
  for (const file of htmlFiles) {
    if (/onclick=/.test(readFileSync(file, "utf8"))) { fail("이벤트", `${file.replace(DIST, "")}에 onclick이 있다. 이벤트 위임을 쓴다.`); bad++; }
  }
  if (!bad) ok("이스케이프 누락·onclick 보간 없음");
}

/* ══════════════ 3. 서브셋 폰트 커버리지 ══════════════ */
head("폰트 커버리지");
{
  const charset = usedCharset(loadIssues(ROOT), UI_CHARS);
  let bad = 0;
  for (const f of FONTS) {
    const p = join(DIST, "assets/fonts", f.file);
    if (!existsSync(p)) { fail("폰트", `${f.file}이 dist에 없다.`); bad++; continue; }
    const set = cmapSet(readFileSync(p));
    const missing = [...charset].filter((c) => c.codePointAt(0) > 32 && !set.has(c.codePointAt(0)));
    if (missing.length) { fail("폰트", `${f.file}에 없는 글자 ${missing.length}개: ${missing.slice(0, 20).join("")}`); bad++; }
  }
  if (!bad) ok(`폰트 ${FONTS.length}벌이 본문 ${charset.size}자를 전부 담는다 (두부 없음)`);
}

/* ══════════════ 4. 인쇄·웹 문자열 일치 (§8 #17) ══════════════ */
head("인쇄·웹 문자열 일치");
{
  const registry = loadRegistry(ROOT);
  const issues = loadIssues(ROOT);
  const stories = allStories(issues, registry);
  let bad = 0;
  for (const issue of issues) {
    const p = join(DIST, issue.issue, "print", "index.html");
    if (!existsSync(p)) continue;
    const html = readFileSync(p, "utf8");
    for (const s of stories.filter((x) => x.issue.issue === issue.issue).slice(0, 4)) {
      const esc = s.headline.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      if (!html.includes(esc)) { fail("진", `${issue.issue} 지면에 "${s.headline}"이 없다.`); bad++; }
    }
  }
  if (!bad) ok("진의 헤드라인이 회차 정본과 일치 (같은 값을 참조하므로 구조적으로 보장)");
}

/* ══════════════ 5. 브라우저 검사 ══════════════ */
head("브라우저 검사 (A4 페이지 수 · 콘솔 에러)");

let chromium = null;
try { ({ chromium } = await import("playwright")); } catch { /* 선택 의존성 */ }

if (!chromium) {
  warn("건너뜀", "playwright가 없다. `npm install`로 설치하면 A4 페이지 수와 콘솔 에러를 실측한다.");
} else {
  const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
    ".ttf": "font/ttf", ".otf": "font/otf" };
  const server = createServer((req, res) => {
    let f = join(DIST, decodeURIComponent(req.url.split("?")[0]));
    try {
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
      if (!existsSync(f)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" });
      res.end(readFileSync(f));
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  try {
    const issues = loadIssues(ROOT);

    /* --- A4 페이지 수 (§8 #15) --- */
    for (const issue of issues) {
      const page = await browser.newPage();
      await page.goto(`${base}/${issue.issue}/print/`, { waitUntil: "networkidle" });
      const buf = await page.pdf({
        format: "A4", printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      });
      const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
      if (pages === 1) ok(`${issue.issue} 인쇄 — A4 정확히 1페이지`);
      else fail("A4", `${issue.issue} 인쇄가 ${pages}페이지다. 1페이지여야 한다 — design.md §4.3`);

      const used = await page.evaluate(() => {
        const z = document.querySelector(".zine-page");
        return z ? Math.round(z.getBoundingClientRect().height) : 0;
      });
      if (used > 1123) warn("A4", `${issue.issue} 지면 높이 ${used}px > 1123px`);
      await page.close();
    }

    /* --- 콘솔 에러 (§8 #14) --- */
    const targets = ["/", ...issues.flatMap((i) => [`/${i.issue}/`, `/${i.issue}/print/`])];
    let consoleBad = 0;
    for (const t of targets) {
      const page = await browser.newPage();
      const errs = [];
      page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
      page.on("pageerror", (e) => errs.push(e.message));
      page.on("requestfailed", (r) => errs.push(`요청 실패 ${r.url()}`));
      await page.goto(base + t, { waitUntil: "networkidle" });
      if (errs.length) { fail("콘솔", `${t} — ${errs.join(" / ")}`); consoleBad++; }
      await page.close();
    }
    if (!consoleBad) ok(`페이지 ${targets.length}개 콘솔 에러 0건`);

    /* --- 반응형: 가로 스크롤 없음 --- */
    let overflow = 0;
    for (const w of [375, 768, 1280, 1920]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      await page.goto(`${base}/2026-w31/book/`, { waitUntil: "networkidle" });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w + 1) { fail("반응형", `${w}px에서 가로 스크롤 발생 (scrollWidth ${sw})`); overflow++; }
      await page.close();
    }
    if (!overflow) ok("375 / 768 / 1280 / 1920px에서 가로 넘침 없음");
  } finally {
    await browser.close();
    server.close();
  }
}

/* ══════════════ 결과 ══════════════ */
console.log();
if (fails) {
  console.log(`${C.r}실패 ${fails}건${C.x}${warns ? `, 경고 ${warns}건` : ""} — 발행할 수 없다.`);
  process.exit(1);
}
console.log(`${C.g}산출물 검증 통과${C.x}${warns ? ` (경고 ${warns}건)` : ""}`);

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
import { setBase } from "./lib/site.mjs";

/** 빌드와 같은 규칙으로 정규화한다. "answerzine" → "/answerzine" */
const BASE = setBase(process.env.BASE_PATH ?? "");

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
  // 기본 경로로 빌드했다면 링크에 접두사가 붙어 있다. 벗기고 해석한다.
  // 정규화는 site.mjs의 setBase와 같은 규칙을 써야 한다 — 앞 슬래시 유무로 어긋나면 안 된다.
  const strip = (t) => (BASE && t.startsWith(BASE + "/") ? t.slice(BASE.length) : t);

  const broken = [];
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
      const t = strip(m[1]);
      const cands = t.endsWith("/") ? [join(DIST, t, "index.html")] : [join(DIST, t), join(DIST, t, "index.html")];
      if (!cands.some(existsSync)) broken.push(`${file.replace(DIST, "")} → ${m[1]}`);
    }
  }
  if (broken.length) for (const b of broken) fail("링크", b);
  else ok(`HTML ${htmlFiles.length}개의 내부 링크 전부 해석됨${BASE ? ` (기본 경로 ${BASE})` : ""}`);

  /* og:image는 절대 URL이라 위 검사(`/`로 시작하는 것만)에 안 걸린다.
     그런데 여기가 깨지면 사이트는 멀쩡한 채로 링크 미리보기만 죽고,
     화면을 아무리 봐도 발견되지 않는다. 절대 URL을 벗겨 실제 파일을 확인한다. */
  const ogBroken = [];
  let ogChecked = 0;
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/<meta (?:property|name)="(?:og:image|twitter:image)" content="([^"]+)"/g)) {
      ogChecked++;
      const src = m[1];
      if (!/^https?:\/\//.test(src)) {
        ogBroken.push(`${file.replace(DIST, "")} → 절대 URL이 아니다: ${src}`);
        continue;
      }
      const path = strip(new URL(src).pathname);
      if (!existsSync(join(DIST, path)))
        ogBroken.push(`${file.replace(DIST, "")} → ${src} (dist${path} 없음)`);
    }
  }
  if (!ogChecked) fail("미리보기", "og:image가 어느 페이지에도 없다. 링크가 맨몸으로 공유된다.");
  else if (ogBroken.length) for (const b of ogBroken) fail("미리보기", b);
  else ok(`og:image·twitter:image ${ogChecked}건이 실재하는 파일을 가리킨다`);

  // CSS의 폰트 경로도 확인한다. 여기가 깨지면 폴백 서체로 조용히 렌더된다.
  const css = readFileSync(join(DIST, "assets/style.css"), "utf8");
  const cssBroken = [];
  for (const m of css.matchAll(/url\("([^"]+)"\)/g)) {
    const t = strip(m[1]);
    if (t.startsWith("/") && !existsSync(join(DIST, t))) cssBroken.push(m[1]);
  }
  if (cssBroken.length) for (const b of cssBroken) fail("폰트 경로", `style.css → ${b}`);
  else ok("스타일시트의 폰트 경로 전부 해석됨");
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

/* 2026-08-10 — 자체 호스팅 폰트를 걷어내고 시스템 헬베티카로 바꾸면서 "서브셋 폰트
   커버리지"(두부 검사) 항목을 없앴다. 시스템/OS 내장 폰트(Apple SD Gothic Neo·맑은 고딕
   등)는 한글 11,172자를 전부 담고 있어 서브셋 누락으로 인한 두부 자체가 구조적으로
   불가능하다 — 검사할 대상이 없어졌다. */

/* ══════════════ 3. 인쇄·웹 문자열 일치 (§8 #17) ══════════════ */
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

/* ══════════════ 4. 브라우저 검사 ══════════════ */
head("브라우저 검사 (A4 페이지 수 · 콘솔 에러)");

let chromium = null;
try { ({ chromium } = await import("playwright")); } catch { /* 선택 의존성 */ }

if (!chromium) {
  warn("건너뜀", "playwright가 없다. `npm install`로 설치하면 A4 페이지 수와 콘솔 에러를 실측한다.");
} else {
  const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
    ".ttf": "font/ttf", ".otf": "font/otf",
    ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
  const server = createServer((req, res) => {
    // GitHub Pages가 /<저장소명>/ 접두사를 벗겨 서빙하는 것과 같게 맞춘다.
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length) || "/";
    let f = join(DIST, p);
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

  const browser = await chromium.launch({
    // 환경에 이미 깔린 크로미움을 쓰고 싶을 때 경로를 지정할 수 있다.
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  try {
    const issues = loadIssues(ROOT);
    const stories = allStories(issues, loadRegistry(ROOT));

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

    /* --- DIY 진(8쪽 미니 진) 인쇄 — 랜드스케이프 A4, 4장(양면 2매) ---
       2026-08-11 사용자 보고 "Print를 누르면 세로로 최적화된다" — @page 랜드스케이프
       키워드 누락이 원인이었다(css.mjs ZINEBOOK 참고). preferCSSPageSize:true로
       페이지 자체의 @page CSS가 실제로 적용되는지 실측한다(format을 강제하지 않는다
       — 그러면 이 버그를 재현하지 못한다). 이 검사가 없으면 같은 회귀가 다시 조용히
       들어와도 아무도 못 잡는다. */
    if (issues.length) {
      const page = await browser.newPage();
      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      const buf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      const str = buf.toString("latin1");
      const mb = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(str);
      const pageCount = (str.match(/\/Type\s*\/Page[^s]/g) || []).length;
      if (!mb) fail("ZINE", "DIY 진 인쇄 PDF에서 MediaBox를 못 읽었다.");
      else {
        const w = parseFloat(mb[3]) - parseFloat(mb[1]);
        const h = parseFloat(mb[4]) - parseFloat(mb[2]);
        if (w <= h) fail("ZINE", `DIY 진이 세로로 나온다(${(w/72*25.4).toFixed(1)}×${(h/72*25.4).toFixed(1)}mm) — landscape 키워드가 빠졌을 수 있다.`);
        else ok(`DIY 진 인쇄 — 랜드스케이프 A4 (${(w/72*25.4).toFixed(1)}×${(h/72*25.4).toFixed(1)}mm)`);
      }
      if (pageCount !== 4) fail("ZINE", `DIY 진이 ${pageCount}페이지다. 물리 시트 4장(2장 양면)이어야 한다.`);
      else ok("DIY 진 인쇄 — 4페이지(물리 A4 2장 양면)");

      /* 2026-08-11 — 기사 페이지가 웹과 같은 전체 5블록 콘텐츠를 담게 되면서, 다음 주
         스토리가 이번 주보다 길면 `.zb-panel`의 overflow:hidden이 소리 없이 내용을
         자른다. 그리드 미리보기(화면)에서 각 패널의 실제 자식 콘텐츠 높이가 사용
         가능한 높이를 넘는지 실측한다 — design.md의 A4 지면 실측과 같은 원칙이다.
         오버레이가 hidden인 채면 .zb-grid 안이 전부 display:none이라 높이가 0으로
         읽힌다 — 먼저 열어야 한다. */
      await page.click(".category-divider");
      await page.waitForTimeout(150);
      const clip = await page.evaluate(() => {
        const panels = [...document.querySelectorAll(".zb-grid .zb-panel")];
        return panels
          .map((p) => {
            const cs = getComputedStyle(p);
            const available = p.clientHeight - parseFloat(cs.paddingBottom);
            let contentBottom = 0;
            for (const child of p.children) {
              // 표지의 zb-wrap-viewport처럼 의도적으로 패딩 박스 전체에 bleed하는(position:
              // absolute + inset:0) 자식은 제외한다 — 그 자신의 overflow:hidden으로 이미
              // 패널 경계에 갇혀 있어 흐름 기반 넘침 계산에 넣으면 항상 헛경고(paddingBottom
              // 만큼)가 뜬다. 일반 흐름(static/relative) 자식만 실제 텍스트 누적 높이를 잰다.
              if (getComputedStyle(child).position === "absolute") continue;
              const b = child.offsetTop + child.offsetHeight;
              if (b > contentBottom) contentBottom = b;
            }
            return { label: p.querySelector("h2")?.textContent ?? p.className, over: Math.round(contentBottom - available) };
          })
          .filter((r) => r.over > 2); // 서브픽셀 반올림 오차 허용
      });
      if (clip.length) for (const c of clip) fail("ZINE", `"${c.label}" 콘텐츠가 페이지보다 ${c.over}px 길어 잘린다.`);
      else ok("DIY 진 8쪽 전부 — 콘텐츠가 페이지 안에 들어간다 (overflow:hidden에 잘리지 않음)");

      /* 2026-08-13 — 표지 랩어라운드 캔버스(THE/ANSWER/MAGAZINE) 회귀 검사.
         render-zinebook.mjs의 문구가 바뀌면(예: MAGAZINE→더 긴 단어) 공유
         font-size(css.mjs .zb-wrap-word)가 새 최장 단어를 캔버스(1122px) 안에
         못 담아 양 끝이 통째로 유실되는 사고가 실제로 있었다 — 재발 방지.
         display:inline-block으로 바꿔 block 스트레치를 없앤 뒤 offsetWidth로
         고유 폭을 재는 것이 핵심이다(scrollWidth는 이미 박스에 맞춰 클램프돼
         있어 캔버스보다 좁은 경우를 구분 못 한다). */
      const wrapOverflow = await page.evaluate(() => {
        const canvas = document.querySelector('.zb-tile-face[data-zb-page="cover-front"] .zb-wrap-canvas');
        if (!canvas) return [];
        const words = [...canvas.querySelectorAll(".zb-wrap-word")];
        return words
          .map((w) => {
            const prevDisplay = w.style.display;
            w.style.display = "inline-block";
            const width = w.offsetWidth;
            w.style.display = prevDisplay;
            return { text: w.textContent.trim(), width, over: Math.round(width - 1122) };
          })
          .filter((r) => r.over > 0);
      });
      if (wrapOverflow.length)
        for (const w of wrapOverflow)
          fail("ZINE", `표지 랩어라운드 "${w.text}"가 캔버스보다 ${w.over}px 넓어 양 끝이 잘린다 — css.mjs .zb-wrap-word font-size를 줄여라.`);
      else ok("DIY 진 표지 — THE/ANSWER/MAGAZINE 전부 랩어라운드 캔버스 안에 들어간다 (잘림 없음)");

      /* --- 스티커 드래그앤드롭 (2026-08-12 일곱 번째 라운드) ---
         실측으로 찾은 회귀: 스티커를 놓는 순간 컨테이너 쿼리 컨테이너(.zb-tile-face)에
         자식이 추가되면서, 그 직후 발생하는 합성 click 이벤트의 e.target이 타일이
         아니라 배경 overlay로 잡혀 "바깥 클릭 시 닫기" 핸들러가 오버레이를 닫아버렸다
         (assets/zinebook.js의 suppressOverlayCloseOnce 주석 참고). 실제 마우스
         드래그(elementFromPoint 기반 hit-test까지 재현하려면 page.mouse가 필요하다 —
         evaluate로 직접 이벤트를 dispatch하면 이 클래스의 버그를 재현 못 한다)로 매
         빌드마다 재확인한다. */
      const chip = await page.$('.zb-sticker-chip[data-zb-sticker="circle-red"]');
      const tile = await page.$('.zb-tile-face[data-zb-page="cover-front"]');
      if (!chip || !tile) {
        fail("ZINE", "스티커 팔레트 또는 표지 타일을 못 찾았다.");
      } else {
        const chipBox = await chip.boundingBox();
        const tileBox = await tile.boundingBox();
        const startX = chipBox.x + chipBox.width / 2;
        const startY = chipBox.y + chipBox.height / 2;
        const endX = tileBox.x + tileBox.width * 0.3;
        const endY = tileBox.y + tileBox.height * 0.3;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 5 });
        await page.mouse.move(endX, endY, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(150);

        const result = await page.evaluate(() => ({
          overlayHidden: document.querySelector("[data-zb-overlay]").hidden,
          inGrid: document.querySelectorAll('.zb-tile-face[data-zb-page="cover-front"] .zb-sticker').length,
          inPrint: document.querySelectorAll('.zb-half[data-zb-page="cover-front"] .zb-sticker').length,
        }));
        if (result.overlayHidden) fail("ZINE", "스티커를 놓자 오버레이가 닫혔다 — 클릭 오탐지 회귀.");
        else if (result.inGrid !== 1) fail("ZINE", `스티커가 그리드 타일에 안 놓였다(${result.inGrid}개).`);
        else if (result.inPrint !== 1) fail("ZINE", `스티커가 인쇄 시트에 미러링 안 됐다(${result.inPrint}개).`);
        else ok("DIY 진 스티커 — 드래그로 놓으면 그리드·인쇄 시트 양쪽에 반영되고 오버레이는 안 닫힌다");
      }

      await page.close();
    }

    /* --- 콘솔 에러 (§8 #14) ---
       2026-08-08부터 회차 목록 페이지(/YYYY-wNN/)가 없다 — 홈과 인쇄 진, 그리고 스토리
       페이지 전체를 대신 방문한다(예전에는 스토리 페이지가 이 목록에 아예 없었다). */
    const targets = ["/", ...issues.map((i) => `/${i.issue}/print/`), ...stories.map((s) => s.url)];
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

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "../build/build.mjs";
import { hangulCoverage, FONTS, usedCharset, UI_CHARS, cmapSet } from "../build/lib/assets.mjs";
import { loadIssues } from "../build/lib/data.mjs";

const OUT = "dist-test";
let result;

before(async () => {
  rmSync(OUT, { recursive: true, force: true });
  result = await build({ root: ".", out: OUT, quiet: true });
});

test("빌드가 기대한 파일을 만든다", () => {
  for (const p of ["index.html", "404.html", "assets/style.css", "assets/app.js",
                   "assets/img/favicon.svg",
                   "2026-w31/index.html", "2026-w31/book/index.html", "2026-w31/print/index.html"]) {
    assert.ok(existsSync(join(OUT, p)), `${p} 없음`);
  }
});

test("회수된 영화 편은 어디에도 없다", () => {
  for (const f of ["index.html", "2026-w31/index.html", "2026-w31/print/index.html"]) {
    const html = readFileSync(join(OUT, f), "utf8");
    assert.ok(!html.includes("매진, 또 매진."), `${f}에 회수된 영화 편이 있다`);
  }
});

test("모든 페이지에 파비콘 링크가 있다 — 콘솔 404 방지", () => {
  assert.ok(existsSync(join(OUT, "assets/img/favicon.svg")));
  for (const f of ["index.html", "2026-w31/book/index.html"])
    assert.match(readFileSync(join(OUT, f), "utf8"), /rel="icon"/);
});

test("인쇄 페이지에 statement-wrap이 없다", () => {
  const html = readFileSync(join(OUT, "2026-w31/print/index.html"), "utf8");
  assert.ok(!html.includes("statement-wrap"));
});

test("스토리 페이지의 이전/다음이 시간을 거스르지 않는다 — §9.2", () => {
  // 배열은 최신순: w31-book, w31-youtube, w27-music
  const html = readFileSync(join(OUT, "2026-w31/youtube/index.html"), "utf8");
  const prevIdx = html.indexOf('class="nav-prev"');
  const nextIdx = html.indexOf('class="nav-next"');
  assert.ok(prevIdx > -1 && nextIdx > -1 && prevIdx < nextIdx);
  // prev는 더 옛날인 w27-music, next는 더 최근인 w31-book이어야 한다
  const prevPart = html.slice(prevIdx, nextIdx);
  const nextPart = html.slice(nextIdx, html.indexOf("</nav>", nextIdx));
  assert.match(prevPart, /2026-w27\/music/, "prev가 더 옛날 회차를 가리켜야 한다");
  assert.match(nextPart, /2026-w31\/book/, "next가 더 최근 회차를 가리켜야 한다");
});

test("draft 회차 페이지는 noindex다", () => {
  assert.match(readFileSync(join(OUT, "2026-w31/index.html"), "utf8"), /noindex/);
});

test("내부 링크가 전부 실제 파일로 해석된다", () => {
  const htmls = [];
  const walk = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith(".html")) htmls.push(p);
    }
  };
  walk(OUT);
  assert.ok(htmls.length >= 8);

  const broken = [];
  for (const file of htmls) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
      const target = m[1];
      const candidates = target.endsWith("/")
        ? [join(OUT, target, "index.html")]
        : [join(OUT, target), join(OUT, target, "index.html")];
      if (!candidates.some(existsSync)) broken.push(`${file} → ${target}`);
    }
  }
  assert.deepEqual(broken, [], `깨진 내부 링크:\n${broken.join("\n")}`);
});

test("렌더된 HTML에 이스케이프 누락이 없다", () => {
  // 본문에 원시 <script>alert 같은 게 남아 있으면 실패
  for (const f of ["index.html", "2026-w31/book/index.html"]) {
    const html = readFileSync(join(OUT, f), "utf8");
    assert.ok(!/<script>alert/.test(html));
  }
});

test("서브셋 폰트가 본문의 모든 글자를 담는다 — 두부 방지", () => {
  const charset = usedCharset(loadIssues("."), UI_CHARS);
  for (const f of FONTS) {
    const p = join(OUT, "assets/fonts", f.file);
    if (!existsSync(p)) continue;
    const set = cmapSet(readFileSync(p));
    const missing = [...charset].filter((c) => {
      const cp = c.codePointAt(0);
      // 공백·개행은 폰트가 없어도 된다
      return cp > 32 && !set.has(cp);
    });
    assert.deepEqual(missing, [], `${f.file}에 없는 글자: ${missing.join("")}`);
  }
});

test("빌드 경고는 실제 데이터 문제만 담는다", () => {
  // 지금은 draft 회차의 미니 슬롯 부족만 있어야 한다
  for (const w of result.warnings) {
    assert.match(w, /미니 슬롯|리드 스토리가 없다/, `예상 못한 경고: ${w}`);
  }
});

test("필수 폰트가 없으면 빌드가 실패한다 — 폴백 렌더 방지", async () => {
  // 폰트 없이 만들어진 사이트는 폴백 서체로 조용히 나간다. 경고가 아니라 실패여야 한다.
  const empty = "dist-test-nofonts";
  rmSync(empty, { recursive: true, force: true });
  await assert.rejects(
    () => build({ root: "test/fixtures/no-fonts", out: empty, quiet: true }),
    /필수 폰트가 없다|no such file|ENOENT/,
  );
  rmSync(empty, { recursive: true, force: true });
});

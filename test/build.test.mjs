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
  // base를 명시한다. build()의 기본값은 process.env.BASE_PATH라, 배포 스크립트처럼
  // 환경변수가 설정된 상태에서 돌리면 링크에 접두사가 붙어 이 파일의 검사가 어긋난다.
  // 접두사 동작은 test/site.test.mjs가 따로 검사한다.
  result = await build({ root: ".", out: OUT, quiet: true, base: "" });
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

test("스토리 페이지의 이전/다음이 시간을 거스르지 않는다 — §9.2", async () => {
  // 특정 스토리에 묶지 않는다. 콘텐츠가 바뀌어도 규칙 자체를 검사해야 한다.
  const { loadIssues, loadRegistry, allStories, neighbors } = await import("../build/lib/data.mjs");
  const list = allStories(loadIssues("."), loadRegistry("."));
  assert.ok(list.length >= 2, "스토리가 2편 이상이어야 의미 있는 검사가 된다");

  for (const s of list) {
    const html = readFileSync(join(OUT, `${s.issue.issue}/${s.slug}/index.html`), "utf8");
    const pi = html.indexOf('class="nav-prev"');
    const ni = html.indexOf('class="nav-next"');
    assert.ok(pi > -1 && ni > -1 && pi < ni, `${s.id}: 내비 블록이 없다`);

    const { prev, next } = neighbors(list, s.id);
    const prevPart = html.slice(pi, ni);
    const nextPart = html.slice(ni, html.indexOf("</nav>", ni));

    if (prev) assert.ok(prevPart.includes(prev.url), `${s.id}: prev가 ${prev.url}이어야 한다`);
    else assert.match(prevPart, /이전 회차 없음/, `${s.id}: prev가 없어야 한다`);

    if (next) assert.ok(nextPart.includes(next.url), `${s.id}: next가 ${next.url}이어야 한다`);
    else assert.match(nextPart, /다음 회차 없음/, `${s.id}: next가 없어야 한다`);
  }
});

test("이웃 관계가 실제로 시간순이다 — §9.2", async () => {
  const { loadIssues, loadRegistry, allStories, neighbors, parseRange } = await import("../build/lib/data.mjs");
  const list = allStories(loadIssues("."), loadRegistry("."));
  for (const s of list) {
    const { prev, next } = neighbors(list, s.id);
    const t = parseRange(s.range).start;
    if (prev) assert.ok(parseRange(prev.range).start <= t, `${s.id}의 prev(${prev.id})가 더 최근이다`);
    if (next) assert.ok(parseRange(next.range).start >= t, `${s.id}의 next(${next.id})가 더 옛날이다`);
  }
});

test("draft 회차는 noindex고, 발행된 회차는 색인된다", async () => {
  // 특정 회차를 못 박으면 그 회차가 발행되는 날 테스트가 거짓으로 실패한다.
  // 검사할 것은 "w31이 draft인가"가 아니라 status가 색인 여부를 정하는가다.
  const { loadIssues } = await import("../build/lib/data.mjs");
  const issues = loadIssues(".");
  let checked = 0;
  for (const iss of issues) {
    const html = readFileSync(join(OUT, iss.issue, "index.html"), "utf8");
    if (iss.status === "draft") assert.match(html, /noindex/, `${iss.issue}는 draft인데 색인된다`);
    else assert.ok(!html.includes("noindex"), `${iss.issue}는 발행됐는데 noindex가 걸려 있다`);
    checked++;
  }
  assert.ok(checked >= 1, "검사할 회차가 없다");
  // draft 표본이 있어야 한다고 못 박으면, 전부 발행된 좋은 상태에서 테스트가 실패한다.
  // 검사할 것은 표본의 존재가 아니라 status와 색인 여부가 늘 붙어 다니는가다.
});

test("작업 중 배지는 draft 회차에만 붙는다", async () => {
  // 배지와 noindex는 같은 신호(status)에서 나와야 한다. 갈리면 독자가 보는 상태와
  // 검색엔진이 보는 상태가 달라진다.
  const { loadIssues } = await import("../build/lib/data.mjs");
  for (const iss of loadIssues(".")) {
    const html = readFileSync(join(OUT, iss.issue, "index.html"), "utf8");
    const badged = html.includes("작업 중");
    assert.equal(badged, iss.status === "draft", `${iss.issue}: 배지(${badged})와 status(${iss.status})가 어긋난다`);
  }
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

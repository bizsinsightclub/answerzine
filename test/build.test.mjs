import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { build } from "../build/build.mjs";

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
  for (const p of ["index.html", "archive/index.html", "about/index.html", "404.html",
                   "assets/style.css", "assets/app.js", "assets/img/favicon.svg",
                   "2026-w31/book/index.html", "2026-w31/print/index.html"]) {
    assert.ok(existsSync(join(OUT, p)), `${p} 없음`);
  }
});

test("전체 아카이브 페이지에 모든 스토리가 나온다", () => {
  const html = readFileSync(join(OUT, "archive/index.html"), "utf8");
  for (const s of result.stories) assert.ok(html.includes(s.headline), `${s.headline} 누락`);
});

test("About 페이지가 편집 명제(태그라인)를 낸다", () => {
  const html = readFileSync(join(OUT, "about/index.html"), "utf8");
  assert.ok(html.includes("순위 말고, 팔린 이유"), "태그라인 누락");
});

test("모든 페이지의 마스트헤드가 같은 카테고리 내비를 내고, About 링크를 포함한다", () => {
  const idx = readFileSync(join(OUT, "index.html"), "utf8");
  const story = readFileSync(join(OUT, "2026-w31/book/index.html"), "utf8");
  const archive = readFileSync(join(OUT, "archive/index.html"), "utf8");
  for (const html of [idx, story, archive]) {
    assert.match(html, /class="category-nav"/);
    assert.match(html, />About<\/a>/);
  }
});

test("회차 목록 페이지는 더 이상 만들지 않는다 — 2026-08-08, 홈 아카이브로 대체", () => {
  assert.ok(!existsSync(join(OUT, "2026-w31/index.html")));
});

test("회수된 영화 편은 어디에도 없다", () => {
  for (const f of ["index.html", "2026-w31/print/index.html"]) {
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

test("draft 회차의 스토리는 noindex고, 발행된 스토리는 색인된다", async () => {
  // 회차 목록 페이지가 없어졌으므로(2026-08-08) 스토리 페이지 자체에서 확인한다.
  // 특정 회차를 못 박으면 그 회차가 발행되는 날 테스트가 거짓으로 실패한다.
  // 검사할 것은 "w31이 draft인가"가 아니라 status가 색인 여부를 정하는가다.
  const { loadIssues, loadRegistry, allStories } = await import("../build/lib/data.mjs");
  const list = allStories(loadIssues("."), loadRegistry("."));
  let checked = 0;
  for (const s of list) {
    const html = readFileSync(join(OUT, `${s.issue.issue}/${s.slug}/index.html`), "utf8");
    if (s.issue.status === "draft") assert.match(html, /noindex/, `${s.id}는 draft인데 색인된다`);
    else assert.ok(!html.includes("noindex"), `${s.id}는 발행됐는데 noindex가 걸려 있다`);
    checked++;
  }
  assert.ok(checked >= 1, "검사할 스토리가 없다");
  // draft 표본이 있어야 한다고 못 박으면, 전부 발행된 좋은 상태에서 테스트가 실패한다.
  // 검사할 것은 표본의 존재가 아니라 status와 색인 여부가 늘 붙어 다니는가다.
});

test("작업 중 배지는 draft 회차의 스토리에만 붙는다", async () => {
  // 배지와 noindex는 같은 신호(status)에서 나와야 한다. 갈리면 독자가 보는 상태와
  // 검색엔진이 보는 상태가 달라진다.
  const { loadIssues, loadRegistry, allStories } = await import("../build/lib/data.mjs");
  const list = allStories(loadIssues("."), loadRegistry("."));
  for (const s of list) {
    const html = readFileSync(join(OUT, `${s.issue.issue}/${s.slug}/index.html`), "utf8");
    const badged = html.includes("작업 중");
    assert.equal(badged, s.issue.status === "draft", `${s.id}: 배지(${badged})와 status(${s.issue.status})가 어긋난다`);
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
  assert.ok(htmls.length >= 6); // 인덱스 + 스토리 4편 + 인쇄 진, 회차 수가 늘면 더 늘어난다

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

// "서브셋 폰트가 본문의 모든 글자를 담는다" 테스트는 2026-08-10 자체 호스팅 폰트 제거와
// 함께 없앴다 — 시스템 헬베티카 스택은 서브셋되지 않고 OS 내장 CJK 폰트로 자동
// 폴백되므로 두부(tofu) 자체가 구조적으로 생기지 않는다.

test("빌드 경고는 실제 데이터 문제만 담는다", () => {
  // 지금은 draft 회차의 미니 슬롯 부족만 있어야 한다
  for (const w of result.warnings) {
    assert.match(w, /미니 슬롯|리드 스토리가 없다/, `예상 못한 경고: ${w}`);
  }
});

// "필수 폰트가 없으면 빌드가 실패한다" 테스트는 2026-08-10 자체 호스팅 폰트 제거와 함께
// 없앴다 — 시스템 헬베티카 스택은 assets/fonts/ 자체가 없어도(항상) 정상 빌드된다.
// 이 테스트 전용이었던 test/fixtures/no-fonts/도 같이 지웠다.

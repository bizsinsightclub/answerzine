/**
 * 진입 화면과 등장 애니메이션.
 *
 * 여기서 지키려는 것은 연출이 아니라 **연출이 읽기를 막지 않는다**는 성질이다.
 * 콘텐츠는 빌드 시점에 이미 HTML에 들어 있다. 스크립트가 죽든, 애니메이션이
 * 차단되든, 인쇄를 하든 본문은 보여야 한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { page } from "../build/lib/layout.mjs";
import { stylesheet } from "../build/lib/css.mjs";

const home = page({
  title: "테스트", description: "설명", url: "/", content: "<main>본문</main>", showIntro: true,
});
const story = page({
  title: "스토리", description: "설명", url: "/2026-w31/book/", content: "<main>본문</main>",
});
const print = page({
  title: "인쇄", description: "설명", url: "/x/print/", content: "<main>지면</main>",
  showChrome: false,
});
const css = stylesheet([{ key: "book", color: "#34C759", colorPaper: "#217E38" }]);

test("진입 화면은 홈에서만 마크업으로 심긴다 — 첫 페인트에 워드마크가 이미 있다", () => {
  // 2026-08-10부터 로고 이미지 대신 실제 텍스트다. 같은 날 두 번째 라운드에서 둘째 줄을
  // "COMPANY"에서 "ZINE"으로 바꿨다(사이트명 ANSWER ZINE에 맞춘다). 2026-08-11 여덟 번째
  // 라운드: "THE ANSWER"가 넓은 화면에서 두 줄로 끊겨 보인다는 지적으로 THE·ANSWER·ZINE
  // 세 단어를 각자 한 줄로 뗐다 — 단어 하나 = 줄 하나라 중간에서 줄이 갈라질 일이 없다.
  // 2026-08-12 열네 번째 라운드: 셋째 단어가 ZINE→MAGAZINE으로 바뀌었다(사용자 요청,
  // "인트로 애니메이션만" — SITE.name 자체는 그대로 "ANSWER ZINE"이다).
  assert.match(home, /class="intro"/);
  assert.match(home, /class="intro-word intro-word-the">THE</);
  assert.match(home, /class="intro-word intro-word-answer">/);
  assert.match(home, /class="intro-word intro-word-magazine">/);
  assert.ok(!home.includes('class="intro-word intro-word-zine"'), "옛 ZINE 클래스가 남아 있다");
});

test("ANSWER·MAGAZINE은 낱글자로 쪼개져 있고, ANZINE을 이루는 글자만 intro-letter--keep이다", () => {
  // ANSWER(A-N-S-W-E-R)의 A·N + MAGAZINE(M-A-G-A-Z-I-N-E)의 Z·I·N·E = "ANZINE".
  // THE는 ANZINE에 들어가는 글자가 하나도 없어 낱글자로 안 쪼갠다(layout.mjs 주석).
  const answerMatch = home.match(/class="intro-word intro-word-answer">([\s\S]*?)<\/span>\s*<span class="intro-word intro-word-magazine"/);
  assert.ok(answerMatch, "ANSWER 단어 블록을 못 찾았다");
  const answerHTML = answerMatch[1];
  assert.match(answerHTML, /<span class="intro-letter intro-letter--keep">A<\/span>/);
  assert.match(answerHTML, /<span class="intro-letter intro-letter--keep">N<\/span>/);
  for (const ch of ["S", "W", "E", "R"]) {
    assert.match(answerHTML, new RegExp(`<span class="intro-letter">${ch}</span>`));
  }

  const magazineMatch = home.match(/class="intro-word intro-word-magazine">([\s\S]*?)<\/span>\s*<\/p>/);
  assert.ok(magazineMatch, "MAGAZINE 단어 블록을 못 찾았다");
  const magazineHTML = magazineMatch[1];
  for (const ch of ["Z", "I", "N", "E"]) {
    assert.match(magazineHTML, new RegExp(`<span class="intro-letter intro-letter--keep">${ch}</span>`));
  }
  for (const ch of ["M", "G"]) {
    assert.match(magazineHTML, new RegExp(`<span class="intro-letter">${ch}</span>`));
  }
  // "MAGAZINE"의 두 A는 둘 다 intro-letter--keep이 아니어야 한다(ANSWER 쪽 A만 살린다).
  assert.equal((magazineHTML.match(/intro-letter--keep/g) || []).length, 4, "MAGAZINE 쪽 keep 글자 수가 4(Z·I·N·E)가 아니다");
});

test("스크립트 없이도 워드마크 텍스트는 읽힌다 — 낱글자 span은 공백 없이 이어붙는다", () => {
  // letterSpans()가 공백 없이 join하므로, 스크립트 없이(색 전환 없이) 봐도
  // "ANSWER"·"MAGAZINE"이 글자 사이가 벌어지지 않고 정상적으로 읽힌다.
  const answerText = [...home.matchAll(/<span class="intro-letter(?: intro-letter--keep)?">([A-Z])<\/span>/g)]
    .map((m) => m[1]).join("");
  assert.equal(answerText, "ANSWERMAGAZINE");
});

test("진입 화면은 issue·story 페이지에는 없다 — 마스트헤드부터 바로 시작한다", () => {
  assert.ok(!story.includes('class="intro"'), "story 페이지에 진입 화면이 들어갔다");
  assert.match(story, /class="site-header/, "story 페이지에 마스트헤드는 있어야 한다");
});

test("진입 화면은 문서 흐름 안에 있다 — 스크립트 없이도 스크롤·앵커로 본문에 닿는다", () => {
  // "이거 왜 잘나가?" 스테이트먼트 단계는 2026-08-10에 없앴다 — 인트로 다음이 바로
  // #main-content(아카이브)다.
  assert.match(home, /class="intro-scroll" href="#main-content"/);
  assert.match(home, /id="main-content"/);
});

test("인쇄 지면에는 진입 화면이 붙지 않는다", () => {
  assert.ok(!print.includes('class="intro"'), "인쇄 페이지에 진입 화면이 들어갔다");
  assert.ok(!print.includes('id="main-content"'), "인쇄 페이지에 main-content 래퍼가 들어갔다");
});

test("세션 판정으로 진입 화면을 건너뛰지 않는다 — 홈에 돌아올 때마다 다시 보인다", () => {
  assert.ok(!css.includes("intro-done"), "진입 화면을 숨기는 세션 판정이 CSS에 남아 있다");
  const head = home.slice(0, home.indexOf("</head>"));
  assert.ok(!head.includes("sessionStorage"), "부트 스크립트에 세션 판정이 남아 있다");
});

test("등장 애니메이션은 .js가 붙은 문서에서만 숨긴다", () => {
  // `[data-reveal] { opacity: 0 }`을 무조건 걸면 스크립트가 실패한 순간
  // 본문 전체가 투명해진다. 반드시 .js 스코프 안에 있어야 한다.
  for (const m of css.matchAll(/([^\n{}]*\[data-reveal\][^\n{}]*)\{([^}]*)\}/g)) {
    const [, selector, body] = m;
    if (!/opacity:\s*0\s*[;}]/.test(body)) continue;
    assert.match(selector, /\.js\b/, `.js 밖에서 본문을 숨긴다: ${selector.trim()}`);
  }
});

test("부트 스크립트가 첫 페인트 전에 .js를 정한다", () => {
  const head = home.slice(0, home.indexOf("</head>"));
  assert.match(head, /className\s*\+=\s*" js"/);
  assert.ok(!head.includes("az-theme"), "테마 토글이 남아 있다");
});

test("인쇄에서는 진입 화면이 숨고 등장 상태가 강제로 풀린다", () => {
  const printBlock = css.slice(css.indexOf("@media print"));
  assert.match(printBlock, /\.intro/);
  assert.match(printBlock, /\[data-reveal\]\s*\{\s*opacity:\s*1\s*!important/);
});

test("동작 최소화 환경에서는 등장 애니메이션이 멈추고 본문이 그대로 보인다", () => {
  const reduce = css.slice(css.indexOf("prefers-reduced-motion"));
  // 진입 화면 자체(스크롤 구간)는 원본처럼 유지하되, 그 안의 애니메이션(체브론 바운스 등)은
  // 최상단의 전역 규칙(animation-duration: .001ms !important)으로 멈춘다.
  assert.match(reduce, /animation-duration:\s*\.001ms\s*!important/);
  assert.match(reduce, /animation-delay:\s*0s\s*!important/);
  assert.match(reduce, /\[data-reveal\]\s*\{\s*opacity:\s*1\s*!important/);
});

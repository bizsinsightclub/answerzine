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
  // 2026-08-10부터 로고 이미지 대신 실제 텍스트 "THE ANSWER"/"COMPANY" 두 줄이다.
  assert.match(home, /class="intro"/);
  assert.match(home, /class="intro-word intro-word-1">THE ANSWER</);
  assert.match(home, /class="intro-word intro-word-2">COMPANY</);
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

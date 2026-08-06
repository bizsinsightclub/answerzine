/**
 * 인트로 로딩 화면과 등장 애니메이션.
 *
 * 여기서 지키려는 것은 연출이 아니라 **연출이 읽기를 막지 않는다**는 성질이다.
 * 콘텐츠는 빌드 시점에 이미 HTML에 들어 있다. 스크립트가 죽든, 애니메이션이
 * 차단되든, 인쇄를 하든 본문은 보여야 한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { page } from "../build/lib/layout.mjs";
import { stylesheet } from "../build/lib/css.mjs";

const html = page({
  title: "테스트", description: "설명", url: "/", content: "<main>본문</main>",
});
const print = page({
  title: "인쇄", description: "설명", url: "/x/print/", content: "<main>지면</main>",
  showChrome: false,
});
const css = stylesheet([{ key: "book", color: "#34C759", colorPaper: "#217E38" }]);

test("인트로는 마크업으로 심긴다 — 첫 페인트에 로고가 이미 있다", () => {
  assert.match(html, /class="splash"/);
  assert.match(html, /data-splash/);
});

test("인쇄 지면에는 인트로가 붙지 않는다", () => {
  assert.ok(!print.includes("data-splash"), "인쇄 페이지에 로딩 화면이 들어갔다");
});

test("인트로는 JS 없이도 스스로 걷힌다", () => {
  // 걷히는 동작이 애니메이션이 아니라 스크립트에 달려 있으면
  // JS가 죽은 브라우저에서 화면이 로고에 덮인 채 멈춘다.
  assert.match(css, /\.splash\s*\{[^}]*animation:\s*splash-out/);
  assert.match(css, /@keyframes splash-out\s*\{[^}]*visibility:\s*hidden/);
});

test("스크롤 잠금은 CSS 기본값이 아니다 — 스크립트가 죽어도 남지 않는다", () => {
  assert.match(css, /\.splash-lock,\s*\.splash-lock body\s*\{\s*overflow:\s*hidden/);
  assert.ok(!/^\s*body\s*\{[^}]*overflow:\s*hidden/m.test(css), "body가 기본값으로 잠겨 있다");
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

test("부트 스크립트가 첫 페인트 전에 .js와 테마를 정한다", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  assert.match(head, /r\.className\s*\+=\s*" js"/);
  assert.match(head, /az-theme/);
  // 두 번째 페이지부터 로고가 번쩍이지 않으려면 세션 판정도 head에서 끝나야 한다.
  assert.match(head, /az-intro/);
  assert.match(head, /splash-done/);
});

test("인쇄에서는 인트로가 숨고 등장 상태가 강제로 풀린다", () => {
  const printBlock = css.slice(css.indexOf("@media print"));
  assert.match(printBlock, /\.splash/);
  assert.match(printBlock, /\[data-reveal\]\s*\{\s*opacity:\s*1\s*!important/);
});

test("동작 최소화 환경에서는 인트로가 재생되지 않고 본문이 그대로 보인다", () => {
  const reduce = css.slice(css.indexOf("prefers-reduced-motion"));
  assert.match(reduce, /\.splash\s*\{\s*display:\s*none\s*!important/);
  assert.match(reduce, /\[data-reveal\]\s*\{\s*opacity:\s*1\s*!important/);
  // 지연까지 눌러야 "빠르게 재생"이 아니라 "없음"이 된다.
  assert.match(reduce, /animation-delay:\s*0s\s*!important/);
});

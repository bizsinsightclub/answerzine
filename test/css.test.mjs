import { test } from "node:test";
import assert from "node:assert/strict";
import { stylesheet } from "../build/lib/css.mjs";
import { loadRegistry } from "../build/lib/data.mjs";

const css = stylesheet(loadRegistry(".").domains);

test("로드하지 않은 폰트 웨이트를 참조하지 않는다 — §9.8", () => {
  const allowed = new Set(["400", "700", "900"]);
  const used = [...css.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => m[1]);
  const bad = [...new Set(used)].filter((w) => !allowed.has(w));
  assert.deepEqual(bad, [], `로드하지 않은 웨이트 참조: ${bad.join(", ")}`);
});

test("@font-face는 다섯 개다 (Paperlogy 3 + 나눔명조 2)", () => {
  assert.equal((css.match(/@font-face/g) ?? []).length, 5);
});

test("@font-face가 참조하는 파일과 로드 웨이트가 일치한다", () => {
  for (const f of ["Paperlogy-400.ttf", "Paperlogy-700.ttf", "Paperlogy-900.ttf",
                   "NanumMyeongjo.otf", "NanumMyeongjoBold.otf"]) {
    assert.ok(css.includes(f), `${f} 참조 없음`);
  }
  assert.ok(!css.includes("Paperlogy-300"), "쓰지 않는 300 웨이트를 참조하면 안 된다");
  assert.ok(!css.includes("NotoSerif"), "한글 0자인 NotoSerif를 참조하면 안 된다");
});

test("자간 하한 -0.04em을 넘지 않는다", () => {
  const ls = [...css.matchAll(/letter-spacing:\s*(-?[\d.]+)em/g)].map((m) => Number(m[1]));
  const bad = ls.filter((v) => v < -0.04);
  assert.deepEqual(bad, [], `자간 하한 초과: ${bad.join(", ")}`);
});

test("인쇄에서 .statement-wrap을 숨긴다 — §9.1", () => {
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\.statement-wrap/);
});

test("인쇄 @page는 A4 margin 0이다", () => {
  assert.match(css, /@page\s*\{[^}]*size:\s*A4[^}]*margin:\s*0/);
});

test("브라우저 표면을 팔레트에서 지정한다 — craft-floor", () => {
  assert.match(css, /::selection/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /caret-color/);
  assert.match(css, /scrollbar/);
});

test("본문 측정은 45~75자 범위 안이다", () => {
  const m = css.match(/--measure:\s*([\d.]+)ch/);
  assert.ok(m, "--measure 토큰이 있어야 한다");
  const ch = Number(m[1]);
  assert.ok(ch >= 45 && ch <= 75, `measure ${ch}ch가 45~75 밖이다`);
});

test("넓은 화면에서도 리드/레일로 쪼개지 않는다 — 원본처럼 한 칼럼이다", () => {
  assert.ok(!/grid-template-columns:\s*repeat\(12,/.test(css), "12칼럼 그리드가 남아 있다");
  assert.ok(!/position:\s*sticky/.test(css), "sticky 레일이 남아 있다");
});

test("768px 브레이크포인트가 있다", () => {
  assert.match(css, /min-width:\s*768px/);
});

test("웹 본문에 CSS 다단을 쓰지 않는다 — 스펙 §6.3", () => {
  const webPart = css.slice(0, css.indexOf(".zine-page"));
  assert.ok(!/column-count/.test(webPart), "웹 본문에 다단을 쓰면 안 된다");
});

test("풀쿼트의 색 보더는 1px 이하다 — craft-floor", () => {
  const m = css.match(/\.pullquote\s*\{[^}]*border-left:\s*(\d+)px/);
  assert.ok(m, ".pullquote에 border-left가 있어야 한다");
  assert.ok(Number(m[1]) <= 1, `색 보더가 ${m[1]}px다. 1px을 넘기면 안 된다`);
});

test("출처 링크를 hover로 숨기지 않는다 — §9.9", () => {
  const m = css.match(/\.stat-source\s*\{([^}]*)\}/);
  assert.ok(m, ".stat-source 규칙이 있어야 한다");
  assert.ok(!/opacity:\s*0/.test(m[1]), "출처를 opacity:0으로 숨기면 안 된다");
});

test("prefers-reduced-motion에서 애니메이션이 멈춘다", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("도메인 색 변수는 Paper 보정색 하나뿐이다 — 토글이 없다", () => {
  assert.match(css, /--dc-book:\s*#217E38/);
  assert.ok(!css.includes("data-theme"), "domainCSS에 테마 토글 분기가 남아 있다");
});

test("킥커는 모노스페이스가 아니다 — craft-floor", () => {
  const m = css.match(/\.kicker\s*\{([^}]*)\}/);
  assert.ok(m);
  assert.ok(!/monospace/.test(m[1]), "킥커에 monospace를 쓰면 안 된다");
});

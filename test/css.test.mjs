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

test("@font-face를 쓰지 않는다 — 2026-08-10부터 시스템 헬베티카 스택뿐이다", () => {
  assert.equal((css.match(/@font-face/g) ?? []).length, 0);
  assert.ok(css.includes("Helvetica"), "--sans/--serif가 헬베티카 스택을 가리켜야 한다");
});

test("자간 하한 -0.04em을 넘지 않는다", () => {
  const ls = [...css.matchAll(/letter-spacing:\s*(-?[\d.]+)em/g)].map((m) => Number(m[1]));
  const bad = ls.filter((v) => v < -0.04);
  assert.deepEqual(bad, [], `자간 하한 초과: ${bad.join(", ")}`);
});

test("인쇄에서 .intro를 숨긴다 — §9.1", () => {
  // "이거 왜 잘나가?" 스테이트먼트 섹션은 2026-08-10에 없앴다 — 이제 인트로 하나만
  // 있고, 그 하나가 인쇄에서 숨는지만 확인한다.
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\.intro\b/);
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

// 2026-08-11 일곱 번째 라운드 되돌림: 위 테스트("리드/레일로 쪼개지 않는다")는
// 2026-08-10 목업 기반 개편 때 명시적으로 세운 규칙이었다. 그런데 사용자가 넓은
// 화면에서 본문이 왼쪽에만 몰려 있다고 다시 지적했고, design.md §5.2/5.3이 원래
// 정의해 뒀던 12칼럼 비대칭 그리드(본문 1/span 7 + 근거 레일 9/span 4)를 실제로
// 구현하는 쪽으로 되돌렸다 — 그 스펙 자체는 이번 세션 초반부터 문서에 있었고 코드만
// 안 따라갔던 것이다. 아래 테스트가 새 계약이다.
test("≥1200px에서 본문·근거 레일 12칼럼 그리드로 넓게 쓴다", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(12,\s*1fr\)/, "12칼럼 그리드가 있어야 한다");
  assert.match(css, /\.story-col\s*\{[^}]*grid-column:\s*1\s*\/\s*span\s*7/, "본문 칼럼이 1/span 7이어야 한다");
  assert.match(css, /\.story-rail\s*\{[^}]*grid-column:\s*9\s*\/\s*span\s*4/, "레일이 9/span 4여야 한다");
  // 레일 컨테이너(.story-rail)는 sticky여도 된다 — 여기서 막는 건 개별 .stat-card가
  // 다시 자체적으로 sticky 레일이 되는 옛 패턴이다.
  assert.ok(!/\.stat-card[^{]*\{[^}]*position:\s*sticky/.test(css), "스탯 카드 자체가 sticky면 안 된다");
});

test("1200px 미만에서는 본문·레일이 한 칼럼으로 쌓인다", () => {
  const before1200 = css.slice(0, css.indexOf("min-width: 1200px"));
  assert.match(before1200, /\.story-grid\s*\{\s*display:\s*block/, "기본값은 한 칼럼 쌓임이어야 한다");
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

test("이탤릭을 쓰지 않는다 — 2026-08-10 두 번째 라운드, 사용자 요청", () => {
  assert.equal((css.match(/font-style:\s*italic/g) ?? []).length, 0, "font-style: italic이 남아 있다");
});

test("마스트헤드가 스크롤에 고정된다", () => {
  const m = css.match(/\.site-header\s*\{([^}]*)\}/);
  assert.ok(m, ".site-header 규칙이 있어야 한다");
  assert.match(m[1], /position:\s*sticky/);
  assert.match(m[1], /top:\s*0/);
});

test("카테고리 카드는 배경을 풀블리드한다 — §2 불변식 3번 다섯 번째 예외", () => {
  // 배경색 자체는 render-index.mjs가 도메인마다 인라인 style로 넣는다(cardColor 또는
  // colorPaper) — 여기서는 CSS가 두 글자색 경로(밝은 배경=먹색 기본, 어두운 배경=흰색
  // .is-dark)를 갖췄는지만 본다. AA는 test/theme.test.mjs가 검증한다.
  const base = css.match(/\.category-card\s*\{([^}]*)\}/);
  assert.ok(base, ".category-card 규칙이 있어야 한다");
  assert.match(base[1], /color:\s*var\(--ink\)/);
  const dark = css.match(/\.category-card\.is-dark\s*\{([^}]*)\}/);
  assert.ok(dark, ".category-card.is-dark 규칙이 있어야 한다");
  assert.match(dark[1], /color:\s*#fff/);
});

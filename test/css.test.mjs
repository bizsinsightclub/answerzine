import { test } from "node:test";
import assert from "node:assert/strict";
import { stylesheet } from "../build/lib/css.mjs";
import { loadRegistry } from "../build/lib/data.mjs";

const css = stylesheet(loadRegistry(".").domains);

test("로드하지 않은 폰트 웨이트를 참조하지 않는다 — §9.8", () => {
  // @font-face 안의 "font-weight: 100 900"은 배리어블 폰트가 지원하는 범위
  // 선언이지 실제로 쓰는 웨이트 목록이 아니다 — 스캔에서 제외한다(2026-08-13).
  const withoutFontFace = css.replace(/@font-face\s*\{[^}]*\}/g, "");
  const allowed = new Set(["400", "700", "900"]);
  const used = [...withoutFontFace.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => m[1]);
  const bad = [...new Set(used)].filter((w) => !allowed.has(w));
  assert.deepEqual(bad, [], `로드하지 않은 웨이트 참조: ${bad.join(", ")}`);
});

test("SUIT @font-face가 정확히 1개다 — 2026-08-13부터 한글 폴백이 SUIT이다", () => {
  // 2026-08-10~2026-08-13까지는 "@font-face를 쓰지 않는다"였다(시스템 헬베티카
  // 스택뿐). 사용자가 "SUIT 웹폰트를 실제로 로드하라"고 명시적으로 요청해
  // 되돌렸다 — CLAUDE.md §9 4번·design.md §3 참고. 여기서는 정확히 SUIT
  // 하나만 늘었는지(다른 폰트가 몰래 딸려오지 않는지) 지킨다 — "0개"였던
  // 예전 불변식의 정신(무분별한 폰트 추가 방지)은 "정확히 1개, 그것도
  // SUIT" 형태로 이어진다.
  const faces = css.match(/@font-face/g) ?? [];
  assert.equal(faces.length, 1, `@font-face 개수가 1이 아니다: ${faces.length}`);
  assert.match(css, /font-family:\s*'SUIT Variable'/, "SUIT Variable을 선언해야 한다");
  assert.match(css, /font-weight:\s*100 900/, "배리어블 폰트는 전 웨이트(100~900)를 커버해야 한다");
  assert.match(css, /font-display:\s*swap/, "font-display: swap이 없으면 폰트 로딩 중 텍스트가 안 보일 수 있다(FOIT)");
});

test("--sans/--serif가 Helvetica Neue를 먼저, SUIT을 그다음에 둔다", () => {
  // 라틴은 Helvetica Neue, 한글은 그 폰트에 글리프가 없어 자동으로 SUIT으로
  // 넘어간다 — 순서가 바뀌면 한글에 라틴 폰트가, 또는 라틴에 SUIT이 먼저
  // 걸릴 수 있다.
  const stack = css.match(/--sans:\s*([^;]+);/)?.[1] ?? "";
  const heIdx = stack.indexOf("Helvetica Neue");
  const suitIdx = stack.indexOf("SUIT Variable");
  assert.ok(heIdx >= 0, "--sans에 Helvetica Neue가 있어야 한다");
  assert.ok(suitIdx >= 0, "--sans에 SUIT Variable이 있어야 한다");
  assert.ok(heIdx < suitIdx, "Helvetica Neue가 SUIT Variable보다 먼저 와야 한다");
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

test("인쇄에서 배경색을 강제한다 — 브라우저 '배경 그래픽' 토글이 꺼져 있어도 인쇄된다(2026-08-12 사용자 보고 버그)", () => {
  // print-color-adjust는 상속 속성이라 html에 한 번만 걸면 DIY 진 뒤표지 같은 배경색
  // 전부에 전파된다. 이 속성이 빠지면 실제 브라우저 인쇄 대화상자에서(Playwright의
  // printBackground:true와 달리) 배경이 전부 흰 페이지로 날아간다.
  assert.match(css, /html\s*\{[^}]*print-color-adjust:\s*exact/);
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

test("카테고리 카드는 좌측 정렬이다 — 2026-08-12 사용자 요청(가운데·양쪽 정렬 금지)", () => {
  // 2026-08-13 — 사진 호버 리빌 기능으로 flex 배치·정렬이 .category-card에서
  // .category-card-cover(커버 레이어)로 옮겨갔다(render-index.mjs 주석 참고).
  // 정렬 자체(좌측)는 안 바뀌었다 — 어느 규칙이 갖고 있는지만 바뀌었다.
  const cover = css.match(/\.category-card-cover\s*\{([^}]*)\}/);
  assert.ok(cover, ".category-card-cover 규칙이 있어야 한다");
  assert.match(cover[1], /align-items:\s*flex-start/);
  assert.match(cover[1], /text-align:\s*left/);
});

test("커버는 height:100%로 늘어난 카드 전체를 채운다 — 짧은 카드 옆 사진이 새지 않게", () => {
  // 2026-08-13 — 실제 사진을 연결하고서야 발견한 버그. .category-grid는
  // align-items 기본값(stretch)이라 같은 행의 짧은 카드도 옆 긴 카드만큼
  // 키가 늘어난다. 커버가 height:100%로 그 늘어난 키를 안 채우면, 사진
  // 레이어(부모 .category-card 전체를 채운다)가 커버 아래 빈 틈에서
  // 그대로 드러난다 — 짧은 카드일수록 더 크게 샌다.
  const cover = css.match(/\.category-card-cover\s*\{([^}]*)\}/);
  assert.match(cover[1], /height:\s*100%/, "height:100%가 없으면 짧은 카드에서 사진이 샌다");
});

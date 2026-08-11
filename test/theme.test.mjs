import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME, ZINE_THEME, themeCSS, domainCSS, contrast } from "../build/lib/theme.mjs";
import { loadRegistry } from "../build/lib/data.mjs";

test("contrast는 WCAG 값을 계산한다", () => {
  assert.equal(Math.round(contrast("#FFFFFF", "#000000") * 100) / 100, 21);
});

test("사이트 테마·인쇄 테마의 ink/secondary/tertiary가 모두 AA(4.5:1)를 넘는다", () => {
  for (const [name, t] of Object.entries({ site: THEME, zine: ZINE_THEME })) {
    for (const role of ["ink", "secondary", "tertiary"]) {
      const c = contrast(t[role], t.bg);
      assert.ok(c >= 4.5, `${name}.${role} 대비 ${c.toFixed(2)}:1 < 4.5:1`);
    }
  }
});

test("registry의 도메인 색(Paper 보정색)이 사이트 배경에서 AA를 넘는다", () => {
  const reg = loadRegistry(".");
  for (const d of reg.domains) {
    assert.ok(d.colorPaper, `${d.key}에 colorPaper가 없다`);
    const c = contrast(d.colorPaper, THEME.bg);
    assert.ok(c >= 4.5, `${d.key} ${d.colorPaper} → ${c.toFixed(2)}:1`);
  }
});

test("colorPaper 풀블리드 위 흰 글자가 AA를 넘는다 — 카테고리 카드의 cardColor 없는 폴백", () => {
  // 2026-08-10 도입, 2026-08-11 cardColor 도입 후 이 조합은 cardColor가 없는 도메인의
  // 폴백(.category-card.is-dark)에만 쓰인다. 먹색 글자는 colorPaper 배경 전부에서
  // 4.5:1을 못 넘어 흰 글자만 쓴다 — 그 전제를 여기서 검증한다.
  const reg = loadRegistry(".");
  for (const d of reg.domains) {
    const white = contrast("#FFFFFF", d.colorPaper);
    assert.ok(white >= 4.5, `${d.key} 위 흰 글자 대비 ${white.toFixed(2)}:1 < 4.5:1`);
  }
});

test("cardColor 풀블리드 위 검은 글자(--ink)가 AA를 넘는다 — 카테고리 카드 기본 경로", () => {
  // 2026-08-11 도입. cardColor는 밝은 파스텔이라 반대로 흰 글자는 못 쓴다(전 도메인
  // 4.5:1 미만) — 검은 글자(--ink)만 쓴다는 전제를 여기서 검증한다.
  const reg = loadRegistry(".");
  const withCardColor = reg.domains.filter((d) => d.cardColor);
  assert.ok(withCardColor.length > 0, "cardColor가 있는 도메인이 하나도 없다");
  for (const d of withCardColor) {
    const ink = contrast("#17150F", d.cardColor);
    const white = contrast("#FFFFFF", d.cardColor);
    assert.ok(ink >= 4.5, `${d.key} cardColor 위 검은 글자 대비 ${ink.toFixed(2)}:1 < 4.5:1`);
    assert.ok(white < 4.5, `${d.key} cardColor 위 흰 글자가 AA를 넘는다(${white.toFixed(2)}:1) — 밝은 배경 전제가 깨졌다`);
  }
});

test("themeCSS는 :root와 .zine-page를 낸다", () => {
  const css = themeCSS();
  assert.match(css, /:root\s*\{[^}]*--bg:\s*#FFFFFF/);
  assert.match(css, /\.zine-page\s*\{[^}]*--bg:\s*#FFFFFF/);
});

test("themeCSS는 다크/라이트 토글이 없다 — data-theme도 prefers-color-scheme도 없다", () => {
  const css = themeCSS();
  assert.ok(!css.includes("prefers-color-scheme"), "테마가 시스템 설정에 따라 자동 전환되면 안 된다");
  assert.ok(!css.includes("data-theme"), "다크/라이트 토글 훅이 남아 있다");
});

test("domainCSS는 :root에 도메인 변수를 낸다", () => {
  const reg = loadRegistry(".");
  const css = domainCSS(reg.domains);
  assert.match(css, /--dc-book:\s*#217E38/);
  assert.ok(!css.includes("data-theme"), "domainCSS에 테마 토글 분기가 남아 있다");
});

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

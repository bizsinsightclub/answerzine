import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, themeCSS, domainCSS, contrast } from "../build/lib/theme.mjs";
import { loadRegistry } from "../build/lib/data.mjs";

test("contrast는 WCAG 값을 계산한다", () => {
  assert.equal(Math.round(contrast("#FFFFFF", "#000000") * 100) / 100, 21);
});

test("세 테마의 ink/secondary/tertiary가 모두 AA(4.5:1)를 넘는다", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    for (const role of ["ink", "secondary", "tertiary"]) {
      const c = contrast(t[role], t.bg);
      assert.ok(c >= 4.5, `${name}.${role} 대비 ${c.toFixed(2)}:1 < 4.5:1`);
    }
  }
});

test("registry의 도메인 색이 각 테마 배경에서 AA를 넘는다", () => {
  const reg = loadRegistry(".");
  for (const d of reg.domains) {
    const night = contrast(d.color, THEMES.night.bg);
    assert.ok(night >= 4.5, `night/${d.key} ${d.color} → ${night.toFixed(2)}:1`);
    assert.ok(d.colorPaper, `${d.key}에 colorPaper가 없다`);
    const paper = contrast(d.colorPaper, THEMES.paper.bg);
    assert.ok(paper >= 4.5, `paper/${d.key} ${d.colorPaper} → ${paper.toFixed(2)}:1`);
  }
});

test("Paper 보정색은 원본과 hue가 같다", () => {
  const hue = (hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    let hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round(hh * 60);
  };
  const reg = loadRegistry(".");
  for (const d of reg.domains) {
    const diff = Math.abs(hue(d.color) - hue(d.colorPaper));
    assert.ok(diff <= 1, `${d.key}: hue가 ${hue(d.color)}° → ${hue(d.colorPaper)}°로 바뀌었다`);
  }
});

test("themeCSS는 :root를 Night로, [data-theme=paper]를 Paper로 낸다", () => {
  const css = themeCSS();
  assert.match(css, /:root\s*\{[^}]*--bg:\s*#16150F/);
  assert.match(css, /\[data-theme="paper"\]\s*\{[^}]*--bg:\s*#F4F1E7/);
  assert.match(css, /\.zine-page\s*\{[^}]*--bg:\s*#F4F1E7/);
});

test("themeCSS는 prefers-color-scheme로 자동 전환하지 않는다", () => {
  assert.ok(!themeCSS().includes("prefers-color-scheme"), "기본값은 Night 고정이다 — 스펙 §5.2");
});

test("domainCSS는 테마별로 도메인 변수를 낸다", () => {
  const reg = loadRegistry(".");
  const css = domainCSS(reg.domains);
  assert.match(css, /--dc-book:\s*#34C759/);
  assert.match(css, /\[data-theme="paper"\][\s\S]*--dc-book:\s*#217E38/);
});

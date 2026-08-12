/**
 * color.mjs — hex↔HSL 변환과 darken()이 정확한지, 그리고 홈 카테고리 카드의
 * 세로 도메인 라벨(cardAccent)이 실제로 AA 대비를 만족하는지 검증한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToHsl, hslToHex, darken } from "../build/lib/color.mjs";
import { contrast } from "../build/lib/theme.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("hexToHsl/hslToHex는 서로의 역함수다 — 원색을 왕복해도 같은 색이 나온다", () => {
  for (const hex of ["#F890CD", "#60C1A9", "#C1D746", "#E9E9E9", "#000000", "#FFFFFF"]) {
    const [h, s, l] = hexToHsl(hex);
    const back = hslToHex(h, s, l);
    assert.equal(back.toLowerCase(), hex.toLowerCase(), `${hex} 왕복 실패 — ${back}`);
  }
});

test("hexToHsl(#FFFFFF)/hexToHsl(#000000)은 채도 0, 명도만 다르다", () => {
  const [, sw, lw] = hexToHsl("#FFFFFF");
  const [, sb, lb] = hexToHsl("#000000");
  assert.equal(sw, 0);
  assert.equal(sb, 0);
  assert.equal(Math.round(lw), 100);
  assert.equal(Math.round(lb), 0);
});

test("darken()은 같은 색상(hue)을 유지한 채 명도만 낮춘다", () => {
  const [h0] = hexToHsl("#F890CD");
  const darker = darken("#F890CD");
  const [h1, , l1] = hexToHsl(darker);
  assert.ok(Math.abs(h0 - h1) < 1, `hue가 바뀌었다: ${h0} → ${h1}`);
  assert.ok(l1 < 30, `명도가 충분히 낮아지지 않았다: ${l1}`);
});

test("darken()은 무채색(회색)에서 임의 색상을 지어내지 않는다", () => {
  // #E9E9E9는 R=G=B라 채도 0 — darken이 채도를 강제로 끌어올리면 원래와 무관한
  // 색(예: 어두운 빨강)이 나온다. 무채색은 무채색으로 어둡게만 해야 한다.
  const darker = darken("#E9E9E9");
  const [, s] = hexToHsl(darker);
  assert.ok(s < 10, `무채색에서 색상을 지어냈다 — 채도 ${s}`);
});

test("홈 카테고리 카드 — cardAccent(darken(cardColor))가 cardColor 배경 위에서 큰 텍스트 AA(3:1)를 만족한다", () => {
  // 세로 도메인 라벨(.category-card-tag)은 40px 굵게(900) — WCAG "large text" 기준
  // (≥18pt 또는 ≥14pt bold)에 해당해 3:1이면 충분하다(본문 기준 4.5:1이 아니다).
  const reg = JSON.parse(readFileSync(join(process.cwd(), "domains/registry.json"), "utf8"));
  const active = reg.domains.filter((d) => d.status === "active" && d.cardColor);
  assert.ok(active.length >= 4, "활성 도메인 중 cardColor 있는 도메인이 4개 이상이어야 한다");
  for (const d of active) {
    const accent = darken(d.cardColor);
    const c = contrast(accent, d.cardColor);
    assert.ok(c >= 3, `${d.key}: cardAccent(${accent}) vs cardColor(${d.cardColor}) 대비 ${c.toFixed(2)} < 3`);
  }
});

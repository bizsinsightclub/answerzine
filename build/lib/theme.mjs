/**
 * 테마 값. 역할 이름은 같고 값은 하나뿐이다.
 *
 * 다크/라이트 토글은 없다 — 사이트는 항상 이 하나의 흰 테마로 읽힌다.
 * 2026-08-10 리디자인 전에는 진입 화면(.intro, .statement-wrap)만 예외로 항상 어두운
 * 스플래시(INTRO_THEME)를 썼는데, 인트로도 화이트+헬베티카로 통일되면서 그 예외
 * 자체가 없어졌다 — 이제 인트로도 이 THEME을 그대로 물려받는다.
 * 인쇄 진(.zine-page)은 별도 값을 쓴다(흰 서피스로 종이 느낌을 낸다) — 지금은 bg도
 * 흰색이라 THEME과 거의 같지만, 역할이 다르므로 변수는 분리해 둔다.
 * 대비 수치는 test/theme.test.mjs가 매번 실제로 계산해 검증한다.
 */

export const THEME = {
  bg: "#FFFFFF", ink: "#17150F", secondary: "#5C574A", tertiary: "#726C5E",
  rule: "#17150F", surface: "#FFFFFF", divider: "rgba(23,21,15,.24)",
  "rule-soft": "rgba(23,21,15,.3)",
};

export const ZINE_THEME = {
  bg: "#FFFFFF", ink: "#17150F", secondary: "#5C574A", tertiary: "#726C5E",
  rule: "#17150F", surface: "#FFFFFF", divider: "rgba(23,21,15,.35)",
  "rule-soft": "rgba(23,21,15,.4)",
};

/** 도메인 색은 registry.json이 단일 소스다. 여기는 폴백일 뿐이다. */
export const DOMAIN_FALLBACK = {
  movie: { color: "#0A84FF", colorPaper: "#006BD7" },
  music: { color: "#FF9500", colorPaper: "#A15E00" },
  youtube: { color: "#FF2D55", colorPaper: "#DD002A" },
  book: { color: "#34C759", colorPaper: "#217E38" },
};

const vars = (t) => Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join("\n");

export function themeCSS() {
  return [
    `:root {\n${vars(THEME)}\n  color-scheme: light;\n}`,
    `.zine-page {\n${vars(ZINE_THEME)}\n  color-scheme: light;\n}`,
  ].join("\n\n");
}

/** 도메인 색을 CSS 변수로 낸다. 밝은 배경 하나뿐이라 Paper 보정색만 쓴다. */
export function domainCSS(domains) {
  const decl = domains
    .map((d) => `  --dc-${d.key}: ${d.colorPaper ?? DOMAIN_FALLBACK[d.key]?.colorPaper ?? d.color};`)
    .join("\n");
  return `:root {\n${decl}\n}`;
}

const hex2rgb = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(fg, bg) {
  const [l1, l2] = [lum(hex2rgb(fg)), lum(hex2rgb(bg))].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

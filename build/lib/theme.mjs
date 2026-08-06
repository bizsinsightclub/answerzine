/**
 * 세 테마의 값. 역할 이름은 같고 값만 다르다.
 *
 * Night가 기본이다. prefers-color-scheme로 자동 전환하지 않는다 — 브랜드 기본값을
 * 우선한 결정이고, 마스트헤드 토글로 Paper로 바꿀 수 있다 (스펙 §5.2).
 * 대비 수치는 test/theme.test.mjs가 매번 실제로 계산해 검증한다.
 */

export const THEMES = {
  night: {
    bg: "#16150F", ink: "#F2EFE4", secondary: "#A8A192", tertiary: "#8A8375",
    rule: "#F2EFE4", surface: "#1E1D16", divider: "rgba(242,239,228,.22)",
    "rule-soft": "rgba(242,239,228,.28)",
  },
  paper: {
    bg: "#F4F1E7", ink: "#17150F", secondary: "#5C574A", tertiary: "#726C5E",
    rule: "#17150F", surface: "#EDEADE", divider: "rgba(23,21,15,.24)",
    "rule-soft": "rgba(23,21,15,.3)",
  },
  zine: {
    bg: "#F4F1E7", ink: "#17150F", secondary: "#5C574A", tertiary: "#726C5E",
    rule: "#17150F", surface: "#FFFFFF", divider: "rgba(23,21,15,.35)",
    "rule-soft": "rgba(23,21,15,.4)",
  },
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
    `:root {\n${vars(THEMES.night)}\n  color-scheme: dark;\n}`,
    `[data-theme="paper"] {\n${vars(THEMES.paper)}\n  color-scheme: light;\n}`,
    `.zine-page {\n${vars(THEMES.zine)}\n  color-scheme: light;\n}`,
  ].join("\n\n");
}

/** 도메인 색을 테마별 CSS 변수로 낸다. Night는 --dc, Paper는 재정의한다. */
export function domainCSS(domains) {
  const night = domains.map((d) => `  --dc-${d.key}: ${d.color};`).join("\n");
  const paper = domains
    .map((d) => `  --dc-${d.key}: ${d.colorPaper ?? DOMAIN_FALLBACK[d.key]?.colorPaper ?? d.color};`)
    .join("\n");
  return `:root {\n${night}\n}\n\n[data-theme="paper"] {\n${paper}\n}`;
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

/**
 * 색 변환 유틸 — hex ↔ HSL, 명도(lightness) 조정.
 *
 * 2026-08-12 사용자가 참고 스크린샷으로 홈 카테고리 카드의 우측 세로 도메인
 * 라벨 색을 지정했다 — 카드 배경(cardColor, 밝은 파스텔)과 같은 색상(hue)
 * 계열이지만 훨씬 짙고 채도 높은 톤이었다. `domains/registry.json`에 그 톤을
 * 또 하나의 수동 필드로 얹는 대신(cardColor·colorPaper·color 세 필드가 이미
 * 있다 — 또 늘리면 셋 다 매번 서로 맞춰야 하는 부담이 커진다), cardColor
 * 하나에서 명도만 낮춰 **계산**한다 — 정본은 여전히 cardColor 하나뿐이다.
 */

/** #rrggbb → [h(0~360), s(0~100), l(0~100)] */
export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

/** [h(0~360), s(0~100), l(0~100)] → #rrggbb */
export function hslToHex(h, s, l) {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 같은 색상(hue)을 유지한 채 명도만 targetL로 낮추고, 채도는 최소 minS까지
 * 끌어올린다(파스텔 원색은 채도가 낮을 수 있어, 그대로 어둡게만 하면 탁한
 * 회갈색이 된다 — 채도를 같이 올려야 "짙은 원색"처럼 보인다).
 *
 * 원색이 채도 10% 미만인 무채색(회색·흰색에 가까운 색)이면 채도를 끌어올리지
 * 않는다 — 무채색에서 hue는 계산상 임의값(0=빨강)이라, 그대로 강제로 채도를
 * 높이면 원래 색과 아무 관계 없는 색(회색 카드에 다크 레드)이 나온다. 무채색은
 * 무채색으로 어둡게만 한다.
 */
export function darken(hex, targetL = 20, minS = 55) {
  const [h, s] = hexToHsl(hex);
  const outS = s < 10 ? s : Math.max(s, minS);
  return hslToHex(h, outS, targetL);
}

/**
 * 스파크라인.
 *
 * 프로토타입은 min–max 정규화라 [98,101,100,426]에서 앞 세 점이 바닥에 붙어
 * 형태 정보가 사라졌다 (design.md §7의 "직선·바닥붙음" 경고).
 * 여기서는 첫 값을 100으로 두는 기준선 정규화를 쓰고, 기준선 자체를 점선으로 그린다.
 * "전주 대비"라는 축의 의미가 형태로 드러난다.
 *
 * SVG에 <title>을 넣어 CLAUDE.md §9.9의 대체 텍스트 부재도 함께 해소한다.
 */
import { escapeHTML } from "./html.mjs";

const W = 160;
const H = 56;
const PAD = 6;

export function trendSentence(points, label) {
  const first = points[0];
  const last = points[points.length - 1];
  const dir = last > first ? "상승" : last < first ? "하락" : "보합";
  return `${label} 추이. 데이터 ${points.length}개, ${first}에서 ${last}로 ${dir}. 전체 값: ${points.join(", ")}.`;
}

export function sparklineSVG(points, color, opts = {}) {
  if (!Array.isArray(points) || points.length < 2)
    throw new Error("스파크라인은 점이 2개 이상이어야 한다.");

  const base = points[0];
  // 기준선 정규화. 첫 값이 0이면 나눌 수 없으므로 원값을 그대로 쓴다.
  const rel = base === 0 ? points.slice() : points.map((v) => (v / base) * 100);
  const baseline = base === 0 ? 0 : 100;

  let min = Math.min(...rel, baseline);
  let max = Math.max(...rel, baseline);

  // 기준선이 값 범위의 끝이면 반대쪽에 여백을 준다.
  // 이게 없으면 [98,101,100,426]처럼 한 점만 튀는 데이터에서 기준선이 차트 바닥에
  // 딱 붙고, 평탄한 앞부분이 바닥에 뭉개져 형태를 읽을 수 없다.
  const HEADROOM = 0.15;
  if (baseline <= min) min = baseline - (max - baseline) * HEADROOM;
  else if (baseline >= max) max = baseline + (baseline - min) * HEADROOM;

  const span = max - min || 1;
  const norm = (v) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const step = W / (points.length - 1);
  const d = rel
    .map((v, i) => `${i === 0 ? "M" : "L"} ${+(i * step).toFixed(2)},${+norm(v).toFixed(2)}`)
    .join(" ");
  const lastY = +norm(rel[rel.length - 1]).toFixed(2);
  const baseY = +norm(baseline).toFixed(2);

  const title = opts.label ? escapeHTML(trendSentence(points, opts.label)) : "";

  return (
    `<svg class="sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"` +
    (title ? ">" : ' aria-hidden="true">') +
    (title ? `<title>${title}</title>` : "") +
    `<line x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" stroke="currentColor" stroke-width="1" opacity=".25" stroke-dasharray="2 3"/>` +
    `<path d="${d}" fill="none" stroke="${escapeHTML(color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${W}" cy="${lastY}" r="3.5" fill="${escapeHTML(color)}"/>` +
    `</svg>`
  );
}

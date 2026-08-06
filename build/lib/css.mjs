/**
 * 전체 스타일시트.
 *
 * 방향 A — "지면이 본체다". 인쇄 진의 크림·먹색·괘선을 웹이 물려받고,
 * PC는 12칼럼 비대칭 그리드(본문 한 칼럼 + 근거 레일)를 쓴다.
 * 본문에 CSS 다단은 쓰지 않는다 — 신문이 다단인 건 지면이 고정이기 때문이고,
 * 웹에서 다단 본문은 아래로 읽다가 위로 되돌아가야 한다 (스펙 §6.3).
 *
 * 로드하는 웨이트는 Paperlogy 400/700/900, 나눔명조 400/700뿐이다.
 * CSS가 그 밖의 웨이트를 참조하면 test/css.test.mjs가 실패한다 (§9.8).
 */
import { themeCSS, domainCSS } from "./theme.mjs";

const FONTS = `
@font-face { font-family: "Paperlogy"; font-weight: 400; font-display: swap;
  src: url("/assets/fonts/Paperlogy-400.ttf") format("truetype"); }
@font-face { font-family: "Paperlogy"; font-weight: 700; font-display: swap;
  src: url("/assets/fonts/Paperlogy-700.ttf") format("truetype"); }
@font-face { font-family: "Paperlogy"; font-weight: 900; font-display: swap;
  src: url("/assets/fonts/Paperlogy-900.ttf") format("truetype"); }
@font-face { font-family: "NanumMyeongjo"; font-weight: 400; font-display: swap;
  src: url("/assets/fonts/NanumMyeongjo.otf") format("opentype"); }
@font-face { font-family: "NanumMyeongjo"; font-weight: 700; font-display: swap;
  src: url("/assets/fonts/NanumMyeongjoBold.otf") format("opentype"); }
`;

const BASE = `
:root {
  --sans: "Paperlogy", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
  --serif: "NanumMyeongjo", Batang, "Times New Roman", serif;
  --measure: 68ch;
  --shell: 1240px;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px;
  --s6: 32px; --s7: 48px; --s8: 64px; --s9: 96px;
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--serif);
  font-weight: 400;
  font-size: 17px;
  line-height: 1.9;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* Night는 어두운 배경에 밝은 글자다. 행간·자간·웨이트 세 축에서 보정한다.
   Paper에서는 자간을 0으로 되돌린다. */
body { letter-spacing: .005em; }
[data-theme="paper"] body { letter-spacing: 0; }

img { max-width: 100%; height: auto; display: block; }
a { color: inherit; }

/* 브라우저가 그리는 표면도 팔레트에서 지정한다.
   impeccable craft-floor: "the parts you did not draw still carry the design." */
::selection { background: var(--ink); color: var(--bg); }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; border-radius: 2px; }
body { caret-color: var(--ink); scrollbar-color: var(--tertiary) var(--bg); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--tertiary); border-radius: 0; }
`;

const TYPE = `
.kicker, .label, .meta, .stat-value, .btn, .seg, .nav-label,
.masthead, h1, h2, h3, .mini-headline, .row-headline {
  font-family: var(--sans);
}

/* 킥커는 신문 문법이라 유지한다. 다만 모노스페이스 코스튬은 뺐다 —
   impeccable craft-floor: "monospace as a costume for 'technical'". */
.kicker {
  font-size: 11px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--dc, var(--secondary));
  margin: 0 0 var(--s2);
}

h1, .story-headline {
  font-weight: 900; font-size: clamp(32px, 5.2vw, 52px);
  line-height: 1.06; letter-spacing: -.035em; margin: 0 0 var(--s4);
}
h2 { font-weight: 900; font-size: clamp(24px, 3.4vw, 34px); line-height: 1.1; letter-spacing: -.03em; margin: 0 0 var(--s3); }
h3 { font-weight: 900; font-size: 20px; line-height: 1.15; letter-spacing: -.025em; margin: 0 0 var(--s2); }

.teaser {
  font-family: var(--serif); font-weight: 700; font-size: 18px;
  line-height: 1.6; margin: 0 0 var(--s6); color: var(--ink);
  max-width: var(--measure);
}

.story-body p { margin: 0 0 var(--s5); max-width: var(--measure); }

.label {
  font-size: 11px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--secondary);
}
.meta { font-size: 13px; color: var(--tertiary); font-variant-numeric: tabular-nums; }

.stat-value {
  font-weight: 900; font-size: 30px; letter-spacing: -.03em;
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
`;

const CHROME = `
.shell { max-width: var(--shell); margin: 0 auto; padding: var(--s5) var(--s4) var(--s8); }

.masthead { padding-top: var(--s3); }
.masthead-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s4); }
.wordmark {
  font-family: var(--sans); font-weight: 900; font-size: clamp(20px, 3vw, 30px);
  letter-spacing: .18em; text-transform: uppercase; text-decoration: none; color: var(--ink);
}
.tagline { font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .06em; color: var(--secondary); }

/* 굵은 선 + 가는 선 — 신문 마스트헤드 관용구 */
.ruleline { border-top: 3px solid var(--rule); border-bottom: 1px solid var(--rule); height: 5px; margin: var(--s3) 0 var(--s2); }
.dateline { font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--secondary); margin-bottom: var(--s6); }

.theme-toggle {
  font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; background: none; color: var(--secondary);
  border: 1px solid var(--divider); padding: 6px 10px; cursor: pointer;
}
.theme-toggle:hover { color: var(--ink); border-color: var(--ink); }

.seg { display: flex; flex-wrap: wrap; gap: var(--s3); margin: 0 0 var(--s5); padding: 0; list-style: none; }
.seg button {
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; background: none; border: none; cursor: pointer;
  color: var(--tertiary); padding: 4px 0; border-bottom: 2px solid transparent;
}
.seg button[aria-pressed="true"] { color: var(--ink); border-bottom-color: var(--ink); }

.site-footer { border-top: 1px solid var(--rule); margin-top: var(--s9); padding-top: var(--s4); }
.site-footer p { font-family: var(--sans); font-size: 12px; color: var(--secondary); margin: 0 0 var(--s2); }

.draft-flag {
  display: inline-block; font-family: var(--sans); font-size: 10px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; border: 1px solid var(--divider);
  padding: 2px 6px; color: var(--tertiary); vertical-align: middle;
}
`;

const LAYOUT = `
/* <768px는 1단이다. 아래 그리드는 그 위에서만 적용된다. */
.story-grid, .index-grid { display: block; }

.rail { margin: var(--s6) 0; }

@media (min-width: 768px) {
  .shell { padding: var(--s6) var(--s5) var(--s9); }
  .index-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: var(--s5); }
  .index-lead { grid-column: 1 / -1; }
  .index-rest { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s5); }
}

@media (min-width: 1200px) {
  .story-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--s5) var(--s6); align-items: start; }
  .story-head { grid-column: 1 / -1; }
  .story-body { grid-column: 1 / span 7; }
  .rail {
    grid-column: 9 / span 4; position: sticky; top: var(--s5);
    border-left: 1px solid var(--rule-soft); padding-left: var(--s5); margin: 0;
  }
  .index-grid { grid-template-columns: repeat(12, 1fr); }
  .index-lead { grid-column: 1 / span 8; }
  .index-rest {
    grid-column: 9 / span 4; display: block;
    border-left: 1px solid var(--rule-soft); padding-left: var(--s5);
  }
  .index-rest .row + .row { margin-top: var(--s5); }
}
`;

const COMPONENTS = `
.row { border-top: 1px solid var(--divider); padding-top: var(--s3); }
.row a { text-decoration: none; display: block; }
.row a:hover .row-headline { text-decoration: underline; text-underline-offset: 3px; }
.row-headline { font-weight: 900; font-size: 19px; line-height: 1.2; letter-spacing: -.025em; margin: 0 0 var(--s1); }
.row-teaser { font-size: 14px; line-height: 1.6; color: var(--secondary); margin: 0; }

/* 스탯은 레일에 상주한다. 출처 링크는 항상 보인다 —
   프로토타입은 opacity:0에 hover로만 노출해 터치 기기에서 접근이 안 됐다 (§9.9). */
.stat-card { border-top: 3px solid var(--rule); border-bottom: 1px solid var(--rule); padding: var(--s3) 0 var(--s4); }
.stat-spark { color: var(--secondary); margin: var(--s2) 0; }
.stat-axis { font-family: var(--sans); font-size: 11px; line-height: 1.5; color: var(--tertiary); margin: var(--s2) 0 var(--s3); }
.stat-source {
  font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .04em;
  color: var(--ink); text-decoration: underline; text-underline-offset: 3px;
}

/* 색 보더는 1px을 넘기지 않는다 —
   impeccable craft-floor: "a colored border-left above 1px on callouts". */
.pullquote {
  font-family: var(--serif); font-weight: 700; font-size: 20px; line-height: 1.55;
  letter-spacing: -.01em; margin: var(--s6) 0; padding-left: var(--s4);
  border-left: 1px solid var(--dc, var(--rule)); max-width: var(--measure);
}

.insight { margin-top: var(--s3); }
.insight summary {
  font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--secondary); cursor: pointer; list-style: none;
}
.insight summary::-webkit-details-marker { display: none; }
.insight summary::after { content: " +"; }
.insight[open] summary::after { content: " −"; }
.insight-body {
  font-family: var(--sans); font-size: 13px; line-height: 1.7; color: var(--secondary);
  margin-top: var(--s2); padding-left: var(--s3); border-left: 1px solid var(--divider);
}

.domain-tag { font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--dc, var(--secondary)); }

.nav-row { display: grid; gap: var(--s5); border-top: 1px solid var(--rule); margin-top: var(--s8); padding-top: var(--s4); }
@media (min-width: 768px) { .nav-row { grid-template-columns: 1fr 1fr; } .nav-next { text-align: right; } }
.nav-row a { text-decoration: none; }
.nav-label { font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--tertiary); }
.nav-headline { font-family: var(--sans); font-weight: 700; font-size: 15px; letter-spacing: -.01em; }

.empty-state { border-top: 1px solid var(--divider); padding: var(--s7) 0; color: var(--secondary); font-size: 15px; }

.btn {
  display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; border: 1px solid var(--ink); padding: 9px 16px;
  text-decoration: none; color: var(--ink); background: none; cursor: pointer;
}
.btn:hover { background: var(--ink); color: var(--bg); }
`;

/* 인쇄 진. design.md §8의 장치를 유지하되 전부 데이터에서 생성한다. */
const ZINE = `
.zine-preview { max-width: 900px; margin: 0 auto; padding: var(--s7) var(--s4) var(--s9); }
.zine-preview .label { display: block; margin-bottom: var(--s3); }

.zine-page {
  width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm 10mm;
  background: var(--bg); color: var(--ink);
  font-family: var(--serif); letter-spacing: 0;
  box-shadow: 0 6px 30px rgba(0,0,0,.18);
}
.zine-masthead { text-align: center; padding-bottom: 2mm; }
.zine-wordmark { font-family: var(--sans); font-weight: 900; font-size: 26px; letter-spacing: .22em; text-transform: uppercase; }
.zine-ruleline { border-top: 3px solid var(--ink); border-bottom: 1px solid var(--ink); height: 5px; margin: 2mm 0; }
.zine-dateline { font-family: var(--sans); font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.zine-section-rule { border-top: 1px solid var(--ink); margin: 4mm 0; }

.zine-kicker { font-family: var(--sans); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--secondary); }
.zine-headline { font-family: var(--sans); font-weight: 900; font-size: 44px; line-height: 1.05; letter-spacing: -.035em; margin: 2mm 0 1mm; }
.zine-byline { font-family: var(--sans); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--secondary); margin: 1mm 0 3mm; }
.zine-teaser { font-size: 14px; font-weight: 700; line-height: 1.45; margin: 0 0 3mm; }
.zine-body { font-size: 11.5px; line-height: 1.65; margin: 0 0 3mm; }
.zine-lead-body::after { content: ""; display: block; clear: both; }
.zine-lead-photo { float: left; width: 38%; margin: 0 5mm 3mm 0; }

.zine-photo-collage { position: relative; margin: 0 0 2mm; }
.zine-photo-placeholder {
  aspect-ratio: 4 / 3; border: 2px solid var(--ink); transform: rotate(-1.1deg);
  background: repeating-linear-gradient(45deg, #DBD7C9 0, #DBD7C9 2px, #EDE9DC 2px, #EDE9DC 5px);
  background-size: cover; background-position: center 20%;
  clip-path: polygon(0% 2%, 3% 0%, 97% 1%, 100% 4%, 99% 97%, 96% 100%, 2% 99%, 0% 96%);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--sans); font-size: 11px; font-weight: 700; color: var(--secondary);
}
.zine-tape { position: absolute; width: 60px; height: 20px; background: rgba(255,255,255,.6); border: 1px dashed rgba(0,0,0,.3); }
.zine-tape-1 { top: -9px; left: 6px; transform: rotate(-9deg); }
.zine-tape-2 { top: -7px; right: 2px; transform: rotate(7deg); }
.zine-sticker {
  display: inline-block; padding: 5px 11px; border: 2px solid var(--ink); background: var(--surface);
  font-family: var(--sans); font-weight: 900; font-size: 12px; transform: rotate(-3deg);
}

.zine-secondary-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; margin-top: 1mm; position: relative; }
.zine-secondary-row::before, .zine-secondary-row::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 1px; background: var(--ink); opacity: .25;
}
.zine-secondary-row::before { left: 33.333%; }
.zine-secondary-row::after { left: 66.666%; }
.zine-mini-headline { font-family: var(--sans); font-weight: 900; font-size: 19px; line-height: 1.15; letter-spacing: -.025em; margin: 1.5mm 0 2mm; }
.zine-mini-teaser { font-size: 11px; line-height: 1.55; }

.zine-footer-bar { display: flex; justify-content: center; align-items: center; margin-top: 5mm; background: var(--ink); color: var(--bg); padding: 4mm 5mm; }
.zine-footer-qr { display: flex; align-items: center; gap: 3mm; }
.zine-qr { width: 60px; height: 60px; background: #fff; padding: 3px; flex-shrink: 0; }
.zine-qr-caption { font-family: var(--sans); font-size: 9.5px; line-height: 1.5; }
.zine-qr-caption span { font-weight: 900; display: block; }

@media (max-width: 780px) {
  .zine-page { width: 100%; padding: 6mm 5mm; }
  .zine-secondary-row { grid-template-columns: 1fr; }
  .zine-secondary-row::before, .zine-secondary-row::after { display: none; }
  .zine-lead-photo { float: none; width: 100%; }
  .zine-headline { font-size: 32px; }
}
`;

const PRINT = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; letter-spacing: 0; }
  .site-header, .site-footer, .statement-wrap, .shell, .seg,
  .theme-toggle, .print-btn, .zine-preview .label, .zine-preview > p {
    display: none !important;
  }
  .zine-preview { padding: 0; margin: 0; max-width: none; }

  /* 지면을 감싼 여백이 남아 있으면 297mm 박스가 인쇄 지면을 넘겨 2페이지가 된다.
     페이지 상자는 @page가 정하므로, 여기서는 크기를 강제하지 않고 흐르게 둔다. */
  .zine-mount { margin: 0 !important; padding: 0 !important; }
  .zine-page {
    box-shadow: none; margin: 0; width: 100%;
    min-height: 0; height: auto; break-inside: avoid; page-break-inside: avoid;
  }
}
`;

const MOTION = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important; animation-iteration-count: 1 !important;
    transition-duration: .001ms !important; scroll-behavior: auto !important;
  }
}
`;

export function stylesheet(domains = []) {
  return [FONTS, themeCSS(), domainCSS(domains), BASE, TYPE, CHROME, LAYOUT, COMPONENTS, ZINE, PRINT, MOTION]
    .join("\n")
    .trim() + "\n";
}

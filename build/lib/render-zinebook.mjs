/**
 * DIY 진 — 인쇄용 미니 8쪽 진(A4 랜드스케이프 2장, 양면) + 그걸 미리 보는 3D 플립북 오버레이.
 *
 * 2026-08-11 아홉 번째 라운드 신규 기능. 기존 "한 장 요약"(`/YYYY-wNN/print/`, A4 세로 1장,
 * `render-zine.mjs`)과는 완전히 별개의 산출물이다 — 그건 그대로 둔다. 이건 그 주 상위
 * 4편을 접어서 만드는 물리적인 소책자용이다.
 *
 * 물리 구조(사용자 지정, 그대로 따른다):
 *   Sheet 1(겉장) 앞면 = [뒤표지 | 앞표지]        Sheet 1 뒷면 = [About | Notes]
 *   Sheet 2(속지) 앞면 = [기사4 | 기사1]           Sheet 2 뒷면 = [기사2 | 기사3]
 * 논리적 읽는 순서(플립북 미리보기가 이 순서로 넘긴다):
 *   앞표지 → About → 기사1 → 기사2 → 기사3 → 기사4 → Notes → 뒤표지  (총 8장)
 *
 * 8개 "논리 페이지" 콘텐츠를 각각 한 번만 만들고, 플립북(읽는 순서)과 인쇄 시트
 * (물리 배치)에 같은 문자열을 재사용한다 — 정본이 둘로 갈라지지 않는다(CLAUDE.md §9.3와
 * 같은 원칙). 데이터는 그 주(최신 회차) 편집 순서(점수순) 상위 4편이다. 4편에 못 미치면
 * (결번) 빈 칸에 확인 안 된 내용을 채우지 않는다 — §7.3 "확인되지 않은 숫자 게재 금지"와
 * 같은 원칙으로, 빈 슬롯은 "이 자리는 다음 호에" 안내만 낸다.
 *
 * 표지(겉장, Sheet 1 앞면 전체)는 검정 배경·흰 글자 — 인쇄 시 진짜로 검게 나온다
 * (`printBackground: true` 가정, 대부분의 브라우저 인쇄 대화상자는 "배경 그래픽" 옵션을
 * 켜야 한다 — 안내 문구를 오버레이에 넣는다). 속지(About·Notes·기사)는 흰 배경·검정
 * 글자로 사이트 나머지와 통일한다 — "겉은 검정, 속은 흰색"이라는 실제 인쇄물의 표지/속지
 * 관례를 그대로 재현한다.
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { SITE } from "./layout.mjs";
import { blocksOf } from "./data.mjs";

/* ── 아이콘 ── 전부 인라인 SVG. 래스터 이미지를 새로 안 만든다(요구사항 #5). */
const ICON = {
  close: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5L19 19M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  prev: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5L8 12L15 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5L16 12L9 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9V3h12v6M6 18h12v3H6v-3zM3 9h18v7H3V9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 8.5L6.5 11L12 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mark: `<svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><rect x="1" y="1" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 27L20 10L29 27M14.5 20H25.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
};

/**
 * 줄 쳐진 노트 배경 — 요구사항 #5(레이아웃 요소는 인라인 SVG).
 *
 * 각 논리 페이지 HTML은 한 번만 만들어 플립북·인쇄 두 군데에 그대로 재사용한다(파일
 * 맨 위 주석) — 그래서 이 SVG도 최종 문서에 두 번 나온다. `<pattern id="...">` +
 * `url(#...)` 참조 방식을 썼다가 문서에 같은 id가 두 번 생겨 패턴이 깨지는 걸
 * 실측으로 발견했다(id는 문서 전체에서 유일해야 한다). id 없이 `<line>`을 반복해
 * 찍는 방식으로 바꿔 그 문제 자체를 없앴다.
 */
function notesRuleSVG() {
  const rows = 20;
  const gap = 280 / rows;
  const lines = Array.from({ length: rows }, (_, i) => {
    const y = (gap * (i + 1) - gap / 2).toFixed(1);
    return `<line x1="0" y1="${y}" x2="200" y2="${y}" stroke="#d9d9d9" stroke-width="0.6"/>`;
  }).join("");
  // width/height="100%" 속성을 명시한다 — CSS의 calc() 퍼센트 크기가 SVG 루트에서
  // 0×0으로 계산되는 경우가 있어(css.mjs .zb-notes-bg 주석 참고) 속성으로도 이중 지정한다.
  return h`<svg class="zb-notes-bg" width="100%" height="100%" viewBox="0 0 200 280" preserveAspectRatio="none" aria-hidden="true">${raw(lines)}</svg>`;
}

/* ── 8개 논리 페이지 콘텐츠 빌더 ── 각자 한 번만 호출되고, 플립북·인쇄 양쪽에 그대로 꽂힌다. */

function coverFront() {
  return h`<div class="zb-panel zb-panel--cover">
  <div class="zb-cover-crop" aria-hidden="true">
    <span class="zb-cover-word">THE</span>
    <span class="zb-cover-word">ANSWER</span>
    <span class="zb-cover-word">ZINE</span>
  </div>
  <p class="zb-cover-caption">직접 접어 만드는 8쪽 진 · 이번 호 큐레이션</p>
</div>`;
}

function coverBack(issue) {
  return h`<div class="zb-panel zb-panel--cover zb-panel--cover-back">
  <div class="zb-cover-mark">${raw(ICON.mark)}</div>
  <p class="zb-cover-site">ANSWERZINE.KR</p>
  <p class="zb-cover-tagline">${SITE.tagline}</p>
  ${issue ? raw(h`<p class="zb-cover-issue">${issue.issue} · ${issue.range}</p>`) : ""}
</div>`;
}

function aboutPanel() {
  return h`<div class="zb-panel zb-panel--about">
  <p class="zb-eyebrow">ABOUT</p>
  <h2 class="zb-heading">${SITE.tagline}</h2>
  <div class="zb-about-body">
    <p>1위여도 이유를 못 대면 싣지 않는다. 7위여도 이유가 선명하면 싣는다 — 순위표가 아니라
    "왜 팔렸는지"를 고른다.</p>
    <p>도메인마다 실 구매·실 소비 숫자를 1차 출처에서 가져오고, 그 변화를 만든 계기를
    특정한다. 둘 다 공개 출처로 확인되지 않으면 후보에서 뺀다.</p>
    <p>이 8쪽은 그 주 통과분 중 상위 4편을 접어서 들고 다니는 판이다. 전체 아카이브는
    웹에서 계속 갱신된다.</p>
  </div>
</div>`;
}

function notesPanel() {
  return h`<div class="zb-panel zb-panel--notes">
  ${raw(notesRuleSVG())}
  <div class="zb-notes-head">
    <p class="zb-eyebrow">NOTES</p>
    ${raw(ICON.check)}
  </div>
  <p class="zb-notes-hint">이번 호에서 다시 찾아볼 것, 사고 싶은 것, 확인하고 싶은 숫자 —
  여백에 적어 둔다.</p>
</div>`;
}

function articlePanel(story, n, total) {
  if (!story) {
    return h`<div class="zb-panel zb-panel--article zb-panel--empty">
    <p class="zb-eyebrow">인사이트 ${String(n).padStart(2, "0")}/${String(total).padStart(2, "0")}</p>
    <p class="zb-empty-note">이 자리는 통과분이 4편에 못 미쳐 비웠다. 확인 안 되는 이야기를
    채우기보다 결번으로 둔다 — 다음 호에 채워진다.</p>
  </div>`;
  }
  const { stat, quote } = blocksOf(story);
  return h`<div class="zb-panel zb-panel--article">
  <p class="zb-eyebrow">인사이트 ${String(n).padStart(2, "0")}/${String(total).padStart(2, "0")} · ${story.domain}</p>
  <h2 class="zb-article-headline">${story.headline}</h2>
  <p class="zb-article-teaser">${story.teaser}</p>
  ${stat ? raw(h`<div class="zb-stat">
    <span class="zb-stat-label">${stat.label}</span>
    <span class="zb-stat-value">${stat.value}</span>
  </div>`) : ""}
  ${quote ? raw(h`<p class="zb-quote">${quote.text}</p>`) : ""}
  ${stat?.sourceLabel ? raw(h`<p class="zb-source">출처 · ${stat.sourceLabel}</p>`) : ""}
</div>`;
}

/**
 * 8개 논리 페이지를 한 번씩 만들어 이름으로 찾을 수 있는 맵을 반환한다.
 * `stories`는 최신 회차 편집 순서(점수순) 상위 4편 — 모자라면 null로 채워 결번을 낸다.
 */
function buildPages({ issue, stories }) {
  const four = [0, 1, 2, 3].map((i) => stories[i] ?? null);
  return {
    "cover-front": coverFront(),
    "cover-back": coverBack(issue),
    about: aboutPanel(),
    notes: notesPanel(),
    "article-1": articlePanel(four[0], 1, 4),
    "article-2": articlePanel(four[1], 2, 4),
    "article-3": articlePanel(four[2], 3, 4),
    "article-4": articlePanel(four[3], 4, 4),
  };
}

/** 플립북이 넘기는 순서. §맨 위 주석의 "논리적 읽는 순서" 그대로. */
const FLIP_ORDER = ["cover-front", "about", "article-1", "article-2", "article-3", "article-4", "notes", "cover-back"];

/** 물리 인쇄 시트 — 사용자가 지정한 그대로. 바꾸지 않는다. */
const SHEETS = [
  { id: "sheet1-front", halves: ["cover-back", "cover-front"] },
  { id: "sheet1-back", halves: ["about", "notes"] },
  { id: "sheet2-front", halves: ["article-4", "article-1"] },
  { id: "sheet2-back", halves: ["article-2", "article-3"] },
];

function flipStageHTML(pages) {
  const leaves = FLIP_ORDER.map(
    (key, i) => h`<div class="zb-leaf" data-zb-leaf="${i}" role="button" tabindex="0" aria-label="다음 쪽">
    <div class="zb-leaf-face zb-leaf-front">${raw(pages[key])}</div>
    <div class="zb-leaf-face zb-leaf-back" aria-hidden="true">${raw(ICON.mark)}</div>
  </div>`
  );
  return h`<div class="zb-stage" data-zb-stage>
  ${raw(leaves.join("\n"))}
</div>`;
}

function printSheetsHTML(pages) {
  const sheets = SHEETS.map(
    ({ id, halves }) => h`<section class="zb-sheet" data-zb-sheet="${id}">
    <div class="zb-half">${raw(pages[halves[0]])}</div>
    <div class="zb-fold" aria-hidden="true"></div>
    <div class="zb-half">${raw(pages[halves[1]])}</div>
  </section>`
  );
  return h`<div class="zb-print-sheets" aria-hidden="true">
  ${raw(sheets.join("\n"))}
</div>`;
}

/**
 * `build.mjs`가 한 번 호출해 모든 showChrome 페이지에 그대로 물려준다(categoryNav와 같은
 * 패턴). `issue`가 없으면(회차가 하나도 없는 초기 상태) 아무것도 렌더하지 않는다 —
 * CTA 바가 빈 진을 열어보여주는 것보다 아예 없는 게 낫다.
 */
export function renderZinebook({ issue, stories }) {
  if (!issue) return "";
  const pages = buildPages({ issue, stories });
  const total = FLIP_ORDER.length;

  return h`<button type="button" class="zb-cta" data-zb-open>Create The Answer Zine</button>
<div class="zb-overlay" data-zb-overlay hidden>
  <div class="zb-toolbar">
    <p class="zb-toolbar-title">이번 호 미니 진 미리보기</p>
    <div class="zb-toolbar-actions">
      <button type="button" class="zb-btn zb-btn--print" data-zb-print>${raw(ICON.print)}<span>Print Zine</span></button>
      <button type="button" class="zb-btn zb-btn--icon" data-zb-close aria-label="닫기">${raw(ICON.close)}</button>
    </div>
  </div>

  <div class="zb-viewer">
    ${raw(flipStageHTML(pages))}
  </div>

  <div class="zb-nav">
    <button type="button" class="zb-btn zb-btn--icon" data-zb-prev aria-label="이전 쪽">${raw(ICON.prev)}</button>
    <span class="zb-indicator" data-zb-indicator aria-live="polite">1 / ${total}</span>
    <button type="button" class="zb-btn zb-btn--icon" data-zb-next aria-label="다음 쪽">${raw(ICON.next)}</button>
  </div>

  <p class="zb-print-hint">인쇄할 때: 양면 인쇄 + 짧은 변 기준 뒤집기, 배경 그래픽 켜기.
  자동 양면이 안 되면 1·2쪽을 먼저 인쇄한 뒤 종이를 뒤집어 3·4쪽을 인쇄한다 — 1·2쪽이
  겉장(Sheet 1), 3·4쪽이 속지(Sheet 2)다.</p>

  ${raw(printSheetsHTML(pages))}
</div>`;
}

export { FLIP_ORDER, SHEETS };

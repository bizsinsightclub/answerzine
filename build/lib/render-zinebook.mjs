/**
 * DIY 진 — 인쇄용 미니 8쪽 진(A4 랜드스케이프 2장, 양면) + 인쇄 전 전체를 훑어보는
 * 정적 그리드 미리보기.
 *
 * 2026-08-11 아홉 번째 라운드 신규, 같은 날 늦게 "Print Zine Refinement" 요청으로
 * 대폭 개편(열두 번째 라운드 안팎). 기존 "한 장 요약"(`/YYYY-wNN/print/`, A4 세로 1장,
 * `render-zine.mjs`)과는 완전히 별개의 산출물이다 — 그건 그대로 둔다. 이건 그 주 상위
 * 4편을 접어서 만드는 물리적인 소책자용이다.
 *
 * 물리 구조(사용자 지정, 그대로 따른다 — 실측으로 이미 올바른 새들스티치 임포지션임을
 * 확인했다: 논리 페이지 1~8을 8/1, 2/7, 6/3, 4/5로 짝지으면 2장을 겹쳐 반으로 접었을 때
 * 정확히 읽는 순서가 나온다):
 *   Sheet 1(겉장) 앞면 = [뒤표지 | 앞표지]        Sheet 1 뒷면 = [About | Notes]
 *   Sheet 2(속지) 앞면 = [기사4 | 기사1]           Sheet 2 뒷면 = [기사2 | 기사3]
 * 논리적 읽는 순서(그리드 미리보기가 이 순서로 나열한다):
 *   앞표지 → About+QR → 기사1 → 기사2 → 기사3 → 기사4 → Notes → 뒤표지  (총 8장)
 *
 * 8개 "논리 페이지" 콘텐츠를 각각 한 번만 만들고, 그리드 미리보기와 인쇄 시트(물리 배치)에
 * 같은 문자열을 재사용한다 — 정본이 둘로 갈라지지 않는다(CLAUDE.md §9.3와 같은 원칙).
 *
 * 데이터는 "지금 홈 카드 그리드에 뜨는 도메인별 최신 스토리" 4편이다(build.mjs가
 * data.mjs의 visibleDomains+latestByDomain으로 계산해 넘긴다) — 예전엔 "최신 회차 파일
 * 안의 스토리"만 썼는데, 활성 도메인이 4개뿐이고 결번이 흔해진 지금은 최신 회차 파일
 * 하나에 1~2편만 있는 주가 많아 진의 절반이 빈 채로 나가는 모순이 있었다. 결번 도메인도
 * 지난 회차 스토리가 있으면 그걸 쓰는 게 홈 카드와 일관된다 — 한 번도 발행된 적 없는
 * 도메인만 진짜 결번 플레이스홀더로 남는다(§7.3 "확인되지 않은 내용 채우지 않기"는 여전히
 * 지킨다 — 없는 도메인에 억지로 내용을 채우지 않을 뿐).
 *
 * 표지(겉장, Sheet 1 앞면 절반)는 2026-08-11 흰 배경·검정 글자로 뒤집었다(사용자 요청) —
 * "THE ANSWER ZINE"이 페이지에 거의 꽉 차게 눌러 담긴 느낌을 노린다. 속지(About·Notes·
 * 기사)는 원래도 흰 배경·검정 글자였다.
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { SITE } from "./layout.mjs";
import { blocksOf } from "./data.mjs";

/* ── 아이콘 ── 전부 인라인 SVG. 래스터 이미지를 새로 안 만든다(요구사항 #5). */
const ICON = {
  close: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5L19 19M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9V3h12v6M6 18h12v3H6v-3zM3 9h18v7H3V9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 8.5L6.5 11L12 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
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

/**
 * 표지 — 2026-08-12 세 번째 라운드, 실사 참고 사진 기준으로 "랩어라운드"로 다시 짰다.
 * 사용자가 실제로 접어 만든 실물 사진을 보내며 "이 사진과 똑같이"라고 요청 — 사진은
 * "THE ANSWER ZINE" 타이포가 접힌 선(스파인)을 가로질러 뒤표지·앞표지 두 면에
 * 걸쳐 하나로 이어진다. 이게 바로 sheet1-front의 물리 구조다(cover-back|cover-front가
 * 나란히 인쇄되고 그 사이가 접히는 선 — `SHEETS` 참고) — 지금까지는 그 경계를 존중해
 * 타이포를 앞면 한 쪽에만 가뒀는데, 사진은 경계를 무시하고 통짜 캔버스로 다룬다.
 *
 * 구현: 폭 1122px(561×2 — 시트 전체 폭)짜리 캔버스 하나에 문구를 한 번만 그리고,
 * 뒤·앞 두 패널이 각자 561px짜리 창(overflow:hidden)으로 그 캔버스의 왼쪽/오른쪽
 * 절반만 잘라 보여준다(`zb-wrap-canvas--back`은 offset 0, `--front`는 -561px).
 * 두 패널이 완전히 독립된 HTML 조각으로 렌더되지만(그리드 미리보기에서는 나란히
 * 붙어 있지 않다), 같은 폭·같은 폰트 크기·같은 세로 중앙 정렬을 쓰므로 인쇄돼
 * 실제로 나란히 놓일 때 이음매 없이 맞아떨어진다 — 실측(스크린샷)으로 확인했다.
 * 그리드 미리보기에서는 앞·뒤 타일이 서로 안 붙어 있어 각자 "반쪽 글자"로 보인다 —
 * 이건 랩어라운드 표지의 구조적 특성이다(실물도 펼치기 전엔 반쪽씩 보인다). 인쇄
 * 시트가 진짜 결과물이고, 사용자가 보낸 사진도 인쇄물이었다.
 */
function wraparoundCanvas(side) {
  return h`<div class="zb-wrap-viewport">
  <div class="zb-wrap-canvas zb-wrap-canvas--${side}" aria-hidden="true">
    <span class="zb-wrap-word">THE</span>
    <span class="zb-wrap-word">ANSWER</span>
    <span class="zb-wrap-word">ZINE</span>
  </div>
</div>`;
}

function coverFront() {
  return h`<div class="zb-panel zb-panel--cover">
  <p class="zb-cover-eyebrow">ANSWER ZINE · 8P MINI ISSUE</p>
  ${raw(wraparoundCanvas("front"))}
  <p class="zb-cover-caption">직접 접어 만드는 8쪽 진 · 이번 호 큐레이션</p>
</div>`;
}

function coverBack() {
  return h`<div class="zb-panel zb-panel--cover" aria-label="뒤표지 — 앞표지 타이포의 왼쪽 절반이 이어진다">
  ${raw(wraparoundCanvas("back"))}
</div>`;
}

/**
 * About + QR — 표지 바로 뒷장, 한 페이지 전체(사용자 요청 — "full booklet page, not
 * a small section"). QR은 여백에 뜬 장식이 아니라 하단 띠(zb-about-scan)에 "웹에서
 * 계속 갱신됩니다" 캡션 + URL 텍스트와 나란히 편집 요소로 구성한다 — /about/ 페이지의
 * 실제 문구(render-about.mjs)를 A5 지면에 맞게 줄여 재사용한다(내용 자체를 새로 짓지
 * 않는다 — 두 곳이 서로 다른 말을 하면 안 된다).
 *
 * `qrSvg`가 없으면(로컬에서 `npm install` 없이 빌드한 경우) 캡션과 URL 텍스트만 남기고
 * QR 자리를 비운다 — 빌드는 그래도 성공해야 한다(§2.2).
 */
function aboutPanel({ qrSvg, siteUrl }) {
  return h`<div class="zb-panel zb-panel--about">
  <p class="zb-eyebrow">ABOUT ANSWER ZINE</p>
  <h2 class="zb-heading">${SITE.tagline}</h2>
  <div class="zb-about-body">
    <p>순위는 결과다. 우리가 싣는 건 그 결과를 만든 계기다. 1위여도 이유를 못 대면 싣지
    않고, 7위여도 이유가 선명하면 싣는다.</p>
    <p>도메인마다 실 구매·실 소비 숫자를 1차 출처에서 가져오고, 그 변화를 만든 계기를
    특정한다. 숫자와 계기 둘 다 공개 출처로 확인되지 않으면 후보에서 뺀다 — 확인 안
    되는 숫자를 싣는 것보다 결번이 낫다고 본다.</p>
    <p>이 8쪽은 그 주 통과분 중 네 편을 접어서 들고 다니는 판이다. 웹은 지금도 갱신되고
    있다.</p>
  </div>
  <div class="zb-about-scan">
    ${qrSvg ? raw(`<div class="zb-qr" aria-hidden="true">${qrSvg}</div>`) : ""}
    <div class="zb-about-scan-text">
      <p class="zb-about-scan-label">전체 아카이브</p>
      <p class="zb-about-scan-url">${escapeHTML(siteUrl)}</p>
    </div>
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

/**
 * 기사 페이지 — 2026-08-11 전면 확장. 예전엔 헤드라인+티저+스탯+쿼트뿐이라 웹 스토리의
 * 축약본이었다("promotional summary"). 사용자 요청대로 5블록 전부(현상→스탯→맥락→
 * 쿼트+인사이트→마무리)를 웹과 같은 문장으로 낸다 — teaser는 뺐다(texts[0]이 이미 더
 * 자세한 같은 역할이라 나란히 두면 중복이다). "누군가 이 진만 읽고도 이야기와 인사이트를
 * 이해할 수 있어야 한다"는 요구를 그대로 따른 것 — 웹의 축약판이 아니라 인쇄판이다.
 */
function articlePanel(story, n, total) {
  if (!story) {
    return h`<div class="zb-panel zb-panel--article zb-panel--empty">
    <p class="zb-eyebrow">인사이트 ${String(n).padStart(2, "0")}/${String(total).padStart(2, "0")}</p>
    <p class="zb-empty-note">이 자리는 통과분이 4편에 못 미쳐 비웠다. 확인 안 되는 이야기를
    채우기보다 결번으로 둔다 — 다음 호에 채워진다.</p>
  </div>`;
  }
  const { texts, stat, quote } = blocksOf(story);
  const [t0, t1, t2] = texts;
  return h`<div class="zb-panel zb-panel--article">
  <p class="zb-eyebrow">인사이트 ${String(n).padStart(2, "0")}/${String(total).padStart(2, "0")} · ${story.domain}</p>
  <h2 class="zb-article-headline">${story.headline}</h2>
  ${t0 ? raw(h`<p class="zb-article-body">${t0.text}</p>`) : ""}
  ${stat ? raw(h`<div class="zb-stat">
    <span class="zb-stat-label">${stat.label}</span>
    <span class="zb-stat-value">${stat.value}</span>
  </div>`) : ""}
  ${t1 ? raw(h`<p class="zb-article-body">${t1.text}</p>`) : ""}
  ${quote ? raw(h`<p class="zb-quote"><span class="zb-quote-label">THE ANSWER</span>${quote.text}</p>`) : ""}
  ${quote?.insight?.note ? raw(h`<p class="zb-insight-note">${quote.insight.note}</p>`) : ""}
  ${t2 ? raw(h`<p class="zb-article-body zb-article-body--close">${t2.text}</p>`) : ""}
  ${stat?.sourceLabel ? raw(h`<p class="zb-source">출처 · ${stat.sourceLabel}</p>`) : ""}
</div>`;
}

/**
 * 8개 논리 페이지를 한 번씩 만들어 이름으로 찾을 수 있는 맵을 반환한다.
 * `stories`는 지금 홈 카드 그리드에 뜨는 도메인별 최신 스토리 — 모자라면(한 번도
 * 발행된 적 없는 도메인) null로 채워 결번을 낸다.
 */
function buildPages({ stories, qrSvg, siteUrl }) {
  const four = [0, 1, 2, 3].map((i) => stories[i] ?? null);
  return {
    "cover-front": coverFront(),
    "cover-back": coverBack(),
    about: aboutPanel({ qrSvg, siteUrl }),
    notes: notesPanel(),
    "article-1": articlePanel(four[0], 1, 4),
    "article-2": articlePanel(four[1], 2, 4),
    "article-3": articlePanel(four[2], 3, 4),
    "article-4": articlePanel(four[3], 4, 4),
  };
}

/** 논리적 읽는 순서. §맨 위 주석 참고 — 그리드 미리보기·인쇄 시트 둘 다 이 순서를
    기준으로 번호를 매긴다(그리드는 이 순서로 나열, 인쇄는 SHEETS가 별도로 접는 순서). */
const FLIP_ORDER = ["cover-front", "about", "article-1", "article-2", "article-3", "article-4", "notes", "cover-back"];

/** 물리 인쇄 시트 — 사용자가 지정한 그대로. 바꾸지 않는다. 논리 페이지 1~8을
    8/1, 2/7, 6/3, 4/5로 짝짓는 새들스티치 임포지션이 실제로 맞는지 실측으로
    확인했다(2026-08-11) — 2장을 겹쳐 반으로 접으면 정확히 읽는 순서가 나온다. */
const SHEETS = [
  { id: "sheet1-front", halves: ["cover-back", "cover-front"] },
  { id: "sheet1-back", halves: ["about", "notes"] },
  { id: "sheet2-front", halves: ["article-4", "article-1"] },
  { id: "sheet2-back", halves: ["article-2", "article-3"] },
];

/**
 * 인쇄 전 전체 미리보기 — 2026-08-11 개편. 예전엔 3D 페이지 넘김으로 한 번에 한 쪽만
 * 보여줬다("cropped, partial preview" — 사용자 지적). 8쪽을 읽는 순서 그대로 정적
 * 그리드에 한 번에 다 낸다 — 인쇄 전에 전체 호를 훑어볼 수 있어야 한다는 요구를
 * 그대로 따른 것. 회전·3D 변환 같은 연출은 없앴다 — "불필요한 장식·애니메이션·새
 * UI 시스템을 더하지 말라"는 요구와도 맞는 방향(오히려 이전보다 단순해졌다).
 */
function gridPreviewHTML(pages) {
  const tiles = FLIP_ORDER.map(
    (key, i) => h`<figure class="zb-tile" data-zb-tile="${i}">
    <figcaption class="zb-tile-num">${i + 1} / ${FLIP_ORDER.length}</figcaption>
    <div class="zb-tile-face">${raw(pages[key])}</div>
  </figure>`
  );
  return h`<div class="zb-grid" data-zb-grid>
  ${raw(tiles.join("\n"))}
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
export function renderZinebook({ issue, stories, qrSvg, siteUrl }) {
  if (!issue) return "";
  const pages = buildPages({ stories, qrSvg, siteUrl });

  return h`<button type="button" class="zb-cta" data-zb-open>Create The Answer Zine</button>
<div class="zb-overlay" data-zb-overlay hidden>
  <div class="zb-toolbar">
    <p class="zb-toolbar-title">이번 호 미니 진 — 8쪽 전체 미리보기</p>
    <div class="zb-toolbar-actions">
      <button type="button" class="zb-btn zb-btn--print" data-zb-print>${raw(ICON.print)}<span>Print Zine</span></button>
      <button type="button" class="zb-btn zb-btn--icon" data-zb-close aria-label="닫기">${raw(ICON.close)}</button>
    </div>
  </div>

  <div class="zb-viewer">
    ${raw(gridPreviewHTML(pages))}
  </div>

  <p class="zb-print-hint">인쇄할 때: 양면 인쇄 + 짧은 변 기준 뒤집기, 배경 그래픽 켜기.
  자동 양면이 안 되면 1·2쪽을 먼저 인쇄한 뒤 종이를 뒤집어 3·4쪽을 인쇄한다 — 1·2쪽이
  겉장(Sheet 1), 3·4쪽이 속지(Sheet 2)다.</p>

  ${raw(printSheetsHTML(pages))}
</div>`;
}

export { FLIP_ORDER, SHEETS };

/**
 * 아카이브 인덱스 — 카테고리 카드 그리드.
 *
 * 2026-08-10 전면 개편. 사용자가 첨부한 참고 이미지(도메인별 색 타일 그리드) 포맷을
 * 따른다 — 도메인 필터(.seg) + 전체 스토리 평면 리스트(.list)를 카드 그리드로 완전히
 * 대체했다. **카테고리(도메인)당 카드 하나, 그 도메인의 가장 최신 스토리로 바로
 * 이어진다.** 과거 스토리를 훑어보는 기능은 이제 스토리 페이지의 이전/다음 회차
 * 내비게이션(`.nav-row`)이 담당한다 — 시간순으로 정확히 움직인다(§9.2).
 *
 * 2026-08-11 두 번째 개편 — 위계를 뒤집었다. 예전엔 도메인명이 카드에서 가장 큰
 * 글자였다. 이제 **스토리 헤드라인이 메인(가장 큰 글자)이고, 도메인명은 우측 상단의
 * 작은 라벨**이다(사용자 요청). 배경색도 `colorPaper`(어두운 톤, 흰 글자용)에서
 * `domains/registry.json`의 새 `cardColor`(밝은 파스텔, 검은 글자용)로 바꿨다 — 둘은
 * 대비 방향이 반대라 같이 못 쓴다. `cardColor`가 없는 도메인은 `colorPaper`+흰 글자로
 * 되돌아간다(전 도메인 AA는 test/theme.test.mjs가 두 조합 다 검증한다).
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { u } from "./site.mjs";
import { dateline, SITE } from "./layout.mjs";
import { latestByDomain, visibleDomains } from "./data.mjs";
import { darken } from "./color.mjs";

/** 여러 줄 제목 — 2026-08-12 사용자 요청("쉼표가 자연스럽게 오는 자리에 줄바꿈").
    `headlineLines`/`insightLines`처럼 정본 문자열을 줄 배열로 미리 쪼갠 표시용 필드가
    있으면 <br>로 이어 보여주고, 없으면 원래 한 줄 문자열을 그대로 쓴다(호출부에서 분기). */
const multiline = (lines) => raw(lines.map(escapeHTML).join("<br>"));

/** 카드 배경·글자색. cardColor가 있으면 밝은 파스텔 + 검은 글자(기본), 없으면 예전처럼
    colorPaper(어두운 톤) + 흰 글자로 되돌아간다(.is-dark 모디파이어 — CSS가 인라인
    style 문자열을 뒤지지 않도록 클래스로 분기한다). */
const cardPalette = (d) =>
  d.cardColor ? `background:${d.cardColor};` : `background:var(--dc-${d.key});`;

/* 카드 우측 세로 도메인 라벨 색 — 2026-08-12 사용자가 참고 스크린샷으로 지정했다.
   cardColor와 같은 색상(hue) 계열이지만 훨씬 짙고 채도 높은 톤이다. 매번 손으로
   고르지 않고 cardColor에서 명도만 낮춰 계산한다(color.mjs darken()) — 정본은
   여전히 cardColor 하나뿐이다. cardColor가 없는 도메인(.is-dark 폴백)은 흰 글자
   그대로 쓴다 — 이미 어두운 배경이라 별도 계산이 필요 없다. */
const cardAccent = (d) => (d.cardColor ? darken(d.cardColor) : "#fff");

/* 카드 라벨 — 2026-08-11 열 번째 라운드까지는 도메인 한글명(d.name)을 그대로
   냈다. 사용자 요청으로 영문(d.nameCard — registry.json 전용 필드, 마스트헤드가 쓰는
   d.nameEn과는 다른 복수형: Movies·Music·Books·YouTube)으로 바꿨다. nameCard가 없는
   도메인(카드에 안 나오는 dormant 도메인)은 한글로 되돌아간다 — 안전망일 뿐 실제로는
   호출되지 않는다(visibleDomains가 이미 걸러낸다). */
const cardLabel = (d) => d.nameCard ?? d.name;

/** 카드 라벨을 한 글자씩 세로로 쌓는다 — 2026-08-12 사용자가 참고 스크린샷으로 요청
    ("우측 카테고리 세로 글"). 한 글자당 <span> 하나, flex column + space-between으로
    카드 세로 폭 전체에 고르게 펼쳐진다(글자 수가 다른 "MUSIC"(5)·"MOVIES"(6)·
    "BOOKS"(5)·"YOUTUBE"(7)가 전부 같은 글자 크기를 쓰면서도 카드 높이를 꽉 채운다). */
const verticalLabel = (label) =>
  raw(label.split("").map((ch) => h`<span>${ch}</span>`).join(""));

/** 아직 스토리가 없는 도메인 — 색을 채우지 않는다. 근거(스토리)가 없는데
    카드에만 색을 칠하면 "발행됐다"는 인상을 준다. 세로 라벨은 색 있는 카드
    전용 장식이라(cardAccent가 실제 배경색에서 계산된다) 빈 카드는 예전처럼
    작은 가로 라벨로 남긴다 — 배경이 없는데 색 계산을 할 대상 자체가 없다. */
const emptyCard = (d) => h`<div class="category-card is-empty">
  <span class="category-card-tag-empty">${cardLabel(d)}</span>
  <p class="category-card-status">아직 신호가 없다.</p>
</div>`;

const card = (d, s) => h`<a class="category-card${d.cardColor ? "" : " is-dark"}" data-reveal href="${u(s.url)}" style="${raw(cardPalette(d))}">
  <span class="category-card-tag" aria-hidden="true" style="color:${cardAccent(d)}">${verticalLabel(cardLabel(d))}</span>
  <span class="sr-only">${cardLabel(d)}</span>
  ${s.draft ? raw('<span class="draft-flag">작업 중</span>') : ""}
  <h2 class="category-card-headline">${s.headlineLines ? multiline(s.headlineLines) : s.headline}</h2>
  <p class="category-card-teaser">${s.teaser}</p>
  <span class="category-card-date">최신 · ${s.range}</span>
</a>`;

/* 참고 이미지의 가로 구분 밴드 — grid-column: 1 / -1로 항상 전체 폭을 차지해,
 * 열 수가 바뀌어도(모바일 1열) 새 줄로 떨어진다.
 *
 * 2026-08-11 되돌림 — "모션은 반응에만 쓴다"(design.md §9)는 원칙상 원래는 정적
 * 텍스트였다("전체 아카이브 · 카테고리별 최신 스토리"). 사용자가 검정 바탕에 흰
 * "THE ANSWER ZINE"이 무한 반복 스크롤되는 마퀴로 바꿔 달라고 명시적으로 요청 —
 * §9 원칙의 예외로 design.md에 기록했다. 이어서 이 밴드를 클릭하면 하단에 숨겨둔
 * DIY 진 CTA(`.zb-cta`, display:none)와 같은 오버레이가 열리도록 요청해, 순수
 * 장식이 아니라 두 번째 진입점이 됐다 — `<button data-zb-open>`으로 만들고
 * `assets/zinebook.js`가 `[data-zb-open]` 전부에 리스너를 붙이도록 갱신했다.
 *
 * 마퀴는 콘텐츠를 두 번 이어 붙이고 -50% translateX로 무한 반복한다(카드 뒤집기와
 * 같은 이 파일의 다른 애니메이션들처럼 라이브러리 없이 순수 CSS). 각 절반이 가장
 * 넓은 지원 뷰포트(1920px, design.md §10)보다 넓어야 이음매가 안 보인다 — 텍스트
 * 6회 반복 폭이 1920px를 넉넉히 넘는다. `prefers-reduced-motion: reduce`는
 * css.mjs의 전역 MOTION 규칙(`*` 선택자)이 이미 처리한다. */
const MARQUEE_REPEAT = Array(6).fill("<span>THE ANSWER ZINE</span>").join("");
const divider = () => h`<button type="button" class="category-divider" data-zb-open aria-label="이번 호 미니 진 열기">
  <span class="marquee-track" aria-hidden="true">${raw(MARQUEE_REPEAT + MARQUEE_REPEAT)}</span>
</button>`;

/**
 * 하단 페이저 — 이전/다음 주 인사이트 + 전체 아카이브.
 *
 * 홈은 정의상 항상 최신 회차(issues[0])를 보여준다 — 그래서 "다음 주"는 홈에서는
 * 구조적으로 늘 없다(더 최신인 회차가 있으면 그게 이미 홈이다). 자리는 남겨 둔다 —
 * 대칭이 자연스럽고, `.pager-link.is-off`가 이미 비활성 상태를 위해 있던 클래스다.
 * "이전 주 인사이트"는 그 회차의 인쇄 진(`/print/`)으로 보낸다 — 회차별 개별 페이지가
 * 2026-08-08에 없어졌지만, 인쇄 진에는 그 주 인사이트 헤드라인 + 스토리 전원이 그대로
 * 있어서 "그 주로 돌아가 본다"는 요청을 충족하는 유일한 남은 라우트다.
 */
function pager(issues) {
  const prev = issues[1] ?? null;
  return h`<nav class="pager" aria-label="주간 인사이트 넘기기">
  ${prev
    ? raw(h`<a class="pager-link pager-prev" href="${u(`/${prev.issue}/print/`)}">
      <span class="pager-dir">← 이전 주 인사이트</span>
      <span class="pager-issue">${prev.insight ?? prev.issue}</span>
    </a>`)
    : raw(h`<span class="pager-link pager-prev is-off">
      <span class="pager-dir">← 이전 주 인사이트</span>
      <span class="pager-issue">없음</span>
    </span>`)}
  <a class="pager-now" href="${u("/archive/")}">전체 아카이브 보기</a>
  <span class="pager-link pager-next is-off">
    <span class="pager-dir">다음 주 인사이트 →</span>
    <span class="pager-issue">이번 주가 최신이다</span>
  </span>
</nav>`;
}

export function renderIndex(issues, stories, registry) {
  const latest = issues[0];

  const domains = visibleDomains(registry);
  const tiles = domains.map((d) => {
    const s = latestByDomain(stories, d.key);
    return s ? card(d, s) : emptyCard(d);
  });

  // 2칸 그리드에서 두 장마다 한 번 구분 밴드를 끼운다 — 참고 이미지처럼 두 행 사이에
  // 뜬다. 마지막 장 뒤에는 넣지 않는다.
  const withDividers = [];
  tiles.forEach((t, i) => {
    withDividers.push(t);
    if ((i + 1) % 2 === 0 && i + 1 < tiles.length) withDividers.push(divider());
  });

  const content = h`<main class="shell-edge">
  <p class="dateline">${latest ? dateline(latest.range) : "준비 중"}</p>
  <div class="insight-lead">
    ${latest?.insight ? raw(h`<h1 class="issue-insight" data-reveal>${latest.insightLines ? multiline(latest.insightLines) : latest.insight}</h1>`) : ""}
    ${latest?.insightNote ? raw(h`<p class="issue-insight-note" data-reveal>${latest.insightNote}</p>`) : ""}
  </div>

  <div class="category-grid">
    ${withDividers.map((t) => raw(t))}
  </div>

  ${raw(pager(issues))}
</main>`;

  return {
    title: SITE.name,
    description: `${SITE.tagline} ${stories[0] ? stories[0].teaser : "매주 잘 팔린 것 중에서 왜 팔렸는지 설명할 수 있는 것만 고른다."}`,
    content,
    noindex: false,
    printUrl: latest ? `/${latest.issue}/print/` : null,
    showIntro: true,
  };
}

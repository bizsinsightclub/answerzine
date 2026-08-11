/**
 * 아카이브 인덱스 — 카테고리 카드 그리드.
 *
 * 2026-08-10 전면 개편. 사용자가 첨부한 참고 이미지(도메인별 색 타일 그리드) 포맷을
 * 따른다 — 도메인 필터(.seg) + 전체 스토리 평면 리스트(.list)를 카드 그리드로 완전히
 * 대체했다. **카테고리(도메인)당 카드 하나, 그 도메인의 가장 최신 스토리로 바로
 * 이어진다.** 과거 스토리를 훑어보는 기능은 이제 스토리 페이지의 이전/다음 회차
 * 내비게이션(`.nav-row`)이 담당한다 — 시간순으로 정확히 움직인다(§9.2).
 *
 * 카드 배경에 도메인 색을 풀블리드로 채운다 — design.md §2 불변식 3번이 새로 허용한
 * 다섯 번째 자리다("배경 채색은 이 시스템에 없다"는 문장에 예외가 하나 생겼다).
 * 글자는 흰색만 쓴다 — `colorPaper` 위 흰 글자는 전 도메인 5.1:1 이상으로 AA(4.5:1)를
 * 넉넉히 넘지만, 먹색 글자는 전 도메인 4.5:1 미만이라 못 쓴다(test/theme.test.mjs가 검증).
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { dateline, SITE } from "./layout.mjs";
import { latestByDomain, visibleDomains } from "./data.mjs";

/** 아직 스토리가 없는 도메인 — 색을 채우지 않는다. 근거(스토리)가 없는데
    카드에만 색을 칠하면 "발행됐다"는 인상을 준다. */
const emptyCard = (d) => h`<div class="category-card is-empty">
  <h2 class="category-card-name">${d.name}</h2>
  <p class="category-card-status">아직 신호가 없다.</p>
</div>`;

const card = (d, s) => h`<a class="category-card" data-reveal href="${u(s.url)}" style="--dc: var(--dc-${raw(d.key)})">
  <span class="category-card-eyebrow">최신 · ${s.range}${s.draft ? raw(' <span class="draft-flag">작업 중</span>') : ""}</span>
  <h2 class="category-card-name">${d.name}</h2>
  <p class="category-card-headline">${s.headline}</p>
</a>`;

/* 참고 이미지의 가로 구분 밴드 — 정적이다(움직이지 않는다). design.md §9 "모션은
   반응에만 쓴다"는 원칙상 순수 장식용 애니메이션(마퀴 스크롤 등)은 추가하지 않았다 —
   포맷(가로 밴드가 행을 가른다)만 가져오고 그 안의 모션은 가져오지 않았다.
   grid-column: 1 / -1로 항상 전체 폭을 차지해, 열 수가 바뀌어도(모바일 1열) 새 줄로
   떨어진다. */
const divider = () => h`<div class="category-divider" aria-hidden="true">
  전체 아카이브 · 카테고리별 최신 스토리 · 전체 아카이브 · 카테고리별 최신 스토리
</div>`;

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

  const content = h`<main class="shell">
  <p class="dateline">${latest ? dateline(latest.range) : "준비 중"}</p>
  ${latest?.insight ? raw(h`<h1 class="issue-insight" data-reveal>${latest.insight}</h1>`) : ""}
  ${latest?.insightNote ? raw(h`<p class="issue-insight-note" data-reveal>${latest.insightNote}</p>`) : ""}

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

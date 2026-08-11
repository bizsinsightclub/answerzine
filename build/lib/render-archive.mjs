/**
 * 전체 아카이브 — 모든 스토리의 평면 목록.
 *
 * 2026-08-10 두 번째 라운드 도입. 같은 날 앞선 라운드에서 홈을 카테고리 카드 그리드로
 * 바꾸면서(도메인당 카드 하나 = 최신 스토리) 전체 목록 자체가 없어졌었는데, "전체
 * 아카이브 보기 — 누르면 글 전체 목록"이 다시 필요하다는 요청으로 별도 라우트
 * (`/archive/`)로 되살렸다. 홈의 카드 그리드는 안 건드린다 — 이 페이지는 "더 보고 싶을
 * 때"만 가는 보조 경로다.
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { SITE } from "./layout.mjs";

const rowBlock = (s) => h`<article class="row" data-reveal style="--dc: var(--dc-${raw(s.slug)})">
  <a href="${u(s.url)}">
    <p class="row-line">
      <span class="domain-tag" style="--dc: var(--dc-${raw(s.slug)})">${s.domain}</span>${s.draft ? raw(' <span class="draft-flag">작업 중</span>') : ""}
      <span class="row-headline">${s.headline}</span>
    </p>
    <span class="row-chevron" aria-hidden="true">›</span>
  </a>
</article>`;

export function renderArchive(stories) {
  const content = h`<main class="shell">
  <a class="back-link" href="${u("/")}">← 홈으로</a>
  <h1>전체 아카이브</h1>
  <p class="teaser">지금까지 발행된 모든 스토리다 — 최신 순.</p>

  <div class="list">
    ${stories.map((s) => raw(rowBlock(s)))}
  </div>
</main>`;

  return {
    title: `전체 아카이브 — ${SITE.name}`,
    description: `${SITE.name}에 실린 모든 스토리 목록.`,
    content,
    noindex: false,
  };
}

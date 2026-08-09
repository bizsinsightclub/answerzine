/**
 * 아카이브 인덱스.
 *
 * 원본 프로토타입처럼 위계 없는 평면 리스트다 — 회차 구분 없이 모든 스토리가
 * 카드 하나씩 나열되고, 도메인 필터로 걸러본다. 필터는 data 속성 + 이벤트
 * 위임이라 onclick 문자열 보간이 없다 (§9.7).
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { dateline, SITE } from "./layout.mjs";

const tag = (s) =>
  h`<span class="domain-tag" style="--dc: var(--dc-${raw(s.slug)})">${s.domain}</span>`;

/* 리스트에서는 장르 + 헤드라인만 보인다 — 나머지 콘텐츠는 클릭해서 스토리 페이지로
   들어가야 보인다. 날짜·키커·티저는 상세 페이지에 이미 있다.
   장르와 헤드라인은 한 줄에 나란히 둔다(§row-line) — 위아래로 쌓지 않는다. */
const rowBlock = (s) => h`<article class="row" data-reveal data-domain="${s.slug}" style="--dc: var(--dc-${raw(s.slug)})">
  <a href="${u(s.url)}">
    <p class="row-line">
      ${raw(tag(s))}${s.draft ? raw(' <span class="draft-flag">작업 중</span>') : ""}
      <span class="row-headline">${s.headline}</span>
    </p>
    <span class="row-chevron" aria-hidden="true">›</span>
  </a>
</article>`;

/* 홈 필터 탭에는 안 올린다 — 뉴스·여행은 데이터가 아직 안 읽혀서 UI에서만 뺐다
   (registry.json은 그대로). OTT는 registry.json에서 status를 dormant로 내려
   이미 활성 도메인 목록에서 빠지므로 여기 다시 적을 필요가 없다. */
const HIDDEN_FILTERS = new Set(["뉴스", "여행"]);

export function renderIndex(issues, stories, registry) {
  const latest = issues[0];

  const filters = ["전체", ...registry.domains.map((d) => d.name).filter((n) => !HIDDEN_FILTERS.has(n))];
  const keyOf = (name) => registry.domains.find((d) => d.name === name)?.key ?? "all";

  const content = h`<main class="shell">
  <p class="dateline">${latest ? dateline(latest.range) : "준비 중"}</p>
  ${latest?.insight ? raw(h`<p class="issue-insight" data-reveal>${latest.insight}</p>`) : ""}

  <nav class="seg" data-reveal aria-label="도메인 필터">
    ${filters.map((name, i) =>
      raw(h`<button type="button" data-domain="${raw(keyOf(name))}" aria-pressed="${i === 0 ? "true" : "false"}">${name}</button>`)
    )}
  </nav>

  <div class="list">
    ${stories.map((s) => raw(rowBlock(s)))}
  </div>

  <p class="empty-state" data-empty hidden>이 카테고리는 아직 신호가 없다.</p>

  ${latest ? raw(h`<p style="margin-top:40px"><a class="btn" href="${u(`/${latest.issue}/print/`)}">인쇄용 A4</a></p>`) : ""}
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


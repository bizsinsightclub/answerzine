/**
 * 아카이브 인덱스.
 *
 * 원본 프로토타입처럼 위계 없는 평면 리스트다 — 회차 구분 없이 모든 스토리가
 * 카드 하나씩 나열되고, 도메인 필터로 걸러본다. 필터는 data 속성 + 이벤트
 * 위임이라 onclick 문자열 보간이 없다 (§9.7).
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { blocksOf, parseRange, issueNeighbors, issueLabel } from "./data.mjs";
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

  <nav class="seg" data-reveal aria-label="도메인 필터">
    ${filters.map((name, i) =>
      raw(h`<button type="button" data-domain="${raw(keyOf(name))}" aria-pressed="${i === 0 ? "true" : "false"}">${name}</button>`)
    )}
  </nav>

  <div class="list">
    ${stories.map((s) => raw(rowBlock(s)))}
  </div>

  <p class="empty-state" data-empty hidden>이 카테고리는 아직 신호가 없다.</p>

  ${latest ? raw(h`<p style="margin-top:40px"><a class="btn" href="${u(`/${latest.issue}/`)}">이번 호 전체 보기</a>
    <a class="btn" href="${u(`/${latest.issue}/print/`)}" style="margin-left:8px">인쇄용 A4</a></p>`) : ""}
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

/** 호 넘기기 바. 독자가 잡지를 주별로 넘기는 동작이다. */
function issuePager(issue, issues) {
  const { prev, next, index, total } = issueNeighbors(issues, issue.issue);
  const link = (i, dir) =>
    i
      ? h`<a class="pager-link pager-${raw(dir)}" href="${u(`/${i.issue}/`)}">
      <span class="pager-dir">${dir === "prev" ? "← 지난 호" : "다음 호 →"}</span>
      <span class="pager-issue">${issueLabel(i.issue)}</span>
    </a>`
      : h`<span class="pager-link pager-${raw(dir)} is-off"><span class="pager-dir">${dir === "prev" ? "← 지난 호 없음" : "다음 호 없음 →"}</span></span>`;

  return h`<nav class="pager" aria-label="호 이동">
  ${raw(link(prev, "prev"))}
  <span class="pager-now">${issueLabel(issue.issue)} <span class="pager-count">${index + 1} / ${total}</span></span>
  ${raw(link(next, "next"))}
</nav>`;
}

export function renderIssue(issue, stories, registry, issues = [issue]) {
  const mine = stories.filter((s) => s.issue.issue === issue.issue);

  const content = h`<main class="shell">
  <a class="back-link" href="${u("/")}">← 아카이브로</a>
  ${raw(issuePager(issue, issues))}

  <p class="dateline" style="margin-top:24px">${dateline(issue.range)}</p>
  <h1 style="font-size:clamp(31px,4.4vw,44px)">${issueLabel(issue.issue)}<span class="issue-range"> · ${issue.range}</span>${issue.status === "draft" ? raw(' <span class="draft-flag">작업 중</span>') : ""}</h1>
  ${issue.notes ? raw(h`<details class="editor-note"><summary>편집 메모</summary><p>${issue.notes}</p></details>`) : ""}

  <div class="list">
    ${mine.map((s) => raw(rowBlock(s)))}
  </div>

  <p style="margin-top:40px">
    <a class="btn" href="${u(`/${issue.issue}/print/`)}">인쇄용 A4 진</a>
    <a class="btn" href="${u("/")}" style="margin-left:8px">전체 아카이브</a>
  </p>

  ${raw(issuePager(issue, issues))}
</main>`;

  return {
    title: `${issueLabel(issue.issue)} — ${mine.length}편`,
    description: mine[0] ? mine[0].teaser : `${issue.range} 회차.`,
    content,
    noindex: issue.status === "draft",
    printUrl: `/${issue.issue}/print/`,
  };
}

export { parseRange };

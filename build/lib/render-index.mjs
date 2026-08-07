/**
 * 아카이브 인덱스.
 *
 * 인쇄 진의 "리드 1 + 나머지" 골격을 그대로 화면으로 옮긴다.
 * 필터는 data 속성 + 이벤트 위임이라 onclick 문자열 보간이 없다 (§9.7).
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { blocksOf, parseRange, issueNeighbors, issueLabel } from "./data.mjs";
import { dateline, SITE } from "./layout.mjs";

const tag = (s) =>
  h`<span class="domain-tag" style="--dc: var(--dc-${raw(s.slug)})">${s.domain}</span>`;

function leadBlock(s) {
  const { stat } = blocksOf(s);
  return h`<article class="index-lead" data-reveal data-domain="${s.slug}" style="--dc: var(--dc-${raw(s.slug)})">
  <p class="meta">${raw(tag(s))} · ${s.range}${s.draft ? raw(' <span class="draft-flag">작업 중</span>') : ""}</p>
  ${s.kicker ? raw(h`<p class="kicker">${s.kicker}</p>`) : ""}
  <h2 style="font-size:clamp(30px,4.6vw,46px)"><a href="${u(s.url)}" style="text-decoration:none">${s.headline}</a></h2>
  <p class="teaser">${s.teaser}</p>
  ${stat ? raw(h`<p class="label">${stat.label} <strong style="font-size:15px">${stat.value}</strong></p>`) : ""}
</article>`;
}

/**
 * 리드 아래의 나머지 기사들.
 *
 * PC에서는 오른쪽 레일에 세로줄로 붙어 "리드와는 다른 층"이라는 게 배치로 보인다.
 * 그런데 모바일에서 한 칼럼으로 접히면 그 단서가 통째로 사라져서, 큰 글 하나 뒤에
 * 작은 글이 붙은 모양이 위계가 아니라 서식 오류처럼 읽힌다.
 * 그래서 층이 바뀐다는 것을 글자로도 말한다 — 배치가 사라져도 남는다.
 */
const restBlock = (rest) => h`<div class="index-rest">
  <p class="rest-label" data-rest-label>이번 호에 함께 실린 기사</p>
  ${rest.map((s) => raw(rowBlock(s)))}
</div>`;

const rowBlock = (s) => h`<article class="row" data-reveal data-domain="${s.slug}" style="--dc: var(--dc-${raw(s.slug)})">
  <a href="${u(s.url)}">
    <p class="meta">${raw(tag(s))} · ${s.range}${s.draft ? raw(' <span class="draft-flag">작업 중</span>') : ""}</p>
    ${s.kicker ? raw(h`<p class="kicker">${s.kicker}</p>`) : ""}
    <h3 class="row-headline">${s.headline}</h3>
    <p class="row-teaser">${s.teaser}</p>
  </a>
</article>`;

export function renderIndex(issues, stories, registry) {
  const latest = issues[0];
  const latestStories = stories.filter((s) => s.issue.issue === latest?.issue);
  const [lead, ...rest] = latestStories;
  const older = stories.filter((s) => s.issue.issue !== latest?.issue);

  const filters = ["전체", ...registry.domains.map((d) => d.name)];
  const keyOf = (name) => registry.domains.find((d) => d.name === name)?.key ?? "all";

  const content = h`<main class="shell">
  <p class="dateline">${latest ? dateline(latest.range) : "준비 중"}</p>

  <nav class="seg" data-reveal aria-label="도메인 필터">
    ${filters.map((name, i) =>
      raw(h`<button type="button" data-domain="${raw(keyOf(name))}" aria-pressed="${i === 0 ? "true" : "false"}">${name}</button>`)
    )}
  </nav>

  <div class="index-grid">
    ${lead ? raw(leadBlock(lead)) : ""}
    ${rest.length ? raw(restBlock(rest)) : ""}
  </div>

  <p class="empty-state" data-empty hidden>이 카테고리는 아직 신호가 없다.</p>

  ${latest ? raw(h`<p style="margin-top:40px"><a class="btn" href="${u(`/${latest.issue}/`)}">이번 호 전체 보기</a>
    <a class="btn" href="${u(`/${latest.issue}/print/`)}" style="margin-left:8px">인쇄용 A4</a></p>`) : ""}

  ${issues.length > 1
    ? raw(h`<section style="margin-top:80px">
    <p class="label">지난 호 — 주별로 넘겨보기</p>
    <ol class="issue-list">
      ${issues.map((iss) => {
        const mine = stories.filter((s) => s.issue.issue === iss.issue);
        return raw(h`<li class="issue-item${iss.issue === latest?.issue ? " is-current" : ""}" data-reveal>
        <a href="${u(`/${iss.issue}/`)}">
          <span class="issue-week">${issueLabel(iss.issue)}</span>
          <span class="issue-meta">${iss.range} · ${mine.length}편${iss.status === "draft" ? " · 작업 중" : ""}</span>
          <span class="issue-heads">${mine.map((s) => s.headline).join(" / ")}</span>
        </a>
      </li>`);
      })}
    </ol>
  </section>`)
    : ""}
</main>`;

  return {
    title: SITE.name,
    description: `${SITE.tagline} ${lead ? lead.teaser : "매주 잘 팔린 것 중에서 왜 팔렸는지 설명할 수 있는 것만 고른다."}`,
    content,
    noindex: false,
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
  const [lead, ...rest] = mine;

  const content = h`<main class="shell">
  ${raw(issuePager(issue, issues))}

  <p class="dateline" style="margin-top:24px">${dateline(issue.range)}</p>
  <h1 style="font-size:clamp(28px,4vw,40px)">${issueLabel(issue.issue)}<span class="issue-range"> · ${issue.range}</span>${issue.status === "draft" ? raw(' <span class="draft-flag">작업 중</span>') : ""}</h1>
  ${issue.notes ? raw(h`<details class="editor-note"><summary>편집 메모</summary><p>${issue.notes}</p></details>`) : ""}

  <div class="index-grid">
    ${lead ? raw(leadBlock(lead)) : ""}
    ${rest.length ? raw(restBlock(rest)) : ""}
  </div>

  <p style="margin-top:40px">
    <a class="btn" href="${u(`/${issue.issue}/print/`)}">인쇄용 A4 진</a>
    <a class="btn" href="${u("/")}" style="margin-left:8px">전체 아카이브</a>
  </p>

  ${raw(issuePager(issue, issues))}
</main>`;

  return {
    title: `${issueLabel(issue.issue)} — ${mine.length}편`,
    description: lead ? lead.teaser : `${issue.range} 회차.`,
    content,
    noindex: issue.status === "draft",
  };
}

export { parseRange };

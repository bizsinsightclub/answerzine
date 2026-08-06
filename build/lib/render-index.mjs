/**
 * 아카이브 인덱스.
 *
 * 인쇄 진의 "리드 1 + 나머지" 골격을 그대로 화면으로 옮긴다.
 * 필터는 data 속성 + 이벤트 위임이라 onclick 문자열 보간이 없다 (§9.7).
 */
import { h, raw } from "./html.mjs";
import { blocksOf, parseRange } from "./data.mjs";
import { dateline, SITE } from "./layout.mjs";

const tag = (s) =>
  h`<span class="domain-tag" style="--dc: var(--dc-${raw(s.slug)})">${s.domain}</span>`;

function leadBlock(s) {
  const { stat } = blocksOf(s);
  return h`<article class="index-lead" data-domain="${s.slug}" style="--dc: var(--dc-${raw(s.slug)})">
  <p class="meta">${raw(tag(s))} · ${s.range}${s.draft ? raw(' <span class="draft-flag">작업 중</span>') : ""}</p>
  ${s.kicker ? raw(h`<p class="kicker">${s.kicker}</p>`) : ""}
  <h2 style="font-size:clamp(30px,4.6vw,46px)"><a href="${s.url}" style="text-decoration:none">${s.headline}</a></h2>
  <p class="teaser">${s.teaser}</p>
  ${stat ? raw(h`<p class="label">${stat.label} <strong style="font-size:15px">${stat.value}</strong></p>`) : ""}
</article>`;
}

const rowBlock = (s) => h`<article class="row" data-domain="${s.slug}" style="--dc: var(--dc-${raw(s.slug)})">
  <a href="${s.url}">
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

  <nav class="seg" aria-label="도메인 필터">
    ${filters.map((name, i) =>
      raw(h`<button type="button" data-domain="${raw(keyOf(name))}" aria-pressed="${i === 0 ? "true" : "false"}">${name}</button>`)
    )}
  </nav>

  <div class="index-grid">
    ${lead ? raw(leadBlock(lead)) : ""}
    ${rest.length ? raw(h`<div class="index-rest">${rest.map((s) => raw(rowBlock(s)))}</div>`) : ""}
  </div>

  <p class="empty-state" data-empty hidden>이 카테고리는 아직 신호가 없다.</p>

  ${latest ? raw(h`<p style="margin-top:40px"><a class="btn" href="/${latest.issue}/">이번 호 전체 보기</a>
    <a class="btn" href="/${latest.issue}/print/" style="margin-left:8px">인쇄용 A4</a></p>`) : ""}

  ${older.length
    ? raw(h`<section style="margin-top:80px">
    <p class="label">지난 호</p>
    <div style="margin-top:16px">${older.map((s) => raw(rowBlock(s)))}</div>
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

export function renderIssue(issue, stories, registry) {
  const mine = stories.filter((s) => s.issue.issue === issue.issue);
  const [lead, ...rest] = mine;

  const content = h`<main class="shell">
  <p class="dateline">${dateline(issue.range)}</p>
  <h1 style="font-size:clamp(28px,4vw,40px)">${issue.issue} · ${issue.range}${issue.status === "draft" ? raw(' <span class="draft-flag">작업 중</span>') : ""}</h1>
  ${issue.notes ? raw(h`<p class="teaser" style="font-weight:400">${issue.notes}</p>`) : ""}

  <div class="index-grid">
    ${lead ? raw(leadBlock(lead)) : ""}
    ${rest.length ? raw(h`<div class="index-rest">${rest.map((s) => raw(rowBlock(s)))}</div>`) : ""}
  </div>

  <p style="margin-top:40px">
    <a class="btn" href="/${issue.issue}/print/">인쇄용 A4 진</a>
    <a class="btn" href="/" style="margin-left:8px">전체 아카이브</a>
  </p>
</main>`;

  return {
    title: `${issue.issue} — ${mine.length}편`,
    description: lead ? lead.teaser : `${issue.range} 회차.`,
    content,
    noindex: issue.status === "draft",
  };
}

export { parseRange };

/**
 * 스토리 페이지.
 *
 * 본문은 45~75자 한 칼럼(col 1–7), 숫자와 인사이트는 오른쪽 sticky 레일(col 9–12)에 붙는다.
 * 스탯이 본문 옆에 상주하므로 "근거는 늘 옆에 있다"는 태도가 레이아웃으로 표현되고,
 * hover에 의존하던 출처 노출(§9.9)이 구조적으로 해소된다.
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { u } from "./site.mjs";
import { blocksOf } from "./data.mjs";
import { sparklineSVG } from "./sparkline.mjs";

const dcVar = (story) => (story.slug ? `--dc: var(--dc-${story.slug});` : "");

/**
 * 스탯 카드.
 *
 * 추세선은 출처가 과거 주차를 다시 내주는 경우에만 존재한다 (whitelist.series === "archived").
 * 그렇지 않은 회차는 `trend` 자체가 데이터에 없고, 그 자리에 `basis` —
 * "이 값이 무엇과 비교한 값인가" 한 문장이 들어간다. 없는 선을 그리는 것보다
 * 비교 기준을 글자로 밝히는 쪽이 검증 가능하다. tools/qa.mjs가 둘 중 하나를 강제한다.
 */
function statCard(stat, story) {
  if (!stat) return "";
  const color = "currentColor";
  const hasTrend = Array.isArray(stat.trend) && stat.trend.length >= 2;

  const figure = hasTrend
    ? h`<div class="stat-spark" style="color:var(--dc,currentColor)">${raw(sparklineSVG(stat.trend, color, { label: stat.label ?? "추이", invert: !!stat.trendInvert }))}</div>
    <p class="stat-axis">${stat.axisCaption}</p>`
    : stat.basis
      ? h`<p class="stat-basis"><span class="stat-basis-label">비교 기준</span>${stat.basis}</p>`
      : "";

  return h`<aside class="rail" data-reveal style="${raw(dcVar(story))}">
  <div class="stat-card${hasTrend ? "" : " is-single"}">
    <div class="label">${stat.label}</div>
    <div class="stat-value">${stat.value}</div>
    ${raw(figure)}
    ${stat.sourceUrl
      ? raw(h`<a class="stat-source" href="${stat.sourceUrl}" target="_blank" rel="noopener noreferrer">${stat.sourceLabel ?? "출처 확인하기"} &#8599;</a>`)
      : ""}
  </div>
</aside>`;
}

function pullquote(quote, story) {
  if (!quote) return "";
  const ins = quote.insight;
  return h`<figure class="pullquote" data-reveal style="${raw(dcVar(story))}">
  ${quote.text}
  ${ins
    ? raw(h`<details class="insight">
    <summary>행동경제학 · ${ins.concept}</summary>
    <div class="insight-body">${ins.note}</div>
  </details>`)
    : ""}
</figure>`;
}

export function renderStory(story, { prev, next } = {}) {
  const { texts, stat, quote } = blocksOf(story);
  const title = story.headline ?? "";
  const description = story.teaser ?? "";

  const body = [
    texts[0] ? h`<p>${texts[0].text}</p>` : "",
    pullquote(quote, story),
    texts[1] ? h`<p>${texts[1].text}</p>` : "",
    texts[2] ? h`<p>${texts[2].text}</p>` : "",
  ].join("\n");

  const navLink = (s, kind) =>
    s
      ? h`<a href="${u(s.url)}"><div class="nav-label">${kind === "prev" ? "← 이전 회차" : "다음 회차 →"}</div><div class="nav-headline">${s.headline}</div></a>`
      : h`<div class="nav-label" style="opacity:.4">${kind === "prev" ? "← 이전 회차 없음" : "다음 회차 없음 →"}</div>`;

  const content = h`<main class="shell" style="${raw(dcVar(story))}">
  <article class="story-grid">
    <header class="story-head" data-reveal>
      <p class="meta"><span class="domain-tag">${story.domain}</span> · ${story.range}${story.draft ? raw(' <span class="draft-flag">작업 중</span>') : ""}</p>
      ${story.kicker ? raw(h`<p class="kicker">${story.kicker}</p>`) : ""}
      <h1 class="story-headline">${story.headline}</h1>
      <p class="teaser">${story.teaser}</p>
    </header>

    <div class="story-body" data-reveal>
${raw(body)}
    </div>

${raw(statCard(stat, story))}
  </article>

  <nav class="nav-row">
    <div class="nav-prev">${raw(navLink(prev, "prev"))}</div>
    <div class="nav-next">${raw(navLink(next, "next"))}</div>
  </nav>

  <p style="margin-top:32px"><a class="btn" href="${u(`/${story.issue.issue}/`)}">이 회차 전체 보기</a></p>
</main>`;

  return { title, description, content, noindex: !!story.draft };
}

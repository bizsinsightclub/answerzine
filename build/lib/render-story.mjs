/**
 * 스토리 페이지.
 *
 * 원본 프로토타입처럼 폭 전체에서 한 칼럼이다 — 리드/레일로 쪼개지 않는다.
 * 스탯은 본문 흐름 안의 둥근 패널이고, 출처 링크는 항상 보인다 —
 * hover에 의존하던 프로토타입의 출처 노출(§9.9)은 그대로 해소돼 있다.
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { u } from "./site.mjs";
import { blocksOf } from "./data.mjs";

const dcVar = (story) => (story.slug ? `--dc: var(--dc-${story.slug});` : "");

/**
 * 스탯 카드.
 *
 * 2026-08-08부터 차트(스파크라인)·축설명·비교기준 문장은 화면에 내지 않는다 — 사용자
 * 피드백으로 라벨+수치+출처 링크만 남긴다. `trend`/`axisCaption`/`basis`는 데이터에는
 * 계속 남아 있다(재현 가능한 선이라는 §3.4의 약속, `tools/qa.mjs` 검증도 그대로다) —
 * 순수 렌더링만 뺐다.
 */
function statCard(stat, story) {
  if (!stat) return "";

  return h`<div class="stat-card is-single" data-reveal style="${raw(dcVar(story))}">
    <div class="label">${stat.label}</div>
    <div class="stat-value">${stat.value}</div>
    ${stat.sourceUrl
      ? raw(h`<a class="stat-source" href="${stat.sourceUrl}" target="_blank" rel="noopener noreferrer">${stat.sourceLabel ?? "출처 확인하기"} &#8599;</a>`)
      : ""}
</div>`;
}

/**
 * 풀쿼트.
 *
 * 2026-08-08부터 `insight`(행동경제학 개념·설명)는 화면에 내지 않는다 — 인용문 한 줄만
 * 보여준다. `quote.insight`는 데이터에는 계속 남는다 — S5 집필 규율(인사이트 3문 테스트,
 * CLAUDE.md §5.1)과 `tools/qa.mjs`의 필수값 검증은 그대로 살아 있는 내부 품질 장치다.
 */
function pullquote(quote, story) {
  if (!quote) return "";
  return h`<figure class="pullquote" data-reveal style="${raw(dcVar(story))}">
  ${quote.text}
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
  <a class="back-link" href="${u("/")}">← 목록으로</a>
  <article class="story">
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

  <p style="margin-top:32px"><a class="btn" href="${u("/")}">전체 아카이브 보기</a></p>
</main>`;

  // 이전/다음 회차 + 전체 보기가 페이지의 진짜 바닥이다 — 그 아래 사이트 공통 설명
  // (footer)이 또 붙으면 "최하단"이 아니게 된다. 스토리 페이지에서만 footer를 뺀다.
  return {
    title, description, content, noindex: !!story.draft, showFooter: false,
    printUrl: `/${story.issue.issue}/print/`,
  };
}

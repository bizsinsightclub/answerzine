/**
 * A4 인쇄 진.
 *
 * 프로토타입은 .zine-page 내용이 HTML에 하드코딩돼 있었다. 그래서
 * issues/2026-w31.json에서 제외한 영화 편(국내 개봉 전 데이터 인용)이
 * 종이 지면에는 그대로 살아 있었다 — 정본이 둘이면 한쪽만 고쳐진다.
 *
 * 이제 입력에 없으면 지면에도 없다. test/zine.test.mjs가 그 사고를 직접 재현해 막는다.
 * 헤드라인·티저는 웹과 같은 값을 참조하므로 CLAUDE.md §8 QA #17은 위반이 불가능하다.
 *
 * 2026-08-10 전면 개편 — 사용자가 첨부한 참고 목업(print.html)의 포맷을 따른다.
 * "리드 1 + 미니 3" 위계를 없애고 그 주 통과분 전원을 동등한 행으로 낸다. 사진·콜라주·
 * 테이프·스티커·회전각 시스템은 그 부품 자체가 빠졌다(design.md §2 불변식 갱신).
 * 폰트·색은 목업을 따르지 않는다 — 이 세션에 확정한 헬베티카+화이트/블랙 톤 그대로다.
 */
import { h, raw } from "./html.mjs";
import { u, absolute } from "./site.mjs";
import { blocksOf } from "./data.mjs";
import { dateline, SITE } from "./layout.mjs";

/** 지면 하단에 적을 사람이 읽는 주소. "https://" 없이, 실제 배포 도메인 그대로.
    2026-08-10부터 QR 대신 텍스트로 낸다(목업 그대로) — 홈 아카이브를 가리킨다. */
const displayUrl = () => absolute("/").replace(/^https?:\/\//, "").replace(/\/$/, "");

/** 인쇄 본문. zineBody가 있으면 그대로, 없으면 text 블록 셋을 쓴다.
    2026-08-10부터 renderZinePage()는 이 함수를 안 쓴다(story.teaser 한 문장으로
    바뀌었다) — zineBody 커스텀 축약이 여전히 유효한 개념이라 export는 유지한다. */
export function zineBodyFor(story) {
  if (Array.isArray(story.zineBody) && story.zineBody.length) return story.zineBody;
  return blocksOf(story).texts.map((t) => t.text);
}

/** 스토리 한 편 = 지면 한 행. 왼쪽은 본문(킥커·헤드라인·티저·인사이트·출처),
    오른쪽은 stat.value 한 방(statcol) — 참고 목업의 .sheet-story/.statcol 구조. */
function storyRow(story) {
  const { stat, quote } = blocksOf(story);
  return h`<div class="zine-story">
  <div class="zine-story-main">
    <div class="zine-kicker">${story.domain}${story.kicker ? ` · ${story.kicker}` : ""}</div>
    <h3 class="zine-story-headline">${story.headline}</h3>
    <p class="zine-story-body">${story.teaser}</p>
    ${quote?.insight?.note
      ? raw(h`<div class="zine-insight-note"><b>인사이트</b>${quote.insight.note}</div>`)
      : ""}
    ${stat?.sourceUrl
      ? raw(h`<div class="zine-source">출처: <a href="${stat.sourceUrl}">${stat.sourceLabel ?? "출처 확인하기"}</a></div>`)
      : ""}
  </div>
  <div class="zine-story-stat">
    ${stat
      ? raw(h`<span class="zine-stat-value">${stat.value}</span><span class="zine-stat-label">${stat.label}</span>`)
      : ""}
  </div>
</div>`;
}

export function renderZinePage(issue, stories, registry = {}) {
  const mine = stories.filter((s) => s.issue?.issue === issue.issue || stories === issue.stories);
  const list = mine.length ? mine : (issue.stories ?? []);
  const warnings = [];

  if (!list.length) warnings.push("이번 주는 게재할 스토리가 없다. 회차가 비어 있다.");

  const content = h`<div class="zine-page" id="zine-page">
  <header class="zine-masthead">
    <img class="zine-logo" src="${raw(u("/assets/img/logo-dark.png"))}" alt="${SITE.name}" width="518" height="265">
    <div class="zine-ruleline"></div>
    <div class="zine-dateline">${dateline(issue.range)}</div>
    ${issue.insightPrint ? raw(h`<p class="zine-insight">${issue.insightPrint}</p>`) : ""}
  </header>

  ${list.length
    ? raw(list.map(storyRow).join("\n"))
    : raw('<p class="zine-story-body">이번 주는 게재할 스토리가 없다.</p>')}

  <footer class="zine-footer">
    ${SITE.name} · ${issue.issue} · 전체 아카이브 ${displayUrl()} · 각 기사의 인사이트는 편집 의견입니다
  </footer>
</div>`;

  return { title: `${issue.issue} 인쇄용 A4`, content, stories: list, warnings };
}

/** 인쇄 진을 감싸는 미리보기 페이지. "← 목록으로"로 돌아가거나, "인쇄 / PDF로 저장"
   버튼으로 바로 인쇄할 수 있다 — 버튼은 assets/app.js의 기존 [data-print] 리스너를
   그대로 쓴다(2026-08-10 되돌림, 오늘 이전 라운드에서 뺐던 버튼이다). */
export function renderZinePreview(issue, stories, registry) {
  const z = renderZinePage(issue, stories, registry);
  const content = h`<main class="zine-preview">
  <div class="zine-preview-cta">
    <a class="back-link" href="${u("/")}">← 목록으로</a>
    <button class="btn" type="button" data-print>인쇄 / PDF로 저장</button>
  </div>
  <div class="zine-mount" style="margin-top:32px">${raw(z.content)}</div>
</main>`;

  return {
    title: z.title,
    description: `${issue.issue} 회차의 A4 인쇄용 지면.`,
    content,
    noindex: true,
    warnings: z.warnings,
  };
}

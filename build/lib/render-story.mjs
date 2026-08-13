/**
 * 스토리 페이지.
 *
 * 2026-08-10 개편 — 사용자가 첨부한 참고 목업(movie.html)의 포맷을 따른다.
 * 스탯 패널과 인사이트를 헤드라인 바로 아래로 끌어올려 "무슨 일이, 왜 중요한지"를
 * 본문을 읽기 전에 먼저 보여주고, 본문 세 문단은 끊김 없이 이어 읽게 한 뒤,
 * 인용문 → 출처 → 다음 회차 순으로 마무리한다. 폰트·색은 목업을 따르지 않는다 —
 * 이 세션에 이미 확정한 헬베티카+화이트/블랙 톤을 그대로 쓴다(CLAUDE.md 참고).
 *
 * `quote.insight.note`는 2026-08-08에 화면에서 뺐다가 이번 개편으로 다시 보인다
 * (design.md §2 불변식 2번 갱신). 출처 링크는 항상 보인다 — hover에 의존하던
 * 프로토타입의 출처 노출(§9.9)은 그대로 해소돼 있다.
 *
 * 2026-08-11 일곱 번째 라운드: 넓은 화면에서 본문이 왼쪽에만 몰려 있다는 지적으로,
 * design.md §5.2/5.3이 이미 정의해 두고도 구현되지 않았던 12칼럼 비대칭 그리드
 * (본문 1/span 7 + 근거 레일 9/span 4)를 실제로 붙였다 — `.story-grid`/`.story-col`/
 * `.story-rail`(스탯·출처·인사이트를 담는다). 1200px 미만에서는 그냥 위아래로
 * 쌓인다(레일이 본문보다 먼저 나온다 — "무슨 일이 왜 중요한지 먼저" 순서 유지).
 *
 * 2026-08-12 스물두 번째 라운드 — 바이라인을 "BY ANSWER ZINE · {도메인} 데이터
 * 기반"에서 "- BY ANZINE"으로 줄이고 우측 정렬했다(사용자가 첨부한 스크린샷).
 * 도메인 정보는 이미 바로 위 `.meta`(도메인 태그+범위)에 있어 중복이었다 —
 * "ANZINE"은 인트로 애니메이션·DIY 진 표지가 이미 쓰는 브랜드 축약형(SITE.name
 * "ANSWER ZINE" 자체는 안 바뀐다, layout.mjs intro() 참고)과 같은 문법을 여기서도
 * 쓴다. SITE.name을 더는 안 써서 import도 뺐다.
 *
 * 2026-08-13 — 바이라인을 티저 아래(헤드라인/티저와 스탯 패널 사이 구분선 역할)에서
 * 헤드라인과 같은 줄 우측으로 옮겼다(사용자가 첨부한 전/후 스크린샷). `.story-title-row`
 * (헤드라인 + 바이라인 flex 행)로 묶었다 — 헤드라인이 늘어나는 칸, 바이라인은
 * `margin-left:auto`로 항상 오른쪽에 붙는다(줄바꿈되어도 유지). 옛 위치의
 * border-bottom(섹션 구분선 역할)은 이 이동으로 없어졌다 — "To Be" 스크린샷에도
 * 그 구분선이 없다.
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { u } from "./site.mjs";
import { blocksOf } from "./data.mjs";
import { sparklineSVG } from "./sparkline.mjs";

const dcVar = (story) => (story.slug ? `--dc: var(--dc-${story.slug});` : "");

/**
 * 스탯 패널.
 *
 * 2026-08-08~2026-08-10 사이에는 여기 출처 링크까지 같이 있었다. 이번 개편으로
 * 라벨+수치만 남기고 출처는 `sourceBox()`로 뺐다(목업의 `.stat-panel`/`.source-box`
 * 분리 구조).
 *
 * 2026-08-12 스물여섯 번째 라운드 — 차트(스파크라인) 렌더를 되살렸다. "차트를 자동으로
 * 그릴지 판단하라"는 사용자 요청(ANZINE Official Data Sources 문서 §4)에 대한 답은 이미
 * §3.4가 정해 놓았다: `stat.trend`가 있다는 것 자체가 "이 값은 재현 가능한 시계열"이라는
 * qa.mjs 검증(series가 archived거나 trendSnapshots가 갖춰짐)을 통과했다는 뜻이다 —
 * 별도의 "쓸모 판단" 로직을 새로 짓지 않고 이 기존 게이트를 그대로 재사용한다.
 * `trend`가 없는 회차(2026-08-12 현재 발행된 4개 회차 전부 — 아직 아무 스토리도 4주
 * 이상 시계열을 못 채웠다)는 이전처럼 라벨+수치만 낸다. 막대·산점도·파이는 넣지
 * 않았다 — 어느 도메인 데이터에도 비교 대상 수치(경쟁작·전작 대비)가 아직 없어서,
 * 없는 데이터를 지어내지 않고서는(§5 "Do not invent missing values") 그릴 수 없다.
 * 그런 지표가 도메인 문서에 실제로 생기면 그때 막대 차트를 추가한다.
 *
 * `trend`가 없고 `basis`만 있으면 "비교 기준" 문장을 낸다 — CLAUDE.md §3.4가 이미
 * "화면에는 `비교 기준`으로 렌더된다"고 적어 두고 있었는데 실제 렌더러는 그 문장을
 * 낸 적이 없었다(문서-코드 불일치, 이번에 맞췄다). design.md "스파크라인" 절 참고.
 */
function statPanel(stat, story) {
  if (!stat) return "";
  const hasChart = Array.isArray(stat.trend) && stat.trend.length >= 2;
  const chart = hasChart
    ? h`<div class="stat-chart">
    ${raw(sparklineSVG(stat.trend, "var(--dc)", { label: stat.label, invert: !!stat.trendInvert }))}
    ${stat.axisCaption ? raw(h`<p class="stat-axis-caption">${stat.axisCaption}</p>`) : ""}
  </div>`
    : stat.basis
      ? h`<p class="stat-basis">비교 기준 · ${stat.basis}</p>`
      : "";
  return h`<div class="stat-card is-single" data-reveal style="${raw(dcVar(story))}">
    <div class="label">${stat.label}</div>
    <div class="stat-value">${stat.value}</div>
${raw(chart)}
</div>`;
}

/**
 * 인사이트 콜아웃.
 *
 * 2026-08-08에 "화면에는 안 보인다"로 뺐던 걸(design.md §2 불변식 2번) 이번 개편으로
 * 되돌린다 — 사용자가 첨부한 목업의 `.insight` 콜아웃이 다시 요구했다. `concept`(개념명)
 * 은 라벨로 쓰지 않는다 — 고정 문구 "인사이트"를 쓴다. 보여주는 건 `note`(왜 일반적
 * 현상인지 + 이번 사례가 어디에 해당하는지) 한 문단뿐이다.
 */
function insightNote(quote, story) {
  if (!quote?.insight?.note) return "";
  return h`<div class="insight-note" data-reveal style="${raw(dcVar(story))}">
  <span class="insight-label">인사이트</span>
  <p>${quote.insight.note}</p>
</div>`;
}

/**
 * 풀쿼트 — 이 회차의 "답의 순간". insight 설명은 위 insightNote()가 이미 냈으므로
 * 여기는 quote.text 한 줄뿐이다(§6 "A가 아니라 B다" 대구조).
 *
 * 2026-08-11 — 사용자의 브랜드 방향 문서("If someone screenshots only one part of an
 * article, the Answer should be the part they screenshot")에 따라 "THE ANSWER" 라벨을
 * 붙였다. quote.text는 이미 그 역할을 하는 문장이었지만 화면에서 다른 본문 문단과
 * 시각적으로 구분되지 않았다 — insight-note가 이미 쓰는 라벨 패턴(`.insight-label`)을
 * 그대로 재사용하되 별도 클래스(`.answer-label`)로 둔다. 두 콜아웃은 다른 컴포넌트라
 * 클래스를 공유하면 나중에 독립적으로 조정할 여지가 없어진다(design.md §2 참고).
 */
function pullquote(quote, story) {
  if (!quote) return "";
  return h`<figure class="pullquote" data-reveal style="${raw(dcVar(story))}">
  <span class="answer-label">THE ANSWER</span>
  ${quote.text}
</figure>`;
}

/** 원문 출처 — 스탯 패널에서 분리해 본문 뒤에 낸다(목업의 `.source-box`). */
function sourceBox(stat) {
  if (!stat?.sourceUrl) return "";
  return h`<div class="source-box" data-reveal>
  <span class="lbl">원문 출처</span>
  <a class="stat-source" href="${stat.sourceUrl}" target="_blank" rel="noopener noreferrer">${stat.sourceLabel ?? "출처 확인하기"} &#8599;</a>
</div>`;
}

export function renderStory(story, { prev, next } = {}) {
  const { texts, stat, quote } = blocksOf(story);
  const title = story.headline ?? "";
  const description = story.teaser ?? "";

  const body = [texts[0], texts[1], texts[2]]
    .filter(Boolean)
    .map((t) => h`<p>${t.text}</p>`)
    .join("\n");

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
      <div class="story-title-row">
        <h1 class="story-headline">${story.headline}</h1>
        <p class="byline">- BY ANZINE</p>
      </div>
      <p class="teaser">${story.teaser}</p>
    </header>

    <div class="story-grid">
      <aside class="story-rail">
${raw(statPanel(stat, story))}
${raw(sourceBox(stat))}
${raw(insightNote(quote, story))}
      </aside>
      <div class="story-col">
        <div class="story-body" data-reveal>
${raw(body)}
        </div>
${raw(pullquote(quote, story))}
      </div>
    </div>
  </article>

  <nav class="nav-row">
    <div class="nav-prev">${raw(navLink(prev, "prev"))}</div>
    <div class="nav-next">${raw(navLink(next, "next"))}</div>
  </nav>

  <div class="to-archive"><a href="${u("/")}">전체 아카이브 보기</a></div>
</main>`;

  // 이전/다음 회차 + 전체 보기가 페이지의 진짜 바닥이다 — 그 아래 사이트 공통 설명
  // (footer)이 또 붙으면 "최하단"이 아니게 된다. 스토리 페이지에서만 footer를 뺀다.
  // 참고 목업엔 footer("한 장 요약 PDF 보기" 링크)가 있지만, 그 기능은 이미 사이트
  // 전역 우하단 고정 CTA(header-cta, "한 장 요약 보기")가 커버해서 다시 넣지 않는다.
  return {
    title, description, content, noindex: !!story.draft, showFooter: false,
    printUrl: `/${story.issue.issue}/print/`,
  };
}

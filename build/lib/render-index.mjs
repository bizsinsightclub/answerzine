/**
 * 아카이브 인덱스 — 카테고리 카드 그리드.
 *
 * 2026-08-10 전면 개편. 사용자가 첨부한 참고 이미지(도메인별 색 타일 그리드) 포맷을
 * 따른다 — 도메인 필터(.seg) + 전체 스토리 평면 리스트(.list)를 카드 그리드로 완전히
 * 대체했다. **카테고리(도메인)당 카드 하나, 그 도메인의 가장 최신 스토리로 바로
 * 이어진다.** 과거 스토리를 훑어보는 기능은 이제 스토리 페이지의 이전/다음 회차
 * 내비게이션(`.nav-row`)이 담당한다 — 시간순으로 정확히 움직인다(§9.2).
 *
 * 2026-08-11 두 번째 개편 — 위계를 뒤집었다. 예전엔 도메인명이 카드에서 가장 큰
 * 글자였다. 이제 **스토리 헤드라인이 메인(가장 큰 글자)이고, 도메인명은 우측 상단의
 * 작은 라벨**이다(사용자 요청). 배경색도 `colorPaper`(어두운 톤, 흰 글자용)에서
 * `domains/registry.json`의 새 `cardColor`(밝은 파스텔, 검은 글자용)로 바꿨다 — 둘은
 * 대비 방향이 반대라 같이 못 쓴다. `cardColor`가 없는 도메인은 `colorPaper`+흰 글자로
 * 되돌아간다(전 도메인 AA는 test/theme.test.mjs가 두 조합 다 검증한다).
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { u } from "./site.mjs";
import { SITE } from "./layout.mjs";
import { latestByDomain, visibleDomains } from "./data.mjs";
import { darken } from "./color.mjs";

/** 여러 줄 제목 — 2026-08-12 사용자 요청("쉼표가 자연스럽게 오는 자리에 줄바꿈").
    `headlineLines`/`insightLines`처럼 정본 문자열을 줄 배열로 미리 쪼갠 표시용 필드가
    있으면 <br>로 이어 보여주고, 없으면 원래 한 줄 문자열을 그대로 쓴다(호출부에서 분기). */
const multiline = (lines) => raw(lines.map(escapeHTML).join("<br>"));

/** 통합 인사이트 부연설명(issue.insightNote)을 인용부호로 감싼 리드 문장과 그 뒤
    분석 문단으로 쪼갠다(CLAUDE.md §5.5 3단 구조의 1단 — "인용부호로 감싼 한 문장짜리
    명제로 연다"). 2026-08-12 스물한 번째 라운드 — 사용자가 스크린샷으로 지정: 화면에서
    리드 문장은 굵고 밝게, 이어지는 분석 문단은 옅게 보이도록 별도 렌더한다. 문두가
    큰따옴표로 시작하지 않으면(리드 없이 바로 분석 문단인 과거 회차) null을 돌려주고,
    호출부가 예전처럼 통짜 문단 하나로 되돌아간다 — 그 형식의 기존 동작을 그대로
    보존한다. */
const LEAD_QUOTE = /^"([^"]+)"\s*(.*)$/s;
function splitInsightNote(note) {
  const m = LEAD_QUOTE.exec(note);
  if (!m || !m[2].trim()) return null;
  return { lead: `"${m[1]}"`, body: m[2].trim() };
}

function insightNoteHTML(note) {
  const split = splitInsightNote(note);
  if (!split) return h`<p class="issue-insight-note" data-reveal>${note}</p>`;
  return h`<div class="issue-insight-note" data-reveal>
  <p class="insight-note-lead">${split.lead}</p>
  <p class="insight-note-body">${split.body}</p>
</div>`;
}

/** 카드 배경·글자색. cardColor가 있으면 밝은 파스텔 + 검은 글자(기본), 없으면 예전처럼
    colorPaper(어두운 톤) + 흰 글자로 되돌아간다(.is-dark 모디파이어 — CSS가 인라인
    style 문자열을 뒤지지 않도록 클래스로 분기한다). */
const cardPalette = (d) =>
  d.cardColor ? `background:${d.cardColor};` : `background:var(--dc-${d.key});`;

/* 카드 우측 세로 도메인 라벨 색 — 2026-08-12 사용자가 참고 스크린샷으로 지정했다.
   cardColor와 같은 색상(hue) 계열이지만 훨씬 짙고 채도 높은 톤이다. 매번 손으로
   고르지 않고 cardColor에서 명도만 낮춰 계산한다(color.mjs darken()) — 정본은
   여전히 cardColor 하나뿐이다. cardColor가 없는 도메인(.is-dark 폴백)은 흰 글자
   그대로 쓴다 — 이미 어두운 배경이라 별도 계산이 필요 없다. */
const cardAccent = (d) => (d.cardColor ? darken(d.cardColor) : "#fff");

/* 카드 라벨 — 2026-08-11 열 번째 라운드까지는 도메인 한글명(d.name)을 그대로
   냈다. 사용자 요청으로 영문(d.nameCard — registry.json 전용 필드, 마스트헤드가 쓰는
   d.nameEn과는 다른 복수형: Movies·Music·Books·YouTube)으로 바꿨다. nameCard가 없는
   도메인(카드에 안 나오는 dormant 도메인)은 한글로 되돌아간다 — 안전망일 뿐 실제로는
   호출되지 않는다(visibleDomains가 이미 걸러낸다). */
const cardLabel = (d) => d.nameCard ?? d.name;

/** 카드 라벨을 한 글자씩 세로로 쌓는다 — 2026-08-12 사용자가 참고 스크린샷으로 요청
    ("우측 카테고리 세로 글"). 한 글자당 <span> 하나, flex column + space-between으로
    카드 세로 폭 전체에 고르게 펼쳐진다(글자 수가 다른 "MUSIC"(5)·"MOVIES"(6)·
    "BOOKS"(5)·"YOUTUBE"(7)가 전부 같은 글자 크기를 쓰면서도 카드 높이를 꽉 채운다). */
const verticalLabel = (label) =>
  raw(label.split("").map((ch) => h`<span>${ch}</span>`).join(""));

/** 아직 스토리가 없는 도메인 — 색을 채우지 않는다. 근거(스토리)가 없는데
    카드에만 색을 칠하면 "발행됐다"는 인상을 준다. 세로 라벨은 색 있는 카드
    전용 장식이라(cardAccent가 실제 배경색에서 계산된다) 빈 카드는 예전처럼
    작은 가로 라벨로 남긴다 — 배경이 없는데 색 계산을 할 대상 자체가 없다. */
const emptyCard = (d) => h`<div class="category-card is-empty">
  <span class="category-card-tag-empty">${cardLabel(d)}</span>
  <p class="category-card-status">아직 신호가 없다.</p>
</div>`;

/**
 * 카드 호버 — 커버가 우상단→좌하단으로 벗겨지며 뒤의 사진(흑백)이 드러난다.
 * (2026-08-13 사용자가 첨부한 4장의 참고 이미지 + 요청.)
 *
 * `story.image`가 있는 카드만 이 효과를 쓴다(`.has-photo` 수식자) — 없는 카드는
 * 예전처럼 헤드라인 밑줄 호버로 남는다(css.mjs `.category-card:hover
 * .category-card-headline`, 안 건드렸다). 사진 레이어(`.category-card-photo`)는
 * 카드 뒤에 절대 위치로 깔리고, 기존에 `.category-card` 자신이 하던 배경색·
 * 패딩·flex 배치 역할은 전부 새 `.category-card-cover`로 옮겼다 — 커버 하나만
 * 독립적으로 clip-path를 걸어 벗겨낼 수 있어야 하기 때문이다. 커버는 여전히
 * 일반 흐름(in-flow)에 있어 카드 높이를 그 내용(헤드라인 줄 수 등)에 맞춰
 * 그대로 키운다 — absolute로 바꾸면 카드가 min-height에 고정돼 긴 헤드라인이
 * 잘리는 회귀가 생긴다(직접 실측으로 확인하고 피했다).
 *
 * story.image는 u()를 거쳐야 한다 — 이 사이트의 모든 내부 링크가 그렇듯(site.mjs
 * 상단 주석, test/site.test.mjs가 강제) GitHub Pages 프로젝트 사이트 하위 경로
 * 배포 시 접두사가 안 붙으면 404가 난다. 처음 이 기능을 만들 때는 아직 어느
 * story에도 image가 없어서 이 <img> 태그 자체가 렌더된 적이 없었고, 그래서
 * u() 누락이 테스트를 안 거치고 넘어갔다 — 실제 사진을 연결하면서 발견하고 고쳤다.
 */
/* 2026-08-13 — 모바일에서 문자간격(세로로 쌓인 글자 사이 간격, line-height로
   조절하는 그 자리)을 더 좁혀 달라는 요청에 "YOUTUBE는 안 잘릴 정도로"라는
   단서가 붙었다. 실측(getBoundingClientRect)해 보니 단일 line-height 값으로는
   둘 다 못 만족한다 — 짧은 단어(MUSIC·BOOKS, 5자)는 간격을 완전히 닫으려면
   line-height ≈1.5~1.6이 필요한데, 긴 단어(YOUTUBE 7자·MOVIES 6자)는 그 값에서
   이미 카드 높이를 넘어서(overflow) 글자가 카드 경계에서 잘리기 시작한다 — 글자
   수가 적을수록 채워야 할 세로 칸이 커서 필요한 line-height가 크고, 글자 수가
   많을수록 이미 꽉 차 있어 조금만 늘려도 넘친다. 그래서 글자 수 기준으로 두
   단계(≤5자만 더 좁힘)로 나눴다 — `card-tag--tight` 클래스, css.mjs 참고. */
/**
 * story.cardTeaser — 2026-08-13 "ANZINE — CARD HEADER DESCRIPTION REWRITE".
 *
 * 카드 밑 한 줄의 역할을 바꿔 달라는 요청 — 기사 요약("무슨 일이, 왜")이 아니라
 * 클릭을 부르는 편집 훅("긴장·질문·미완의 사실 하나")으로. 기존 `story.teaser`는
 * 건드리지 않는다 — 스토리 페이지 부제·메타 description·인쇄 진 본문
 * (render-zine.mjs)이 전부 그 문자열을 그대로 참조하고 있어서, 거기서 값을
 * 바꾸면 이 카드 하나가 아니라 스토리 페이지·SEO·인쇄물까지 전부 바뀐다. 대신
 * `headlineLines`/`insightLines`와 같은 패턴으로 **표시 전용 대안 필드**를
 * 새로 둔다 — 있으면 카드에서만 그 값을 쓰고, 없으면 예전처럼 `teaser`로
 * 그대로 폴백한다(과거 회차·다른 도메인은 아무것도 안 바뀐다). CLAUDE.md §3.1
 * 데이터 계약에 문서화했다.
 */
const card = (d, s) => {
  const label = cardLabel(d);
  return h`<a class="category-card${d.cardColor ? "" : " is-dark"}${s.image ? " has-photo" : ""}" data-reveal href="${u(s.url)}">
  ${s.image ? raw(h`<img class="category-card-photo" src="${u(s.image)}" alt="" aria-hidden="true" loading="lazy">`) : ""}
  <div class="category-card-cover" style="${raw(cardPalette(d))}">
    <span class="category-card-tag${label.length <= 5 ? " category-card-tag--tight" : ""}" aria-hidden="true" style="color:${cardAccent(d)}">${verticalLabel(label)}</span>
    <span class="sr-only">${label}</span>
    ${s.draft ? raw('<span class="draft-flag">작업 중</span>') : ""}
    <h2 class="category-card-headline">${s.headlineLines ? multiline(s.headlineLines) : s.headline}</h2>
    <p class="category-card-teaser">${s.cardTeaser ?? s.teaser}</p>
    <span class="category-card-date">최신 · ${s.range}</span>
  </div>
</a>`;
};

/* 참고 이미지의 가로 구분 밴드 — grid-column: 1 / -1로 항상 전체 폭을 차지해,
 * 열 수가 바뀌어도(모바일 1열) 새 줄로 떨어진다.
 *
 * 2026-08-11 되돌림 — "모션은 반응에만 쓴다"(design.md §9)는 원칙상 원래는 정적
 * 텍스트였다("전체 아카이브 · 카테고리별 최신 스토리"). 사용자가 검정 바탕에 흰
 * "THE ANSWER ZINE"이 무한 반복 스크롤되는 마퀴로 바꿔 달라고 명시적으로 요청 —
 * §9 원칙의 예외로 design.md에 기록했다. 이어서 이 밴드를 클릭하면 하단에 숨겨둔
 * DIY 진 CTA(`.zb-cta`, display:none)와 같은 오버레이가 열리도록 요청해, 순수
 * 장식이 아니라 두 번째 진입점이 됐다 — `<button data-zb-open>`으로 만들고
 * `assets/zinebook.js`가 `[data-zb-open]` 전부에 리스너를 붙이도록 갱신했다.
 *
 * 마퀴는 콘텐츠를 두 번 이어 붙이고 -50% translateX로 무한 반복한다(카드 뒤집기와
 * 같은 이 파일의 다른 애니메이션들처럼 라이브러리 없이 순수 CSS). 각 절반이 가장
 * 넓은 지원 뷰포트(1920px, design.md §10)보다 넓어야 이음매가 안 보인다 — 텍스트
 * 6회 반복 폭이 1920px를 넉넉히 넘는다. `prefers-reduced-motion: reduce`는
 * css.mjs의 전역 MOTION 규칙(`*` 선택자)이 이미 처리한다. */
// 2026-08-12 열아홉 번째 라운드 — 마퀴 문구를 "THE ANSWER ZINE"(사이트 이름을
// 그대로 반복)에서 "DESIGN YOUR OWN ZINE"으로 바꿨다(사용자 요청). 이 밴드는
// 순수 장식이 아니라 DIY 진 오버레이를 여는 버튼이다(`data-zb-open`) — 누르면
// 실제로 일어나는 일("자기만의 진을 만든다")을 문구가 직접 말하게 했다. 반복
// 폭이 1920px(design.md §10 최대 지원 뷰포트)를 넉넉히 넘어야 이음매가 안
// 보인다는 전제는 그대로다 — 글자 수가 비슷해 6회 반복으로 충분하다.
const MARQUEE_REPEAT = Array(6).fill("<span>DESIGN YOUR OWN ZINE</span>").join("");
const divider = () => h`<button type="button" class="category-divider" data-zb-open aria-label="이번 호 미니 진 열기">
  <span class="marquee-track" aria-hidden="true">${raw(MARQUEE_REPEAT + MARQUEE_REPEAT)}</span>
</button>`;

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

  // 2026-08-12 열아홉 번째 라운드 — 사용자 요청으로 "서울, 대한민국 — 2026년 8월
  // 1주차"(dateline(latest.range), layout.mjs)를 고정 라벨 "WEEKLY ANSWER"로
  // 바꿨다. 회차마다 값이 바뀌던 자리를 상시 표시되는 섹션 이름표로 바꾼 것 —
  // 그래서 latest 유무를 더는 안 따진다(회차가 없을 때의 "준비 중" 분기도 같이
  // 없앴다). dateline() 자체는 지우지 않았다 — 인쇄 진(render-zine.mjs)이 여전히
  // 그 회차의 실제 날짜를 써야 해서 그대로 쓴다. 이 자리는 홈 화면 전용이다.
  //
  // 2026-08-13 — "ANZINE — WEEKLY ANSWER → UNEXPECTED HERO RESTRUCTURE". 고정
  // 라벨을 "WEEKLY ANSWER"에서 "UNEXPECTED"로 바꿨다. 이전까지 "UNEXPECTED"는
  // 2026-w32의 issue.insight 값(매주 바뀌는 데이터)이었는데, 그 값 자체가 마침
  // "고정 라벨로 쓰기 좋은 한 단어"였을 뿐이다 — 이번 요청이 그 두 역할(①매주
  // 안 바뀌는 편집 장치의 이름 ②그 주의 실제 편집 테제)을 분리해 달라고
  // 명시했다("UNEXPECTED is a fixed editorial label... the sentence beneath it
  // ... MUST be replaceable every week"). 그래서 "UNEXPECTED"는 이제 여기
  // 리터럴 문자열로 고정되고(옛 "WEEKLY ANSWER"와 정확히 같은 자리·같은
  // 메커니즘), issue.insight는 이번 주부터 그 주의 테제 문장("소비를 움직인
  // 건, 우리가 보고 있던 곳에 없었다." 같은)을 담는다 — 필드 자체의 용도는
  // 안 바뀌었다(여전히 회차마다 바뀌는 값), 화면에 같이 보이던 고정 라벨과
  // 우연히 값이 겹쳤던 상태를 풀었을 뿐이다.
  const content = h`<main class="shell-edge">
  <p class="dateline">UNEXPECTED</p>
  <div class="insight-lead">
    ${latest?.insight ? raw(h`<h1 class="issue-insight" data-reveal>${latest.insightLines ? multiline(latest.insightLines) : latest.insight}</h1>`) : ""}
    ${latest?.insightNote ? raw(insightNoteHTML(latest.insightNote)) : ""}
  </div>

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

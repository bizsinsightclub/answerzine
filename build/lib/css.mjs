/**
 * 전체 스타일시트.
 *
 * 방향 A — "지면이 본체다". 인쇄 진의 흰색·먹색·괘선을 웹이 물려받고,
 * PC는 12칼럼 비대칭 그리드(본문 한 칼럼 + 근거 레일)를 쓴다.
 * 본문에 CSS 다단은 쓰지 않는다 — 신문이 다단인 건 지면이 고정이기 때문이고,
 * 웹에서 다단 본문은 아래로 읽다가 위로 되돌아가야 한다 (스펙 §6.3).
 *
 * 2026-08-10부터 자체 호스팅 폰트(Paperlogy·나눔명조)를 걷어내고 시스템 헬베티카
 * 스택으로 바꿨다 — 자체 폰트·서브셋 빌드 단계가 없다. 위계는 400/700/900 웨이트
 * 대비로만 만든다(design.md §3). `--sans`/`--serif` 두 변수는 이름만 남기고 같은
 * 스택을 가리킨다 — 기존 규칙들이 역할별로 나눠 참조하던 걸 그대로 두기 위해서다.
 */
import { themeCSS, domainCSS } from "./theme.mjs";

/* 라틴 글자는 Helvetica Neue/Helvetica/Arial에서, 한글은 그 폰트들에 글리프가 없어
   자동으로 다음 순번(Apple SD Gothic Neo·맑은 고딕)으로 넘어간다 — 둘 다 헬베티카와
   같은 계열의 중립 그로테스크라 톤이 크게 안 어긋난다. */
const HELVETICA = `-apple-system, "Helvetica Neue", Helvetica, Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

const BASE = `
:root {
  --sans: ${HELVETICA};
  --serif: ${HELVETICA};
  --measure: 68ch;
  --shell: 1240px;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px;
  --s6: 32px; --s7: 48px; --s8: 64px; --s9: 96px;
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--serif);
  font-weight: 400;
  font-size: 18px;
  line-height: 1.9;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

body { letter-spacing: 0; }

img { max-width: 100%; height: auto; display: block; }
a { color: inherit; }

/* 브라우저가 그리는 표면도 팔레트에서 지정한다.
   impeccable craft-floor: "the parts you did not draw still carry the design." */
::selection { background: var(--ink); color: var(--bg); }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; border-radius: 2px; }
body { caret-color: var(--ink); scrollbar-color: var(--tertiary) var(--bg); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--tertiary); border-radius: 0; }
`;

const TYPE = `
.kicker, .label, .meta, .stat-value, .btn, .nav-label,
.masthead, h1, h2, h3, .mini-headline {
  font-family: var(--sans);
}

/* 킥커는 신문 문법이라 유지한다. 다만 모노스페이스 코스튬은 뺐다 —
   impeccable craft-floor: "monospace as a costume for 'technical'".
   2026-08-10 개편: 참고 목업의 밑줄 태그처럼 아래 보더를 붙여 헤드라인 앞 마디를
   시각적으로 끊는다. */
.kicker {
  display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--dc, var(--secondary));
  margin: 0 0 var(--s5); padding-bottom: var(--s3);
  border-bottom: 1px solid var(--divider);
}

h1, .story-headline {
  font-weight: 900; font-size: clamp(36px, 5.8vw, 58px);
  line-height: 1.06; letter-spacing: -.035em; margin: 0 0 var(--s4);
}
h2 { font-weight: 900; font-size: clamp(27px, 3.8vw, 38px); line-height: 1.1; letter-spacing: -.03em; margin: 0 0 var(--s3); }
h3 { font-weight: 900; font-size: 22px; line-height: 1.15; letter-spacing: -.025em; margin: 0 0 var(--s2); }

.teaser {
  font-family: var(--serif); font-weight: 700; font-size: 20px;
  line-height: 1.6; margin: 0 0 var(--s5); color: var(--ink);
  max-width: var(--measure);
}

/* "BY ANSWER ZINE · {도메인} 데이터 기반" — 인쇄 진의 킥커류와 같은 문법이다.
   2026-08-10 개편: 헤드라인/티저와 스탯 패널 사이의 경계선 역할도 겸한다. */
.byline {
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--secondary); margin: 0 0 var(--s6);
  padding-bottom: var(--s4); border-bottom: 1px solid var(--divider);
}

.story-body p { margin: 0 0 var(--s5); max-width: var(--measure); }

.label {
  font-size: 12px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--secondary);
}
.meta { font-size: 14px; color: var(--tertiary); font-variant-numeric: tabular-nums; }

.stat-value {
  font-weight: 900; font-size: 34px; letter-spacing: -.03em;
  font-variant-numeric: tabular-nums; line-height: 1.1;
}
`;

const CHROME = `
.shell { max-width: var(--shell); margin: 0 auto; padding: var(--s5) var(--s4) var(--s8); }

/* 2026-08-10 두 번째 라운드: 마스트헤드가 스크롤 내내 상단에 붙는다 — 로고(좌)와
   카테고리 내비(우)를 "콘텐츠 화면부터" 항상 같은 자리에서 볼 수 있어야 한다는 요청.
   불투명 배경이 필요하다 — 안 그러면 고정된 채로 아래 콘텐츠가 그 밑으로 비쳐 겹친다. */
.site-header { position: sticky; top: 0; z-index: 30; background: var(--bg); }
.masthead { padding-top: var(--s3); padding-bottom: var(--s3); }
.masthead-top { display: flex; align-items: center; justify-content: space-between; gap: var(--s5); flex-wrap: nowrap; }
/* 워드마크는 2026-08-10부터 브래킷 마크 + "the answer company"만 남긴 축소판이다
   (기존의 큰 ANSWER/Zine 로고타입은 뺐다 — CLAUDE.md 참고). 배경을 투명화한 두 벌 중
   어두운 쪽(logo-dark)만 실제로 쓰인다 — 사이트가 단일 흰 테마라 밝은 쪽(logo-light)이
   보일 자리가 없다. 나중에 어두운 배경이 다시 생기면 그대로 켤 수 있게 마크업·스위치는
   남겨 둔다. 마크가 가로로 넓고 얇은 비율이라(약 7.3:1) 높이가 아니라 너비로 재운다.
   같은 날 두 번째 라운드에서 20% 키웠다(150→180 / 20vw→24vw / 230→276, 사용자 요청). */
.wordmark { display: inline-block; text-decoration: none; color: var(--ink); line-height: 0; flex-shrink: 0; }
.logo { height: auto; width: clamp(180px, 24vw, 276px); display: block; }
.logo-light { display: none; }
.intro .logo-light { display: block; }
.intro .logo-dark { display: none; }

/* 카테고리 상단 내비 — 2026-08-10 두 번째 라운드 도입. 홈의 카테고리 카드와 같은 목록·
   같은 "최신 스토리" 링크를 쓴다(build.mjs가 한 번 계산해 물려준다). 좁은 화면에서는
   줄바꿈 대신 가로 스크롤한다(참고 이미지의 nav.filters와 같은 처리) — 페이지 자체가
   가로로 넘치면 안 되므로(§10 QA) 내비 안쪽에서만 스크롤을 흡수한다. */
.category-nav {
  display: flex; align-items: center; gap: var(--s5); overflow-x: auto;
  scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.category-nav::-webkit-scrollbar { display: none; }
.category-nav a, .category-nav span {
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; white-space: nowrap; text-decoration: none; color: var(--secondary);
}
.category-nav a:hover { color: var(--ink); }
.category-nav span.is-empty { color: var(--divider); }

/* 화면 우하단에 항상 떠 있는 CTA — 그 회차의 인쇄 지면으로 바로 간다.
   position:fixed라 마크업 위치(.masthead-top 안)와 무관하게 뷰포트 우하단에 앉는다. */
.header-cta {
  position: fixed; right: var(--s5); bottom: var(--s5); z-index: 40;
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--secondary); text-decoration: none;
  background: var(--bg); border: 1px solid var(--divider); border-radius: 8px;
  padding: 7px 12px; white-space: nowrap; box-shadow: 0 2px 12px rgba(0,0,0,.15);
}
.header-cta:hover { color: var(--ink); border-color: var(--ink); }

/* 어디서 왔는지로 돌아가는 링크. 지면 맨 위, 헤드라인보다 먼저 온다. */
.back-link {
  display: inline-block; font-family: var(--sans); font-size: 13px; font-weight: 700;
  letter-spacing: .02em; color: var(--secondary); text-decoration: none; margin-bottom: var(--s5);
}
.back-link:hover { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }

.dateline { font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--secondary); margin-bottom: var(--s6); }
/* 그 호 4편을 관통하는 통합 인사이트(issue.insight). 홈의 진짜 헤드라인이라 h1로 낸다 —
   2026-08-10 두 번째 라운드에서 PC 기준 72px까지 키우고 이탤릭을 뺐다(사용자 요청,
   "이탤릭은 쓰지 말도록"). 산세리프 900이라 개별 스토리 헤드라인과 같은 문법이지만,
   더 큰 스케일로 "이 호를 관통하는 한 줄"이라는 위계를 표시한다. */
.issue-insight {
  font-family: var(--sans); font-weight: 900; font-size: clamp(34px, 6.5vw, 72px);
  line-height: 1.04; letter-spacing: -.03em; max-width: 20ch; margin: 0 0 var(--s4);
}
/* 부연설명 — 헤드라인이 압축한 것을 한 문단으로 풀어준다(2026-08-10 두 번째 라운드 도입,
   issue.insightNote). 헤드라인 아래, 카테고리 그리드 위에 온다. */
.issue-insight-note {
  font-family: var(--serif); font-weight: 400; font-size: 18px; line-height: 1.6;
  color: var(--secondary); max-width: var(--measure); margin: 0 0 var(--s6);
}

.draft-flag {
  display: inline-block; font-family: var(--sans); font-size: 11px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; border: 1px solid var(--divider);
  border-radius: 4px; padding: 2px 6px; color: var(--tertiary); vertical-align: middle;
}
`;

/* 원본 프로토타입처럼 폭 전체에서 한 칼럼이다 — 넓은 화면에서도 리드/레일로
   쪼개지 않는다. 읽기 폭은 --measure(68ch)가 잡는다. */
const LAYOUT = `
@media (min-width: 768px) {
  .shell { padding: var(--s6) var(--s5) var(--s9); }
}
`;

const COMPONENTS = `
/* 전체 아카이브(/archive/) 목록 — 2026-08-10 두 번째 라운드에서 되살렸다. 홈이
   카테고리 카드로 바뀌면서 한 번 없앴던 평면 리스트를 별도 라우트로 다시 낸다. */
.list { display: block; }
.row { background: var(--surface); border: 1px solid var(--divider); border-radius: 16px; padding: var(--s4); }
.row + .row { margin-top: var(--s4); }
.row a { text-decoration: none; display: flex; align-items: center; gap: var(--s4); }
.row a:hover .row-headline { text-decoration: underline; text-underline-offset: 3px; }
.row-line { flex: 1 1 auto; min-width: 0; margin: 0; display: flex; align-items: baseline; gap: var(--s3); flex-wrap: wrap; }
.row-headline { font-family: var(--sans); font-weight: 900; font-size: 21px; line-height: 1.2; letter-spacing: -.025em; }
.row-chevron {
  flex-shrink: 0; width: 34px; height: 34px; border-radius: 999px;
  background: var(--bg); display: flex; align-items: center; justify-content: center;
  color: var(--tertiary); font-family: var(--sans); font-size: 18px;
}

/* 카테고리 카드 그리드 — 2026-08-10 도입, 아카이브 인덱스(홈)를 전부 대체한다.
   gap 1px + 그리드 배경색(--ink)으로 칸 사이 얇은 괘선을 만든다 — 카드 각각에
   테두리를 그리는 게 아니라 gap이 만드는 틈으로 --ink가 비치는 방식이다. */
.category-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px;
  background: var(--ink); border: 1px solid var(--ink); margin: 0 0 var(--s6);
}
@media (max-width: 640px) { .category-grid { grid-template-columns: 1fr; } }

/* 배경 풀블리드는 design.md §2 불변식 3번이 허용한 다섯 번째 자리다. 흰 글자만
   쓴다 — colorPaper 위 흰 글자는 전 도메인 AA를 넘지만 먹색 글자는 못 넘는다
   (test/theme.test.mjs가 검증한다). */
.category-card {
  display: flex; flex-direction: column; justify-content: space-between;
  min-height: 260px; padding: var(--s6) var(--s5); background: var(--dc);
  color: #fff; text-decoration: none;
}
.category-card:hover .category-card-headline { text-decoration: underline; text-underline-offset: 3px; }
.category-card-eyebrow {
  font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; opacity: .85;
}
.category-card-name {
  font-weight: 900; font-size: clamp(40px, 6.5vw, 72px); line-height: 1;
  letter-spacing: -.03em; margin: var(--s4) 0; color: #fff;
}
.category-card-headline {
  font-family: var(--sans); font-weight: 700; font-size: 17px;
  line-height: 1.35; letter-spacing: -.01em; margin: 0; max-width: 34ch;
}
/* 그 도메인에 아직 통과분이 없을 때 — 근거(스토리)가 없는데 색만 칠하면
   "발행됐다"는 인상을 준다. 색을 비우고 표면 취급(§1 "카드·필터는 1px 테두리로만
   구분")으로 되돌아간다. */
.category-card.is-empty {
  background: var(--surface); color: var(--secondary);
  outline: 1px dashed var(--divider); outline-offset: -1px;
}
.category-card.is-empty .category-card-name { color: var(--ink); }
.category-card.is-empty .category-card-status { font-family: var(--sans); font-size: 13px; margin: 0; }
/* 색 카드 위에서는 --divider/--tertiary(회색 계열)가 안 보인다 — 흰 계열로 덧쓴다. */
.category-card .draft-flag { border-color: rgba(255,255,255,.6); color: #fff; }

/* 참고 이미지의 가로 구분 밴드 — 정적이다, 움직이지 않는다(design.md §9). */
.category-divider {
  grid-column: 1 / -1; overflow: hidden; white-space: nowrap; background: var(--bg);
  padding: 7px 0; font-family: var(--sans); font-weight: 900; font-size: 12px;
  letter-spacing: .1em; text-transform: uppercase; color: var(--tertiary); text-align: center;
}

/* 2026-08-10 개편: 헤드라인 바로 아래(byline 다음)로 끌어올렸다 — 참고 목업의
   .stat-panel처럼 라벨(왼쪽)과 수치(오른쪽)를 한 줄에 나란히 둔다. 출처 링크는
   여기서 뺐다 — source-box로 분리해 본문 뒤로 옮겼다. */
.stat-card {
  background: var(--surface); border: 1px solid var(--divider); border-radius: 16px;
  padding: var(--s5); margin: 0 0 var(--s6); max-width: var(--measure);
  display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: var(--s3);
}
.stat-card .label { max-width: 60%; }

/* 인사이트 콜아웃. 2026-08-08에 화면에서 뺐던 quote.insight.note가 2026-08-10에
   되돌아왔다 — 참고 목업의 .insight 콜아웃 구조를 그대로 가져왔다. 왼쪽 보더에
   도메인색을 쓴다 — 도메인 태그·킥커·풀쿼트에 이어 네 번째 자리다
   (design.md §2 불변식 3번 갱신, 9번은 그대로 — 1px을 넘지 않는다). */
.insight-note {
  background: var(--surface); border: 1px solid var(--divider);
  border-left: 1px solid var(--dc, var(--rule));
  padding: var(--s4) var(--s5); margin: 0 0 var(--s6); max-width: var(--measure);
}
.insight-label {
  display: block; font-family: var(--sans); font-size: 11px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; color: var(--dc, var(--secondary));
  margin-bottom: var(--s2);
}
.insight-note p { margin: 0; font-size: 14px; line-height: 1.75; }

/* 출처 링크는 항상 보인다 — 프로토타입은 opacity:0에 hover로만 노출해
   터치 기기에서 접근이 안 됐다 (§9.9). 2026-08-10부터 스탯 패널이 아니라 본문
   뒤의 이 헤어라인 박스에서 낸다(참고 목업의 .source-box). */
.source-box {
  display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap;
  gap: var(--s3); border-top: 1px solid var(--divider); border-bottom: 1px solid var(--divider);
  padding: var(--s4) 0; margin: 0 0 var(--s6); max-width: var(--measure);
}
.source-box .lbl {
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--tertiary);
}
.stat-source {
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .04em;
  color: var(--ink); text-decoration: underline; text-underline-offset: 3px;
}

/* 색 보더는 1px을 넘기지 않는다 —
   impeccable craft-floor: "a colored border-left above 1px on callouts". */
.pullquote {
  font-family: var(--serif); font-weight: 700; font-size: 22px; line-height: 1.55;
  letter-spacing: -.01em; margin: var(--s6) 0; padding-left: var(--s4);
  border-left: 1px solid var(--dc, var(--rule)); max-width: var(--measure);
}

.domain-tag { font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--dc, var(--secondary)); }
.domain-tag::before {
  content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 6px;
  border-radius: 999px; background: var(--dc, var(--secondary)); vertical-align: middle;
}

.nav-row { display: grid; gap: var(--s5); border-top: 1px solid var(--rule); margin-top: var(--s8); padding-top: var(--s4); }
@media (min-width: 768px) { .nav-row { grid-template-columns: 1fr 1fr; } .nav-next { text-align: right; } }
.nav-row a { text-decoration: none; }
.nav-label { font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--tertiary); }
.nav-headline { font-family: var(--sans); font-weight: 700; font-size: 17px; letter-spacing: -.01em; }

/* 호 넘기기 — 잡지 한 권을 넘기는 동작. 스토리 내비(nav-row)와 축이 다르다.
   2026-08-10 두 번째 라운드에서 홈 하단(카테고리 그리드 밑)에 처음 실렸다 — 이전/다음
   주 인사이트 + 가운데 "전체 아카이브 보기"(render-index.mjs의 pager()). */
.pager {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: var(--s3);
  border-top: 1px solid var(--rule); border-bottom: 1px solid var(--divider);
  padding: var(--s3) 0; margin: 0 0 var(--s5); font-family: var(--sans);
}
.pager-link { text-decoration: none; display: block; }
.pager-next { text-align: right; }
.pager-link.is-off { opacity: .35; }
.pager-dir { display: block; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--tertiary); }
.pager-issue { display: block; font-size: 15px; font-weight: 700; letter-spacing: -.01em; color: var(--ink); }
.pager-link:hover .pager-issue { text-decoration: underline; text-underline-offset: 3px; }
.pager-now {
  display: block; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  color: var(--secondary); white-space: nowrap; text-align: center; text-decoration: none;
}
.pager-now:hover { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.pager-count { display: block; font-size: 12px; font-weight: 400; color: var(--tertiary); font-variant-numeric: tabular-nums; }
@media (max-width: 520px) {
  .pager { grid-template-columns: 1fr 1fr; }
  .pager-now { grid-column: 1 / -1; order: -1; text-align: left; margin-bottom: var(--s2); }
}

.issue-range { font-weight: 400; color: var(--secondary); font-size: .6em; letter-spacing: 0; }

/* 편집 메모는 독자가 아니라 운영을 위한 기록이다. 접어두고 필요할 때만 편다. */
.editor-note { margin: 0 0 var(--s6); max-width: var(--measure); }
.editor-note summary {
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--tertiary); cursor: pointer; list-style: none;
}
.editor-note summary::-webkit-details-marker { display: none; }
.editor-note summary::after { content: " +"; }
.editor-note[open] summary::after { content: " −"; }
.editor-note p {
  font-family: var(--sans); font-size: 13.5px; line-height: 1.75; color: var(--secondary);
  margin: var(--s2) 0 0; padding-left: var(--s3); border-left: 1px solid var(--divider);
}

.btn {
  display: inline-block; font-size: 13px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; border: 1px solid var(--ink); border-radius: 10px; padding: 10px 17px;
  text-decoration: none; color: var(--ink); background: none; cursor: pointer;
}
.btn:hover { background: var(--ink); color: var(--bg); }

/* "전체 아카이브 보기" — 2026-08-10부터 테두리 버튼이 아니라 참고 목업의
   .to-archive처럼 가운데 정렬된 텍스트 링크다. 페이지의 진짜 마지막 줄이라
   장식을 줄였다. */
.to-archive { text-align: center; margin-top: var(--s7); }
.to-archive a {
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--secondary); text-decoration: underline;
  text-underline-offset: 3px;
}
.to-archive a:hover { color: var(--ink); }
`;

/* 인쇄 진.
 *
 * 2026-08-10 전면 개편 — 사용자가 첨부한 참고 목업(print.html)의 포맷을 따른다.
 * "리드 1 + 미니 3" 위계(design.md §2 옛 불변식 4번)를 없애고, 그 주 통과분 전원을
 * 사진·콜라주·테이프·스티커·회전각 없이 동등한 행으로 낸다 — 그 부품들이 쓰던
 * 옛 불변식 5·6번도 함께 없어졌다. QR도 뺐다 — 목업처럼 사람이 읽는 URL 한 줄로
 * 바꿨다(§4.2 A4 1페이지 검증은 그대로 유지). */
const ZINE = `
.zine-preview { max-width: 900px; margin: 0 auto; padding: var(--s7) var(--s4) var(--s9); }
.zine-preview-cta { display: flex; align-items: center; justify-content: center; gap: var(--s4); flex-wrap: wrap; }
.zine-preview-cta .back-link { margin-bottom: 0; }

.zine-page {
  width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm 10mm;
  background: var(--bg); color: var(--ink);
  font-family: var(--serif); letter-spacing: 0;
  box-shadow: 0 6px 30px rgba(0,0,0,.18);
}
.zine-masthead { text-align: center; padding-bottom: 2mm; }
/* 2026-08-10 축소판 마크(약 7.3:1)에 맞춰 높이 대신 너비로 잰다 — 예전 높이 기준이면
   가로 109mm까지 늘어나 인쇄 지면 폭을 넘긴다. */
.zine-logo { width: 62mm; height: auto; margin: 0 auto 1mm; display: block; }
.zine-ruleline { border-top: 3px solid var(--ink); border-bottom: 1px solid var(--ink); height: 5px; margin: 2mm 0; }
.zine-dateline { font-family: var(--sans); font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
/* issue.insightPrint — 웹의 .issue-insight와 같은 자리지만 A4는 여유가 없어 한 줄로 줄인다. */
.zine-insight { font-family: var(--serif); font-weight: 700; font-size: 10.5px; margin: 1.5mm 0 0; }

/* 스토리 한 편 = 한 행. 왼쪽은 본문, 오른쪽은 숫자 한 방(statcol) — 참고 목업의
   .sheet-story/.statcol 구조 그대로다. */
.zine-story {
  display: grid; grid-template-columns: 1fr 32mm; gap: 6mm; align-items: start;
  padding: 4.5mm 0; border-bottom: 1px solid var(--ink);
}
.zine-story:first-of-type { padding-top: 4mm; }
.zine-story:last-of-type { border-bottom: none; }

.zine-kicker { font-family: var(--sans); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--secondary); margin: 0 0 1mm; }
.zine-story-headline { font-family: var(--sans); font-weight: 900; font-size: 16px; line-height: 1.25; letter-spacing: -.02em; margin: 0 0 1.5mm; }
.zine-story-body { font-size: 10px; line-height: 1.55; margin: 0 0 2mm; }

/* 인사이트 콜아웃. 웹의 .insight-note와 같은 데이터(quote.insight.note), A4에
   맞춰 여백만 줄였다. 왼쪽 보더의 도메인색은 웹과 같은 네 번째 자리다. */
.zine-insight-note {
  font-size: 9px; line-height: 1.5; background: var(--surface);
  border-left: 2px solid var(--dc, var(--rule)); padding: 1.5mm 2.5mm; margin: 0 0 2mm;
}
.zine-insight-note b {
  display: block; font-family: var(--sans); font-size: 7.5px; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; color: var(--dc, var(--secondary)); margin-bottom: .6mm;
}
.zine-source { font-family: var(--sans); font-size: 8px; color: var(--secondary); }
.zine-source a { color: var(--ink); font-weight: 700; }

.zine-story-stat { text-align: center; border-left: 1px solid var(--divider); padding-left: 4mm; }
.zine-stat-value {
  display: block; font-family: var(--sans); font-weight: 900; font-size: 15px;
  letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1.2;
  word-break: keep-all;
}
.zine-stat-label { display: block; font-family: var(--sans); font-size: 7.5px; color: var(--secondary); letter-spacing: .02em; margin-top: 1mm; }

/* 사람이 읽는 URL 한 줄 — QR 대신이다 (2026-08-10). */
.zine-footer {
  text-align: center; margin-top: 4mm; padding-top: 3mm; border-top: 1px solid var(--ink);
  font-family: var(--sans); font-size: 8.5px; letter-spacing: .04em; color: var(--secondary);
}

@media (max-width: 780px) {
  .zine-page { width: 100%; padding: 6mm 5mm; }
  .zine-story { grid-template-columns: 1fr; }
  .zine-story-stat { text-align: left; border-left: none; padding-left: 0; }
}
`;

/* ── 진입 화면 ──────────────────────────────────────────────
   홈에서만 나온다 (issue·story 페이지는 마스트헤드부터 바로 시작한다).
   2026-08-10 리디자인: "THE ANSWER" / "COMPANY" 두 줄이 중앙에 겹쳐 있다가, 스크롤에
   맞춰 첫 줄은 오른쪽으로 둘째 줄은 왼쪽으로 갈라지며 바로 아카이브로 이어진다 —
   "이거 왜 잘나가?" 스테이트먼트 단계는 없앴다. 세션에 한 번 봤다고 건너뛰지 않는다 —
   홈으로 돌아올 때마다 다시 보인다. 자동으로 걷히는 타이머 오버레이가 아니라 문서
   흐름 안의 섹션 하나라 스크립트가 죽어도 그냥 스크롤하거나 링크를 누르면 본문이
   나온다. app.js가 스크롤 위치에 맞춰 두 줄을 좌우로 밀어내고 옅게 한다 — 스크립트가
   없으면 그냥 중앙에 겹친 채로 스크롤되어 지나간다. */
const INTRO = `
/* 인트로는 이제 사이트의 기본 흰 테마를 그대로 쓴다 — 예전엔 항상 어두운 로컬
   팔레트(theme.mjs의 INTRO_THEME)를 덮어썼지만, 화이트+헬베티카로 통일되면서
   별도 팔레트가 필요 없어져 그 오버라이드 자체를 없앴다. */
.intro { text-align: center; position: relative; }
/* 인트로는 뷰포트보다 60vh 더 큰 상자다 — 그 여유분만큼 안쪽 콘텐츠가 상단에
   고정(sticky)된 채로 머물러서, 스크롤해도 그냥 지나가 버리지 않고 두 줄이 갈라지는
   과정 자체가 눈에 보인다. app.js의 진행률 계산이 이 160svh를 전제한다. */
.intro { height: 160svh; }
.intro-inner {
  position: sticky; top: 0; height: 100svh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: var(--s6) var(--s5);
}
/* app.js가 매 스크롤 프레임마다 두 줄을 직접 조절한다. will-change로 미리 레이어를 띄워둔다. */
.js .intro-word { will-change: transform, opacity; }

/* 2026-08-10 두 번째 라운드: 화면을 꽉 채우는 크기로 키웠다(사용자 요청) — "ANSWER ZINE"
   이 인트로에서 화면의 절대적인 비중을 차지하도록. gap도 같이 키워 두 줄 사이 자간(여백)이
   커 보이는 인상을 준다(요청: "THE ANSWER 와 ZINE 사이의 자간이 좀 더 넓어도 상관없음"). */
.intro-wordmark { margin: 0; display: flex; flex-direction: column; align-items: center; gap: .06em; }
.intro-word {
  display: block; font-family: var(--sans); font-weight: 700; letter-spacing: -.03em;
  font-size: clamp(56px, 15vw, 260px); line-height: 1.02; white-space: nowrap;
}

.intro-scroll {
  position: absolute; bottom: var(--s7); left: 50%; transform: translateX(-50%);
  color: var(--tertiary); text-decoration: none; padding: var(--s2);
}
.intro-scroll .chev { display: inline-block; animation: chev-bounce 1.8s ease-in-out infinite; }
@keyframes chev-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
`;

/* ── 등장 ──────────────────────────────────────────────────
   .js가 붙은 문서에서만 숨긴다. 스크립트가 없거나 실패하면 본문은 처음부터 보인다 —
   콘텐츠는 빌드 시점에 이미 HTML에 들어 있으므로 읽기가 JS에 의존하면 안 된다. */
const REVEAL = `
.js [data-reveal] {
  opacity: 0; transform: translateY(16px);
  transition: opacity .62s cubic-bezier(.22, 1, .36, 1), transform .62s cubic-bezier(.22, 1, .36, 1);
  transition-delay: calc(var(--i, 0) * 70ms);
  will-change: opacity, transform;
}
.js [data-reveal].is-in { opacity: 1; transform: none; }
/* 화면에 들어온 뒤에는 will-change를 놓아준다. 남겨두면 레이어가 계속 떠 있다. */
.js [data-reveal].is-in { will-change: auto; }
`;

const PRINT = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; letter-spacing: 0; }
  .site-header, .shell, .intro,
  .print-btn, .zine-preview-cta {
    display: none !important;
  }
  /* 등장 애니메이션이 안 끝난 채로 인쇄되면 본문이 통째로 opacity:0으로 찍힌다. */
  .js [data-reveal] { opacity: 1 !important; transform: none !important; }
  .zine-preview { padding: 0; margin: 0; max-width: none; }

  /* 지면을 감싼 여백이 남아 있으면 297mm 박스가 인쇄 지면을 넘겨 2페이지가 된다.
     페이지 상자는 @page가 정하므로, 여기서는 크기를 강제하지 않고 흐르게 둔다. */
  .zine-mount { margin: 0 !important; padding: 0 !important; }
  .zine-page {
    box-shadow: none; margin: 0; width: 100%;
    min-height: 0; height: auto; break-inside: avoid; page-break-inside: avoid;
  }
}
`;

const MOTION = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important; animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important; transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  .js [data-reveal] { opacity: 1 !important; transform: none !important; }
}
`;

export function stylesheet(domains = []) {
  // 시스템 폰트만 쓰므로(2026-08-10) __BASE__ 접두사가 필요한 @font-face가 없다.
  return [themeCSS(), domainCSS(domains), BASE, TYPE, CHROME, LAYOUT, COMPONENTS, ZINE, INTRO, REVEAL, PRINT, MOTION]
    .join("\n")
    .trim() + "\n";
}

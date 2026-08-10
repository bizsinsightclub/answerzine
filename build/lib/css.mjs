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
.kicker, .label, .meta, .stat-value, .btn, .seg, .nav-label,
.masthead, h1, h2, h3, .mini-headline, .row-headline {
  font-family: var(--sans);
}

/* 킥커는 신문 문법이라 유지한다. 다만 모노스페이스 코스튬은 뺐다 —
   impeccable craft-floor: "monospace as a costume for 'technical'". */
.kicker {
  font-size: 12px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: var(--dc, var(--secondary));
  margin: 0 0 var(--s2);
}

h1, .story-headline {
  font-weight: 900; font-size: clamp(36px, 5.8vw, 58px);
  line-height: 1.06; letter-spacing: -.035em; margin: 0 0 var(--s4);
}
h2 { font-weight: 900; font-size: clamp(27px, 3.8vw, 38px); line-height: 1.1; letter-spacing: -.03em; margin: 0 0 var(--s3); }
h3 { font-weight: 900; font-size: 22px; line-height: 1.15; letter-spacing: -.025em; margin: 0 0 var(--s2); }

.teaser {
  font-family: var(--serif); font-weight: 700; font-size: 20px;
  line-height: 1.6; margin: 0 0 var(--s6); color: var(--ink);
  max-width: var(--measure);
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

.masthead { padding-top: var(--s3); }
.masthead-top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s4); }
/* 워드마크는 2026-08-10부터 브래킷 마크 + "the answer company"만 남긴 축소판이다
   (기존의 큰 ANSWER/Zine 로고타입은 뺐다 — CLAUDE.md 참고). 배경을 투명화한 두 벌 중
   어두운 쪽(logo-dark)만 실제로 쓰인다 — 사이트가 단일 흰 테마라 밝은 쪽(logo-light)이
   보일 자리가 없다. 나중에 어두운 배경이 다시 생기면 그대로 켤 수 있게 마크업·스위치는
   남겨 둔다. 마크가 가로로 넓고 얇은 비율이라(약 7.3:1) 높이가 아니라 너비로 재운다. */
.wordmark { display: inline-block; text-decoration: none; color: var(--ink); line-height: 0; }
.logo { height: auto; width: clamp(150px, 20vw, 230px); display: block; }
.logo-light { display: none; }
.intro .logo-light { display: block; }
.intro .logo-dark { display: none; }

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

/* 굵은 선 + 가는 선 — 신문 마스트헤드 관용구 */
.ruleline { border-top: 3px solid var(--rule); border-bottom: 1px solid var(--rule); height: 5px; margin: var(--s3) 0 0; }
.dateline { font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--secondary); margin-bottom: var(--s6); }
/* 그 호 4편을 관통하는 통합 인사이트(issue.insight, 2026-08-08 도입). 개별 스토리의
   헤드라인(산세리프 900)·풀쿼트(명조 700)와는 다른 자리라는 걸 폰트로도 구분한다 —
   여기는 편집자의 목소리이지 어느 한 스토리의 목소리가 아니다. */
.issue-insight {
  font-family: var(--serif); font-weight: 700; font-style: italic; font-size: 19px;
  line-height: 1.5; letter-spacing: -.01em; max-width: var(--measure);
  margin: -20px 0 var(--s6);
}

.seg {
  display: inline-flex; flex-wrap: wrap; gap: 2px; margin: 0 0 var(--s5);
  padding: 4px; list-style: none; background: var(--surface); border-radius: 12px;
  max-width: 100%;
  /* --surface가 --bg와 같은 흰색이라(2026-08-10) 테두리 없이는 페이지에 묻힌다. */
  border: 1px solid var(--divider);
}
.seg button {
  font-family: var(--sans); font-size: 13px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; background: none; border: none; border-radius: 9px;
  cursor: pointer; color: var(--tertiary); padding: 7px 14px; white-space: nowrap;
}
.seg button[aria-pressed="true"] { color: var(--ink); background: var(--bg); }

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
/* 아카이브 리스트 — 모든 스토리가 위계 없이 카드 하나씩 나열된다. */
.list { display: block; }
.row { background: var(--surface); border: 1px solid var(--divider); border-radius: 16px; padding: var(--s4); }
.row + .row { margin-top: var(--s4); }
.row a { text-decoration: none; display: flex; align-items: center; gap: var(--s4); }
.row a:hover .row-headline { text-decoration: underline; text-underline-offset: 3px; }
/* 장르와 헤드라인이 같은 줄에 나란히 앉는다 — 위아래로 쌓지 않는다. */
.row-line { flex: 1 1 auto; min-width: 0; margin: 0; display: flex; align-items: baseline; gap: var(--s3); flex-wrap: wrap; }
.row-headline { font-weight: 900; font-size: 21px; line-height: 1.2; letter-spacing: -.025em; }
.row-chevron {
  flex-shrink: 0; width: 34px; height: 34px; border-radius: 999px;
  background: var(--bg); display: flex; align-items: center; justify-content: center;
  color: var(--tertiary); font-family: var(--sans); font-size: 18px;
}

/* 출처 링크는 항상 보인다 — 프로토타입은 opacity:0에 hover로만 노출해
   터치 기기에서 접근이 안 됐다 (§9.9). */
.stat-card {
  background: var(--surface); border: 1px solid var(--divider); border-radius: 16px;
  padding: var(--s5); margin: var(--s6) 0; max-width: var(--measure);
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

.empty-state { border-top: 1px solid var(--divider); padding: var(--s7) 0; color: var(--secondary); font-size: 16px; }

/* 호 넘기기 — 잡지 한 권을 넘기는 동작. 스토리 내비(nav-row)와 축이 다르다. */
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
.pager-now { font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--secondary); white-space: nowrap; text-align: center; }
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
`;

/* 인쇄 진. design.md §8의 장치를 유지하되 전부 데이터에서 생성한다. */
const ZINE = `
.zine-preview { max-width: 900px; margin: 0 auto; padding: var(--s7) var(--s4) var(--s9); }
.zine-preview-cta { text-align: center; }

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
.zine-insight { font-family: var(--serif); font-style: italic; font-weight: 700; font-size: 10.5px; margin: 1.5mm 0 0; }
.zine-section-rule { border-top: 1px solid var(--ink); margin: 4mm 0; }

.zine-kicker { font-family: var(--sans); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--secondary); }
.zine-headline { font-family: var(--sans); font-weight: 900; font-size: 44px; line-height: 1.05; letter-spacing: -.035em; margin: 2mm 0 1mm; }
.zine-byline { font-family: var(--sans); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--secondary); margin: 1mm 0 3mm; }
.zine-teaser { font-size: 14px; font-weight: 700; line-height: 1.45; margin: 0 0 3mm; }
.zine-body { font-size: 11.5px; line-height: 1.65; margin: 0 0 3mm; }
.zine-lead-body::after { content: ""; display: block; clear: both; }
.zine-lead-photo { float: left; width: 38%; margin: 0 5mm 3mm 0; }

.zine-photo-collage { position: relative; margin: 0 0 9mm; }
/* 2026-08-10 — 화이트 톤에 맞춰 크림 대각선 스트라이프를 걷어내고 연회색 박스로
   단순화했다. 배경이 이제 흰색이라 스트라이프 텍스처가 있으나 없으나 실사진이
   덮이면 안 보이고, 없을 때는 은은한 회색 박스가 더 깔끔하다. */
.zine-photo-placeholder {
  aspect-ratio: 4 / 3; border: 2px solid var(--ink); transform: rotate(-1.1deg);
  background: #F2F2F2;
  background-size: cover; background-position: center 20%;
  clip-path: polygon(0% 2%, 3% 0%, 97% 1%, 100% 4%, 99% 97%, 96% 100%, 2% 99%, 0% 96%);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--sans); font-size: 11px; font-weight: 700; color: var(--secondary);
}
.zine-tape { position: absolute; width: 60px; height: 20px; background: rgba(255,255,255,.6); border: 1px dashed rgba(0,0,0,.3); }
.zine-tape-1 { top: -9px; left: 6px; transform: rotate(-9deg); }
.zine-tape-2 { top: -7px; right: 2px; transform: rotate(7deg); }
/* 사진 왼쪽 아래 모서리에 겹쳐 붙는다. 라벨이 길어도 배너로 늘어나지 않도록 폭을 묶는다. */
.zine-sticker {
  position: absolute; left: -2mm; bottom: -6mm; z-index: 2;
  max-width: 78%; padding: 4px 9px;
  border: 2px solid var(--ink); background: var(--surface);
  font-family: var(--sans); transform: rotate(-3deg); line-height: 1.2;
}
.zine-sticker .lbl {
  display: block; font-size: 8px; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase; color: var(--secondary);
}
.zine-sticker .val {
  display: block; font-size: 15px; font-weight: 900;
  letter-spacing: -.025em; font-variant-numeric: tabular-nums;
}

.zine-secondary-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; margin-top: 1mm; position: relative; }
.zine-secondary-row::before, .zine-secondary-row::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 1px; background: var(--ink); opacity: .25;
}
.zine-secondary-row::before { left: 33.333%; }
.zine-secondary-row::after { left: 66.666%; }
.zine-mini-headline { font-family: var(--sans); font-weight: 900; font-size: 19px; line-height: 1.15; letter-spacing: -.025em; margin: 1.5mm 0 2mm; }
.zine-mini-teaser { font-size: 11px; line-height: 1.55; }

.zine-footer-bar { display: flex; justify-content: center; align-items: center; margin-top: 5mm; background: var(--ink); color: var(--bg); padding: 4mm 5mm; }
.zine-footer-qr { display: flex; align-items: center; gap: 3mm; }
.zine-qr { width: 60px; height: 60px; background: #fff; padding: 3px; flex-shrink: 0; }
.zine-qr-caption { font-family: var(--sans); font-size: 9.5px; line-height: 1.5; }
.zine-qr-caption span { font-weight: 900; display: block; }

@media (max-width: 780px) {
  .zine-page { width: 100%; padding: 6mm 5mm; }
  .zine-secondary-row { grid-template-columns: 1fr; }
  .zine-secondary-row::before, .zine-secondary-row::after { display: none; }
  .zine-lead-photo { float: none; width: 100%; }
  .zine-headline { font-size: 32px; }
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

.intro-wordmark { margin: 0; display: flex; flex-direction: column; align-items: center; gap: .02em; }
.intro-word {
  display: block; font-family: var(--sans); font-weight: 700; letter-spacing: -.03em;
  font-size: clamp(40px, 9vw, 130px); line-height: 1.05; white-space: nowrap;
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
  .site-header, .shell, .seg, .intro,
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

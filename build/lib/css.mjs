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
  /* 2026-08-11 세 번째 라운드 도입 — 엣지-투-엣지 페이지(마스트헤드·홈)의 최소 여백.
     .shell(1240px 중앙 정렬)의 큰 거터 대신 이 값 하나만 쓴다. */
  --edge: clamp(10px, 2vw, 24px);
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
  /* 2026-08-11 열한 번째 라운드 — 한글 타이포그래피 전용 줄바꿈. 기본값(word-break:
     normal)은 CJK 텍스트를 아무 글자 사이에서나 끊을 수 있어, 좁은 화면에서
     "최단 기록을 세웠\n다"처럼 어절(단어) 중간이 갈라지는 사고가 났다. keep-all은
     공백(어절 경계)에서만 줄을 바꾼다 — 사이트 전체(모든 페이지)에 적용해 개별
     컴포넌트마다 따로 챙기지 않아도 되게 했다. overflow-wrap: break-word는 안전망이다
     — 공백 없이 이어지는 긴 문자열(URL 등)이 폭을 넘기면 그때만 강제로 끊는다. 이미
     white-space: nowrap을 쓰는 요소(로고 텍스트·킥커 등)는 한 줄 고정이 우선이라
     영향받지 않는다. */
  word-break: keep-all;
  overflow-wrap: break-word;
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
   불투명 배경이 필요하다 — 안 그러면 고정된 채로 아래 콘텐츠가 그 밑으로 비쳐 겹친다.
   2026-08-11 세 번째 라운드: ".shell"(max-width 1240px 중앙 정렬)을 벗었다 — 넓은
   화면에서 로고가 가운데로 몰리고 좌우에 빈 공간이 남는다는 지적이었다. 이제 뷰포트
   전체 폭이고, 로고·내비는 최소 여백만 두고 각자 코너에 붙는다. */
/* 2026-08-11 열세 번째 라운드 — 사용자 요청으로 마스트헤드만 반전(검정 배경·흰 로고·
   흰 내비)했다. 사이트 나머지는 여전히 흰 바탕 하나뿐이다(§1) — 이건 전역 다크모드가
   아니라 이 바 하나에 국한된 배색이라, --bg/--ink 같은 전역 토큰을 바꾸지 않고 이
   컴포넌트 안에서만 리터럴 색을 쓴다. 미리보기는 filter: invert(1)로 통째로
   뒤집어서 보여줬지만, 실제 적용은 색을 각각 지정한다 — invert(1)을 그대로 프로덕션에
   쓰면 나중에 헤더 안에 다른 색(도메인 컬러 등)이 들어왔을 때 의도치 않게 같이
   뒤집힌다. */
.site-header { position: sticky; top: 0; z-index: 30; background: #16150F; width: 100%; }
.masthead { padding: var(--s3) var(--edge); }

/* 홈 전용 — .shell(1240px 중앙 정렬)이 아니라 마스트헤드와 같은 최소 여백만 쓴다.
   2026-08-11 세 번째 라운드: 데이트라인·통합 인사이트·페이저도 카드 그리드처럼
   가장자리에 붙여 달라는 요청 — 넓은 화면에서 마스트헤드는 꽉 차는데 그 아래 텍스트만
   가운데 좁은 칼럼에 남아 있으면 앞뒤가 안 맞는다. */
.shell-edge { padding: var(--s5) var(--edge) var(--s8); }
@media (min-width: 768px) { .shell-edge { padding: var(--s6) var(--edge) var(--s9); } }
/* 2026-08-11 네 번째 라운드: 로고 옆 공백을 줄여 달라는 요청 — 로고·내비 사이 gap을
   좁혔다(var(--s5) 24px → var(--s3) 12px). */
.masthead-top { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); flex-wrap: nowrap; }
/* 워드마크는 2026-08-10부터 브래킷 마크 + "the answer company"만 남긴 축소판이다
   (기존의 큰 ANSWER/Zine 로고타입은 뺐다 — CLAUDE.md 참고).
   2026-08-11 여섯 번째 라운드 — "로고 옆 공백"의 진짜 원인을 찾았다. PNG 원본
   (1971×270)이 실제 잉크(x 748~1245)의 4배 가까운 캔버스였다 — 로고 좌우로 투명
   여백이 전체 너비의 약 38%씩 있었다. "tools/crop-png.mjs"로 내용 경계에 10px
   패딩만 남기고 다시 잘랐다(1971×270 → 518×265) — 지금까지 여러 라운드에 걸쳐
   "옆에 공백을 없애 달라"던 요청이 CSS 여백이 아니라 이 파일 자체의 문제였다.
   가로세로 비율이 7.3:1(넓고 얇음)에서 약 1.96:1(정사각에 가까움)로 완전히
   바뀌어서, 너비 기준 재기(width: clamp(...))를 높이 기준으로 바꿨다 — 예전
   비율로 재던 값을 그대로 두면 로고가 비정상적으로 세로로 길어진다.
   같은 라운드에서 어두운 배경용 logo-light.png와 전환 스위치(.logo-light/
   .intro .logo-dark)를 없앴다 — 인트로가 이미지가 아니라 텍스트라 그 스위치가
   켜질 자리 자체가 없었다(죽은 코드, "layout.mjs"의 "header()" 주석 참고). */
.wordmark { display: inline-block; text-decoration: none; color: #fff; line-height: 0; flex-shrink: 0; }
/* 로고 PNG는 검정 잉크를 투명 배경 위에 찍은 파일이다(assets/img/logo-dark.png) — 흰
   버전 파일을 새로 만드는 대신, 검은 배경 위에서 invert(1)로 흰 잉크로 뒤집어 낸다.
   투명한 부분은 invert의 영향을 안 받는다(알파 채널은 그대로다). */
.logo { width: auto; height: clamp(56px, 6vw, 96px); display: block; filter: invert(1); }

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
  text-transform: uppercase; white-space: nowrap; text-decoration: none; color: rgba(255,255,255,.7);
}
.category-nav a:hover { color: #fff; }
.category-nav span.is-empty { color: rgba(255,255,255,.32); }

/* 화면 우하단에 항상 떠 있는 CTA — 그 회차의 인쇄 지면으로 바로 간다.
   position:fixed라 마크업 위치(.masthead-top 안)와 무관하게 뷰포트 우하단에 앉는다.
   2026-08-11 사용자 요청으로 화면에서 숨겼다 — 마크업·라우트(/print/)는 그대로 있고
   버튼만 안 보인다. 되돌리려면 이 display:none 한 줄만 지우면 된다. */
.header-cta {
  display: none;
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

/* 2026-08-11 여섯 번째 라운드 — 헤드라인+부연설명이 좁은 왼쪽 칼럼에 몰려 있고
   화면 오른쪽이 통째로 비어 보인다는 지적(사용자 요청) — 나란히 두 칼럼으로 펼쳐
   페이지 너비를 실제로 쓴다. 좁은 화면에서는 flex-wrap이 자동으로 위아래로 접는다. */
.insight-lead {
  display: flex; align-items: center; flex-wrap: wrap; gap: var(--s7); margin: 0 0 var(--s6);
}
/* 그 호 4편을 관통하는 통합 인사이트(issue.insight). 홈의 진짜 헤드라인이라 h1로 낸다 —
   2026-08-10 두 번째 라운드에서 PC 기준 72px까지 키우고 이탤릭을 뺐다(사용자 요청,
   "이탤릭은 쓰지 말도록"). 산세리프 900이라 개별 스토리 헤드라인과 같은 문법이지만,
   더 큰 스케일로 "이 호를 관통하는 한 줄"이라는 위계를 표시한다. */
.issue-insight {
  font-family: var(--sans); font-weight: 900; font-size: clamp(34px, 6.5vw, 72px);
  line-height: 1.04; letter-spacing: -.03em; margin: 0; flex: 2 1 480px;
}
/* 부연설명 — 헤드라인이 압축한 것을 한 문단으로 풀어준다(2026-08-10 두 번째 라운드 도입,
   issue.insightNote). 2026-08-11부터 헤드라인 옆(아래가 아니라)에 온다 — flex: 1로
   나머지 폭을 채워 오른쪽 빈 공간을 없앤다. */
.issue-insight-note {
  font-family: var(--serif); font-weight: 400; font-size: 18px; line-height: 1.6;
  color: var(--secondary); margin: 0; flex: 1 1 320px; max-width: 44ch;
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
   테두리를 그리는 게 아니라 gap이 만드는 틈으로 --ink가 비치는 방식이다.
   2026-08-11 세 번째 라운드: 뷰포트 가장자리에 완전히 닿는다(참고 이미지처럼 좌우
   여백 없이) — 부모(.shell-edge)의 --edge 패딩만큼 음수 마진으로 상쇄한다.
   "width: 100vw"/"calc(50% - 50vw)" 같은 뷰포트 기준 트릭은 안 쓴다 — 세로
   스크롤바가 있는 데스크톱에서 그 방식이 가로 넘침을 만들 수 있다(§10 QA가
   375~1920px 무넘침을 실측한다). --edge는 고정 토큰이라 이 문제가 없다. */
.category-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px;
  background: var(--ink); border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink);
  margin: 0 calc(var(--edge) * -1) var(--s6);
}
@media (max-width: 640px) { .category-grid { grid-template-columns: 1fr; } }

/* 배경 풀블리드는 design.md §2 불변식 3번이 허용한 다섯 번째 자리다.
   2026-08-11부터 위계가 바뀌었다 — 도메인명이 아니라 **스토리 헤드라인이 메인**
   (가장 큰 글자)이고, 도메인명은 우측 상단의 작은 라벨이다(사용자 요청).
   배경도 밝은 파스텔(cardColor)로 바뀌면서 글자색이 흰색→검은색(--ink)으로 뒤집혔다
   — cardColor가 없는 도메인은 예전처럼 어두운 colorPaper+흰 글자로 남는다
   (render-index.mjs의 cardPalette()가 인라인 style로 결정한다). 두 조합 다
   test/theme.test.mjs가 AA를 검증한다. */
/* 2026-08-11 다섯 번째 라운드: 좌우 패딩을 10px로 좁혔다(사용자 요청 — "글자가 시작·
   끝나는 지점에 딱 10px만, 완전한 여백이 아니라 아주 살짝 숨 쉴 틈만"). 위아래는
   그대로 뒀다 — 요청이 좌우 한정이었다.
   2026-08-11 여섯 번째 라운드: 제목이 아래로 처져 보인다는 지적 — justify-content를
   flex-end에서 center로 바꿔 세로로는 카드 한가운데 온다. min-height도 280→420px로
   키웠다(사용자 요청, "여유를 더 준다").
   2026-08-12 되돌림 — 사용자가 "전체를 좌측 정렬로, 가운데·양쪽 정렬 쓰지 말라"고
   요청해 가로 정렬만 다시 왼쪽으로 뒤집었다(align-items:center→flex-start,
   text-align:center→left). 세로 중앙 정렬(justify-content:center)은 그대로 둔다 —
   요청이 가로 정렬 한정이었다. */
.category-card {
  position: relative; display: flex; flex-direction: column; align-items: flex-start;
  justify-content: center; text-align: left;
  min-height: 420px; padding: var(--s7) 10px var(--s5); text-decoration: none;
  color: var(--ink);
}
/* cardColor가 없는 도메인의 폴백 — 어두운 colorPaper 배경이라 흰 글자가 필요하다. */
.category-card.is-dark { color: #fff; }
.category-card.is-dark .draft-flag { border-color: rgba(255,255,255,.6); color: #fff; }
.category-card:hover .category-card-headline { text-decoration: underline; text-underline-offset: 4px; }
/* 태그도 텍스트와 같은 10px 우측 여백으로 맞췄다 — 헤드라인만 좁히면 태그와
   가장자리 거리가 안 맞아 보인다. */
.category-card-tag {
  position: absolute; top: var(--s5); right: 10px;
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; opacity: .75;
}
/* 2026-08-11 네 번째 라운드: PC 기준 40~48px 범위로 조정. 다섯 번째 라운드에서
   범위를 없애고 40px 고정값으로 좁혔다(사용자 요청 — "정확히 40pt"). 모바일에서도
   과하지 않은 크기라(스토리 헤드라인이 이미 최대 58px까지 쓴다) 반응형 없이 고정했다.
   2026-08-11 열 번째 라운드: 사용자 요청으로 두 배(40px→80px)로 키웠다 — 스토리
   헤드라인(최대 58px)보다도 커졌다. 카드 min-height(420px)가 바닥일 뿐 상한이 아니라
   레이아웃이 깨지지는 않는다 — 긴 헤드라인은 카드가 그만큼 더 커져서 받아낸다. */
.category-card-headline {
  font-weight: 900; font-size: 80px; line-height: 1.1;
  letter-spacing: -.025em; margin: 0 0 var(--s3);
}
/* 제목 밑 한 줄 티저 — 2026-08-11 여섯 번째 라운드 도입(사용자 요청). story.teaser를
   그대로 쓴다 — 새 필드가 필요 없다. 열 번째 라운드에서 헤드라인과 같이 두 배(14px→
   28px)로 키웠다 — max-width가 ch 단위라 글자 수 기준 줄바꿈 폭은 그대로 유지된다. */
.category-card-teaser {
  font-family: var(--sans); font-weight: 400; font-size: 28px; line-height: 1.5;
  margin: 0 0 var(--s4); max-width: 42ch; opacity: .85;
}
.category-card-date {
  font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .04em; opacity: .65;
}
/* 그 도메인에 아직 통과분이 없을 때 — 근거(스토리)가 없는데 색만 칠하면
   "발행됐다"는 인상을 준다. 색을 비우고 표면 취급(§1 "카드는 배경색이 아니라 1px
   테두리로만 구분")으로 되돌아간다. */
.category-card.is-empty {
  background: var(--surface); color: var(--secondary);
  outline: 1px dashed var(--divider); outline-offset: -1px;
}
.category-card.is-empty .category-card-tag { color: var(--ink); opacity: 1; }
.category-card.is-empty .category-card-status { font-family: var(--sans); font-size: 13px; margin: 0; }

/* 가로 구분 밴드 — 2026-08-11 되돌림, design.md §9 예외(render-index.mjs 주석
   참고). 검정 바탕·흰 글자 마퀴이자 DIY 진을 여는 버튼이라 <button> 리셋이 필요하다. */
.category-divider {
  grid-column: 1 / -1; overflow: hidden; white-space: nowrap;
  display: flex; align-items: center; height: 58px;
  background: #16150F; border: 0; margin: 0; padding: 0; width: 100%;
  cursor: pointer; font: inherit;
}
.category-divider:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.marquee-track {
  display: flex; white-space: nowrap;
  animation: marquee-scroll 18s linear infinite;
}
/* 2026-08-11 — 사용자 요청으로 밴드 10%↓(64→58px), 글자 두께 900→700(폭이 아니라
   무게만 얇게, 크기는 밴드 축소분(40→36px)만 반영). */
.marquee-track span {
  font-family: var(--sans); font-weight: 700; font-size: 36px; letter-spacing: -.01em;
  padding: 0 22px; text-transform: uppercase; color: #fff;
}
@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* 2026-08-11 일곱 번째 라운드: 스토리 본문이 넓은 화면에서 왼쪽에만 몰려 있다는
   지적 — .shell(1240px)은 넓은데 본문·스탯·인사이트가 전부 --measure(68ch)로
   막혀 왼쪽 절반만 쓰고 있었다. design.md §5.2/5.3이 원래 정의해 둔 "본문 한 칼럼 +
   근거 레일" 12칼럼 비대칭 그리드를 여기서 실제로 구현한다 — 문서만 있고 코드가
   없던 스펙이다. 좁은 화면(<1200px)에서는 그냥 위아래로 쌓인다(기존과 동일한
   시각 순서 — 스탯·출처·인사이트가 본문보다 먼저 나온다). ≥1200px에서만 두 칼럼:
   본문 1/span 7, 레일 9/span 4(세로 괘선), 레일은 position: sticky로 스크롤에 붙는다. */
.story-grid { display: block; }
.story-rail { margin-bottom: var(--s6); }
@media (min-width: 1200px) {
  .story-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--s7); align-items: start; }
  /* grid-row: 1을 명시하지 않으면 auto-placement 커서가 DOM 순서(레일이 먼저)를
     따라가다가 본문(1/span 7, 레일보다 앞 칼럼)을 다음 행으로 밀어낸다 — 실측으로
     발견했다(레일 아래 빈 칸이 본문 위로 그대로 옮겨 붙었었다). 두 칼럼 다 1행에
     고정해야 나란히 앉는다. */
  .story-col { grid-column: 1 / span 7; grid-row: 1; min-width: 0; }
  .story-rail {
    grid-column: 9 / span 4; grid-row: 1; min-width: 0; margin-bottom: 0;
    border-left: 1px solid var(--divider); padding-left: var(--s6);
    position: sticky; top: 96px;
  }
}

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
/* "THE ANSWER" 라벨 — 2026-08-11 도입. .insight-label과 같은 스펙(11px·700·
   letter-spacing .1em·uppercase·도메인색)을 재사용하되 별도 클래스로 둔다 — 풀쿼트와
   인사이트 콜아웃은 다른 컴포넌트라 나중에 독립적으로 조정할 여지를 남긴다. */
.answer-label {
  display: block; font-family: var(--sans); font-size: 11px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; color: var(--dc, var(--secondary));
  margin-bottom: var(--s2);
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
/* 2026-08-11 여섯 번째 라운드 — 로고 PNG를 실제 잉크 경계로 다시 잘라 비율이
   7.3:1에서 약 1.96:1로 바뀌었다(위 .logo 주석 참고). 너비 62mm 기준을 그대로 두면
   세로가 32mm까지 늘어나 지면을 침범한다 — 높이 기준(12mm)으로 다시 잰다. */
.zine-logo { height: 12mm; width: auto; margin: 0 auto 1mm; display: block; }
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
.intro { text-align: center; position: relative; overflow: hidden; }
/* 인트로는 뷰포트보다 60vh 더 큰 상자다 — 그 여유분만큼 안쪽 콘텐츠가 상단에
   고정(sticky)된 채로 머물러서, 스크롤해도 그냥 지나가 버리지 않고 줄이 갈라지는
   과정 자체가 눈에 보인다. app.js의 진행률 계산이 이 160svh를 전제한다.
   2026-08-11 여덟 번째 라운드: overflow: hidden을 붙였다 — 아래에서 글자 크기를
   더 키워 가장자리에 닿을 만큼 커지므로, 자간·서브픽셀 반올림으로 1px 안팎이
   삐져나와도 가로 스크롤바가 안 생기게 막아 둔다(verify.mjs의 가로 넘침 검사와도
   맞물린다). */
.intro { height: 160svh; }
.intro-inner {
  position: sticky; top: 0; height: 100svh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: var(--s6) var(--s3);
}
/* app.js가 매 스크롤 프레임마다 세 줄을 직접 조절한다. will-change로 미리 레이어를 띄워둔다. */
.js .intro-word { will-change: transform, opacity; }

/* 2026-08-10 두 번째 라운드: 화면을 꽉 채우는 크기로 키웠다(사용자 요청) — "ANSWER ZINE"
   이 인트로에서 화면의 절대적인 비중을 차지하도록. gap도 같이 키워 줄 사이 자간(여백)이
   커 보이는 인상을 준다(요청: "THE ANSWER 와 ZINE 사이의 자간이 좀 더 넓어도 상관없음").
   2026-08-11 여덟 번째 라운드: THE·ANSWER·ZINE을 각자 한 줄로 뗀 뒤(위 intro() 주석)
   여백을 더 줄이고(var(--s3)) 글자 크기를 한 단계 더 키웠다 — 화면 가장자리에 살짝
   닿는 듯한 인상을 의도적으로 노린다(사용자 요청: "화면 경계에 살짝 넘치는 효과"). */
.intro-wordmark { margin: 0; display: flex; flex-direction: column; align-items: center; gap: .03em; }
/* 2026-08-11 열두 번째 라운드: 참고 이미지만큼 두껍게(사용자 요청) — font-weight를
   700에서 900(사이트에서 가장 굵은 값)으로 올렸다. 900이어도 폴백 폰트(시스템에
   Helvetica Neue가 없으면 Arial 등으로 넘어간다, --sans 참고)에 따라 참고 이미지보다
   가늘어 보일 수 있어, -webkit-text-stroke로 획 자체를 두껍게 겹쳐 그린다 — 어느
   폴백 폰트에서도 결과가 비슷하게 두꺼워진다. em 단위라 clamp된 글자 크기에
   비례해서 커진다(작은 화면에서 획이 과하게 두꺼워지지 않는다). 미지원 브라우저
   (Firefox 등)는 이 속성만 조용히 무시하고 900 굵기로 보인다 — 깨지지 않는다.
   그 다음 라운드에 "아직 안 두껍다"는 피드백으로 .075em까지 올라갔다가, 이후
   사용자 요청으로 한 단계 전인 .045em으로 되돌렸다. */
.intro-word {
  display: block; font-family: var(--sans); font-weight: 900; letter-spacing: -.03em;
  font-size: clamp(72px, 21vw, 380px); line-height: .98; white-space: nowrap;
  -webkit-text-stroke: .045em currentColor;
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
  /* 브라우저 인쇄 대화상자의 "배경 그래픽"(Background graphics) 토글은 기본이 꺼짐이다.
     꺼진 채로 인쇄하면 background-color·background-image가 전부 흰 배경으로 날아간다 —
     DIY 진 뒤표지(검정 배경, 텍스트 없음)가 통째로 빈 흰 페이지로 나온 사고가 이래서
     났다(2026-08-12 실사용자 보고). print-color-adjust는 상속 속성이라 html에 한 번만
     걸면 이 스타일시트가 쓰는 모든 배경(뒤표지·인사이트 콜아웃 등)에 전파된다 — 토글
     상태와 무관하게 항상 인쇄되도록 강제한다. */
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
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

/* ── DIY 진 (플립북 + 인쇄 시트) ──────────────────────────────
   2026-08-11 아홉 번째 라운드 신규. `.zb-` 접두사로 기존 클래스와 완전히 분리한다.
   흑백만 쓴다(요구사항 #5) — 도메인 컬러(--dc-*)를 참조하지 않는다.

   미리보기(.zb-leaf-face 안)와 인쇄(.zb-half 안)가 같은 `.zb-panel` 콘텐츠 마크업을
   공유한다(render-zinebook.mjs). 인쇄에서는 148.5mm×210mm 반쪽을 그대로 채우고,
   미리보기에서는 인쇄판과 같은 비율의 고정 캔버스(561×794px, 96dpi에서 148.5mm×210mm에
   해당)를 그린 뒤 실제 화면 크기에 맞춰 `transform: scale()`로 축소한다 — 그래서
   미리보기가 인쇄 결과와 같은 레이아웃으로 보인다(WYSIWYG). 배율은 `assets/zinebook.js`가
   `--zb-scale` 커스텀 프로퍼티로 계산해 넣는다. */
const ZINEBOOK = `
/* 2026-08-11 사용자 요청으로 화면에서 숨겼다 — 오버레이·인쇄 시트 마크업과 스크립트는
   그대로 있고 진입 버튼만 안 보인다(§11 나머지 스펙은 전부 유효, 재도입 시 아래
   display:none 한 줄만 지우면 된다). 버튼을 숨기는 김에 그 자리를 위해 남겨 두던
   하단 여백(body.has-zb)도 같이 0으로 되돌린다 — 안 그러면 페이지 아래에 아무 이유
   없는 빈 띠만 남는다. */
.zb-cta {
  display: none;
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  width: 100%; border: none; margin: 0; padding: 18px 16px;
  background: #000; color: #fff; cursor: pointer;
  font-family: var(--sans); font-weight: 700; font-size: 14px;
  letter-spacing: .12em; text-transform: uppercase; text-align: center;
}
.zb-cta:hover, .zb-cta:focus-visible { background: #1a1a1a; }
body.has-zb { padding-bottom: 0; }

.zb-overlay {
  position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column;
  background: #000; color: #fff; padding: var(--s4) var(--s5) var(--s5);
}
.zb-overlay[hidden] { display: none !important; }

/* 2026-08-12 여섯 번째 라운드 — 툴바 제목 문구를 뺐다(render-zinebook.mjs 주석
   참고). 남는 건 버튼뿐이라 오른쪽 정렬로 바꿨다. */
.zb-toolbar { display: flex; align-items: center; justify-content: flex-end; gap: var(--s4); flex-wrap: wrap; }
.zb-toolbar-actions { display: flex; align-items: center; gap: var(--s3); }

.zb-btn {
  display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.35);
  border-radius: 8px; padding: 9px 13px;
  font-family: var(--sans); font-size: 12px; font-weight: 700; letter-spacing: .06em;
}
.zb-btn:hover:not(:disabled) { border-color: rgba(255,255,255,.8); }
.zb-btn:disabled { opacity: .3; cursor: default; }
.zb-btn--print { background: #fff; color: #000; border-color: #fff; text-transform: uppercase; }
.zb-btn--print:hover:not(:disabled) { background: #e6e6e6; }
.zb-btn--icon { padding: 9px; }

/* ── 전체 8쪽 그리드 미리보기 — 2026-08-11 개편 ──
   예전엔 3D 페이지 넘김(perspective+rotateY)으로 한 번에 한 쪽만 보였다. 사용자가
   "인쇄 전에 8쪽 전체를 볼 수 있어야 한다"고 요청해 정적 그리드로 바꿨다. 축소 배율은
   JS 측정이 아니라 CSS 컨테이너 쿼리 단위(cqw)로 계산한다 — 타일 폭이 바뀌면(반응형)
   배율도 자동으로 따라온다. */
.zb-viewer { flex: 1; min-height: 0; overflow-y: auto; padding: var(--s5) 0; }
.zb-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s4);
  max-width: 1100px; margin: 0 auto;
}
@media (max-width: 900px) { .zb-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .zb-grid { grid-template-columns: 1fr; } }
.zb-tile { margin: 0; }
.zb-tile-num {
  font-family: var(--sans); font-size: 10.5px; font-weight: 700; letter-spacing: .08em;
  color: rgba(255,255,255,.5); margin: 0 0 6px; font-variant-numeric: tabular-nums;
}
/* aspect-ratio가 148.5:210(A5) 높이를 미리 확보해 둔다 — 컨테이너 쿼리는 크기가 이미
   정해진 다음에야 값을 낸다(순환 의존 방지). container-type: inline-size가 이 요소의
   폭을 1cqw = 1%로 등록하고, 안의 .zb-panel(561px 고정 디자인 캔버스)이 그 비율로
   스스로 줄어든다 — 자바스크립트 리사이즈 리스너가 필요 없다. */
.zb-tile-face {
  position: relative; aspect-ratio: 148.5 / 210; overflow: hidden; container-type: inline-size;
  box-shadow: 0 6px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.25);
}
.zb-tile-face .zb-panel {
  position: absolute; top: 0; left: 0; width: 561px; height: 794px;
  transform: scale(calc(100cqw / 561px)); transform-origin: top left;
}
/* ── 콘텐츠 패널 — 표지·About·Notes·기사 넷, 미리보기·인쇄 공용 ── */
.zb-panel {
  display: flex; flex-direction: column; box-sizing: border-box;
  padding: 34px 30px; background: #fff; color: #111; font-family: var(--serif);
  overflow: hidden;
}
.zb-half .zb-panel { position: absolute; inset: 0; }

/* 표지 — 2026-08-12 세 번째 라운드, 랩어라운드로 재구성(render-zinebook.mjs
   wraparoundCanvas() 주석 참고 — 사용자가 보낸 실물 사진 기준). 뒤표지·앞표지가
   같은 배경/글자색을 쓴다 — 더는 별도의 어두운 뒤표지 블록이 없다. */
/* 2026-08-12 여섯 번째 라운드 — eyebrow·caption 텍스트를 뺐다(render-zinebook.mjs
   coverFront() 주석 참고). 남는 건 랩어라운드 캔버스뿐이다. */
.zb-panel--cover { background: #fff; color: #111; position: relative; }

/* 랩어라운드 캔버스 — 뒤표지·앞표지 공용, 폭 1122px(561×2, 시트 전체 폭)짜리
   하나의 문구를 두 패널이 각자 561px 창으로 절반씩 잘라 보여준다. 위아래는
   패널 한가운데에 고정 — 두 패널의 뷰포트 크기가 같으므로(561×794) 별도 계산 없이도
   이음매의 세로 위치가 자동으로 맞는다.
   세로 중앙 정렬은 position:absolute + top:50%/translateY(-50%)가 아니라
   flex(align-items:center)로 한다 — 실측으로 발견한 함정: 인쇄 PDF는 4장이 실제로는
   한 문서 흐름(break-after:page)이라, 퍼센트 기반 top:50%가 그 흐름 전체 높이를
   기준으로 계산돼 화면 미리보기에서는 멀쩡했는데 실제 인쇄 PDF에서만 텍스트가
   페이지 아래로 밀려 잘렸다(스크린샷 검사로는 못 잡고 실제 page.pdf() 출력을
   래스터화해서 발견했다). flex 중앙 정렬은 이 흐름 높이에 기대지 않아 안전하다. */
.zb-wrap-viewport { position: absolute; inset: 0; overflow: hidden; display: flex; align-items: center; }
.zb-wrap-canvas { position: relative; width: 1122px; flex: none; }
.zb-wrap-canvas--back { left: 0; }
.zb-wrap-canvas--front { left: -561px; }
.zb-wrap-word {
  display: block; font-family: var(--sans); font-weight: 900; font-stretch: condensed;
  font-size: 262px; line-height: .76; letter-spacing: -.03em; white-space: nowrap; text-align: center;
}
/* About — 표지 바로 뒷장, 페이지 전체(사용자 요청 — "not a small section of an A4
   page"). 2026-08-12 다섯 번째 라운드 — 사용자가 본문 전체를 새 카피로 교체하며 제목
   크기(36px)·본문 크기(18~24px)를 직접 지정했다(render-zinebook.mjs aboutPanel() 주석
   참고). 2026-08-12 여섯 번째 라운드 — 문장 하나와 하단 QR 띠를 뺐다(사용자 요청) —
   본문만 남아 .zb-panel--about의 justify-content:flex-start가 위에서부터 자연스럽게
   흐른다(QR 띠를 바닥에 고정하던 margin-top:auto 대상이 이제 없다). */
.zb-about-title { font-family: var(--sans); font-weight: 900; font-size: 36px; line-height: 1.1; letter-spacing: -.02em; margin: 0 0 22px; }
.zb-panel--about { justify-content: flex-start; }
.zb-about-body p { font-size: 19px; line-height: 1.7; margin: 0 0 20px; color: #222; }

/* 스캔 페이지(7쪽, 구 Notes) — 2026-08-12 여섯 번째 라운드 신규. QR 하나만 페이지
   정중앙에 두고(사용자 요청 — "perfectly centered"), 그 밑에 "Scan for Mobile" 캡션.
   About 페이지에 있던 QR(zb-qr)을 그대로 옮겨왔다 — 인쇄 크기에 맞춰 더 크게
   키웠다(92px→160px, --large 모디파이어). */
.zb-panel--scan { align-items: center; justify-content: center; }
.zb-scan-center { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.zb-qr { flex-shrink: 0; width: 92px; height: 92px; }
.zb-qr svg { display: block; width: 100%; height: 100%; }
.zb-qr--large { width: 160px; height: 160px; }
.zb-scan-caption {
  font-family: var(--sans); font-weight: 700; font-size: 15px; letter-spacing: .04em;
  color: #111; margin: 0;
}

/* 기사 페이지 — 2026-08-11 전면 확장(사용자 요청, "same editorial quality and
   substance as the website"). 5블록 전부(현상→스탯→맥락→쿼트+인사이트→마무리)가
   한 페이지에 들어간다 — teaser는 뺐다(texts[0]와 중복).
   2026-08-12 여섯 번째 라운드 — 줄간격이 너무 좁다는 지적(사용자 요청, "더 넓은 간격,
   페이지를 fully 사용")으로 전 요소의 line-height·margin을 다시 키웠다. 헤더가
   "인사이트 NN/총 · 도메인"(흐름을 차지하는 문단)에서 우측 상단 절대 위치 라벨
   (.zb-article-domain)로 바뀌면서 그만큼 흐름 공간이 남아 여유가 생겼다 — 실측
   (build/verify.mjs의 콘텐츠 잘림 검사)으로 한 페이지 안에 들어오는 걸 확인했다. */
.zb-panel--article { position: relative; }
.zb-article-domain {
  position: absolute; top: 34px; right: 30px; z-index: 2;
  font-family: var(--sans); font-size: 11px; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: #666; margin: 0;
}
.zb-article-headline { font-family: var(--sans); font-weight: 900; font-size: 26px; line-height: 1.22; letter-spacing: -.02em; margin: 6px 0 18px; }
.zb-article-body { font-family: var(--serif); font-size: 13px; line-height: 1.8; margin: 0 0 16px; color: #222; }
.zb-article-body--close { margin-bottom: 0; }
.zb-stat { display: flex; flex-direction: column; gap: 5px; padding: 14px 16px; border: 1px solid #ddd; margin: 0 0 18px; }
.zb-stat-label { font-family: var(--sans); font-size: 9.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #666; }
.zb-stat-value { font-family: var(--sans); font-weight: 900; font-size: 18px; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.zb-quote {
  font-family: var(--serif); font-weight: 700; font-size: 14.5px; line-height: 1.65;
  padding-left: 14px; border-left: 2px solid #111; margin: 0 0 14px;
}
.zb-quote-label {
  display: block; font-family: var(--sans); font-weight: 700; font-size: 9.5px;
  letter-spacing: .1em; color: #888; margin-bottom: 6px;
}
.zb-insight-note {
  font-family: var(--sans); font-size: 11px; line-height: 1.7; color: #444;
  background: #f7f7f5; border-left: 2px solid #111; padding: 12px 14px; margin: 0 0 18px;
}
.zb-source { font-family: var(--sans); font-size: 9.5px; line-height: 1.5; color: #777; margin-top: auto; padding-top: 12px; }
.zb-empty-note { font-size: 13.5px; line-height: 1.7; color: #777; }

/* ── 스티커 팔레트 — 미리보기 화면 하단(사용자 요청). 인쇄에는 안 나온다(도구지
   콘텐츠가 아니다) — 아래 @media print 블록이 숨긴다. 드래그·터치 로직은
   assets/zinebook.js, 여기는 정적 스타일만. */
.zb-sticker-palette {
  border-top: 1px solid rgba(255,255,255,.15); margin-top: var(--s4); padding-top: var(--s4);
  flex-shrink: 0;
}
.zb-sticker-hint {
  margin: 0 0 var(--s3); font-family: var(--sans); font-size: 11.5px; line-height: 1.5;
  color: rgba(255,255,255,.5); text-align: center;
}
.zb-sticker-tray {
  display: flex; align-items: center; justify-content: center; gap: var(--s3);
  flex-wrap: wrap; max-width: 1100px; margin: 0 auto;
}
.zb-sticker-chip {
  cursor: grab; width: 44px; height: 44px; padding: 6px; flex-shrink: 0;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.2); border-radius: 10px;
  touch-action: none; -webkit-user-select: none; user-select: none;
}
.zb-sticker-chip svg { display: block; width: 100%; height: 100%; }
.zb-sticker-chip:hover, .zb-sticker-chip:focus-visible { border-color: rgba(255,255,255,.6); }
.zb-sticker-chip:active { cursor: grabbing; }

/* 놓인 스티커 — 그리드 타일(.zb-tile-face)과 인쇄 시트 반쪽(.zb-half) 둘 다
   position:relative + 같은 종횡비(148.5:210)라, 퍼센트 좌표가 두 컨텍스트에서
   그대로 호환된다(픽셀 단위 변환이 필요 없다) — assets/zinebook.js가 이 성질을
   이용해 그리드에 놓은 스티커를 인쇄 시트에도 같은 %로 미러링한다. */
.zb-sticker {
  position: absolute; width: 13%; aspect-ratio: 1; z-index: 5; touch-action: none;
  cursor: grab; -webkit-user-select: none; user-select: none;
}
.zb-sticker svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 2px 4px rgba(0,0,0,.25)); }
.zb-sticker:active { cursor: grabbing; }
.zb-sticker.is-dragging { opacity: .55; }
.zb-drag-ghost {
  position: fixed; z-index: 999; width: 48px; height: 48px; pointer-events: none;
  opacity: .85; transform: translate(-50%, -50%);
}
.zb-drag-ghost svg { display: block; width: 100%; height: 100%; }

/* ── 인쇄 시트 — 화면엔 안 보인다. 실제 인쇄에서만 켜진다 ── */
.zb-print-sheets { display: none; }
@media print {
  /* zinebook은 showChrome 페이지(홈·스토리·about·아카이브)에서만 존재한다 — 그 페이지의
     평소 콘텐츠(#main-content, 마스트헤드)와 CTA 바까지 같이 인쇄되면 진 시트 앞뒤로
     엉뚱한 페이지가 끼어든다(실측으로 발견 — 처음엔 4장이 아니라 7장이 나왔다). 인쇄
     전용 라우트(/print/)는 showChrome:false라 #main-content·.site-header 자체가
     DOM에 없으므로 이 규칙이 거기엔 영향을 주지 않는다. */
  #main-content, .site-header, .zb-cta { display: none !important; }
  /* body.has-zb의 하단 여백(고정 CTA 바 자리)이 인쇄까지 새어 들어가면, 마지막 시트
     뒤에 그 몇십 px짜리 빈 공간만을 위한 5번째 빈 페이지가 생긴다 — 실측으로 발견했다
     (처음엔 정확히 4장이 아니라 5장이 나왔다). 인쇄에서는 0으로 되돌린다. */
  body.has-zb { padding-bottom: 0 !important; }
  /* [hidden] 쪽이 명시도가 더 높아서(0,2,0 > 0,1,0) 오버레이를 한 번도 열지 않은 채
     인쇄를 시도하면(Ctrl+P 등, "Print Zine" 버튼을 안 거치는 경로) 아래 display:block이
     졌었다 — 실측으로 발견했다. 선택자에 [hidden]을 같이 걸어 명시도를 맞춘다. */
  .zb-overlay, .zb-overlay[hidden] {
    position: static !important; inset: auto; background: #fff !important; color: #111 !important;
    padding: 0 !important; display: block !important;
  }
  .zb-toolbar, .zb-viewer, .zb-sticker-palette { display: none !important; }
  .zb-print-sheets { display: block !important; }

  .zb-sheet {
    page: zb-landscape; width: 297mm; height: 210mm; margin: 0;
    display: flex; break-inside: avoid; page-break-inside: avoid;
    break-after: page; page-break-after: always;
  }
  .zb-sheet:last-child { break-after: auto; page-break-after: auto; }
  .zb-half { position: relative; width: 148.5mm; height: 210mm; box-sizing: border-box; overflow: hidden; }
  .zb-fold { width: 0; border-left: 1px dashed #ccc; }
  /* 2026-08-11 — 사용자가 "Print를 누르면 세로로 최적화된다"고 보고. 헤드리스로
     실측(preferCSSPageSize)하면 PDF 자체는 이미 297×210mm로 정확히 나왔다 — 문제는
     페이지 박스 크기가 아니라, 크롬 인쇄 대화상자의 "레이아웃(세로/가로)" 토글이 raw
     mm 치수(size: 297mm 210mm)만으로는 자동으로 가로를 고르지 않는다는 것이다.
     landscape 키워드를 명시해야 그 토글 자체가 가로로 맞춰진다 — 페이지 박스
     치수는 A4 landscape나 297mm 210mm나 동일하다. */
  @page zb-landscape { size: A4 landscape; margin: 0; }
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
  return [themeCSS(), domainCSS(domains), BASE, TYPE, CHROME, LAYOUT, COMPONENTS, ZINE, INTRO, REVEAL, PRINT, ZINEBOOK, MOTION]
    .join("\n")
    .trim() + "\n";
}

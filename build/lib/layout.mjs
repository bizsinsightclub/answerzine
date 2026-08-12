/**
 * 페이지 셸. <head>의 메타데이터와 마스트헤드·푸터를 만든다.
 *
 * 회차·스토리마다 OG 태그와 canonical을 정적으로 심는다 (CLAUDE.md §9.10).
 * 테마는 첫 페인트 전에 인라인 스크립트로 적용해 깜빡임을 막는다.
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { SITE, u, absolute } from "./site.mjs";

export { SITE };

/**
 * 첫 페인트 전에 실행되는 부트 스크립트.
 *
 * 다크/라이트 토글은 없다 — 사이트는 항상 하나의 밝은 테마로 읽힌다.
 * JS가 도는가만 여기서 정한다 — .js가 붙은 문서에서만 등장 애니메이션이 켜진다.
 * 스크립트가 죽어도 본문은 그냥 보인다. 콘텐츠는 이미 빌드에서 렌더돼 있다.
 */
const BOOT = `(function(d){d.documentElement.className+=" js";})(document);`;

/** 한 단어를 "그대로 남는 부분"(keep)과 "옅어져 사라지는 부분"(fade)으로 쪼갠다.
    `keepStart`~`keepEnd`(둘 다 포함, 0-based)만 `intro-keep`(+ `data-intro-role`로
    app.js가 찾을 이름표)을 얹고, 앞뒤 나머지는 `intro-fade`로 감싼다 — 원래 글자
    순서 그대로 이어붙이므로(§아래 intro() 주석) 스크립트 없이 봐도 "ANSWER"·
    "MAGAZINE"이 정상적으로 읽힌다. 빈 조각(접두사·접미사가 없는 경우)은 건너뛴다.
    render-index.mjs의 verticalLabel()과 같은 이유로 공백 없이 join한다 — 인라인
    span 사이에 공백 텍스트 노드가 끼면 글자 사이가 벌어져 보인다. */
function splitWord(word, keepStart, keepEnd, keepRole) {
  const prefix = word.slice(0, keepStart);
  const keep = word.slice(keepStart, keepEnd + 1);
  const suffix = word.slice(keepEnd + 1);
  const parts = [];
  if (prefix) parts.push(`<span class="intro-fade">${prefix}</span>`);
  if (keep) parts.push(`<span class="intro-keep" data-intro-role="${keepRole}">${keep}</span>`);
  if (suffix) parts.push(`<span class="intro-fade">${suffix}</span>`);
  return raw(parts.join(""));
}

/**
 * 진입 화면 — 홈에서만 나온다. 2026-08-10 리디자인: 로고 이미지 대신 실제 텍스트를
 * 화면을 꽉 채우는 크기로 띄우고, 스크롤에 맞춰 갈라지며 그 뒤의 아카이브를 드러낸다
 * ("이거 왜 잘나가?" 스테이트먼트 단계는 없앴다 — 인트로 다음이 바로 본문이다).
 * 문서 흐름 안의 섹션 하나라 스크립트가 없어도 그냥 스크롤하거나 아래 링크를 누르면
 * 바로 본문(`#main-content`)으로 넘어간다. 실패해도 텍스트는 중앙에 그냥 보인다.
 *
 * 2026-08-11 여덟 번째 라운드: "THE ANSWER" 한 줄이 넓은 화면에서 두 줄로 끊겨(THE /
 * ANSWER) 어색하게 읽힌다는 지적 — 한 단어짜리 span 안에서 줄바꿈이 일어난 게 아니라,
 * "THE"와 "ANSWER"가 한 덩어리(intro-word-1)라 폭에 따라 그 사이에서 줄이 갈라졌다.
 * 사용자가 첨부한 참고 이미지처럼 THE / ANSWER / ZINE 세 단어를 처음부터 각자 한 줄로
 * 떼어내 — 의도치 않은 중간 줄바꿈 자체가 구조적으로 안 생긴다(단어 하나 = 줄 하나).
 *
 * 2026-08-12 열네 번째 라운드 — 문구를 "THE ANSWER ZINE"에서 "THE ANSWER MAGAZINE"으로
 * 바꿨다(사용자 요청). **이건 사이트 이름을 바꾸는 게 아니다** — `SITE.name`(="ANSWER
 * ZINE")은 그대로다. 사용자가 명시적으로 "인트로 애니메이션만" 바꾸라고 확인했다(전체
 * 리브랜딩은 거절) — 인트로 화면에만 쓰는 표시용 문구이지, 사이트 정체성 자체는 안
 * 바뀐다. 셋째 단어의 클래스를 intro-word-zine→intro-word-magazine으로 바꿨다.
 *
 * 2026-08-12 열다섯 번째 라운드 — 스크롤 안무를 다시 짰다(사용자 요청, 3가지):
 * 1. "PC 기준 100% VIEW에 맞춰서" — 예전엔(여덟 번째 라운드) 글자가 화면 가장자리에
 *    살짝 넘치는 걸 의도했는데(가장 긴 단어가 ANSWER, 6자였다), 셋째 단어가 8자
 *    MAGAZINE으로 바뀌면서 그 비율 그대로는 화면 밖으로 심하게 삐져나갔다. 글자
 *    크기를 낮춰(css.mjs .intro-word) 가장 긴 줄(MAGAZINE)이 데스크톱 뷰포트
 *    안에 완전히 들어오게 했다 — `build/verify.mjs`가 375~1920px에서 실측한다.
 * 2. 글자 색이 옅어지는 것(기존 유지) — ANSWER의 A·N + MAGAZINE의 Z·I·N·E =
 *    "ANZINE"만 검정으로 남고 나머지는 회색.
 * 3. "3번째 줄의 ZINE이 2번째 줄의 AN과 만나 정가운데 배치" — 더 스크롤하면 ZINE이
 *    물리적으로 이동해 AN 바로 뒤에 붙어 한 줄로 "ANZINE"을 이룬다. 구현은
 *    app.js의 bootIntroMotion() 참고 — 핵심 트릭은 AN은 전혀 안 움직이고(이미
 *    가운데 줄에 있다) ZINE만 AN의 오른쪽 끝으로 이동한다는 것이다. THE 전체와
 *    ANSWER의 나머지(SWER)·MAGAZINE의 나머지(MAGA)는 자리를 지킨 채 투명해질
 *    뿐이다(레이아웃 폭이 안 바뀌어야 AN의 위치가 스크롤 내내 고정된 기준점으로
 *    쓸 수 있다) — 그래서 이동시키지 않고 opacity만 쓴다.
 * `splitWord()`가 각 단어를 intro-fade(회색으로 옅어지고 사라짐)/intro-keep(항상
 * 검정, ZINE만 이동)으로 쪼갠다. `data-intro-role`로 app.js가 AN·ZINE 각각을
 * 정확히 찾는다. 색 전환은 `.intro-wordmark.is-revealing`(스크롤 시작과 동시에
 * 붙는 클래스) + CSS `transition: color`로, 이동·투명화는 app.js가 스크롤 진행률에
 * 맞춰 매 프레임 `transform`·`opacity` 인라인 스타일을 쓴다 — 어느 쪽도 글자
 * 크기·문서 레이아웃을 바꾸지 않아 CLS가 없다.
 */
function intro() {
  return h`<section class="intro" id="intro" data-intro role="presentation">
  <div class="intro-inner">
    <p class="intro-wordmark">
      <span class="intro-word intro-word-the">THE</span>
      <span class="intro-word intro-word-answer">${splitWord("ANSWER", 0, 1, "an")}</span>
      <span class="intro-word intro-word-magazine">${splitWord("MAGAZINE", 4, 7, "zine")}</span>
    </p>
    <a class="intro-scroll" href="#main-content" aria-label="아카이브로 이동"><span class="chev" aria-hidden="true">⌄</span></a>
  </div>
</section>`;
}

/**
 * 링크 미리보기 이미지.
 *
 * `tools/make-og.mjs`가 구워 커밋해 둔 PNG다. 카카오톡·슬랙·X가 이걸 받는다.
 * 반드시 **절대 URL**이어야 한다 — 스크래퍼는 우리 페이지 밖에서 이 값을 읽으므로
 * 상대 경로를 주면 아무것도 못 가져간다. 이게 미리보기가 안 뜨는 가장 흔한 이유다.
 */
const OG_IMAGE = { path: "/assets/img/og.png", width: 1200, height: 630 };

export function page({ title, description, url, content, noindex = false, bodyClass = "", showChrome = true, printUrl = null, showIntro = false, categoryNav = [], zinebook = "" }) {
  const full = title === SITE.name ? title : `${title} — ${SITE.name}`;
  const canonical = absolute(url ?? "/");
  const ogImage = absolute(OG_IMAGE.path);
  // zinebook은 showChrome 페이지에만 붙는다 — 인쇄 전용 라우트(/print/)는 showChrome:false라
  // 애초에 이 인자를 안 받는다(build.mjs). has-zb는 css.mjs가 하단 CTA 바 높이만큼
  // body에 여백을 주는 데 쓴다.
  const zb = showChrome ? zinebook : "";
  const bodyClasses = [bodyClass, zb ? "has-zb" : ""].filter(Boolean).join(" ");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(full)}</title>
<meta name="description" content="${escapeHTML(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="canonical" href="${escapeHTML(canonical)}">
<link rel="icon" href="${u("/assets/img/favicon.svg")}" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeHTML(SITE.name)}">
<meta property="og:title" content="${escapeHTML(title)}">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:url" content="${escapeHTML(canonical)}">
<meta property="og:image" content="${escapeHTML(ogImage)}">
<meta property="og:image:width" content="${OG_IMAGE.width}">
<meta property="og:image:height" content="${OG_IMAGE.height}">
<meta property="og:image:alt" content="${escapeHTML(`${SITE.name} — ${SITE.tagline}`)}">
<meta property="og:image:type" content="image/png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escapeHTML(ogImage)}">
<link rel="stylesheet" href="${u("/assets/style.css")}">
${
  // DIY 진이 있는 문서에서만, 인쇄 시 "기본"(이름 없는) @page 자체를 랜드스케이프로
  // 덮어쓴다(2026-08-12 네 번째 라운드, 사용자가 "실제로 인쇄해보니 세로로 나온다"고
  // 재보고). css.mjs의 named page(`page: zb-landscape` + `@page zb-landscape`)만으로는
  // 부족했다 — named page(CSS Paged Media의 `page` 프로퍼티)는 비교적 최근 스펙이라
  // 브라우저별 지원이 고르지 않다. 이 문서에서 인쇄되는 건 항상 진 시트뿐이므로
  // (`#main-content`·`.site-header`가 인쇄에서 강제로 숨겨진다, css.mjs 참고 — 오버레이를
  // 연 적이 없어도 마찬가지다) 이 문서의 기본 페이지 자체를 통째로 랜드스케이프로 바꿔도
  // 안전하다 — 거의 모든 브라우저가 지원하는 평범한 `@page{size}` 오버라이드라 named
  // page보다 훨씬 안정적이다. `/print/`(한 장 요약, 세로)는 zinebook을 안 받아 이 블록이
  // 안 붙는다 — 공유 스타일시트의 세로 기본값을 그대로 쓴다.
  zb ? `<style>@media print { @page { size: A4 landscape; margin: 0; } }</style>` : ""
}
<script>${BOOT}</script>
</head>
<body class="${escapeHTML(bodyClasses)}">
${showChrome ? `${showIntro ? intro() : ""}\n<div id="main-content">\n${header(printUrl, categoryNav)}\n${content}\n</div>` : content}
${zb}
<script src="${u("/assets/app.js")}" defer></script>
${zb ? `<script src="${u("/assets/zinebook.js")}" defer></script>` : ""}
</body>
</html>
`;
}

/**
 * 마스트헤드 — 2026-08-10 두 번째 라운드: 로고(좌)와 카테고리 내비(우)를 한 줄에 놓고
 * 스크롤 내내 상단에 고정한다(`.site-header { position: sticky; top: 0 }`). 밑줄 괘선
 * (`.ruleline`)은 뺐다 — 사용자 요청.
 *
 * 2026-08-11 세 번째 라운드: `.shell`(max-width 1240px 중앙 정렬)을 벗고 뷰포트 전체
 * 폭으로 바꿨다 — 넓은 화면에서 로고 좌우로 빈 공간이 남는다는 지적이었다. 로고는
 * 30% 더 키웠다(2026-08-10의 +20%에 이은 두 번째 확대). 내비 맨 앞에 "About" 링크를
 * 추가했다(신규 `/about/` 라우트).
 *
 * `categoryNav`는 build.mjs가 한 번 계산해 모든 페이지에 그대로 물려준다 —
 * [{ name, href }] 배열. `href`가 없으면(그 도메인에 아직 통과분이 없으면) 링크 없는
 * 라벨로만 낸다. 영문 라벨(`nameEn`)은 domains/registry.json 단일 소스다.
 *
 * 2026-08-11 정리 라운드: 어두운 배경용 `logo-light.png`와 그 전환 스위치를 없앴다 —
 * 사이트가 처음부터 흰 배경 하나뿐이고(§1), 인트로도 이미지가 아니라 텍스트라
 * `logo-light`가 표시될 자리가 구조적으로 없었다(죽은 코드). 어두운 배경이 다시
 * 생기면 그때 다시 만든다.
 *
 * 2026-08-11 아홉 번째 라운드: "All" 링크가 `/`(홈, 카테고리 카드 그리드)를 가리켰는데,
 * 사용자 요청으로 `/archive/`(전체 스토리 평면 목록)로 바꿨다 — "전체"를 눌렀을 때
 * 카드 그리드가 아니라 실제 전체 목록이 나오는 게 더 직관적이라는 판단이다. 홈 자체는
 * 여전히 로고 클릭(`.wordmark`)으로 간다.
 */
function header(printUrl, categoryNav = []) {
  return h`<header class="site-header" style="padding-bottom:0">
  <div class="masthead">
    <div class="masthead-top">
      <a class="wordmark" href="${u("/")}" aria-label="${SITE.name} 홈">
        <img class="logo" src="${u("/assets/img/logo-dark.png")}" alt="${SITE.name}" width="518" height="265">
      </a>
      <nav class="category-nav" aria-label="카테고리">
        <a href="${u("/about/")}">About</a>
        <a href="${u("/archive/")}">All</a>
        ${categoryNav.map((c) =>
          raw(c.href ? h`<a href="${u(c.href)}">${c.name}</a>` : h`<span class="is-empty">${c.name}</span>`)
        )}
      </nav>
      ${printUrl ? raw(h`<a class="header-cta" href="${u(printUrl)}">한 장 요약 보기</a>`) : ""}
    </div>
  </div>
</header>`;
}

/** "서울, 대한민국 — 2026년 8월 1주차" */
export function dateline(range) {
  const [y, m, d] = range.split(" – ")[0].split(".").map(Number);
  const week = Math.ceil(d / 7);
  return `서울, 대한민국 — ${y}년 ${m}월 ${week}주차`;
}

export { raw };

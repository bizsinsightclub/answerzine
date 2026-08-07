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
 * 두 가지를 첫 페인트 "전에" 정해야 깜빡임이 없다.
 * 다크/라이트 토글은 없다 — 사이트는 항상 하나의 밝은 테마로 읽힌다.
 *   1. 진입 화면을 이미 본 세션인가 — 봤으면 intro-done을 걸어 인트로·스테이트먼트
 *      섹션을 아예 그리지 않고 본문부터 보여준다. 페이지를 넘길 때마다 로고
 *      스크롤 구간이 다시 나오면 로딩이 아니라 방해다.
 *   2. JS가 도는가 — .js가 붙은 문서에서만 등장 애니메이션이 켜진다.
 *      스크립트가 죽어도 본문은 그냥 보인다. 콘텐츠는 이미 빌드에서 렌더돼 있다.
 */
const BOOT = `(function(d){var r=d.documentElement;try{
if(sessionStorage.getItem("az-intro")==="1")r.className+=" intro-done";
}catch(e){}r.className+=" js";})(document);`;

/**
 * 진입 화면. 원본 프로토타입처럼 로고 화면 → 스테이트먼트 → 본문 순으로 스크롤해 들어간다.
 * 자동으로 걷히는 타이머 오버레이가 아니라 문서 흐름 안의 두 섹션이라, 스크립트가 없어도
 * 그냥 스크롤하거나 링크를 누르면 다음 섹션·본문으로 넘어간다 (a href="#…" 뿐이다).
 */
function intro() {
  return h`<section class="intro" id="intro" data-intro role="presentation">
  <img class="logo logo-light" src="${u("/assets/img/logo-light.png")}" alt="${SITE.name}" width="1970" height="860">
  <img class="logo logo-dark" src="${u("/assets/img/logo-dark.png")}" alt="" aria-hidden="true" width="1971" height="842">
  <a class="intro-scroll" href="#statement" aria-label="아래로 스크롤"><span class="chev" aria-hidden="true">⌄</span></a>
</section>
<section class="statement-wrap" id="statement" data-intro>
  <p class="statement-text">이거 왜 잘나가?<br>순위가 아니라, 팔린 이유를 본다.</p>
  <a class="statement-cta" href="#main-content">아카이브 보기 <span class="chev" aria-hidden="true">⌄</span></a>
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

export function page({ title, description, url, content, noindex = false, bodyClass = "", showChrome = true, showFooter = true, printUrl = null }) {
  const full = title === SITE.name ? title : `${title} — ${SITE.name}`;
  const canonical = absolute(url ?? "/");
  const ogImage = absolute(OG_IMAGE.path);

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
<script>${BOOT}</script>
</head>
<body class="${escapeHTML(bodyClass)}">
${showChrome ? `${intro()}\n<div id="main-content">\n${header(printUrl)}\n${content}\n${showFooter ? footer() : ""}\n</div>` : content}
<script src="${u("/assets/app.js")}" defer></script>
</body>
</html>
`;
}

function header(printUrl) {
  return h`<header class="site-header shell" style="padding-bottom:0">
  <div class="masthead">
    <div class="masthead-top">
      <a class="wordmark" href="${u("/")}" aria-label="${SITE.name} 홈">
        <img class="logo logo-light" src="${u("/assets/img/logo-light.png")}" alt="${SITE.name}" width="1970" height="860">
        <img class="logo logo-dark" src="${u("/assets/img/logo-dark.png")}" alt="" aria-hidden="true" width="1971" height="842">
      </a>
      ${printUrl ? raw(h`<a class="header-cta" href="${u(printUrl)}">핵심 포인트 보기</a>`) : ""}
    </div>
    <div class="ruleline"></div>
  </div>
</header>`;
}

function footer() {
  return h`<footer class="site-footer shell" style="padding-top:0">
  <p>${SITE.name} — ${SITE.tagline}</p>
  <p>1위라도 이유를 설명할 수 없으면 싣지 않는다. 7위라도 이유가 선명하면 싣는다.</p>
</footer>`;
}

/** "서울, 대한민국 — 2026년 8월 1주차" */
export function dateline(range) {
  const [y, m, d] = range.split(" – ")[0].split(".").map(Number);
  const week = Math.ceil(d / 7);
  return `서울, 대한민국 — ${y}년 ${m}월 ${week}주차`;
}

export { raw };

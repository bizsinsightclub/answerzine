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
 * 세 가지를 첫 페인트 "전에" 정해야 깜빡임이 없다.
 *   1. 테마 — Night가 기본이라 paper일 때만 속성을 건다.
 *   2. 인트로를 이미 본 세션인가 — 봤으면 splash-done을 걸어 로고 화면을 아예 그리지 않는다.
 *      이걸 app.js(defer)에 두면 두 번째 페이지부터 로고가 한 번 번쩍이고 사라진다.
 *   3. JS가 도는가 — .js가 붙은 문서에서만 등장 애니메이션이 켜진다.
 *      스크립트가 죽어도 본문은 그냥 보인다. 콘텐츠는 이미 빌드에서 렌더돼 있다.
 */
const BOOT = `(function(d){var r=d.documentElement;try{
if(localStorage.getItem("az-theme")==="paper")r.setAttribute("data-theme","paper");
if(sessionStorage.getItem("az-intro")==="1")r.className+=" splash-done";
}catch(e){}r.className+=" js";})(document);`;

/** 로딩 화면. 마크업으로 심고 CSS 애니메이션으로 스스로 걷힌다 — JS가 없어도 사라진다. */
function splash() {
  return h`<div class="splash" data-splash role="presentation">
  <div class="splash-inner">
    <img class="logo logo-light" src="${u("/assets/img/logo-light.png")}" alt="" width="1970" height="860">
    <img class="logo logo-dark" src="${u("/assets/img/logo-dark.png")}" alt="" width="1971" height="842">
    <div class="splash-rule"></div>
    <p class="splash-tagline">${SITE.tagline}</p>
  </div>
</div>`;
}

export function page({ title, description, url, content, noindex = false, bodyClass = "", showChrome = true }) {
  const full = title === SITE.name ? title : `${title} — ${SITE.name}`;
  const canonical = absolute(url ?? "/");

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
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${u("/assets/style.css")}">
<script>${BOOT}</script>
</head>
<body class="${escapeHTML(bodyClass)}">
${showChrome ? splash() : ""}
${showChrome ? header() : ""}
${content}
${showChrome ? footer() : ""}
<script src="${u("/assets/app.js")}" defer></script>
</body>
</html>
`;
}

function header() {
  return h`<header class="site-header shell" style="padding-bottom:0">
  <div class="masthead">
    <div class="masthead-top">
      <a class="wordmark" href="${u("/")}" aria-label="${SITE.name} 홈">
        <img class="logo logo-light" src="${u("/assets/img/logo-light.png")}" alt="${SITE.name}" width="1970" height="860">
        <img class="logo logo-dark" src="${u("/assets/img/logo-dark.png")}" alt="" aria-hidden="true" width="1971" height="842">
      </a>
      <div style="display:flex;align-items:center;gap:16px">
        <span class="tagline">${SITE.tagline}</span>
        <button class="theme-toggle" data-theme-toggle type="button" aria-label="테마 전환">Paper</button>
      </div>
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

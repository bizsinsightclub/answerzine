/**
 * 페이지 셸. <head>의 메타데이터와 마스트헤드·푸터를 만든다.
 *
 * 회차·스토리마다 OG 태그와 canonical을 정적으로 심는다 (CLAUDE.md §9.10).
 * 테마는 첫 페인트 전에 인라인 스크립트로 적용해 깜빡임을 막는다.
 */
import { h, raw, escapeHTML } from "./html.mjs";
import { SITE, u, absolute } from "./site.mjs";

export { SITE };

/** 첫 페인트 전에 저장된 테마를 적용한다. Night가 기본이라 paper일 때만 속성을 건다. */
const THEME_BOOT = `try{if(localStorage.getItem("az-theme")==="paper")document.documentElement.setAttribute("data-theme","paper")}catch(e){}`;

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
<script>${THEME_BOOT}</script>
</head>
<body class="${escapeHTML(bodyClass)}">
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

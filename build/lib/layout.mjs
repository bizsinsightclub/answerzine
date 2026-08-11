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

/**
 * 진입 화면 — 홈에서만 나온다. 2026-08-10 리디자인: 로고 이미지 대신 실제 텍스트
 * "THE ANSWER" / "ZINE" 두 줄을 화면을 꽉 채우는 크기로 띄우고, 스크롤에 맞춰 첫 줄은
 * 오른쪽으로, 둘째 줄은 왼쪽으로 갈라지며 그 뒤의 아카이브를 드러낸다("이거 왜 잘나가?"
 * 스테이트먼트 단계는 없앴다 — 인트로 다음이 바로 본문이다).
 * 문서 흐름 안의 섹션 하나라 스크립트가 없어도 그냥 스크롤하거나 아래 링크를 누르면
 * 바로 본문(`#main-content`)으로 넘어간다. app.js의 bootIntroMotion()이 스크롤 진행률에
 * 맞춰 두 줄을 좌우로 밀어낸다 — 실패해도 텍스트는 중앙에 그냥 보인다.
 *
 * 같은 날 두 번째 라운드에서 문구를 "THE ANSWER" / "COMPANY"에서 "THE ANSWER" / "ZINE"
 * (사이트명 ANSWER ZINE과 맞춘다)로, 크기를 화면 채움 수준으로 키웠다 — 사용자 요청.
 */
function intro() {
  return h`<section class="intro" id="intro" data-intro role="presentation">
  <div class="intro-inner">
    <p class="intro-wordmark">
      <span class="intro-word intro-word-1">THE ANSWER</span>
      <span class="intro-word intro-word-2">ZINE</span>
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

export function page({ title, description, url, content, noindex = false, bodyClass = "", showChrome = true, printUrl = null, showIntro = false, categoryNav = [] }) {
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
${showChrome ? `${showIntro ? intro() : ""}\n<div id="main-content">\n${header(printUrl, categoryNav)}\n${content}\n</div>` : content}
<script src="${u("/assets/app.js")}" defer></script>
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
 */
function header(printUrl, categoryNav = []) {
  return h`<header class="site-header" style="padding-bottom:0">
  <div class="masthead">
    <div class="masthead-top">
      <a class="wordmark" href="${u("/")}" aria-label="${SITE.name} 홈">
        <img class="logo logo-light" src="${u("/assets/img/logo-light.png")}" alt="${SITE.name}" width="1970" height="260">
        <img class="logo logo-dark" src="${u("/assets/img/logo-dark.png")}" alt="" aria-hidden="true" width="1971" height="270">
      </a>
      <nav class="category-nav" aria-label="카테고리">
        <a href="${u("/about/")}">About</a>
        <a href="${u("/")}">All</a>
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

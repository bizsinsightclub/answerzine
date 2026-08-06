/**
 * A4 인쇄 진.
 *
 * 프로토타입은 .zine-page 내용이 HTML에 하드코딩돼 있었다. 그래서
 * issues/2026-w31.json에서 제외한 영화 편(국내 개봉 전 데이터 인용)이
 * 종이 지면에는 그대로 살아 있었다 — 정본이 둘이면 한쪽만 고쳐진다.
 *
 * 이제 입력에 없으면 지면에도 없다. test/zine.test.mjs가 그 사고를 직접 재현해 막는다.
 * 헤드라인·티저는 웹과 같은 값을 참조하므로 CLAUDE.md §8 QA #17은 위반이 불가능하다.
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { blocksOf } from "./data.mjs";
import { dateline, SITE } from "./layout.mjs";

/** 인쇄 본문. zineBody가 있으면 그대로, 없으면 text 블록 셋을 쓴다. */
export function zineBodyFor(story) {
  if (Array.isArray(story.zineBody) && story.zineBody.length) return story.zineBody;
  return blocksOf(story).texts.map((t) => t.text);
}

function photoBlock(story, stat) {
  // 사진은 스토리가 명시할 때만 붙인다. 기본 사진을 두면 엉뚱한 기사에 남의 사진이 얹힌다.
  const src = story.photo?.src ?? null;
  const alt = story.photo?.alt ?? "";
  const bg = src ? `background-image:url('${u(src)}');` : "";
  // 스티커는 사진 모서리에 겹쳐 붙인다. 사진과 본문 사이에 띄우면 배너처럼 읽힌다.
  return h`<div class="zine-lead-photo">
  <div class="zine-photo-collage">
    <div class="zine-photo-placeholder" style="${raw(bg)}" role="img" aria-label="${alt || "사진 자리"}">${src ? "" : "PHOTO"}</div>
    <div class="zine-tape zine-tape-1"></div>
    <div class="zine-tape zine-tape-2"></div>
    ${stat ? raw(h`<div class="zine-sticker"><span class="lbl">${stat.label}</span><span class="val">${stat.value}</span></div>`) : ""}
  </div>
</div>`;
}

export function renderZinePage(issue, stories, registry = {}) {
  const mine = stories.filter((s) => s.issue?.issue === issue.issue || stories === issue.stories);
  const list = mine.length ? mine : (issue.stories ?? []);
  const [lead, ...minis] = list;
  const warnings = [];

  if (!lead) warnings.push("리드 스토리가 없다. 회차가 비어 있다.");
  if (minis.length < 3)
    warnings.push(`미니 슬롯이 ${minis.length}개다 (3개 기준). 그만큼 지면 하단이 빈다 — 결번 판정 결과인지 확인할 것. CLAUDE.md §7.2`);
  if (minis.length > 3)
    // 지면은 리드 1 + 미니 3 고정이다. 활성 도메인이 8개여도 늘리지 않는다 (registry.zineLayout).
    warnings.push(`통과 ${list.length}편 중 점수 상위 4편만 지면에 싣는다. 나머지 ${minis.length - 3}편은 웹에만 게재된다.`);

  const leadStat = lead ? blocksOf(lead).stat : null;
  const body = lead ? zineBodyFor(lead) : [];

  const content = h`<div class="zine-page" id="zine-page">
  <header class="zine-masthead">
    <img class="zine-logo" src="${raw(u("/assets/img/logo-dark.png"))}" alt="${SITE.name}" width="1971" height="842">
    <div class="zine-ruleline"></div>
    <div class="zine-dateline">${dateline(issue.range)}</div>
  </header>

  ${lead
    ? raw(h`<div class="zine-lead">
    <div class="zine-kicker">이번 주 · ${lead.domain}${lead.kicker ? ` · ${lead.kicker}` : ""}</div>
    <h1 class="zine-headline">${lead.headline}</h1>
    <div class="zine-byline">BY ${SITE.name} · ${lead.domain} 데이터 기반</div>
    <div class="zine-lead-body">
      ${raw(photoBlock(lead, leadStat))}
      <p class="zine-teaser">${lead.teaser}</p>
      ${body.map((p) => raw(h`<p class="zine-body">${p}</p>`))}
    </div>
  </div>`)
    : raw('<p class="zine-body">이번 주는 게재할 스토리가 없다.</p>')}

  <div class="zine-section-rule"></div>

  <div class="zine-secondary-row">
    ${minis.slice(0, 3).map((s) =>
      raw(h`<div class="zine-mini">
      <div class="zine-kicker">${s.kicker ?? ""}${s.kicker ? " · " : ""}${s.domain}</div>
      <h3 class="zine-mini-headline">${s.headline}</h3>
      <p class="zine-mini-teaser">${s.teaser}</p>
    </div>`)
    )}
  </div>

  <footer class="zine-footer-bar">
    <div class="zine-footer-qr">
      <img class="zine-qr" src="${u(`/assets/img/qr-${issue.issue}.svg`)}" alt="QR 코드" width="60" height="60">
      <div class="zine-qr-caption">전체 글 읽기 →<span>answerzine.kr/${issue.issue}</span></div>
    </div>
  </footer>
</div>`;

  return { title: `${issue.issue} 인쇄용 A4`, content, lead, minis, warnings };
}

/** 인쇄 진을 감싸는 미리보기 페이지. */
export function renderZinePreview(issue, stories, registry) {
  const z = renderZinePage(issue, stories, registry);
  const content = h`<main class="zine-preview">
  <span class="label">인쇄용 요약 페이지 (A4 1장)</span>
  <p style="font-size:14px;color:var(--secondary);margin:0 0 24px">카페 등에 배포할 실물 진이다. QR로 웹의 전체 글로 이어진다.</p>
  <button class="btn print-btn" type="button" data-print>인쇄하기</button>
  <div class="zine-mount" style="margin-top:32px">${raw(z.content)}</div>
</main>`;

  return {
    title: z.title,
    description: `${issue.issue} 회차의 A4 인쇄용 지면.`,
    content,
    noindex: true,
    warnings: z.warnings,
  };
}

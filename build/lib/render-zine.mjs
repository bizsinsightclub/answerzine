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
import { blocksOf } from "./data.mjs";
import { dateline, SITE } from "./layout.mjs";

/** 인쇄 본문. zineBody가 있으면 그대로, 없으면 text 블록 셋을 쓴다. */
export function zineBodyFor(story) {
  if (Array.isArray(story.zineBody) && story.zineBody.length) return story.zineBody;
  return blocksOf(story).texts.map((t) => t.text);
}

function photoBlock(story, stat) {
  const bg = story.photo?.src ? `background-image:url('${story.photo.src}');` : "";
  const alt = story.photo?.alt ?? "";
  return h`<div class="zine-lead-photo">
  <div class="zine-photo-collage">
    <div class="zine-photo-placeholder" style="${raw(bg)}" role="img" aria-label="${alt || "사진 자리"}">${bg ? "" : "PHOTO"}</div>
    <div class="zine-tape zine-tape-1"></div>
    <div class="zine-tape zine-tape-2"></div>
  </div>
  ${stat ? raw(h`<div class="zine-sticker">${stat.label} ${stat.value}</div>`) : ""}
</div>`;
}

export function renderZinePage(issue, stories, registry = {}) {
  const mine = stories.filter((s) => s.issue?.issue === issue.issue || stories === issue.stories);
  const list = mine.length ? mine : (issue.stories ?? []);
  const [lead, ...minis] = list;
  const warnings = [];

  if (!lead) warnings.push("리드 스토리가 없다. 회차가 비어 있다.");
  if (minis.length < 3)
    warnings.push(`미니 슬롯이 ${minis.length}개다 (3개 기준). 인쇄 진 레이아웃 조정이 필요하다 — CLAUDE.md §7.2`);
  if (minis.length > 3)
    warnings.push(`미니가 ${minis.length}개로 슬롯 3개를 넘는다. domains/README.md §3의 결정이 필요하다.`);

  const leadStat = lead ? blocksOf(lead).stat : null;
  const body = lead ? zineBodyFor(lead) : [];

  const content = h`<div class="zine-page" id="zine-page">
  <header class="zine-masthead">
    <div class="zine-wordmark">${SITE.name}</div>
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
      <img class="zine-qr" src="/assets/img/qr-${raw(issue.issue)}.svg" alt="QR 코드" width="60" height="60">
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
  <div style="margin-top:32px">${raw(z.content)}</div>
</main>`;

  return {
    title: z.title,
    description: `${issue.issue} 회차의 A4 인쇄용 지면.`,
    content,
    noindex: true,
    warnings: z.warnings,
  };
}

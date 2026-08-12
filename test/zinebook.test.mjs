/**
 * DIY 진(플립북 + 인쇄 시트) — render-zinebook.mjs.
 *
 * 물리 시트 배치(§render-zinebook.mjs 맨 위 주석)는 사용자가 명시적으로 지정한
 * 값이다 — 여기서 그 순서가 절대 안 바뀌는지를 고정한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderZinebook, FLIP_ORDER, SHEETS } from "../build/lib/render-zinebook.mjs";
import { page } from "../build/lib/layout.mjs";
import { stylesheet } from "../build/lib/css.mjs";

const ISSUE = { issue: "2026-w31", range: "2026.07.24 – 08.09" };

function mockStory(n, domain) {
  return {
    id: `2026-w31-s${n}`, domain, slug: `s${n}`, range: "2026.07.24 – 08.09",
    kicker: "TEST", headline: `테스트 헤드라인 ${n}.`, teaser: `테스트 티저 ${n}.`,
    issue: ISSUE, url: `/2026-w31/s${n}/`,
    blocks: [
      { type: "text", text: "현상." },
      { type: "stat", label: `스탯 라벨 ${n}`, value: `${n}00 (테스트)`, sourceUrl: "https://example.com", sourceLabel: "예시 출처" },
      { type: "text", text: "맥락." },
      { type: "quote", text: `인용문 ${n}.`, insight: { concept: "테스트 개념", note: "테스트 노트." } },
      { type: "text", text: "마무리." },
    ],
  };
}

const FOUR = [1, 2, 3, 4].map((n) => mockStory(n, "영화"));

test("회차가 없으면 아무것도 렌더하지 않는다", () => {
  assert.equal(renderZinebook({ issue: null, stories: [] }), "");
});

test("하단 CTA 버튼 문구가 정확히 나온다", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  assert.match(html, /<button[^>]*data-zb-open[^>]*>Create The Answer Zine<\/button>/);
});

test("그리드 미리보기가 논리적 읽는 순서(표지→About→기사1~4→Notes→뒤표지) 8장으로 나온다", () => {
  // 2026-08-11 — 3D 페이지 넘김(한 번에 한 쪽)을 정적 전체 그리드로 바꿨다(사용자 요청 —
  // "인쇄 전에 8쪽 전체를 봐야 한다"). 순서 자체(FLIP_ORDER)는 그대로 재사용한다.
  assert.deepEqual(FLIP_ORDER, [
    "cover-front", "about", "article-1", "article-2", "article-3", "article-4", "notes", "cover-back",
  ]);
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  const grid = html.slice(html.indexOf("data-zb-grid"), html.indexOf("zb-print-hint"));
  // 각 논리 페이지를 식별하는 문자열이 이 순서대로 나오는지 인덱스로 확인한다.
  const markers = ["ANSWER ZINE · 8P MINI ISSUE", "ABOUT", "테스트 헤드라인 1", "테스트 헤드라인 2", "테스트 헤드라인 3", "테스트 헤드라인 4", "NOTES", 'aria-label="뒤표지'];
  const idx = markers.map((m) => grid.indexOf(m));
  assert.ok(idx.every((i) => i > -1), `마커 중 못 찾은 게 있다: ${JSON.stringify(idx)}`);
  for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1], `${markers[i]}가 순서를 벗어났다`);
});

test("물리 인쇄 시트 배치가 사용자 지정 그대로다 — 바뀌면 인쇄물이 잘못 접힌다", () => {
  assert.deepEqual(SHEETS, [
    { id: "sheet1-front", halves: ["cover-back", "cover-front"] },
    { id: "sheet1-back", halves: ["about", "notes"] },
    { id: "sheet2-front", halves: ["article-4", "article-1"] },
    { id: "sheet2-back", halves: ["article-2", "article-3"] },
  ]);
});

test("인쇄 시트 4장이 그 순서·좌우 배치대로 마크업에 나온다", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  const sheetsHTML = html.slice(html.indexOf("zb-print-sheets"));
  const s1f = sheetsHTML.slice(sheetsHTML.indexOf('sheet1-front'), sheetsHTML.indexOf('sheet1-back'));
  // 뒤표지는 자체 텍스트 라벨(eyebrow·caption)이 없어(2026-08-12 세 번째 라운드,
  // 랩어라운드 캔버스만 있다) aria-label로 식별한다.
  assert.ok(s1f.indexOf('aria-label="뒤표지') < s1f.indexOf("8쪽 진"), "Sheet1 앞면은 [뒤표지 | 앞표지] 순이어야 한다");

  const s1b = sheetsHTML.slice(sheetsHTML.indexOf('sheet1-back'), sheetsHTML.indexOf('sheet2-front'));
  assert.ok(s1b.indexOf("ABOUT") < s1b.indexOf("NOTES"), "Sheet1 뒷면은 [About | Notes] 순이어야 한다");

  const s2f = sheetsHTML.slice(sheetsHTML.indexOf('sheet2-front'), sheetsHTML.indexOf('sheet2-back'));
  assert.ok(s2f.indexOf("테스트 헤드라인 4") < s2f.indexOf("테스트 헤드라인 1"), "Sheet2 앞면은 [기사4 | 기사1] 순이어야 한다");

  const s2b = sheetsHTML.slice(sheetsHTML.indexOf('sheet2-back'));
  assert.ok(s2b.indexOf("테스트 헤드라인 2") < s2b.indexOf("테스트 헤드라인 3"), "Sheet2 뒷면은 [기사2 | 기사3] 순이어야 한다");
});

test("4편에 못 미치면 확인 안 된 내용을 채우지 않고 결번 안내를 낸다 — §7.3", () => {
  const html = renderZinebook({ issue: ISSUE, stories: [mockStory(1, "영화")] });
  assert.match(html, /이 자리는 통과분이 4편에 못 미쳐 비웠다/);
  // 결번 자리(기사 2·3·4) 3개가 플립북·인쇄 시트 두 군데에 각각 나오므로(파일 맨 위 주석의
  // "한 번 만들어 두 군데 재사용" 설계) 6번이 맞다 — 어느 쪽이든 확인 안 된 헤드라인을
  // fabricate하지 않는다.
  const count = (html.match(/이 자리는 통과분이 4편에 못 미쳐 비웠다/g) ?? []).length;
  assert.equal(count, 6);
});

test("기사 페이지가 5블록 전체를 낸다 — teaser 요약이 아니라 웹과 같은 전체 콘텐츠(사용자 요청)", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  for (const s of ["현상.", "맥락.", "마무리.", "인용문 1.", "테스트 노트."]) {
    assert.ok(html.includes(s), `${s} 누락 — 기사 페이지가 웹 스토리를 축약했다`);
  }
  // teaser는 texts[0]와 중복이라 뺐다 — 남아 있으면 안 된다.
  assert.ok(!html.includes("테스트 티저 1"), "teaser가 남아 있다 — texts[0]와 중복된다");
});

test("About 페이지가 QR과 URL을 낸다(전달됐을 때) — 사용자 요청", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR, qrSvg: "<svg data-test-qr></svg>", siteUrl: "https://example.com/" });
  assert.match(html, /<div class="zb-qr"[^>]*><svg data-test-qr><\/svg><\/div>/);
  assert.match(html, /https:\/\/example\.com\//);
});

test("About 페이지 — qrSvg가 없어도(npm install 안 한 로컬) 빌드는 그대로 성공한다", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR, qrSvg: null, siteUrl: "https://example.com/" });
  assert.ok(!html.includes('class="zb-qr"'), "qrSvg가 없는데 QR 자리가 그려졌다");
  assert.match(html, /https:\/\/example\.com\//, "QR이 없어도 URL 텍스트는 남아야 한다");
});

test("출처 링크가 항상 보인다 — §9.9와 같은 원칙", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  assert.match(html, /예시 출처/);
  assert.ok(!/opacity:\s*0/.test(html), "hover에만 노출하면 안 된다");
});

test("이스케이프를 거친다 — §9.7", () => {
  const evil = [{ ...mockStory(1, "영화"), headline: `<script>alert(1)</script>` }, ...FOUR.slice(1)];
  const html = renderZinebook({ issue: ISSUE, stories: evil });
  assert.ok(!html.includes("<script>alert"), "이스케이프되지 않았다");
});

test("onclick 문자열 보간을 쓰지 않는다 — §9.7", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  assert.ok(!html.includes("onclick"), "이벤트 위임을 써야 한다");
});

test("page()가 zinebook을 받으면 body에 has-zb가 붙고 zinebook.js를 싣는다", () => {
  const zb = renderZinebook({ issue: ISSUE, stories: FOUR });
  const withZb = page({ title: "t", description: "d", url: "/", content: "<main></main>", zinebook: zb });
  assert.match(withZb, /<body class="[^"]*\bhas-zb\b[^"]*"/);
  assert.match(withZb, /assets\/zinebook\.js/);

  const withoutZb = page({ title: "t", description: "d", url: "/", content: "<main></main>" });
  assert.ok(!withoutZb.includes("has-zb"), "zinebook 없이도 has-zb가 붙었다");
  assert.ok(!withoutZb.includes("zinebook.js"), "zinebook 없이도 스크립트가 실렸다");
});

test("showChrome:false 페이지(인쇄 전용 라우트)에는 zinebook을 넘겨도 안 붙는다", () => {
  const zb = renderZinebook({ issue: ISSUE, stories: FOUR });
  const html = page({ title: "t", description: "d", url: "/x/print/", content: "<main></main>", showChrome: false, zinebook: zb });
  assert.ok(!html.includes("zb-cta"), "인쇄 전용 라우트에 CTA 바가 붙었다");
  assert.ok(!html.includes("zinebook.js"), "인쇄 전용 라우트에 스크립트가 실렸다");
});

/* ── CSS 계약 ── */
const css = stylesheet([{ key: "book", color: "#34C759", colorPaper: "#217E38" }]);

test("인쇄 시트는 이름 있는 페이지로 A4 랜드스케이프를 쓴다 — 기존 A4 세로 인쇄를 건드리지 않는다", () => {
  // 2026-08-11 — raw mm 치수(297mm 210mm)는 헤드리스 PDF 박스 자체는 맞게 나왔지만,
  // 실제 인쇄 대화상자의 레이아웃(세로/가로) 토글은 landscape 키워드가 있어야 자동으로
  // 맞춰진다는 걸 실측으로 확인해 갱신했다.
  assert.match(css, /@page\s+zb-landscape\s*\{\s*size:\s*A4\s+landscape/);
  assert.match(css, /\.zb-sheet\s*\{[^}]*page:\s*zb-landscape/);
  // 기존 인쇄 진의 기본(이름 없는) @page는 그대로 A4다.
  assert.match(css, /@page\s*\{\s*size:\s*A4;\s*margin:\s*0;\s*\}/);
});

test("표지는 흰 배경·검정 글자다 — 2026-08-11 반전(사용자 요청)", () => {
  const zbBlock = css.slice(css.indexOf(".zb-cta"), css.indexOf("@media (prefers-reduced-motion"));
  const coverRule = /\.zb-panel--cover\s*\{[^}]*\}/.exec(zbBlock)[0];
  assert.match(coverRule, /background:\s*#fff/);
  assert.match(coverRule, /color:\s*#111/);
});

test("흑백만 쓴다 — 도메인 컬러를 참조하지 않는다(요구사항 #5)", () => {
  const zbBlock = css.slice(css.indexOf(".zb-cta"), css.indexOf("@media (prefers-reduced-motion"));
  assert.ok(!/var\(--dc/.test(zbBlock), "DIY 진 CSS가 도메인 컬러를 참조한다");
});

test("이탤릭을 쓰지 않는다 — 사이트 전역 규칙", () => {
  const zbBlock = css.slice(css.indexOf(".zb-cta"), css.indexOf("@media (prefers-reduced-motion"));
  assert.ok(!/font-style:\s*italic/.test(zbBlock));
});

test("오버레이를 열지 않은 채(hidden 속성이 남아 있어도) 인쇄 규칙이 이긴다", () => {
  // .zb-overlay[hidden]의 display:none과 인쇄 블록의 display:block이 둘 다 !important일 때
  // 인쇄 규칙 쪽 선택자에도 [hidden]이 있어야 명시도가 밀리지 않는다 — 실측으로 찾은 버그.
  const printBlock = css.slice(css.indexOf("@media print", css.indexOf(".zb-cta")));
  assert.match(printBlock, /\.zb-overlay,\s*\.zb-overlay\[hidden\]\s*\{[^}]*display:\s*block\s*!important/);
});

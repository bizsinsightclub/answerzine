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
    issue: ISSUE, url: `/2026-w31/s${n}/`, anchorDate: "2026-07-24",
    blocks: [
      { type: "text", text: "현상." },
      { type: "stat", label: `스탯 라벨 ${n}`, value: `${n}00 (테스트)`, sourceUrl: "https://example.com", sourceLabel: "예시 출처 확인하기" },
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

test("툴바 제목(장식용)이 없다 — 2026-08-12 여섯 번째 라운드(사용자 요청, delete texts)", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  assert.ok(!html.includes("이번 호 미니 진"), "툴바 제목이 남아 있다");
  assert.ok(!html.includes("zb-toolbar-title"));
});

test("양면 인쇄 뒤집기 안내(.zb-duplex-hint)가 툴바 안에 있다 — 2026-08-12 열세 번째 라운드(사용자 신고: 뒷면이 거꾸로 인쇄됨). 여섯 번째 라운드에서 지운 옛 인쇄 안내 문단과는 다르다 — 장식이 아니라 물리 출력 정합성에 필요한 기능 문구라 다시 넣었다(design.md §11.2 참고)", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  assert.match(html, /<p class="zb-duplex-hint">/);
  assert.ok(html.includes("Flip on Short Edge"), "짧은 변 기준 뒤집기 안내가 없다");
  assert.ok(html.includes("짧은 변 기준 뒤집기"), "한국어 안내 문구가 없다");
  // .zb-toolbar 안에 있어야 인쇄 시 그 규칙(전체 display:none)을 그대로 물려받아
  // 숨는다 — zb-toolbar 여는 태그와 zb-viewer 여는 태그 사이에 있는지로 확인한다.
  const toolbarStart = html.indexOf('<div class="zb-toolbar">');
  const viewerStart = html.indexOf('<div class="zb-viewer">');
  const hintPos = html.indexOf("zb-duplex-hint");
  assert.ok(toolbarStart >= 0 && viewerStart > toolbarStart, "zb-toolbar/zb-viewer 위치를 못 찾았다");
  assert.ok(hintPos > toolbarStart && hintPos < viewerStart, "안내 문구가 zb-toolbar 밖에 있다 — 인쇄에 찍힐 수 있다");
});

test("표지에 eyebrow·caption 텍스트가 없다 — 랩어라운드 타이포만 남는다(사용자 요청)", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  assert.ok(!html.includes("8P MINI ISSUE"), "표지 eyebrow가 남아 있다");
  assert.ok(!html.includes("직접 접어 만드는"), "표지 caption이 남아 있다");
});

test("스티커 팔레트가 미리보기 하단에 나온다 — 2026-08-12 일곱 번째 라운드(사용자 요청)", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  assert.match(html, /<div class="zb-sticker-palette" data-zb-sticker-palette>/);
  const chips = html.match(/class="zb-sticker-chip"/g) ?? [];
  assert.ok(chips.length >= 8, `스티커 종류가 너무 적다(${chips.length}개) — 참고 이미지만큼 다양해야 한다`);
  // 팔레트는 오버레이 안, 뷰어 다음에 온다 — 인쇄 시트보다 먼저.
  assert.ok(html.indexOf("data-zb-sticker-palette") < html.indexOf("zb-print-sheets"));
});

test("그리드 타일과 인쇄 시트 반쪽에 같은 data-zb-page가 짝으로 붙는다 — 스티커 미러링의 전제", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  for (const key of FLIP_ORDER) {
    const tileCount = (html.match(new RegExp(`class="zb-tile-face" data-zb-page="${key}"`, "g")) ?? []).length;
    const halfCount = (html.match(new RegExp(`class="zb-half" data-zb-page="${key}"`, "g")) ?? []).length;
    assert.equal(tileCount, 1, `${key}의 그리드 타일이 정확히 1개여야 한다`);
    assert.equal(halfCount, 1, `${key}의 인쇄 시트 반쪽이 정확히 1개여야 한다`);
  }
});

test("그리드 미리보기가 논리적 읽는 순서(표지→About→기사1~4→스캔→뒤표지) 8장으로 나온다", () => {
  // 2026-08-11 — 3D 페이지 넘김(한 번에 한 쪽)을 정적 전체 그리드로 바꿨다(사용자 요청 —
  // "인쇄 전에 8쪽 전체를 봐야 한다"). 순서 자체(FLIP_ORDER)는 그대로 재사용한다.
  assert.deepEqual(FLIP_ORDER, [
    "cover-front", "about", "article-1", "article-2", "article-3", "article-4", "notes", "cover-back",
  ]);
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  const grid = html.slice(html.indexOf("data-zb-grid"), html.indexOf("zb-print-sheets"));
  // 각 논리 페이지를 식별하는 문자열이 이 순서대로 나오는지 인덱스로 확인한다.
  // 2026-08-12 여섯 번째 라운드 — 표지 eyebrow, "NOTES" 라벨이 텍스트째 빠져(사용자 요청)
  // 클래스명(zb-wrap-canvas--front)·새 캡션("Scan for Mobile")으로 마커를 바꿨다.
  const markers = ['zb-wrap-canvas--front', "About", "테스트 헤드라인 1", "테스트 헤드라인 2", "테스트 헤드라인 3", "테스트 헤드라인 4", "Scan for Mobile", 'aria-label="뒤표지'];
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
  // 뒤표지·앞표지 둘 다 자체 텍스트 라벨이 없다(2026-08-12 여섯 번째 라운드, 랩어라운드
  // 캔버스만 있다) — aria-label과 캔버스 모디파이어 클래스로 식별한다.
  assert.ok(s1f.indexOf('aria-label="뒤표지') < s1f.indexOf("zb-wrap-canvas--front"), "Sheet1 앞면은 [뒤표지 | 앞표지] 순이어야 한다");

  const s1b = sheetsHTML.slice(sheetsHTML.indexOf('sheet1-back'), sheetsHTML.indexOf('sheet2-front'));
  assert.ok(s1b.indexOf("About") < s1b.indexOf("Scan for Mobile"), "Sheet1 뒷면은 [About | 스캔] 순이어야 한다");

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

test("기사 헤더가 영문 도메인명 하나만, 우측 상단 라벨로 나온다 — 2026-08-12 여섯 번째 라운드(사용자 요청)", () => {
  const withMeta = { ...mockStory(1, "영화"), domainMeta: { key: "movie", name: "영화", nameEn: "Movie" } };
  const html = renderZinebook({ issue: ISSUE, stories: [withMeta, ...FOUR.slice(1)] });
  assert.match(html, /<p class="zb-article-domain">MOVIE<\/p>/);
  // 예전 "인사이트 NN/총 · 도메인" 번호 매기기는 완전히 없어졌다.
  assert.ok(!html.includes("인사이트 01"), "예전 번호 매기기 라벨이 남아 있다");
});

test("domainMeta가 없으면(테스트 목 데이터 등) 한글 도메인명으로 되돌아간다", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR }); // FOUR는 domainMeta 없음
  assert.match(html, /<p class="zb-article-domain">영화<\/p>/);
});

test("인쇄용 출처 한 줄이 클릭 유도 문구 없이 매체명 · 날짜 · URL로 나온다 — 2026-08-12 여섯 번째 라운드(사용자 요청, 인쇄물은 링크를 못 누른다)", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR });
  // mockStory의 sourceLabel은 "예시 출처 확인하기", anchorDate는 "2026-07-24".
  assert.match(html, /<p class="zb-source">예시 출처 · 2026\.07\.24 · https:\/\/example\.com<\/p>/);
  assert.ok(!html.includes("확인하기"), "클릭 유도 동사('확인하기')가 인쇄용 출처 줄에 남아 있다");
});

test("한터차트·예스24는 날짜·URL 없이 매체명만 낸다 — 2026-08-12 여덟 번째 라운드(사용자 요청, 저자 없는 차트 페이지라 기사처럼 인용하면 안 된다)", () => {
  const chartStory = { ...mockStory(1, "음악"), blocks: mockStory(1, "음악").blocks.map((b) =>
    b.type === "stat" ? { ...b, sourceLabel: "한터차트 확인하기", sourceUrl: "http://www.hanteochart.com/" } : b
  ) };
  const bestsellerStory = { ...mockStory(2, "도서"), blocks: mockStory(2, "도서").blocks.map((b) =>
    b.type === "stat" ? { ...b, sourceLabel: "예스24 베스트셀러 확인하기", sourceUrl: "https://www.yes24.com/24/category/bestseller" } : b
  ) };
  const html = renderZinebook({ issue: ISSUE, stories: [chartStory, bestsellerStory, ...FOUR.slice(2)] });
  assert.match(html, /<p class="zb-source">한터차트<\/p>/);
  assert.match(html, /<p class="zb-source">예스24<\/p>/);
  assert.ok(!html.includes("hanteochart.com"), "한터차트 URL이 인쇄용 출처 줄에 남아 있다");
  assert.ok(!html.includes("yes24.com"), "예스24 URL이 인쇄용 출처 줄에 남아 있다");
});

test("About 페이지는 순수 텍스트다 — QR·URL이 없다(2026-08-12 여섯 번째 라운드, 사용자 요청)", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR, qrSvg: "<svg data-test-qr></svg>" });
  const about = html.slice(html.indexOf('data-zb-grid'), html.indexOf("테스트 헤드라인 1"));
  assert.ok(!about.includes("data-test-qr"), "About 쪽에 QR이 아직 남아 있다");
  assert.ok(!about.includes("전체 아카이브"), "About 쪽에 예전 QR 라벨이 남아 있다");
  assert.ok(!about.includes("Answer Zine은 여기서 멈추지 않습니다"), "삭제 요청받은 문장이 남아 있다");
});

test("스캔 페이지(7쪽)가 QR + 'Scan for Mobile' 캡션만 낸다(전달됐을 때) — 사용자 요청", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR, qrSvg: "<svg data-test-qr></svg>" });
  assert.match(html, /<div class="zb-qr zb-qr--large"[^>]*><svg data-test-qr><\/svg><\/div>/);
  assert.match(html, /<p class="zb-scan-caption">Scan for Mobile<\/p>/);
});

test("스캔 페이지 — qrSvg가 없어도(npm install 안 한 로컬) 빌드는 그대로 성공한다", () => {
  const html = renderZinebook({ issue: ISSUE, stories: FOUR, qrSvg: null });
  assert.ok(!html.includes('class="zb-qr'), "qrSvg가 없는데 QR 자리가 그려졌다");
  assert.match(html, /Scan for Mobile/, "QR이 없어도 캡션은 남아야 한다");
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

test("DIY 진이 있는 문서는 문서 자체의 기본 @page도 랜드스케이프로 덮어쓴다 — 2026-08-12 네 번째 라운드(실사용자가 실제 인쇄해보니 여전히 세로로 나왔다고 재보고)", () => {
  // named page(page: zb-landscape)만으로는 부족했다 — CSS Paged Media의 `page` 프로퍼티는
  // 브라우저 지원이 고르지 않다. 이 문서에서 인쇄되는 건 항상 진 시트뿐이므로(css.mjs가
  // #main-content·.site-header를 인쇄에서 강제로 숨긴다) 문서의 기본 페이지 자체를
  // 랜드스케이프로 바꿔도 안전하다 — 훨씬 폭넓게 지원되는 평범한 @page{size} 오버라이드다.
  const withZine = page({
    title: "테스트", description: "d", url: "/", content: "<p>c</p>",
    zinebook: '<div class="zb-overlay"></div>',
  });
  assert.match(withZine, /<style>@media print \{ @page \{ size: A4 landscape; margin: 0; \} \}<\/style>/);

  // /print/(한 장 요약, 세로)처럼 showChrome:false면 zinebook 자체를 안 받으므로
  // 이 오버라이드가 붙지 않는다 — 공유 스타일시트의 세로 기본값을 그대로 쓴다.
  const printRoute = page({
    title: "테스트", description: "d", url: "/print/", content: "<p>c</p>",
    showChrome: false, zinebook: '<div class="zb-overlay"></div>',
  });
  assert.ok(!printRoute.includes("A4 landscape"), "/print/류 라우트에는 랜드스케이프 오버라이드가 붙으면 안 된다");
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

test("스티커 팔레트는 인쇄에서 숨는다 — 도구지 콘텐츠가 아니다", () => {
  const printBlock = css.slice(css.indexOf("@media print", css.indexOf(".zb-cta")));
  assert.match(printBlock, /\.zb-sticker-palette[^{]*\{[^}]*display:\s*none\s*!important/);
});

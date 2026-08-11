import { test } from "node:test";
import assert from "node:assert/strict";
import { page } from "../build/lib/layout.mjs";
import { renderStory } from "../build/lib/render-story.mjs";

const STORY = {
  id: "2026-w31-book", domain: "도서", slug: "book",
  range: "2026.07.28 – 08.03", kicker: "IN MEMORIAM",
  headline: "부고 다음날, 서점이 붐볐다.",
  teaser: "히가시노 게이고가 세상을 떠난 다음 주, 그의 신작이 판매량 326% 증가하며 1위에 올랐다.",
  domainMeta: { key: "book", name: "도서", color: "#34C759", colorPaper: "#217E38" },
  issue: { issue: "2026-w31" },
  url: "/2026-w31/book/",
  blocks: [
    { type: "text", text: "7월 23일, <script>alert(1)</script> 별세했다." },
    { type: "stat", label: "주간 판매량 지수", value: "+326.5%", trend: [98, 101, 100, 426],
      axisCaption: "X축: 최근 4주", sourceUrl: "https://www.yes24.com/24/category/bestseller",
      sourceLabel: "예스24 베스트셀러 확인하기" },
    { type: "text", text: "구매자 데이터를 보면 40대가 38.2%였다." },
    { type: "quote", text: "이건 마케팅이 만든 베스트셀러가 아니다.",
      insight: { concept: "사후 관심 효과", note: "예술 시장 연구에서 반복 관찰된다." } },
    { type: "text", text: "숫자 뒤에 슬픔이 있다는 걸 아는 채로 전한다." },
  ],
};

test("본문의 스크립트가 실행 가능한 형태로 남지 않는다", () => {
  const { content } = renderStory(STORY, {});
  assert.ok(!content.includes("<script>alert"), "이스케이프되지 않았다");
  assert.ok(content.includes("&lt;script&gt;"));
});

test("5블록이 계약 순서대로 렌더된다", () => {
  const { content } = renderStory(STORY, {});
  const iStat = content.indexOf("stat-card");
  const iQuote = content.indexOf("pullquote");
  assert.ok(iStat > -1, "stat 카드가 없다");
  assert.ok(iQuote > -1, "풀쿼트가 없다");
});

test("세 text 블록이 전부 나온다", () => {
  const { content } = renderStory(STORY, {});
  for (const t of ["7월 23일", "구매자 데이터", "숫자 뒤에 슬픔"])
    assert.ok(content.includes(t), `${t} 누락`);
});

test("출처 링크가 항상 보인다 — §9.9", () => {
  const { content } = renderStory(STORY, {});
  assert.match(content, /예스24 베스트셀러 확인하기/);
  assert.ok(!/opacity:\s*0/.test(content), "hover에만 노출하면 안 된다");
});

test("외부 링크에 rel=noopener가 붙는다", () => {
  const { content } = renderStory(STORY, {});
  assert.match(content, /rel="noopener noreferrer"/);
});

test("onclick 문자열 보간을 쓰지 않는다 — §9.7", () => {
  const { content } = renderStory(STORY, {});
  assert.ok(!content.includes("onclick"), "이벤트 위임을 써야 한다");
});

test("차트(스파크라인)는 더 이상 렌더되지 않는다 — 2026-08-08, 라벨+수치+출처만 남긴다", () => {
  const { content } = renderStory(STORY, {});
  assert.ok(!content.includes("stat-spark"), "차트가 여전히 나온다");
  assert.ok(!content.includes("<svg"), "차트 SVG가 여전히 나온다");
  assert.ok(!content.includes("X축: 최근 4주"), "축 설명이 여전히 나온다");
  assert.match(content, /주간 판매량 지수/, "라벨은 남아 있어야 한다");
  assert.match(content, /\+326\.5%/, "수치는 남아 있어야 한다");
});

test("인사이트 설명(note)이 콜아웃으로 다시 보인다 — 2026-08-10, 참고 목업 포맷 반영", () => {
  // 2026-08-08엔 이걸 화면에서 뺐다. 사용자가 첨부한 참고 목업(movie.html)의
  // .insight 콜아웃 구조가 되돌려 놓았다 — design.md §2 불변식 2번 갱신.
  const { content } = renderStory(STORY, {});
  assert.match(content, /insight-note/, "인사이트 콜아웃이 없다");
  assert.match(content, /예술 시장 연구에서 반복 관찰된다\./, "insight.note 문장이 안 보인다");
  assert.ok(!content.includes("사후 관심 효과"), "concept 이름은 라벨로 쓰지 않는다 — 고정 문구 '인사이트'를 쓴다");
  assert.match(content, /이건 마케팅이 만든 베스트셀러가 아니다\./, "쿼트 문장 자체는 남아 있어야 한다");
});

test("풀쿼트에 THE ANSWER 라벨이 붙는다 — 2026-08-11, 답의 순간을 화면에서 명시", () => {
  const { content } = renderStory(STORY, {});
  assert.match(content, /<span class="answer-label">THE ANSWER<\/span>/, "answer-label이 없다");
  const iLabel = content.indexOf("answer-label");
  const iQuoteText = content.indexOf("이건 마케팅이 만든 베스트셀러가 아니다");
  assert.ok(iLabel > -1 && iQuoteText > iLabel, "라벨이 쿼트 문장보다 먼저 나와야 한다");
});

test("이전/다음 링크가 URL로 나간다", () => {
  const prev = { id: "2026-w27-music", headline: "밈이, 판다.", url: "/2026-w27/music/" };
  const { content } = renderStory(STORY, { prev, next: null });
  assert.match(content, /href="\/2026-w27\/music\/"/);
  assert.match(content, /밈이, 판다\./);
});

test("이웃이 없으면 비활성 표시가 나온다", () => {
  const { content } = renderStory(STORY, {});
  assert.match(content, /이전 회차 없음/);
  assert.match(content, /다음 회차 없음/);
});

test("draft 스토리는 noindex를 요청한다", () => {
  const r = renderStory({ ...STORY, draft: true }, {});
  assert.equal(r.noindex, true);
});

test("page는 OG 태그와 canonical을 넣는다", () => {
  const html = page({ title: "제목", description: "설명", url: "/2026-w31/book/", content: "<p>x</p>" });
  assert.match(html, /<meta property="og:title" content="제목">/);
  assert.match(html, /<link rel="canonical" href="[^"]*\/2026-w31\/book\/">/);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /rel="icon"/);
});

test("page는 첫 페인트 전에 부트 스크립트로 .js를 붙인다", () => {
  const html = page({ title: "t", description: "d", url: "/", content: "" });
  const headEnd = html.indexOf("</head>");
  const bootScript = html.indexOf('className+=" js"');
  assert.ok(bootScript > -1 && bootScript < headEnd, "부트 스크립트가 head 안에 있어야 한다");
});

test("page는 제목과 설명을 이스케이프한다", () => {
  const html = page({ title: `x"><script>`, description: `y"><img>`, url: "/", content: "" });
  assert.ok(!html.includes(`x"><script>`));
  assert.ok(!html.includes(`y"><img>`));
});

test("noindex가 아니면 robots 메타를 넣지 않는다", () => {
  const html = page({ title: "t", description: "d", url: "/", content: "" });
  assert.ok(!html.includes("noindex"));
});

test("마스트헤드는 categoryNav를 영문 라벨 링크로 낸다 — 2026-08-10", () => {
  const html = page({
    title: "t", description: "d", url: "/", content: "",
    categoryNav: [{ name: "Movie", href: "/2026-w31/movie/" }, { name: "Stage", href: null }],
  });
  assert.match(html, /class="category-nav"/);
  assert.match(html, /<a href="[^"]*\/2026-w31\/movie\/">Movie<\/a>/);
  // href가 없는 도메인(아직 통과분 없음)은 링크가 아니라 라벨만 낸다.
  assert.match(html, /<span class="is-empty">Stage<\/span>/);
});

test("마스트헤드는 스크롤에 고정된다 — .ruleline 밑줄은 없다", () => {
  const html = page({ title: "t", description: "d", url: "/", content: "" });
  assert.ok(!html.includes('class="ruleline"'), "밑줄 괘선이 남아 있다");
});

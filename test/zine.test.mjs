import { test } from "node:test";
import assert from "node:assert/strict";
import { renderZinePage, renderZinePreview, zineBodyFor } from "../build/lib/render-zine.mjs";
import { renderIndex } from "../build/lib/render-index.mjs";

const ISSUE = { issue: "2026-w31", range: "2026.07.28 – 08.03", status: "ready" };

const mk = (id, key, name, hl, teaser) => ({
  id, slug: key, domain: name, headline: hl, teaser, kicker: "KICKER",
  range: "2026.07.28 – 08.03", url: `/2026-w31/${key}/`,
  domainMeta: { key, name, color: "#34C759", colorPaper: "#217E38" },
  issue: ISSUE,
  blocks: [
    { type: "text", text: "첫 문단이다." },
    { type: "stat", label: "주간 판매량 지수", value: "+326.5%", trend: [98, 426],
      axisCaption: "c", sourceUrl: "https://www.yes24.com/x", sourceLabel: "확인" },
    { type: "text", text: "둘째 문단이다." },
    { type: "quote", text: "쿼트.", insight: { concept: "개념", note: "설명." } },
    { type: "text", text: "마무리 문단이다." },
  ],
});

const stories = [
  mk("2026-w31-book", "book", "도서", "부고 다음날, 서점이 붐볐다.", "티저 하나."),
  mk("2026-w31-movie", "movie", "영화", "매진, 또 매진.", "티저 둘."),
  mk("2026-w31-music", "music", "음악", "밈이, 판다.", "티저 셋."),
  mk("2026-w31-youtube", "youtube", "유튜브", "15초 보고, 품절됐다.", "티저 넷."),
];
const REG = { domains: [
  { key: "movie", name: "영화" }, { key: "music", name: "음악" },
  { key: "youtube", name: "유튜브" }, { key: "book", name: "도서" },
]};

// 2026-08-10 전면 개편 — "리드 1 + 미니 3" 위계를 없앴다. 그 주 통과분 전원이
// 사진·콜라주 없이 동등한 행(.zine-story)으로 나온다. 참고 목업(print.html)의
// .sheet-story/.statcol 구조를 따른다.

test("그 주 통과분 전원이 위계 없이 지면에 나온다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  assert.equal(z.stories.length, 4);
  assert.deepEqual(z.warnings, []);
  for (const s of stories) assert.ok(z.content.includes(s.headline), `${s.headline} 누락`);
});

test("진의 헤드라인·티저가 웹과 문자열이 같다 — §8 QA #17", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  for (const s of stories) {
    assert.ok(z.content.includes(s.headline), `헤드라인 불일치: ${s.headline}`);
    assert.ok(z.content.includes(s.teaser), `티저 불일치: ${s.teaser}`);
  }
});

test("스탯 값·라벨이 스토리마다 하나씩 나온다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  const rows = z.content.match(/class="zine-story"/g) ?? [];
  const values = z.content.match(/class="zine-stat-value">\+326\.5%/g) ?? [];
  const labels = z.content.match(/주간 판매량 지수/g) ?? [];
  assert.equal(rows.length, 4, "스토리 행이 4개가 아니다");
  assert.equal(values.length, 4, "stat.value가 스토리 수만큼 없다");
  assert.equal(labels.length, 4, "stat.label이 스토리 수만큼 없다");
});

test("인사이트 설명(note)이 각 행의 콜아웃으로 나온다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  const count = (z.content.match(/zine-insight-note/g) ?? []).length;
  assert.equal(count, 4, "스토리마다 인사이트 콜아웃이 하나씩 있어야 한다");
  assert.match(z.content, /설명\./, "insight.note 문장이 안 보인다");
});

test("사진·콜라주·테이프·스티커·QR은 더 이상 나오지 않는다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  for (const gone of ["zine-photo", "zine-tape", "zine-sticker", "zine-qr", "<img class=\"zine-qr\""])
    assert.ok(!z.content.includes(gone), `${gone}이 여전히 나온다`);
});

test("QR 대신 사람이 읽는 URL이 지면 하단에 나온다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  assert.match(z.content, /answerzine\.kr/);
  assert.match(z.content, /class="zine-footer"/);
});

test("미리보기에 인쇄 버튼과 목록 링크가 둘 다 있다", () => {
  const { content } = renderZinePreview(ISSUE, stories, REG);
  assert.match(content, /data-print/, "인쇄 버튼이 없다");
  assert.match(content, /← 목록으로/, "목록 링크가 없다");
});

test("스토리가 0편이면 경고한다", () => {
  const z = renderZinePage({ ...ISSUE, stories: [] }, [], REG);
  assert.equal(z.stories.length, 0);
  assert.ok(z.warnings.some((w) => /스토리가 없다/.test(w)));
});

test("zineBodyFor는 zineBody가 있으면 그대로 쓴다", () => {
  assert.deepEqual(zineBodyFor({ ...stories[0], zineBody: ["가.", "나.", "다."] }), ["가.", "나.", "다."]);
});

test("zineBodyFor는 없으면 text 블록 셋을 쓴다", () => {
  assert.deepEqual(zineBodyFor(stories[0]), ["첫 문단이다.", "둘째 문단이다.", "마무리 문단이다."]);
});

test("회수된 스토리는 지면에 나올 수 없다 — 입력에 없으면 끝이다", () => {
  // 프로토타입에서는 지면이 하드코딩이라 issues/*.json에서 뺀 영화 편이 남아 있었다
  const without = stories.filter((s) => s.slug !== "movie");
  const z = renderZinePage({ ...ISSUE, stories: without }, without, REG);
  assert.ok(!z.content.includes("매진, 또 매진."), "제외한 스토리가 지면에 남았다");
});

test("진 본문도 이스케이프된다", () => {
  const evil = mk("2026-w31-e", "book", "도서", `<script>alert(1)</script>`, "티저.");
  const z = renderZinePage({ ...ISSUE, stories: [evil] }, [evil], REG);
  assert.ok(!z.content.includes("<script>alert"));
});

/* --- 인덱스(홈) — 카테고리 카드 그리드, 2026-08-10 전면 개편 --- */

test("도메인당 카드 하나, 그 도메인의 최신 스토리로 이어진다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  const cards = content.match(/class="category-card(?: is-dark)?"/g) ?? [];
  assert.equal(cards.length, 4, "REG의 도메인 4개만큼 카드가 나와야 한다");
  for (const s of stories) {
    assert.match(content, new RegExp(`href="${s.url}"[\\s\\S]*?${s.headline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("onclick을 쓰지 않는다 — 카드는 순수 링크다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.ok(!content.includes("onclick"));
  assert.match(content, /<a class="category-card(?: is-dark)?"/);
});

test("draft 회차의 최신 스토리 카드엔 '작업 중' 배지가 붙는다", () => {
  // noindex는 스토리 페이지 자체의 일이다 (render.test.mjs "draft 스토리는 noindex를 요청한다").
  const draft = { ...ISSUE, status: "draft" };
  const ds = stories.map((s) => ({ ...s, issue: draft, draft: true }));
  const idx = renderIndex([draft], ds, REG);
  assert.match(idx.content, /작업 중/);
});

test("인덱스가 최신 회차의 인쇄 링크를 준다", () => {
  // "이번 호 전체 보기" 버튼은 2026-08-08에 없앴다 — 회차 목록 페이지 자체가 없어졌다.
  // 본문 하단의 "인쇄용 A4" 링크는 2026-08-10에 없앴다 — 마스트헤드의 "한 장 요약
  // 보기"(header-cta, printUrl로 렌더된다)가 유일한 인쇄 진입점이다.
  const { content, printUrl } = renderIndex([ISSUE], stories, REG);
  assert.equal(printUrl, "/2026-w31/print/");
  assert.ok(!content.includes("이번 호 전체 보기"));
  assert.ok(!content.includes("인쇄용 A4"));
});

test("뉴스·여행은 카드 그리드에서 빠진다 — 데이터가 아직 불안정한 도메인", () => {
  const withHidden = { domains: [...REG.domains, { key: "news", name: "뉴스" }, { key: "travel", name: "여행" }] };
  const { content } = renderIndex([ISSUE], stories, withHidden);
  assert.equal((content.match(/class="category-card(?: is-dark)?"/g) ?? []).length, 4, "뉴스·여행 카드까지 나오면 안 된다");
  assert.ok(!content.includes(">뉴스<"));
  assert.ok(!content.includes(">여행<"));
});

test("스토리가 없는 도메인은 색 없는 빈 카드로 뜬다", () => {
  const reg = { domains: [...REG.domains, { key: "stage", name: "공연" }] };
  const { content } = renderIndex([ISSUE], stories, reg);
  assert.match(content, /class="category-card is-empty"/);
  assert.match(content, /아직 신호가 없다/);
  // 빈 카드는 링크가 아니다 — 갈 곳(최신 스토리)이 없다.
  assert.ok(!content.includes('href="/2026-w31/stage/"'));
});

test("카드는 편집 순서가 아니라 실제 최신(시간순) 스토리로 이어진다", () => {
  // book이 두 회차에 걸쳐 있다 — 최근 발행(issue2)이 카드에 나와야 한다,
  // allStories()의 배열 순서(issue1이 먼저 온다)를 그대로 믿으면 안 된다.
  const issue1 = { issue: "2026-w30", range: "2026.07.21 – 07.27", status: "ready" };
  const issue2 = { issue: "2026-w31", range: "2026.07.28 – 08.03", status: "ready" };
  const older = mk("2026-w30-book", "book", "도서", "지난주 도서.", "지난주 티저.");
  older.range = issue1.range; older.issue = issue1; older.url = "/2026-w30/book/";
  const newer = { ...stories.find((s) => s.slug === "book") };
  const mixed = [older, newer, ...stories.filter((s) => s.slug !== "book")];
  const { content } = renderIndex([issue2, issue1], mixed, REG);
  assert.ok(content.includes('href="/2026-w31/book/"'), "최신 book 스토리로 이어져야 한다");
  assert.ok(!content.includes("지난주 도서."), "지난주 스토리가 카드에 뜨면 안 된다");
});

test("통합 인사이트가 헤드라인(h1)+부연설명(insightNote)으로 나온다 — 2026-08-10 두 번째 라운드", () => {
  const withNote = { ...ISSUE, insight: "헤드라인.", insightNote: "부연설명 문단." };
  const { content } = renderIndex([withNote], stories, REG);
  assert.match(content, /<h1 class="issue-insight"[^>]*>헤드라인\.<\/h1>/);
  assert.match(content, /class="issue-insight-note"[^>]*>부연설명 문단\./);
});

test("하단 페이저 — 전체 아카이브 링크는 항상 있고, 다음 주는 홈에서 늘 없다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.match(content, /class="pager"/);
  assert.match(content, /<a class="pager-now" href="[^"]*\/archive\/">전체 아카이브 보기<\/a>/);
  assert.match(content, /class="pager-link pager-next is-off"/, "홈은 항상 최신이라 '다음 주'가 없어야 한다");
});

test("하단 페이저 — 이전 회차가 있으면 그 인쇄 진으로 이어진다", () => {
  const prev = { issue: "2026-w30", range: "2026.07.21 – 07.27", status: "ready", insight: "지난주 헤드라인." };
  const { content } = renderIndex([ISSUE, prev], stories, REG);
  assert.match(content, /<a class="pager-link pager-prev" href="[^"]*\/2026-w30\/print\/">/);
  assert.match(content, /지난주 헤드라인\./);
  assert.ok(!content.includes("pager-prev is-off"), "이전 회차가 있는데 비활성으로 나오면 안 된다");
});

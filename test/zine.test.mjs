import { test } from "node:test";
import assert from "node:assert/strict";
import { renderZinePage, renderZinePreview, zineBodyFor } from "../build/lib/render-zine.mjs";
import { renderIndex } from "../build/lib/render-index.mjs";
import { HIDDEN_DOMAIN_NAMES } from "../build/lib/data.mjs";

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

test("카드 제목 밑에 teaser 한 줄이 나온다 — 2026-08-11 여섯 번째 라운드", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  for (const s of stories) {
    assert.match(content, new RegExp(`class="category-card-teaser">${s.teaser.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("headlineLines가 있으면 카드 헤드라인이 <br>로 여러 줄로 나온다 — 2026-08-12 사용자 요청", () => {
  const withLines = { ...stories[0], headlineLines: ["부고 다음날,", "서점이 붐볐다."] };
  const { content } = renderIndex([ISSUE], [withLines, ...stories.slice(1)], REG);
  assert.match(content, /<h2 class="category-card-headline">부고 다음날,<br>서점이 붐볐다\.<\/h2>/);
});

test("headlineLines가 없으면 카드 헤드라인이 그대로 한 줄이다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.match(content, /<h2 class="category-card-headline">부고 다음날, 서점이 붐볐다\.<\/h2>/);
});

test("insightLines가 있으면 홈 큰 헤드라인도 <br>로 여러 줄로 나온다", () => {
  const withInsight = { ...ISSUE, insight: "헤드라인, 이다.", insightLines: ["헤드라인,", "이다."] };
  const { content } = renderIndex([withInsight], stories, REG);
  assert.match(content, /<h1 class="issue-insight" data-reveal>헤드라인,<br>이다\.<\/h1>/);
});

test("헤드라인·부연설명이 같은 가로 컨테이너(insight-lead) 안에 있다", () => {
  const withInsight = { ...ISSUE, insight: "헤드라인.", insightNote: "부연설명." };
  const { content } = renderIndex([withInsight], stories, REG);
  const m = content.match(/<div class="insight-lead">([\s\S]*?)<\/div>/);
  assert.ok(m, "insight-lead 래퍼가 없다");
  assert.match(m[1], /class="issue-insight"/);
  assert.match(m[1], /class="issue-insight-note"/);
});

test("onclick을 쓰지 않는다 — 카드는 순수 링크다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.ok(!content.includes("onclick"));
  assert.match(content, /<a class="category-card(?: is-dark)?"/);
});

/* --- 카드 호버 사진 리빌 — 2026-08-13 사용자 요청(첨부 이미지 4장 + "커버가
   벗겨지며 흑백 사진이 드러나게"). story.image가 있을 때만 켜진다 — 없는 카드는
   예전 그대로(밑줄 호버)다. 실제 사진 파일은 이 세션에서 구할 수 없어서(네트워크
   차단, 첨부 이미지는 파일로 저장되지 않는다) 데이터에는 아직 아무 story.image도
   없다 — 이 테스트는 메커니즘 자체(마크업 조건부 렌더)만 지킨다. */
test("story.image가 있으면 has-photo 카드가 되고 사진 레이어가 나온다", () => {
  const withImage = { ...stories[0], image: "/assets/img/covers/book.jpg" };
  const { content } = renderIndex([ISSUE], [withImage, ...stories.slice(1)], REG);
  assert.match(content, /<a class="category-card is-dark has-photo"/);
  assert.match(content, /<img class="category-card-photo" src="\/assets\/img\/covers\/book\.jpg" alt="" aria-hidden="true" loading="lazy">/);
  // 헤드라인·티저·라벨은 사진과 무관하게 여전히 커버 안에 그대로 있다.
  assert.match(content, /class="category-card-cover"/);
  assert.match(content, /부고 다음날, 서점이 붐볐다\./);
});

test("story.image가 없으면 has-photo·사진 레이어 둘 다 없다 — 기존 카드 그대로", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.ok(!content.includes("has-photo"), "이미지 없는 카드에 has-photo가 붙었다");
  assert.ok(!content.includes("category-card-photo"), "이미지 없는 카드에 사진 레이어가 나왔다");
});

test("우측 세로 도메인 라벨 — 한 글자씩 <span>으로 쌓이고, 실제 라벨은 sr-only로 낸다 — 2026-08-12 사용자 요청(참고 스크린샷)", () => {
  const withCardColor = { domains: REG.domains.map((d) => ({ ...d, cardColor: "#F890CD", nameCard: "MOVIES" })) };
  const { content } = renderIndex([ISSUE], stories, withCardColor);
  // 낱글자가 각각 <span>으로 나온다 — 연속 문자열 "MOVIES"는 aria-hidden 태그 안에
  // 없어야 한다(스크린 리더가 한 글자씩 읽지 않도록).
  assert.match(content, /<span class="category-card-tag" aria-hidden="true" style="color:#[0-9a-f]{6}">(?:<span>[A-Z]<\/span>){6}<\/span>/);
  assert.match(content, /<span class="sr-only">MOVIES<\/span>/);
});

test("cardColor가 없는 도메인(.is-dark 폴백)도 세로 라벨을 쓴다 — 색만 흰색으로 고정된다", () => {
  const { content } = renderIndex([ISSUE], stories, REG); // REG는 cardColor가 없다
  assert.match(content, /<span class="category-card-tag" aria-hidden="true" style="color:#fff">/);
});

test("스토리가 없는 빈 카드는 세로 라벨이 아니라 예전 작은 가로 라벨을 쓴다 — 세로 라벨 색은 cardColor에서 계산되는데 빈 카드는 배경색이 없다", () => {
  const emptyReg = { domains: [...REG.domains, { key: "stage", name: "공연" }] };
  const { content } = renderIndex([ISSUE], stories, emptyReg);
  assert.match(content, /<span class="category-card-tag-empty">공연<\/span>/);
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

// 뉴스·여행은 2026-08-11 사용자 요청으로 registry.json에서 도메인 자체가 삭제됐다(더는
// "데이터 불안정" 편집 결정으로 숨겨둔 상태가 아니다) — 이 Set은 현재 비어 있다
// (data.mjs 참고). 그 메커니즘 자체(HIDDEN_DOMAIN_NAMES에 있는 도메인은 카드 그리드에서
// 빠진다)는 여전히 살아 있으므로, 합성 이름으로 회귀 테스트한다.
test("HIDDEN_DOMAIN_NAMES에 있는 도메인은 카드 그리드에서 빠진다", () => {
  HIDDEN_DOMAIN_NAMES.add("가상도메인");
  try {
    const withHidden = { domains: [...REG.domains, { key: "fake", name: "가상도메인" }] };
    const { content } = renderIndex([ISSUE], stories, withHidden);
    assert.equal((content.match(/class="category-card(?: is-dark)?"/g) ?? []).length, 4, "숨김 도메인 카드까지 나오면 안 된다");
    assert.ok(!content.includes(">가상도메인<"));
  } finally {
    HIDDEN_DOMAIN_NAMES.delete("가상도메인");
  }
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
  // 인용부호로 시작하지 않는 문단은 예전처럼 <p> 하나로 통짜 렌더된다 — 리드/바디로
  // 안 쪼개진다(아래 새 테스트가 쪼개지는 경우를 확인한다).
  assert.match(content, /<p class="issue-insight-note" data-reveal>부연설명 문단\.<\/p>/);
});

test("insightNote가 인용부호로 시작하면 리드 문장(굵게)과 분석 문단(옅게)으로 쪼개 낸다 — 2026-08-12 스물한 번째 라운드(사용자 요청)", () => {
  const withQuote = {
    ...ISSUE, insight: "UNEXPECTED",
    insightNote: '"짧은 명제가 있다." 그 뒤로 분석 문단이 이어진다. 문장이 더 있다.',
  };
  const { content } = renderIndex([withQuote], stories, REG);
  assert.match(content, /<div class="issue-insight-note" data-reveal>/);
  // h 태그드 템플릿이 큰따옴표를 &quot;로 이스케이프한다(escapeHTML() 통과 — §9.7).
  assert.match(content, /<p class="insight-note-lead">&quot;짧은 명제가 있다\.&quot;<\/p>/);
  assert.match(content, /<p class="insight-note-body">그 뒤로 분석 문단이 이어진다\. 문장이 더 있다\.<\/p>/);
});

test("insightNote가 인용부호로 시작하지만 뒤에 본문이 없으면(인용문뿐) 쪼개지 않는다", () => {
  const quoteOnly = { ...ISSUE, insight: "UNEXPECTED", insightNote: '"이것뿐이다."' };
  const { content } = renderIndex([quoteOnly], stories, REG);
  assert.match(content, /<p class="issue-insight-note" data-reveal>&quot;이것뿐이다\.&quot;<\/p>/);
  assert.ok(!content.includes("insight-note-lead"), "본문 없는 인용문인데도 쪼개졌다");
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

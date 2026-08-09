import { test } from "node:test";
import assert from "node:assert/strict";
import { renderZinePage, zineBodyFor } from "../build/lib/render-zine.mjs";
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

test("리드는 첫 스토리, 미니는 나머지 3편이다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  assert.equal(z.lead.id, "2026-w31-book");
  assert.equal(z.minis.length, 3);
  assert.deepEqual(z.warnings, []);
});

test("진의 헤드라인·티저가 웹과 문자열이 같다 — §8 QA #17", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  for (const s of stories) assert.ok(z.content.includes(s.headline), `헤드라인 불일치: ${s.headline}`);
  assert.ok(z.content.includes(stories[0].teaser));
});

test("스티커 수치는 리드의 stat.value를 그대로 쓴다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  const m = z.content.match(/<div class="zine-sticker">([\s\S]*?)<\/div>/);
  assert.ok(m, "스티커가 없다");
  assert.match(m[1], /\+326\.5%/, "리드 stat.value가 스티커에 없다");
  assert.match(m[1], /주간 판매량 지수/, "리드 stat.label이 스티커에 없다");
});

test("스티커는 사진 콜라주 안에 있다 — 사진과 본문 사이에 뜨지 않는다", () => {
  const z = renderZinePage(ISSUE, stories, REG);
  const collage = z.content.match(/<div class="zine-photo-collage">([\s\S]*?)<\/div>\s*<\/div>/);
  assert.ok(collage, "콜라주 블록이 없다");
  assert.match(collage[1], /zine-sticker/, "스티커가 콜라주 밖에 있다");
});

test("QR 캡션은 홈 아카이브 URL을 가리킨다", () => {
  // 2026-08-08부터 회차 목록 페이지가 없어져 QR·캡션 모두 홈을 가리킨다.
  const z = renderZinePage(ISSUE, stories, REG);
  assert.match(z.content, /answerzine\.kr</);
  assert.ok(!z.content.includes("answerzine.kr/2026-w31"));
});

test("미니가 3편 미만이면 경고한다", () => {
  const two = stories.slice(0, 2);
  const z = renderZinePage({ ...ISSUE, stories: two }, two, REG);
  assert.equal(z.minis.length, 1);
  assert.ok(z.warnings.some((w) => /미니/.test(w)), "레이아웃 경고가 있어야 한다");
});

test("도메인이 늘어도 지면은 상위 4편만 싣는다", () => {
  // 활성 도메인 8개 체제에서, 통과 편수가 슬롯을 넘는 것이 정상 상황이 됐다.
  const five = [...stories, mk("2026-w31-x", "stage", "공연", "다섯째.", "티저 다섯.")];
  const z = renderZinePage({ ...ISSUE, stories: five }, five, REG);
  assert.equal(z.minis.length, 4, "미니 후보는 4편이다");
  assert.ok(!z.content.includes("다섯째."), "슬롯을 넘은 스토리는 지면에 없어야 한다");
  assert.ok(z.warnings.some((w) => /상위 4편만/.test(w)), "웹에만 실린다는 사실을 알려야 한다");
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

/* --- 인덱스·회차 --- */

test("인덱스는 모든 스토리를 위계 없는 카드 리스트로 낸다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  const iFirst = content.indexOf("부고 다음날, 서점이 붐볐다.");
  const iOther = content.indexOf("매진, 또 매진.");
  assert.ok(iFirst > -1 && iOther > -1 && iFirst < iOther);
  assert.match(content, /class="row"/);
});

test("인덱스에 도메인 필터가 전부 나온다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  for (const d of ["전체", "영화", "음악", "유튜브", "도서"]) assert.ok(content.includes(d), `${d} 누락`);
});

test("필터는 onclick이 아니라 data 속성을 쓴다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.ok(!content.includes("onclick"));
  assert.match(content, /data-domain=/);
});

test("draft 회차는 인덱스에 표시가 붙는다", () => {
  // noindex는 스토리 페이지 자체의 일이다 (render.test.mjs "draft 스토리는 noindex를 요청한다").
  // 회차 목록 페이지가 없어졌으므로(2026-08-08) 여기서는 인덱스의 배지만 본다.
  const draft = { ...ISSUE, status: "draft" };
  const ds = stories.map((s) => ({ ...s, issue: draft, draft: true }));
  const idx = renderIndex([draft], ds, REG);
  assert.match(idx.content, /작업 중/);
});

test("인덱스가 최신 회차의 인쇄 링크를 준다", () => {
  // "이번 호 전체 보기" 버튼은 2026-08-08에 없앴다 — 회차 목록 페이지 자체가 없어졌다.
  // "인쇄용 A4"만 남는다.
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.match(content, /href="\/2026-w31\/print\/"/);
  assert.ok(!content.includes("이번 호 전체 보기"));
});

test("빈 상태 요소가 인덱스에 있다", () => {
  const { content } = renderIndex([ISSUE], stories, REG);
  assert.match(content, /data-empty/);
});

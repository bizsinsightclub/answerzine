/**
 * 스탯 카드 — 추세선과 비교 기준.
 *
 * 추세선은 "다음 주에 같은 방법으로 다시 그릴 수 있는가"를 통과한 출처에서만 나온다.
 * 그럴 수 없는 회차는 데이터에 `trend` 자체가 없고, 그 자리에 `basis` 한 문장이 들어간다.
 * 판정은 tools/qa.mjs가 하고, 여기서는 **없는 선을 렌더러가 지어내지 않는지**만 본다 (L-011).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStory } from "../build/lib/render-story.mjs";

const base = {
  id: "2026-w31-x", domain: "도서", slug: "book",
  range: "2026.07.28 – 08.03", headline: "제목.", teaser: "티저.",
  domainMeta: { key: "book", name: "도서", color: "#34C759" },
  issue: { issue: "2026-w31" }, url: "/2026-w31/book/",
};

const withStat = (stat) => ({
  ...base,
  blocks: [
    { type: "text", text: "가." },
    { type: "stat", ...stat },
    { type: "text", text: "나." },
    { type: "quote", text: "다.", insight: { concept: "개념", note: "설명" } },
    { type: "text", text: "라." },
  ],
});

const ARCHIVED = {
  label: "6주 차 스크린당 관객수", value: "+9.9%",
  trend: [408, 287, 165, 182], axisCaption: "X축: 3~6주 차 · Y축: 스크린당 관객수",
  trendSource: "KOBIS 일별 박스오피스에서 주별 합산.",
  sourceUrl: "https://www.kobis.or.kr/x", sourceLabel: "KOBIS 확인하기",
};

const SNAPSHOT = {
  label: "주간 판매지수 (전주 대비)", value: "+326.5%",
  basis: "예스24 종합 주간 1위. 전주 판매지수를 100으로 둔 값.",
  sourceUrl: "https://www.yes24.com/x", sourceLabel: "예스24 확인하기",
};

test("trend가 있으면 스파크라인과 축 캡션이 나온다", () => {
  const { content } = renderStory(withStat(ARCHIVED), {});
  assert.match(content, /<svg class="sparkline"/);
  assert.match(content, /stat-axis/);
  assert.ok(!content.includes("stat-basis"), "추세선이 있는데 비교 기준까지 나왔다");
});

test("trend가 없으면 선을 지어내지 않고 비교 기준을 글자로 낸다", () => {
  const { content } = renderStory(withStat(SNAPSHOT), {});
  assert.ok(!content.includes("<svg class=\"sparkline\""), "없는 데이터로 선을 그렸다");
  assert.match(content, /stat-basis/);
  assert.match(content, /비교 기준/);
  assert.match(content, /전주 판매지수를 100으로 둔 값/);
});

test("trend도 basis도 없으면 그 칸은 비워둔다 — 대충 채우지 않는다", () => {
  const { content } = renderStory(withStat({
    label: "라벨", value: "1위", sourceUrl: "https://www.yes24.com/x",
  }), {});
  assert.ok(!content.includes("sparkline"));
  assert.ok(!content.includes("stat-basis"));
  assert.match(content, /stat-value/);
  assert.match(content, /is-single/);
});

test("점이 하나뿐인 trend로는 선을 그리지 않는다", () => {
  // 스파크라인은 2점 미만에서 예외를 던진다. 렌더러가 먼저 걸러야 빌드가 죽지 않는다.
  const { content } = renderStory(withStat({ ...SNAPSHOT, trend: [5] }), {});
  assert.ok(!content.includes("sparkline"));
  assert.match(content, /stat-basis/);
});

test("출처 링크는 추세선 유무와 무관하게 항상 나온다", () => {
  for (const stat of [ARCHIVED, SNAPSHOT]) {
    const { content } = renderStory(withStat(stat), {});
    assert.match(content, /class="stat-source"/, `${stat.label}에 출처 링크가 없다`);
  }
});

test("헤드라인에서 감춘 이름이 본문에 있는지는 qa가 본다 — 렌더러는 꺾쇠를 깨지 않는다", () => {
  // 〈 〉(U+3008/3009)는 HTML 태그로 먹히지 않는다. escapeHTML을 통과해도 그대로 남아야
  // 독자가 작품명을 읽을 수 있다. <>로 쓰면 통째로 사라진다 — CLAUDE.md §6 표기 규칙.
  const story = withStat(SNAPSHOT);
  story.blocks[0].text = "〈모태솔로 애프터서비스〉 6화가 올라왔다.";
  const { content } = renderStory(story, {});
  assert.match(content, /〈모태솔로 애프터서비스〉/);
});

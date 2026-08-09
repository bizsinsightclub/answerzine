/**
 * 스탯 카드 — 라벨 + 수치 + 출처.
 *
 * 2026-08-08부터 차트(스파크라인)·축설명·비교기준 문장은 trend/basis 유무와 무관하게
 * 화면에 나오지 않는다 — 사용자 요청으로 렌더링만 뺐다. 데이터 계약(trend는 "다음 주에
 * 같은 방법으로 다시 그릴 수 있는가"를 통과한 출처에서만, 아니면 basis)은 `tools/qa.mjs`가
 * 그대로 검증한다 — 여기서는 **렌더러가 어느 쪽이든 차트/축설명/비교기준을 지어내 보여주지
 * 않는지**만 본다.
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

test("trend가 있어도 차트·축 캡션은 나오지 않는다 — 라벨과 수치만 나온다", () => {
  const { content } = renderStory(withStat(ARCHIVED), {});
  assert.ok(!content.includes("sparkline"), "차트가 나왔다");
  assert.ok(!content.includes("stat-axis"), "축 설명이 나왔다");
  assert.ok(!content.includes("stat-basis"), "비교 기준이 나왔다");
  assert.match(content, /6주 차 스크린당 관객수/);
  assert.match(content, /\+9\.9%/);
});

test("trend가 없어도(basis만 있어도) 비교 기준 문장은 나오지 않는다", () => {
  const { content } = renderStory(withStat(SNAPSHOT), {});
  assert.ok(!content.includes("sparkline"), "없는 데이터로 선을 그렸다");
  assert.ok(!content.includes("stat-basis"), "비교 기준이 나왔다");
  assert.ok(!content.includes("전주 판매지수를 100으로 둔 값"), "basis 문장이 나왔다");
  assert.match(content, /주간 판매지수/);
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

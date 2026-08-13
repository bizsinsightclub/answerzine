/**
 * 스탯 카드 — 라벨 + 수치 + (조건부) 차트/비교 기준 + 출처.
 *
 * 2026-08-08~2026-08-12(스물다섯 번째 라운드)까지는 차트(스파크라인)·축설명·비교기준
 * 문장이 trend/basis 유무와 무관하게 화면에 나오지 않았다 — 사용자 요청으로 렌더링만
 * 뺐었다. 2026-08-12 스물여섯 번째 라운드("ANZINE — Official Data Sources & Comparative
 * Chart Integration" 문서 §3·§4)에서 되살렸다 — design.md "스파크라인" 절 참고.
 * 지금 규칙: `trend`(길이≥2)가 있으면 차트+axisCaption, 없고 `basis`만 있으면 "비교
 * 기준" 문장, 둘 다 없으면 이전처럼 라벨+수치만.
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

test("trend가 있으면 차트와 축 캡션이 나온다", () => {
  const { content } = renderStory(withStat(ARCHIVED), {});
  assert.match(content, /sparkline/, "차트가 안 나왔다");
  assert.match(content, /stat-axis-caption/, "축 설명이 안 나왔다");
  assert.match(content, /X축: 3~6주 차/);
  assert.ok(!content.includes("stat-basis"), "trend가 있는데 비교 기준 문장도 나왔다");
  assert.match(content, /6주 차 스크린당 관객수/);
  assert.match(content, /\+9\.9%/);
});

test("trend가 없고 basis만 있으면 비교 기준 문장이 나온다 — 차트는 없다", () => {
  const { content } = renderStory(withStat(SNAPSHOT), {});
  assert.ok(!content.includes("sparkline"), "없는 데이터로 선을 그렸다");
  assert.match(content, /stat-basis/, "비교 기준이 안 나왔다");
  assert.match(content, /전주 판매지수를 100으로 둔 값/);
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

test("trend 배열이 1개뿐이면 차트를 그리지 않는다 — sparklineSVG가 던지기 전에 막는다", () => {
  const { content } = renderStory(withStat({
    label: "라벨", value: "1위", trend: [100], sourceUrl: "https://www.yes24.com/x",
  }), {});
  assert.ok(!content.includes("sparkline"));
});

/**
 * 2026-08-13 — "ANZINE — Editorial Readability Pass". stat.value 끝의 괄호 부연설명을
 * 렌더 시점에만 갈라 굵기를 다르게 준다(design.md "스탯 패널" 참고). 데이터
 * (issues/*.json의 stat.value 원문)는 그대로 두므로, 괄호를 포함한 전체 텍스트가
 * 여전히 렌더된 HTML 안에 남아 있어야 한다 — 사라지는 건 괄호 기호 자체뿐이다.
 */
test("stat.value 끝의 괄호를 주 숫자와 다른 span으로 분리한다", () => {
  const { content } = renderStory(withStat({
    label: "라벨", value: "213만 (6일 연속 박스오피스 1위)", sourceUrl: "https://www.yes24.com/x",
  }), {});
  assert.match(content, /<div class="stat-value">213만<span class="stat-value-context">6일 연속 박스오피스 1위<\/span><\/div>/);
  assert.ok(!content.includes("(6일 연속"), "괄호 기호는 화면에 안 남아야 한다");
});

test("괄호가 없는 stat.value는 그대로 한 덩어리로 나온다", () => {
  const { content } = renderStory(withStat({
    label: "라벨", value: "+9.9%", sourceUrl: "https://www.yes24.com/x",
  }), {});
  assert.match(content, /<div class="stat-value">\+9\.9%<\/div>/);
  assert.ok(!content.includes("stat-value-context"));
});

test("괄호가 중간에 있거나 여러 개면 분리하지 않는다 — 끝에 오는 패턴만 잡는다", () => {
  const { content } = renderStory(withStat({
    label: "라벨", value: "1위(2주) 연속 (재확인)", sourceUrl: "https://www.yes24.com/x",
  }), {});
  // 끝에 오는 마지막 괄호 하나는 여전히 매치된다 — "1위(2주) 연속"이 primary가 된다.
  assert.match(content, /<div class="stat-value">1위\(2주\) 연속<span class="stat-value-context">재확인<\/span><\/div>/);
});

test("헤드라인에서 감춘 이름이 본문에 있는지는 qa가 본다 — 렌더러는 꺾쇠를 깨지 않는다", () => {
  // 〈 〉(U+3008/3009)는 HTML 태그로 먹히지 않는다. escapeHTML을 통과해도 그대로 남아야
  // 독자가 작품명을 읽을 수 있다. <>로 쓰면 통째로 사라진다 — CLAUDE.md §6 표기 규칙.
  const story = withStat(SNAPSHOT);
  story.blocks[0].text = "〈모태솔로 애프터서비스〉 6화가 올라왔다.";
  const { content } = renderStory(story, {});
  assert.match(content, /〈모태솔로 애프터서비스〉/);
});

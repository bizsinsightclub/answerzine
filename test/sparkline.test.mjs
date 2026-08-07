import { test } from "node:test";
import assert from "node:assert/strict";
import { sparklineSVG, trendSentence } from "../build/lib/sparkline.mjs";

const ys = (svg) => {
  const d = svg.match(/ d="([^"]+)"/)[1];
  return d.match(/,(-?\d+(?:\.\d+)?)/g).map((s) => Number(s.slice(1)));
};

test("2점 미만이면 던진다", () => {
  assert.throws(() => sparklineSVG([1], "#fff"), /2개/);
  assert.throws(() => sparklineSVG(null, "#fff"), /2개/);
});

test("평탄한 앞부분이 바닥에 붙지 않는다", () => {
  // [98,101,100,426] — 프로토타입에서 앞 세 점이 바닥에 뭉개지던 실제 데이터
  const y = ys(sparklineSVG([98, 101, 100, 426], "#34C759"));
  const [y0, y1, y2] = y;
  assert.notEqual(y0, y1, "98과 101의 y가 같으면 안 된다");
  assert.ok(Math.max(y0, y1, y2) < 50, `앞 세 점이 바닥(50)에 붙었다: ${y.join(",")}`);
});

test("기준선이 점선으로 그려진다", () => {
  const svg = sparklineSVG([98, 101, 100, 426], "#34C759");
  assert.match(svg, /stroke-dasharray/);
});

test("색은 전달한 값을 쓴다", () => {
  assert.ok(sparklineSVG([1, 2], "#FF9500").includes("#FF9500"));
});

test("SVG에 대체 텍스트가 들어간다 — §9.9", () => {
  const svg = sparklineSVG([98, 101, 100, 426], "#34C759", { label: "주간 판매량 지수" });
  assert.match(svg, /<title>/);
  assert.match(svg, /role="img"/);
  assert.ok(!svg.includes('aria-hidden="true"'), "title이 있으면 aria-hidden을 붙이면 안 된다");
});

test("label이 없으면 aria-hidden으로 숨긴다", () => {
  assert.match(sparklineSVG([1, 2], "#fff"), /aria-hidden="true"/);
});

test("대체 텍스트는 이스케이프된다", () => {
  const svg = sparklineSVG([1, 2], "#fff", { label: `<script>x` });
  assert.ok(!svg.includes("<script>"));
});

test("trendSentence는 추세를 문장으로 만든다", () => {
  const s = trendSentence([98, 101, 100, 426], "주간 판매량 지수");
  assert.match(s, /4개/);
  assert.match(s, /98/);
  assert.match(s, /426/);
  assert.match(s, /상승/);
});

test("trendSentence는 하락과 보합을 구분한다", () => {
  assert.match(trendSentence([200, 100], "x"), /하락/);
  assert.match(trendSentence([100, 100], "x"), /보합/);
});

test("좌표에 NaN이 없다", () => {
  for (const pts of [[100, 100], [0, 0, 0], [5, 5, 5, 5], [0, 100]]) {
    assert.ok(!sparklineSVG(pts, "#fff").includes("NaN"), `NaN 발생: ${pts}`);
  }
});

test("실제 회차 데이터 전부에서 NaN이 없다", async () => {
  const { loadIssues } = await import("../build/lib/data.mjs");
  for (const issue of loadIssues(".")) {
    for (const st of issue.stories ?? []) {
      const stat = (st.blocks ?? []).find((b) => b.type === "stat");
      if (!stat?.trend) continue;
      const svg = sparklineSVG(stat.trend, "#fff", { label: stat.label });
      assert.ok(!svg.includes("NaN"), `${st.id}에서 NaN`);
    }
  }
});

test("순위 추이는 y축을 뒤집어 그린다 — 1위로 갈수록 위", () => {
  // 순위는 작을수록 좋은 값이다. 그대로 그리면 1위에 오른 곡의 선이 아래로 흐르고,
  // 눈은 그것을 하락으로 읽는다. 그림이 문장과 반대로 말하면 없는 것보다 나쁘다.
  const y = (svg) => [...svg.matchAll(/[ML] [\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
  const rising = [5, 3, 1, 1, 1];

  const plain = y(sparklineSVG(rising, "#FF9500", { label: "순위" }));
  const flipped = y(sparklineSVG(rising, "#FF9500", { label: "순위", invert: true }));

  // SVG는 y가 클수록 아래다.
  assert.ok(plain.at(-1) > plain[0], "뒤집지 않으면 1위 쪽이 아래로 간다");
  assert.ok(flipped.at(-1) < flipped[0], "뒤집으면 1위 쪽이 위로 가야 한다");
});

test("순위 추이의 대체 텍스트가 방향을 뒤집어 읽는다", () => {
  const up = trendSentence([5, 3, 1, 1, 1], "멜론 주간 순위", true);
  assert.match(up, /상승/);
  assert.match(up, /값이 작을수록 위/);
  // 같은 배열을 정방향으로 읽으면 반대말이 나온다 — 이게 뒤집기가 필요한 이유다.
  assert.match(trendSentence([5, 3, 1, 1, 1], "순위"), /하락/);
});

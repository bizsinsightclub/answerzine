/**
 * About 페이지 — 2026-08-13 "ANZINE — ABOUT / WHY ANZINE Refinement".
 *
 * 사용자가 준 WHY ANZINE 코어 카피를 그대로 쓰는지, 중심 질문이 페이지의 유일한
 * h1인지(가장 강한 시각·시맨틱 요소), 기존 사실 관계 문단(선정 기준·데이터 출처)이
 * 손 안 댄 채 남아 있는지, About 페이지에 UNEXPECTED가 없다는(=건드릴 게 없다는)
 * 전제가 계속 맞는지를 검사한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderAbout } from "../build/lib/render-about.mjs";

test("WHY ANZINE 코어 카피가 그대로 나온다", () => {
  const { content } = renderAbout();
  assert.match(content, /class="why-eyebrow">Why ANZINE</);
  assert.match(content, /영화가 흥행하고, 책이 팔리고, 음악이 차트에 오르고, 콘텐츠가 바이럴됩니다\./);
  assert.match(content, /하지만 ANZINE이 궁금한 건 무엇이 떴는지가 아닙니다\./);
  assert.match(content, /사람들은 지금 무엇에 돈을 쓰고 있을까\.<br>그리고 왜 그곳에 지갑을 열었을까\./);
  assert.match(content, /ANZINE은 실제 판매·매출·소비 데이터와 시장의 이상 신호를 따라가며/);
  assert.match(content, /왜 그것을 선택하고 소비했는지/);
  assert.match(content, /많이 언급되는 트렌드를 나열하는 대신/);
  assert.match(content, /결과보다 이유를,<br>순위보다 왜 팔렸는지를\./);
});

test("중심 질문이 페이지의 유일한 h1이다", () => {
  const { content } = renderAbout();
  const h1s = content.match(/<h1[ >]/g) ?? [];
  assert.equal(h1s.length, 1, "h1이 정확히 하나여야 한다");
  assert.match(content, /<h1 class="why-question">사람들은 지금/);
});

test("기존 사실 관계 문단(선정 기준·데이터 출처·발행 주기)은 그대로 남아 있다", () => {
  const { content } = renderAbout();
  assert.match(content, /순위는 결과다\. 우리가 싣는 건 그 결과를 만든 계기다\./);
  assert.match(content, /도메인마다 실 구매·실 소비 숫자/);
  assert.match(content, /한 호가 나오면 이 아카이브가 갱신되고/);
});

test("About 페이지에는 UNEXPECTED가 없다 — 건드릴 것 자체가 없었다", () => {
  const { content } = renderAbout();
  assert.ok(!content.includes("UNEXPECTED"), "About 페이지에 UNEXPECTED 문구가 생기면 안 된다(홈·DIY 진 전용)");
});

test("홈·아카이브로 돌아가는 링크가 남아 있다", () => {
  const { content } = renderAbout();
  assert.match(content, /class="back-link" href="\/">← 홈으로/);
  assert.match(content, /href="\/archive\/">전체 아카이브 보기/);
});

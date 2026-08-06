import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrl, normalize, toAnchorDate, KEY } from "../tools/kobis.mjs";

test("키가 임베드돼 있다", () => {
  assert.match(KEY, /^[0-9a-f]{32}$/);
});

test("buildUrl은 targetDt를 YYYYMMDD로 강제한다", () => {
  assert.throws(() => buildUrl("daily", { targetDt: "2026-08-05" }), /YYYYMMDD/);
  assert.match(buildUrl("daily", { targetDt: "20260805" }), /targetDt=20260805/);
});

test("buildUrl은 키를 붙인다", () => {
  assert.ok(buildUrl("daily", { targetDt: "20260805" }).includes(`key=${KEY}`));
});

test("buildUrl은 모르는 요청을 거부한다", () => {
  assert.throws(() => buildUrl("nope", {}), /알 수 없는 요청/);
});

test("normalize는 문자열 수치를 숫자로 바꾼다", () => {
  const raw = { rank: "1", movieNm: "오디세이", audiCnt: "291353", audiAcc: "293720",
                openDt: "2026-08-05", movieCd: "20260001", rankInten: "0" };
  const m = normalize(raw);
  assert.equal(m.rank, 1);
  assert.equal(m.audiCnt, 291353);
  assert.equal(m.audiAcc, 293720);
  assert.equal(m.openDt, "2026-08-05");
  assert.equal(m.title, "오디세이");
});

test("normalize는 개봉일이 비면 null로 둔다", () => {
  assert.equal(normalize({ rank: "1", movieNm: "x", openDt: " " }).openDt, null);
  assert.equal(normalize({ rank: "1", movieNm: "x" }).openDt, null);
});

test("toAnchorDate는 issues의 anchorDate 형식으로 바꾼다", () => {
  assert.equal(toAnchorDate("20260805"), "2026-08-05");
  assert.equal(toAnchorDate(""), null);
  assert.equal(toAnchorDate("2026-08-05"), null);
});

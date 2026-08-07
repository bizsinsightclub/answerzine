/**
 * 수집기의 주차 계산.
 *
 * 여기서 한 칸 어긋나면 지난 주 데이터를 이번 주 파일로 저장하게 된다.
 * 그건 이 저장소에서 가장 위험한 종류의 오류라 계산부터 못 박는다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { weekBounds, rangeLabel, isoWeekOf } from "../tools/collect.mjs";

const d = (s) => new Date(`${s}T00:00:00Z`);

test("ISO 주차는 월요일에 시작해 일요일에 끝난다", () => {
  const { start, end } = weekBounds("2026-w31");
  assert.equal(start.toISOString().slice(0, 10), "2026-07-27");
  assert.equal(end.toISOString().slice(0, 10), "2026-08-02");
  assert.equal(start.getUTCDay(), 1);
  assert.equal(end.getUTCDay(), 0);
});

test("range 표기가 issues/*.json 계약과 같다 (en dash)", () => {
  assert.equal(rangeLabel(weekBounds("2026-w31")), "2026.07.27 – 08.02");
  assert.ok(rangeLabel(weekBounds("2026-w31")).includes("–"));
});

test("해가 바뀌는 주도 ISO 규칙을 따른다", () => {
  // 2026-w01은 2025년 12월 29일(월)에 시작한다. 1주는 첫 목요일이 든 주다.
  assert.equal(rangeLabel(weekBounds("2026-w01")), "2025.12.29 – 01.04");
});

test("isoWeekOf가 weekBounds와 왕복한다", () => {
  for (const id of ["2026-w01", "2026-w27", "2026-w31", "2026-w52"]) {
    const { start, end } = weekBounds(id);
    assert.equal(isoWeekOf(start), id, `${id} 시작일`);
    assert.equal(isoWeekOf(end), id, `${id} 종료일`);
  }
});

test("넷플릭스 주 라벨(일요일)이 우리 주 종료일과 같다", () => {
  // 어댑터가 이 등식으로 TSV를 거른다. 어긋나면 엉뚱한 주를 뜬다.
  assert.equal(weekBounds("2026-w31").end.toISOString().slice(0, 10), "2026-08-02");
});

test("주차 형식이 틀리면 조용히 넘어가지 않는다", () => {
  for (const bad of ["2026-31", "26-w31", "", null, "2026-wXX"])
    assert.throws(() => weekBounds(bad), /YYYY-wNN/);
});

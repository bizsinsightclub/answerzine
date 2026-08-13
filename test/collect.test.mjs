/**
 * 수집기의 주차 계산.
 *
 * 여기서 한 칸 어긋나면 지난 주 데이터를 이번 주 파일로 저장하게 된다.
 * 그건 이 저장소에서 가장 위험한 종류의 오류라 계산부터 못 박는다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { weekBounds, rangeLabel, isoWeekOf, collect, ADAPTERS } from "../tools/collect.mjs";

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

/**
 * 2026-08-13 — 그 주의 정본은 한 번만 찍는다.
 * 네트워크가 필요 없는 가짜 어댑터를 임시로 끼워 실제 collect()를 돈다 — 진짜 사이트를
 * 안 건드리면서도 "이미 있는 스냅숏을 조용히 덮어쓰지 않는다"는 회귀를 실측으로 잡는다.
 */
test("이미 있는 주간 스냅숏은 --force 없이는 안 덮어쓴다", async () => {
  const root = mkdtempSync(join(tmpdir(), "az-collect-"));
  const calls = [];
  ADAPTERS.__test_snapshot_guard__ = {
    domains: ["book"],
    needs: null,
    async run() {
      calls.push(1);
      return { method: "fetch", url: "http://example.invalid", rows: [{ n: calls.length }], note: "test" };
    },
  };
  try {
    const opts = { only: ["__test_snapshot_guard__"], root };
    const file = join(root, "runs/raw/2099-w01/__test_snapshot_guard__.json");

    const first = await collect("2099-w01", opts);
    assert.equal(first.results[0].status, "ok");
    const firstBody = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(firstBody.rows[0].n, 1);

    // 다시 돈다 — force 없이. 거부는 a.run() 호출 자체보다 먼저 걸리므로(불필요한
    // 네트워크 요청을 아예 안 한다), calls는 늘지 않고 파일도 그대로여야 한다.
    const second = await collect("2099-w01", opts);
    assert.equal(second.results[0].status, "refused");
    assert.equal(calls.length, 1, "거부됐다면 run()이 다시 호출되면 안 된다");
    const secondBody = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(secondBody.rows[0].n, 1, "거부됐다면 파일 내용이 첫 실행 그대로여야 한다");

    // --force면 의도적으로 덮어쓸 수 있다 — 이때는 run()이 다시 호출된다(두 번째 실제 실행).
    const third = await collect("2099-w01", { ...opts, force: true });
    assert.equal(third.results[0].status, "ok");
    const thirdBody = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(thirdBody.rows[0].n, 2, "force 실행은 두 번째 실제 run() 호출 결과를 반영해야 한다");

    // --dry는 파일이 있어도 항상 통과한다(애초에 아무것도 안 쓰므로 덮어쓸 게 없다).
    const dryRun = await collect("2099-w01", { ...opts, dry: true });
    assert.equal(dryRun.results[0].status, "ok");
  } finally {
    delete ADAPTERS.__test_snapshot_guard__;
    rmSync(root, { recursive: true, force: true });
  }
});

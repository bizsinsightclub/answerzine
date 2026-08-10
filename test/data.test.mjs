import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRange, neighbors, allStories, sortIssues } from "../build/lib/data.mjs";

test("parseRange는 en dash 형식을 파싱한다", () => {
  const r = parseRange("2026.07.28 – 08.03");
  assert.equal(r.start.getUTCFullYear(), 2026);
  assert.equal(r.start.getUTCMonth(), 6); // 0-indexed
  assert.equal(r.start.getUTCDate(), 28);
});

test("parseRange는 하이픈을 거부한다", () => {
  assert.throws(() => parseRange("2026.07.28 - 08.03"), /en dash/);
});

test("sortIssues는 최신 회차를 앞에 둔다", () => {
  const issues = [
    { issue: "2026-w27", range: "2026.06.29 – 07.05", stories: [] },
    { issue: "2026-w31", range: "2026.07.28 – 08.03", stories: [] },
  ];
  assert.deepEqual(sortIssues(issues).map((i) => i.issue), ["2026-w31", "2026-w27"]);
});

test("allStories는 회차 순서를 보존하고 회차 안에서는 입력 순서를 지킨다", () => {
  const issues = [
    {
      issue: "2026-w31", range: "2026.07.28 – 08.03",
      stories: [{ id: "2026-w31-book", domain: "도서" }, { id: "2026-w31-youtube", domain: "유튜브" }],
    },
    { issue: "2026-w27", range: "2026.06.29 – 07.05", stories: [{ id: "2026-w27-music", domain: "음악" }] },
  ];
  const list = allStories(sortIssues(issues));
  assert.deepEqual(list.map((s) => s.id), ["2026-w31-book", "2026-w31-youtube", "2026-w27-music"]);
});

test("allStories는 url과 slug를 붙인다", () => {
  const issues = [{ issue: "2026-w31", range: "2026.07.28 – 08.03", stories: [{ id: "2026-w31-book", domain: "도서" }] }];
  const reg = { byName: new Map([["도서", { key: "book", name: "도서", color: "#34C759" }]]) };
  const [s] = allStories(issues, reg);
  assert.equal(s.slug, "book");
  assert.equal(s.url, "/2026-w31/book/");
  assert.equal(s.domainMeta.color, "#34C759");
});

test("neighbors의 prev는 시간상 이전, next는 시간상 다음이다", () => {
  const list = [{ id: "c" }, { id: "b" }, { id: "a" }]; // 최신순
  const n = neighbors(list, "b");
  assert.equal(n.prev.id, "a", "prev는 더 옛날 회차여야 한다");
  assert.equal(n.next.id, "c", "next는 더 최근 회차여야 한다");
});

test("neighbors는 양 끝에서 null을 준다", () => {
  const list = [{ id: "c" }, { id: "b" }, { id: "a" }];
  assert.equal(neighbors(list, "c").next, null);
  assert.equal(neighbors(list, "a").prev, null);
});

test("neighbors는 필터된 배열 위에서 동작한다 — §9.5", () => {
  const all = [{ id: "c", domain: "도서" }, { id: "b", domain: "음악" }, { id: "a", domain: "도서" }];
  const filtered = all.filter((s) => s.domain === "도서");
  const n = neighbors(filtered, "c");
  assert.equal(n.prev.id, "a", "필터 적용 배열에서 음악을 건너뛰어야 한다");
});

test("실제 저장소 데이터가 최신순으로 로드된다", async () => {
  const { loadIssues, loadRegistry } = await import("../build/lib/data.mjs");
  const reg = loadRegistry(".");
  const issues = loadIssues(".");
  assert.ok(issues.length >= 1, "회차가 1개 이상이어야 한다");
  const dates = issues.map((i) => parseRange(i.range).start.getTime());
  for (let i = 1; i < dates.length; i++)
    assert.ok(dates[i - 1] >= dates[i], "회차가 최신순이 아니다");
  const list = allStories(issues, reg);
  for (const s of list) assert.ok(s.url.startsWith("/"), `url이 없다: ${s.id}`);
});

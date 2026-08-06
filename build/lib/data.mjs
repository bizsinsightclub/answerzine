/**
 * 회차·레지스트리 로드와 시간순 정렬.
 *
 * 프로토타입은 WEEKS 배열의 순서가 최신순이라고 "가정"했다. 실제로는
 * w31 → w27 → w31 → w31 순이라 이전/다음 회차가 시간을 거슬러 갔다 (CLAUDE.md §9.2).
 * 여기서 range 기준으로 정렬한 배열 하나를 만들고, 그 위에서만 인덱싱한다.
 * 필터도 같은 배열을 좁힌 것을 쓰므로 §9.5도 함께 없어진다.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const EN_DASH = "–";

export function parseRange(range) {
  if (!range || !range.includes(` ${EN_DASH} `))
    throw new Error(`range는 en dash(–)를 써야 한다: "${range}"`);
  const [head, tail] = range.split(` ${EN_DASH} `);
  const [y, m, d] = head.split(".").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, d)), end: tail, raw: range };
}

export function sortIssues(issues) {
  return [...issues].sort((a, b) => parseRange(b.range).start - parseRange(a.range).start);
}

export function loadRegistry(root) {
  const reg = JSON.parse(readFileSync(join(root, "domains/registry.json"), "utf8"));
  const domains = reg.domains.filter((d) => d.status === "active");
  return {
    ...reg,
    domains,
    byName: new Map(domains.map((d) => [d.name, d])),
    byKey: new Map(domains.map((d) => [d.key, d])),
  };
}

export function loadIssues(root) {
  const dir = join(root, "issues");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => /^\d{4}-w\d{2}\.json$/.test(f));
  return sortIssues(files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8"))));
}

/** 회차를 평탄화해 최신순 스토리 배열을 만든다. 각 스토리에 파생 필드를 주입한다. */
export function allStories(issues, registry) {
  const out = [];
  for (const issue of issues) {
    for (const st of issue.stories ?? []) {
      const meta = registry?.byName.get(st.domain) ?? null;
      const key = meta?.key ?? String(st.id ?? "").split("-").pop();
      out.push({
        ...st,
        issue,
        domainMeta: meta,
        slug: key,
        url: `/${issue.issue}/${key}/`,
        draft: issue.status === "draft",
      });
    }
  }
  return out;
}

/** 배열은 최신순이므로 prev(시간상 이전)는 뒤쪽, next(시간상 다음)는 앞쪽이다. */
export function neighbors(list, id) {
  const i = list.findIndex((s) => s.id === id);
  if (i === -1) return { prev: null, next: null };
  return { prev: list[i + 1] ?? null, next: list[i - 1] ?? null };
}

/**
 * 회차 단위 이웃. 독자가 호를 주별로 넘겨보는 데 쓴다.
 * 스토리 이웃(neighbors)과 축이 다르다 — 이건 잡지 한 권을 넘기는 동작이다.
 */
export function issueNeighbors(issues, issueId) {
  const i = issues.findIndex((x) => x.issue === issueId);
  if (i === -1) return { prev: null, next: null, index: -1, total: issues.length };
  return {
    prev: issues[i + 1] ?? null, // 배열은 최신순이므로 뒤가 지난 호
    next: issues[i - 1] ?? null,
    index: i,
    total: issues.length,
  };
}

/** 회차 라벨. "2026-w31" → "2026년 31주" */
export function issueLabel(issueId) {
  const m = /^(\d{4})-w(\d{2})$/.exec(issueId ?? "");
  return m ? `${m[1]}년 ${Number(m[2])}주` : issueId;
}

/** 스토리 블록에서 타입별로 꺼낸다. 계약은 text,stat,text,quote,text 고정이다. */
export function blocksOf(story) {
  const b = story.blocks ?? [];
  return {
    texts: b.filter((x) => x.type === "text"),
    stat: b.find((x) => x.type === "stat") ?? null,
    quote: b.find((x) => x.type === "quote") ?? null,
  };
}

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

/* 데이터 수집이 아직 불안정해 UI에는 노출하지 않기로 한 도메인(편집 결정, registry.json의
   status와는 별개). 홈 카테고리 카드 그리드와 마스트헤드 상단 내비 둘 다 이 목록을
   공유한다 — 갈리면 카드에는 있는데 내비에는 없는(또는 반대) 도메인이 생긴다. 공연은
   registry.json에서 이미 dormant라 loadRegistry()가 걸러내므로 여기 다시 적지 않는다.
   뉴스·여행은 2026-08-11 사용자 요청으로 registry.json에서 도메인 자체가 삭제됐다 —
   이 목록에 있었던 이유(데이터 불안정)와 무관한 편집 결정이라, 되살릴 필요가 생기면
   먼저 registry.json에 도메인을 다시 등록해야 한다. 이 Set은 등록은 돼 있지만 화면에는
   아직 못 낼 도메인이 생겼을 때 다시 쓴다. */
export const HIDDEN_DOMAIN_NAMES = new Set();

/** UI(카테고리 카드·상단 내비)에 노출할 도메인 목록. */
export function visibleDomains(registry) {
  return registry.domains.filter((d) => !HIDDEN_DOMAIN_NAMES.has(d.name));
}

/**
 * 작품명 꺾쇠(〈 〉, U+3008/3009) 제거 — 표시 전용.
 *
 * CLAUDE.md §6은 "헤드라인은 고유명사를 감추고, 본문은 반드시 〈작품명〉으로 밝힌다"고
 * 못박는다. tools/qa.mjs가 이걸 하드 강제한다 — WORK_DOMAINS 도메인의 본문에 〈〉가
 * 없으면 발행을 막는다(qa.mjs는 issues/*.json을 이 파일과 별개로 직접 읽는다, S3 참고).
 *
 * 2026-08-13 사용자 요청: "꺾쇠 표기를 빼고 그냥 텍스트로 보여달라." 원본 JSON에서
 * 꺾쇠를 지우면 qa.mjs의 검사 자체가 통과 못 한다 — 검사가 지키려는 "고유명사가 본문
 * 어딘가에 실제로 나오는가"라는 목적은 꺾쇠 유무와 무관하게 여전히 충족되므로, 데이터는
 * 그대로 두고 화면에 나가기 직전(이 함수)에만 꺾쇠 문자를 벗긴다. qa.mjs는 이 함수를
 * 거치지 않는 원본을 보므로 계속 정상 작동한다.
 */
const stripWorkBrackets = (s) => (typeof s === "string" ? s.replace(/[〈〉]/g, "") : s);

/** 회차를 평탄화해 최신순 스토리 배열을 만든다. 각 스토리에 파생 필드를 주입한다. */
export function allStories(issues, registry) {
  const out = [];
  for (const issue of issues) {
    for (const st of issue.stories ?? []) {
      const meta = registry?.byName.get(st.domain) ?? null;
      const key = meta?.key ?? String(st.id ?? "").split("-").pop();
      out.push({
        ...st,
        teaser: stripWorkBrackets(st.teaser),
        blocks: (st.blocks ?? []).map((b) =>
          b.type === "text" ? { ...b, text: stripWorkBrackets(b.text) } : b
        ),
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

/**
 * 스토리 단위 이웃. 이전/다음 회차 내비게이션이 쓴다.
 *
 * `allStories`가 주는 배열은 **편집 순서**다 — 회차 안에서 맨 앞이 리드이고 점수순이다.
 * 그 순서를 시간순이라고 가정하면 안 된다. 스토리마다 자기 출처의 집계 기간을 선언하므로
 * 한 회차 안에서도 range가 다르다 (예: 도서 07.24~07.30, 영화 07.27~08.02).
 * 프로토타입이 배열 순서를 시간순으로 착각해 내비게이션이 시간을 거슬렀다 (§9.2).
 *
 * 그래서 여기서 **range 기준으로 다시 정렬한 배열을 만들고 그 위에서만 인덱싱한다.**
 * 편집 순서(리드 선정)와 시간 순서(내비게이션)는 서로 다른 축이고, 섞으면 둘 다 틀린다.
 */
export function neighbors(list, id) {
  // range가 없거나 형식이 깨진 항목이 섞여도 내비게이션이 죽으면 안 된다.
  // 읽을 수 없는 것은 원래 자리에 둔다 — 형식 검사는 tools/qa.mjs의 일이다.
  const startOf = (s) => { try { return parseRange(s.range).start.getTime(); } catch { return null; } };
  const byTime = [...list].sort((a, b) => {
    const [x, y] = [startOf(a), startOf(b)];
    if (x === null || y === null || x === y) return list.indexOf(a) - list.indexOf(b);
    return y - x;
  });
  const i = byTime.findIndex((s) => s.id === id);
  if (i === -1) return { prev: null, next: null };
  return { prev: byTime[i + 1] ?? null, next: byTime[i - 1] ?? null };
}

/**
 * 도메인 하나의 가장 최신 스토리. 홈 카테고리 카드 그리드가 쓴다.
 *
 * `allStories()`가 주는 배열은 **편집 순서**다(회차 안에서 리드가 맨 앞, 점수순) —
 * 시간순이 아니다. `neighbors()`와 같은 이유로 range 기준으로 다시 비교해야
 * "진짜 최신"이 나온다. 형식이 깨진 range는 무시한다 — 형식 검사는 tools/qa.mjs의 일이다.
 */
export function latestByDomain(stories, key) {
  let best = null;
  let bestTime = -Infinity;
  for (const s of stories) {
    if (s.slug !== key) continue;
    let t;
    try { t = parseRange(s.range).start.getTime(); } catch { continue; }
    if (t > bestTime) { best = s; bestTime = t; }
  }
  return best;
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

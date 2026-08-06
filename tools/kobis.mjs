#!/usr/bin/env node
/**
 * KOBIS 오픈API — 영화진흥위원회 영화관입장권통합전산망.
 *
 *   node tools/kobis.mjs daily  20260805        일별 박스오피스
 *   node tools/kobis.mjs weekly 20260803 0      주간 (0=주간, 1=주말, 2=주중)
 *   node tools/kobis.mjs info   20260001        영화 상세 (국내 개봉일 확인)
 *
 * 박스오피스 페이지는 폼 제출이 필요해 스크래핑으로 읽히지 않는다. 공식 API를 쓴다.
 * 이 API가 반환하는 openDt가 market-scope.md가 요구하는 **국내 개봉일**이고,
 * L-001 사고(최초 발표일 7/15를 쓴 채 실제 개봉 8/5 이전 데이터를 인용)를 만든 바로 그 값이다.
 * az-scout·az-verify는 개봉일을 기사에서 옮겨 적지 말고 여기서 가져온다.
 *
 * 키는 무료이며 저장소가 공개라 노출된다. 호출 한도가 소진되면
 * https://www.kobis.or.kr/kobisopenapi 에서 재발급한다.
 */
export const KEY = "6538d672a685ea3c074387778481e686";

const BASE = "https://www.kobis.or.kr/kobisopenapi/webservice/rest";

const ENDPOINTS = {
  daily: `${BASE}/boxoffice/searchDailyBoxOfficeList.json`,
  weekly: `${BASE}/boxoffice/searchWeeklyBoxOfficeList.json`,
  info: `${BASE}/movie/searchMovieInfo.json`,
};

export function buildUrl(kind, params) {
  if (!ENDPOINTS[kind]) throw new Error(`알 수 없는 요청: ${kind}`);
  const url = new URL(ENDPOINTS[kind]);
  url.searchParams.set("key", KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "targetDt" && !/^\d{8}$/.test(String(v)))
      throw new Error(`targetDt는 YYYYMMDD여야 한다: ${v}`);
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

export function normalize(m) {
  const dt = String(m.openDt ?? "").trim();
  return {
    rank: num(m.rank),
    title: m.movieNm,
    movieCd: m.movieCd,
    audiCnt: num(m.audiCnt),
    audiAcc: num(m.audiAcc),
    scrnCnt: num(m.scrnCnt),
    showCnt: num(m.showCnt),
    rankInten: num(m.rankInten),
    openDt: dt ? dt : null,
  };
}

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`KOBIS HTTP ${r.status}`);
  const j = await r.json();
  if (j.faultInfo) throw new Error(`KOBIS: ${j.faultInfo.message}`);
  return j;
}

export async function dailyBoxOffice(targetDt) {
  const j = await get(buildUrl("daily", { targetDt }));
  return (j.boxOfficeResult?.dailyBoxOfficeList ?? []).map(normalize);
}

export async function weeklyBoxOffice(targetDt, weekGb = "0") {
  const j = await get(buildUrl("weekly", { targetDt, weekGb }));
  return (j.boxOfficeResult?.weeklyBoxOfficeList ?? []).map(normalize);
}

export async function movieInfo(movieCd) {
  const j = await get(buildUrl("info", { movieCd }));
  const i = j.movieInfoResult?.movieInfo;
  if (!i) return null;
  return {
    title: i.movieNm,
    titleEn: i.movieNmEn,
    movieCd: i.movieCd,
    openDt: String(i.openDt ?? "").trim() || null,
    nations: (i.nations ?? []).map((n) => n.nationNm),
    showTm: num(i.showTm),
  };
}

/** "20260805" → "2026-08-05". issues/*.json의 anchorDate 형식이다. */
export function toAnchorDate(openDt) {
  if (!openDt || !/^\d{8}$/.test(openDt)) return null;
  return `${openDt.slice(0, 4)}-${openDt.slice(4, 6)}-${openDt.slice(6, 8)}`;
}

/* ── CLI ── */
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;
if (isMain) {
  const [cmd, arg, arg2] = process.argv.slice(2);
  const runners = {
    daily: () => dailyBoxOffice(arg),
    weekly: () => weeklyBoxOffice(arg, arg2 ?? "0"),
    info: () => movieInfo(arg),
  };
  const run = runners[cmd];
  if (!run || !arg) {
    console.error("사용법: node tools/kobis.mjs <daily|weekly|info> <targetDt(YYYYMMDD)|movieCd> [weekGb]");
    process.exit(1);
  }
  run()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}

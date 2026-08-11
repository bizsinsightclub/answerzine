#!/usr/bin/env node
/**
 * ANSWER ZINE — 주간 원본 수집
 *
 *   node tools/collect.mjs 2026-w32
 *   node tools/collect.mjs 2026-w32 --only=kobis,yes24
 *   node tools/collect.mjs 2026-w32 --dry
 *
 * ── 이 도구가 있는 이유 ────────────────────────────────────────
 * 이 저장소의 출처 절반은 `snapshot`이다. 조회 시점의 순위만 보여주고
 * 지난 주 값은 사후에 열리지 않는다. 그래서 추세선을 그릴 수 없었다 (L-011).
 *
 * 못 그리는 진짜 이유는 "아무도 아카이브를 안 해서"다. 매주 같은 시각에 같은 방법으로
 * 읽어서 `runs/raw/`에 커밋해 두면, 다음 주부터는 **우리가 그 아카이브다.**
 * 그때부터는 스냅숏 출처에서도 추세선을 그릴 수 있다 — 각 점이 커밋된 파일을 가리키므로
 * 누구나 같은 값을 다시 볼 수 있기 때문이다. `tools/qa.mjs`의 `trendSnapshots` 규칙이 그것이다.
 *
 * 그러므로 **수집을 거른 주는 영영 복구되지 않는다.** 이 도구는 매주 돌린다.
 *
 * ── 왜 외부 스크래핑 서비스를 쓰지 않는가 ─────────────────────
 * 이 웹진의 명제는 "집계 주체가 직접 공개한 값"이다. 중간에 가공 계층을 하나 끼우면
 * 화이트리스트가 막으려던 2차 가공이 파이프라인 안으로 들어온다 (`sources/README.md`).
 * 여기서 쓰는 건 셋뿐이고 전부 원본에 직접 닿는다.
 *
 *   1. 공식 오픈API  — KOBIS · KOPIS (무료 키, 환경변수)
 *   2. 그냥 fetch    — 넷플릭스 TSV · 예스24 · 가이섬 (서버가 값을 그대로 내려준다)
 *   3. Playwright    — 써클차트 · 교보문고 (목록이 클라이언트 렌더라 이 방법뿐)
 *
 * Playwright는 이미 승인된 devDependency다 (`package.json` comment, CLAUDE.md §7.3).
 * 없으면 그 어댑터만 건너뛰고 나머지는 정상 동작한다.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (compatible; answerzine-collector/1.0)";

/** KOBIS 오픈API 무료 공개 키. 사용자 승인 하에 저장소에 포함한다 (§7.3). */
const KOBIS_PUBLIC_KEY = "6538d672a685ea3c074387778481e686";

const C = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", x: "\x1b[0m" };
const ok = (m) => console.log(`${C.g}  ✓ ${C.x}${m}`);
const skip = (m) => console.log(`${C.d}  – ${m}${C.x}`);
const bad = (m) => console.log(`${C.r}  ✕ ${C.x}${m}`);

/* ══════════════ 주차 계산 ══════════════ */

/** ISO 주차(월~일)의 시작·끝을 UTC로 낸다. "2026-w31" → 2026.07.27 ~ 08.02 */
export function weekBounds(id) {
  const m = /^(\d{4})-w(\d{2})$/.exec(id ?? "");
  if (!m) throw new Error(`주차 형식이 YYYY-wNN이 아니다: "${id}"`);
  const [y, w] = [Number(m[1]), Number(m[2])];
  // ISO-8601: 1주는 그 해 첫 목요일이 든 주다.
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dow = (jan4.getUTCDay() + 6) % 7; // 월=0
  const week1Mon = new Date(jan4.getTime() - dow * 86400000);
  const start = new Date(week1Mon.getTime() + (w - 1) * 7 * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start, end };
}

/** 어떤 날짜가 속한 ISO 주차 id. "2026-08-06" → "2026-w32" */
export function isoWeekOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // 그 주의 목요일이 속한 해가 ISO 연도다.
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round((d - jan4) / 86400000 / 7);
  return `${y}-w${String(w).padStart(2, "0")}`;
}

const iso = (d) => d.toISOString().slice(0, 10);
const dot = (d) => iso(d).replaceAll("-", ".");
const compact = (d) => iso(d).replaceAll("-", "");

/** issues/*.json의 range 표기. "2026.07.27 – 08.02" (en dash) */
export function rangeLabel({ start, end }) {
  return `${dot(start)} – ${dot(end).slice(5)}`;
}

/* ══════════════ 공통 ══════════════ */

async function get(url, init = {}) {
  const res = await fetch(url, { headers: { "user-agent": UA, ...(init.headers ?? {}) }, ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res;
}

/** Playwright는 있으면 쓰고 없으면 그 어댑터만 건너뛴다. */
let browserPromise = null;
async function withPage(fn) {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({
        // 환경에 이미 깔린 크로미움을 쓰고 싶을 때 경로를 지정할 수 있다.
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      });
    })();
  }
  const browser = await browserPromise;
  const page = await (await browser.newContext({ userAgent: UA })).newPage();
  try { return await fn(page); } finally { await page.close(); }
}

/* ══════════════ 어댑터 ══════════════
   각 어댑터는 { method, url, note, rows } 를 낸다.
   rows는 그 주에 실제로 화면에 있던 값이다 — 해석하지 않고 그대로 적는다. */

const ADAPTERS = {
  /* 예스24 — 순위와 판매지수가 서버 렌더 HTML에 그대로 있다. */
  yes24: {
    domains: ["book"],
    needs: null,
    snapshotOnly: true,
    async run() {
      const url = "https://www.yes24.com/product/category/bestseller?categoryNumber=001&pageNumber=1&pageSize=120&type=WEEKLY";
      const html = await (await get(url)).text();
      const rows = [];
      for (const m of html.matchAll(/<em class="ico rank">(\d+)<\/em>([\s\S]{0,6000}?)판매지수\s*([\d,]+)/g)) {
        const block = m[2];
        const t = /<a[^>]*class="gd_name"[^>]*>([\s\S]*?)<\/a>/.exec(block);
        rows.push({
          rank: Number(m[1]),
          title: t ? t[1].replace(/<[^>]+>/g, "").trim() : null,
          salesIndex: Number(m[3].replaceAll(",", "")),
        });
      }
      if (rows.length < 10) throw new Error(`${rows.length}건만 파싱됐다. 마크업이 바뀌었을 수 있다.`);
      return {
        method: "fetch", url, rows,
        note: "판매지수는 절대값이다. 전주 대비를 쓰려면 지난 주 스냅숏과 직접 비교한다. "
          + "⚠️ 순위는 판매지수 순이 아니다 — 예스24는 최근 판매 추이를 함께 반영한다. "
          + "실제로 이 주에 1위(302,604)보다 5위(389,754)의 판매지수가 높았다. "
          + "'판매지수 1위'라고 쓰지 않는다.",
      };
    },
  },

  /* 교보문고 — TOP100 목록이 클라이언트 렌더다. */
  kyobo: {
    domains: ["book"],
    needs: "playwright",
    snapshotOnly: true,
    async run() {
      const url = "https://store.kyobobook.co.kr/bestseller/total/weekly";
      return await withPage(async (page) => {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        const data = await page.evaluate(() => {
          const period = document.body.innerText.match(/\d{4}\.\d{2}\.\d{2}\s*~\s*\d{4}\.\d{2}\.\d{2}/);
          const rows = [...document.querySelectorAll("li")]
            .map((li) => {
              const rank = li.querySelector(".product_rank, .rank, [class*=rank]")?.innerText?.match(/\d+/)?.[0];
              const title = li.querySelector(".prod_name, .title, a[class*=title]")?.innerText?.trim();
              return rank && title ? { rank: Number(rank), title } : null;
            })
            .filter(Boolean);
          return { period: period?.[0] ?? null, rows };
        });
        if (!data.rows.length)
          throw new Error("순위 목록을 못 읽었다. 선택자가 바뀌었을 수 있다 — 화면을 직접 확인한다.");
        return {
          method: "playwright", url, rows: data.rows,
          note: `교보 집계 기간 ${data.period ?? "확인 실패"}. 온·오프라인 합산. 판매지수는 공개하지 않는다.`,
        };
      });
    },
  },

  /* 써클차트 — 주차 지정이 되는 국내 유일 음악 집계. 목록은 클라이언트 렌더다. */
  circlechart: {
    domains: ["music"],
    needs: "playwright",
    async run({ id }) {
      const [, y, w] = /^(\d{4})-w(\d{2})$/.exec(id);
      const url = `https://circlechart.kr/page_chart/onoff.circle?serviceGbn=ALL&termGbn=week&hitYear=${y}&targetTime=${Number(w)}&nationGbn=T`;
      return await withPage(async (page) => {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(2500);
        const rows = await page.evaluate(() =>
          [...document.querySelectorAll("table tbody tr")]
            .map((tr) => [...tr.querySelectorAll("td,th")].map((c) => c.innerText.replace(/\s+/g, " ").trim()))
            .filter((cells) => cells.length > 1)
        );
        if (!rows.length)
          throw new Error("차트 목록이 비었다. 2026-w32에 사이트가 개편됐다 — 경로와 선택자를 확인한다.");
        return {
          method: "playwright", url, rows,
          // ⚠️ 써클차트 주는 일~토다. 같은 번호라도 ISO 주(월~일)와 하루씩 어긋난다.
          //    예: 2026 w31 → 써클 2026.07.26~08.01 / ISO 2026.07.27~08.02.
          //    스토리의 range는 이 파일의 note에 적힌 기간을 그대로 쓴다. 우리 주차로 덮어쓰지 않는다.
          note: `디지털 종합(국내). 써클차트 ${y}년 ${Number(w)}주차(일~토)다. ISO 주(월~일)와 하루 어긋나므로 스토리 range는 화면의 기간 표기를 그대로 옮긴다.`,
        };
      });
    },
  },

  /* 가이섬 — 멜론 주간차트를 주차별로 보관하는 제3자 아카이브.
     멜론 자신은 지난 주를 열어주지 않으므로 과거 주차를 확인할 유일한 경로다.
     2차 가공이라 사이트가 사라지면 링크도 죽는다. 그래서 매주 떠서 우리 저장소에 남긴다. */
  guyso: {
    domains: ["music"],
    needs: null,
    async run({ id }) {
      const [, y, w] = /^(\d{4})-w(\d{2})$/.exec(id);
      const url = `https://xn--o39an51b2re.com/chart/melon/weekly/${y}/${Number(w)}`;
      const html = await (await get(url)).text();
      const body = html.slice(html.indexOf('id="chart-table-content"'));
      const re = /<td class="ranking">\s*<p>\s*<span[^>]*>(\d+)<\/span>\s*<\/p>\s*<p class="change">([\s\S]*?)<\/p>\s*<\/td>[\s\S]*?<td class="subject">\s*<p title="([^"]*)">[\s\S]*?<p class="singer" title="([^"]*)"/g;
      const rows = [];
      for (const m of body.matchAll(re)) {
        rows.push({
          rank: Number(m[1]),
          change: m[2].replace(/<[^>]+>/g, "").trim(),
          title: m[3], artist: m[4],
        });
      }
      // 순위가 1부터 빠짐없이 이어지지 않으면 파서가 깨진 것이다. 반쪽짜리를 남기지 않는다.
      const contiguous = rows.length === 100 && rows.every((r, i) => r.rank === i + 1);
      if (!contiguous)
        throw new Error(`${rows.length}행만 읽혔다(순위 연속 ${contiguous}). 마크업이 바뀌었을 수 있다.`);
      const period = /(\d{4}\.\d{2}\.\d{2}~\d{4}\.\d{2}\.\d{2}) \(${y}년 ${Number(w)}주차\)/.exec(html);
      return {
        method: "fetch", url, rows,
        note: `멜론 주간 TOP100. 집계 기간 ${period?.[1] ?? "확인 실패"}. `
          + "가이섬은 집계 주체가 아니라 아카이브다 — 본문에는 '멜론 주간 차트'라고 원 출처를 밝힌다.",
      };
    },
  },

  /* KOBIS — 공식 오픈API. 무료 키를 KOBIS_API_KEY에 넣는다.
     https://www.kobis.or.kr/kobisopenapi/homepg/apiservice/searchServiceInfo.do */
  kobis: {
    domains: ["movie"],
    needs: null,
    async run({ end }) {
      // KOBIS 오픈API는 무료 공개 키다. 저장소에 박아 두면 아무 설정 없이 바로 돈다.
      // 쿼터는 키 단위라 소진되면 KOBIS에서 재발급해 여기를 바꾸거나 환경변수로 덮어쓴다.
      const key = process.env.KOBIS_API_KEY || KOBIS_PUBLIC_KEY;
      // 주간(월~일) 박스오피스: weekGb=0. targetDt는 그 주에 속한 아무 날.
      const url = "https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchWeeklyBoxOfficeList.json"
        + `?key=${key}&targetDt=${compact(end)}&weekGb=0&itemPerPage=10`;
      const json = await (await get(url)).json();
      const rows = json?.boxOfficeResult?.weeklyBoxOfficeList ?? [];
      if (!rows.length) throw new Error(`응답에 목록이 없다: ${JSON.stringify(json).slice(0, 200)}`);
      return {
        method: "openapi",
        url: url.replace(key, "***"),
        rows,
        note: "weekGb=0은 월~일 주간 집계다. scrnCnt·showCnt가 있어 스크린당 관객수를 계산할 수 있다.",
      };
    },
  },

  /* KOPIS — 공식 오픈API. 무료 서비스키를 KOPIS_API_KEY에 넣는다.
     https://kopis.or.kr/por/cs/openapi/openApiList.do */
  kopis: {
    domains: ["stage"],
    needs: "KOPIS_API_KEY",
    async run({ start, end }) {
      const key = process.env.KOPIS_API_KEY;
      const url = "https://kopis.or.kr/openApi/restful/boxoffice"
        + `?service=${key}&ststype=week&date=${compact(start)}&catecode=`;
      const xml = await (await get(url)).text();
      const rows = [...xml.matchAll(/<boxof>([\s\S]*?)<\/boxof>/g)].map((m) =>
        Object.fromEntries(
          [...m[1].matchAll(/<(\w+)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/\1>/g)].map((f) => [f[1], f[2].trim()])
        )
      );
      if (!rows.length) throw new Error(`파싱된 항목이 없다: ${xml.slice(0, 200)}`);
      return {
        method: "openapi",
        url: url.replace(key, "***"),
        rows,
        note: `주간 예매 집계 ${dot(start)}~${dot(end)}. 예매 기준이라 실제 관람과 다르다.`,
      };
    },
  },
};

/* ══════════════ 실행 ══════════════ */

export async function collect(id, { only = null, dry = false, root = ROOT } = {}) {
  const bounds = weekBounds(id);
  const range = rangeLabel(bounds);
  const outDir = join(root, "runs/raw", id);
  const names = Object.keys(ADAPTERS).filter((n) => !only || only.includes(n));
  const nowWeek = isoWeekOf();

  console.log(`\n${C.d}── ${id} · ${range} ${"─".repeat(28)}${C.x}`);

  const results = [];
  for (const name of names) {
    const a = ADAPTERS[name];
    if (a.needs && a.needs !== "playwright" && !process.env[a.needs]) {
      skip(`${name} — 환경변수 ${a.needs}가 없다. 키를 받아 넣으면 이 주부터 수집된다.`);
      results.push({ name, status: "skipped", reason: `no ${a.needs}` });
      continue;
    }
    /* 스냅숏 출처는 "지금"밖에 못 낸다. 지난 주를 달라고 하면 오늘 값이 그대로 나오는데,
       그걸 지난 주 파일명으로 저장하면 이 저장소에서 가장 위험한 거짓말이 된다 —
       추세선 규칙(L-011)이 통째로 무의미해진다. 그래서 아예 거부한다. */
    if (a.snapshotOnly && id !== nowWeek) {
      bad(`${name} — 스냅숏 출처는 현재 주(${nowWeek})만 뜰 수 있다. `
        + `${id}를 요청했는데 이 사이트는 오늘 값밖에 못 준다. 그 주는 이미 지나갔다.`);
      results.push({ name, status: "refused", reason: `snapshot-only, ${id} != ${nowWeek}` });
      continue;
    }
    try {
      const r = await a.run({ id, ...bounds });
      const payload = {
        source: name, week: id, range,
        // 이 파일이 언제 찍힌 스냅숏인지가 이 파일의 존재 이유다.
        collectedAt: new Date().toISOString(),
        domains: a.domains, method: r.method, url: r.url, note: r.note,
        rowCount: Array.isArray(r.rows) ? r.rows.length : null,
        rows: r.rows,
      };
      if (!dry) {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, `${name}.json`), JSON.stringify(payload, null, 2) + "\n");
      }
      ok(`${name} — ${payload.rowCount}건${dry ? " (dry)" : ` → runs/raw/${id}/${name}.json`}`);
      results.push({ name, status: "ok", rowCount: payload.rowCount });
    } catch (e) {
      const msg = e?.code === "ERR_MODULE_NOT_FOUND" || /Executable doesn't exist/.test(e.message)
        ? "playwright가 없다. `npm install && npx playwright install chromium` 후 다시 돈다."
        : e.message;
      bad(`${name} — ${msg}`);
      results.push({ name, status: "failed", reason: msg });
    }
  }

  if (browserPromise) await (await browserPromise).close().catch(() => {});

  const good = results.filter((r) => r.status === "ok").length;
  console.log(`\n  성공 ${good} / 시도 ${results.length}` +
    (good < results.length ? ` ${C.d}(못 뜬 출처는 그 주 결번 사유가 된다 — CLAUDE.md §7.2)${C.x}` : ""));
  console.log();
  return { week: id, range, results };
}

if (import.meta.url.startsWith("file:") && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  if (!id) {
    console.log("사용법: node tools/collect.mjs YYYY-wNN [--only=a,b] [--dry]");
    console.log(`어댑터: ${Object.keys(ADAPTERS).join(", ")}`);
    process.exit(1);
  }
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const r = await collect(id, {
    only: onlyArg ? onlyArg.slice(7).split(",") : null,
    dry: args.includes("--dry"),
  });
  process.exit(r.results.some((x) => x.status === "failed" || x.status === "refused") ? 1 : 0);
}

export { ADAPTERS };

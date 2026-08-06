#!/usr/bin/env node
/**
 * ANSWER ZINE — 자동 검증
 *
 *   node tools/qa.mjs            전체 검사
 *   node tools/qa.mjs issues/2026-w31.json   특정 회차만
 *
 * CLAUDE.md §8의 [자동] 항목과 market-scope.md §5의 시간·시장 규칙을 검사한다.
 * 실패가 하나라도 있으면 exit 1 — GitHub Actions가 이 값으로 PR을 막는다.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

let fails = 0, warns = 0, drafts = 0;
let draftMode = false;   // status:"draft" 회차는 실패를 경고로 낮춘다 (CI를 막지 않음)
const C = { r:"\x1b[31m", y:"\x1b[33m", g:"\x1b[32m", d:"\x1b[2m", x:"\x1b[0m" };
const fail = (where, msg) => {
  if (draftMode) { drafts++; console.log(`${C.d}  ○ ${where}  ${msg} ${C.d}[draft]${C.x}`); return; }
  fails++; console.log(`${C.r}  ✕ ${C.x}${where}  ${msg}`);
};
const warn = (where, msg) => { warns++; console.log(`${C.y}  ! ${C.x}${where}  ${msg}`); };
const ok   = msg => console.log(`${C.g}  ✓ ${C.x}${msg}`);
const head = t => console.log(`\n${C.d}── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}${C.x}`);

/* ══════════════ 1. 레지스트리 ══════════════ */
head("domains/registry.json");
const reg = read("domains/registry.json");
const DOM = reg.domains.filter(d => d.status === "active");
const BUDGET = reg.budget;

const hueDist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
for (const d of DOM) {
  if (!existsSync(join(ROOT, d.doc))) fail(d.key, `문서 ${d.doc}가 없다.`);
  if (d.contrast < reg.colorRules.minContrast && d.contrastPass !== false)
    fail(d.key, `대비 ${d.contrast}:1 < ${reg.colorRules.minContrast}:1인데 contrastPass가 false가 아니다.`);
  for (const o of DOM) {
    if (o.key <= d.key) continue;
    const dist = hueDist(d.hue, o.hue);
    if (dist < reg.colorRules.minHueDistance)
      fail(`${d.key}↔${o.key}`, `색상환 거리 ${dist}° < ${reg.colorRules.minHueDistance}°`);
  }
}
const dupKey = DOM.map(d => d.key).filter((k, i, a) => a.indexOf(k) !== i);
if (dupKey.length) fail("registry", `key 중복: ${dupKey.join(", ")}`);
if (DOM.length > reg.zineLayout.leadSlots + reg.zineLayout.miniSlots)
  warn("registry", `활성 도메인 ${DOM.length}개 > 진 슬롯 ${reg.zineLayout.leadSlots + reg.zineLayout.miniSlots}개. domains/README.md §3 결정 필요.`);
if (!fails) ok(`활성 도메인 ${DOM.length}개, 색상 규칙 통과`);

/* ══════════════ 2. 화이트리스트 ══════════════ */
head("sources/whitelist.json");
const WL = read("sources/whitelist.json");
const TIER_URL_OK = { primary:true, conditional:true, secondary:false, evidence_only:false, blocked:false };
const dupHost = WL.sources.map(s => s.host).filter((h, i, a) => a.indexOf(h) !== i);
if (dupHost.length) fail("whitelist", `host 중복: ${dupHost.join(", ")}`);
for (const s of WL.sources) {
  if (!WL.tiers[s.tier]) fail(s.host, `알 수 없는 등급 "${s.tier}"`);
  if (s.tier !== "blocked" && !s.market) fail(s.host, "market이 없다.");
}
for (const d of DOM) {
  if (!d.primarySources?.length && !d.warning)
    warn(d.key, "1차 출처가 없는데 warning 표기도 없다.");
  for (const h of d.primarySources ?? []) {
    const hit = WL.sources.find(s => s.host === h);
    if (!hit) fail(d.key, `primarySource ${h}가 화이트리스트에 없다.`);
    else if (hit.tier !== "primary") fail(d.key, `${h}는 ${hit.tier} 등급이라 1차 출처가 될 수 없다.`);
  }
}
if (!fails) ok(`출처 ${WL.sources.length}건, 등급 정합성 통과`);

function judge(url) {
  if (!url?.trim()) return { status:"empty" };
  let host;
  try { host = new URL(url).hostname.replace(/^www\./, ""); }
  catch { return { status:"invalid" }; }
  for (const p of WL.blockedPatterns) if (url.includes(p.pattern ?? p)) return { status:"blocked", host };
  const hit = WL.sources.find(s => host === s.host || host.endsWith("." + s.host));
  if (!hit) return { status:"unlisted", host };
  return { status:hit.tier, host, name:hit.name, market:hit.market, urlOk:TIER_URL_OK[hit.tier] };
}

/* ══════════════ 3. LESSONS.md ══════════════ */
head("LESSONS.md");
const LESSON_STATES = ["자동화", "수동", "관찰"];
const LESSON_CATS = ["수집", "선별", "검증", "집필", "해석", "빌드", "운영"];
const REQUIRED_KEYS = ["발생", "상태", "분류", "증상", "규칙", "탐지", "반영"];
let lessons = [];

if (!existsSync(join(ROOT, "LESSONS.md"))) {
  warn("LESSONS.md", "파일이 없다. 학습 기록 없이 운영하면 같은 실수가 반복된다.");
} else {
  const md = readFileSync(join(ROOT, "LESSONS.md"), "utf8")
    .replace(/^```[\s\S]*?^```/gm, "");   // 코드 펜스 안의 예시 형식은 제외
  for (const b of md.split(/^### /m).slice(1)) {
    const m = b.match(/^(L-\d+)\s*·\s*(.+)$/m);
    if (!m) { fail("LESSONS.md", `제목 형식이 "### L-00N · 제목"이 아닌 블록이 있다.`); continue; }
    const item = { id: m[1], title: m[2].trim() };
    for (const line of b.split("\n")) {
      const kv = line.match(/^-\s+\*\*(.+?)\*\*:\s*(.+)$/);
      if (kv) item[kv[1].trim()] = kv[2].trim();
    }
    lessons.push(item);
  }
  const dupL = lessons.map(l => l.id).filter((v, i, a) => a.indexOf(v) !== i);
  if (dupL.length) fail("LESSONS.md", `id 중복: ${[...new Set(dupL)].join(", ")}`);

  for (const l of lessons) {
    for (const k of REQUIRED_KEYS) if (!l[k]) fail(l.id, `필수 항목 "${k}"이 없다.`);
    if (l.상태 && !LESSON_STATES.includes(l.상태))
      fail(l.id, `상태 "${l.상태}"는 ${LESSON_STATES.join("/")} 중 하나여야 한다.`);
    if (l.분류 && !LESSON_CATS.includes(l.분류))
      fail(l.id, `분류 "${l.분류}"는 ${LESSON_CATS.join("/")} 중 하나여야 한다.`);
    if (l.상태 === "자동화" && !/qa\.mjs|제작기|빌더/.test(l.탐지 ?? ""))
      fail(l.id, `상태가 "자동화"인데 탐지에 검사 주체(qa.mjs / 제작기)가 적혀 있지 않다. 실제로 자동화됐는지 확인할 것.`);
    if (l.상태 !== "자동화" && /^qa\.mjs\s*—/.test(l.탐지 ?? ""))
      warn(l.id, `탐지가 qa.mjs인데 상태가 "${l.상태}"다. 졸업 후보일 수 있다.`);
  }
  const auto = lessons.filter(l => l.상태 === "자동화").length;
  const rate = lessons.length ? Math.round(auto / lessons.length * 100) : 0;
  ok(`교훈 ${lessons.length}건 · 자동화 ${auto}건 (${rate}%)`);
  if (rate < 50 && lessons.length >= 5)
    warn("LESSONS.md", `자동화율 ${rate}% — 수동 항목이 쌓이고 있다. az-retro로 졸업 후보를 검토할 것.`);
}
const lessonIds = new Set(lessons.map(l => l.id));

/* ══════════════ 4. runs ══════════════ */
head("runs/");
const runDir = join(ROOT, "runs");
const runFiles = existsSync(runDir)
  ? readdirSync(runDir).filter(f => /^\d{4}-w\d{2}\.json$/.test(f)) : [];
const VALID_STAGE = ["S1+S2", "S3", "S4+S5", "S6+S7", "retro"];
const domNames = new Set(DOM.map(d => d.key));
const applyCount = {};

for (const rf of runFiles) {
  const at0 = `runs/${rf}`;
  let run;
  try { run = read(at0); } catch (e) { fail(at0, `JSON 파싱 실패 — ${e.message}`); continue; }
  if (run.week !== rf.replace(".json", "")) fail(at0, `week "${run.week}"이 파일명과 다르다.`);
  if (!["in_progress", "done", "blocked"].includes(run.status ?? ""))
    fail(at0, `status는 in_progress/done/blocked 중 하나여야 한다: "${run.status}"`);

  for (const s of run.stages ?? []) {
    const at = `${at0} · ${s.agent ?? "?"}${s.domain ? "/" + s.domain : ""}`;
    if (!VALID_STAGE.includes(s.stage)) fail(at, `알 수 없는 stage "${s.stage}"`);
    if (!["done", "blocked", "skipped"].includes(s.status ?? "")) fail(at, `알 수 없는 status "${s.status}"`);
    if (s.domain && !domNames.has(s.domain)) fail(at, `domain "${s.domain}"이 레지스트리에 없다.`);
    if (!("lessonsApplied" in s))
      fail(at, "lessonsApplied가 없다. 비어 있어도 배열로 남긴다 — 없으면 학습을 측정할 수 없다.");
    for (const id of s.lessonsApplied ?? []) {
      if (!lessonIds.has(id)) fail(at, `lessonsApplied의 "${id}"가 LESSONS.md에 없다.`);
      applyCount[id] = (applyCount[id] ?? 0) + 1;
    }
    if (s.needsHuman && !s.humanNote) warn(at, "needsHuman이 true인데 humanNote가 비었다.");
  }
  for (const v of run.verdicts ?? []) {
    const at = `${at0} · verdict/${v.candidate ?? "?"}`;
    if (!["pass", "fail"].includes(v.verdict)) fail(at, `verdict는 pass/fail만 허용한다: "${v.verdict}"`);
    if (v.verdict === "fail" && !v.failedOn?.length) fail(at, "fail인데 failedOn이 비었다.");
    if (!v.rebuttalAttempted) fail(at, "rebuttalAttempted가 없다. 무엇으로 반증을 시도했는지 적지 않으면 검증하지 않은 것이다.");
    for (const id of v.lessonsApplied ?? []) applyCount[id] = (applyCount[id] ?? 0) + 1;
  }
  for (const c of run.candidates ?? []) {
    const at = `${at0} · ${c.title ?? "?"}`;
    const sc = c.score ?? {};
    const sum = (sc.anomaly ?? 0) + (sc.cause ?? 0) + (sc.verify ?? 0);
    if (sc.total !== undefined && sc.total !== sum) fail(at, `score.total ${sc.total} ≠ 합계 ${sum}`);
    if (c.recommended && sum < 4) fail(at, `합계 ${sum}점인데 recommended가 true다. 4점 미만은 결번이다.`);
    if (!c.recommended && !c.rejectReason) warn(at, "미추천인데 rejectReason이 없다.");
    if (!c.scoreReason) warn(at, "scoreReason이 없다. 기준선과 비교한 근거를 남긴다 — L-007");
  }
}
// 대시보드용 인덱스 생성 — 정적 호스팅에는 디렉터리 목록이 없다
if (existsSync(runDir)) {
  const idx = { generated: "tools/qa.mjs", weeks: runFiles.map(f => f.replace(".json", "")).sort().reverse() };
  writeFileSync(join(runDir, "index.json"), JSON.stringify(idx, null, 2) + "\n");
}

if (runFiles.length) {
  const top = Object.entries(applyCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  ok(`실행 로그 ${runFiles.length}개 · 교훈 적용 ${Object.values(applyCount).reduce((a, c) => a + c, 0)}회`
     + (top.length ? ` · 최다 ${top.map(([k, v]) => `${k}(${v}회)`).join(", ")}` : ""));
  for (const [id, n] of Object.entries(applyCount)) {
    const l = lessons.find(x => x.id === id);
    if (l && l.상태 === "수동" && n >= 3)
      warn("졸업 후보", `${id} "${l.title}" — ${n}회 적용된 수동 항목이다. 자동 검사로 구현할 것.`);
  }
} else warn("runs/", "실행 로그가 없다.");

/* ══════════════ 5. 회차 ══════════════ */
const argFiles = process.argv.slice(2);
const issueDir = join(ROOT, "issues");
const files = argFiles.length ? argFiles
  : existsSync(issueDir) ? readdirSync(issueDir).filter(f => f.endsWith(".json")).map(f => "issues/" + f) : [];

const seenIds = new Set();
const conceptLog = [];   // { week, concept }

for (const f of files) {
  head(f);
  let issue;
  try { issue = read(f); }
  catch (e) { fail(f, `JSON 파싱 실패 — ${e.message}`); continue; }

  const stories = Array.isArray(issue) ? issue : issue.stories;
  if (!Array.isArray(stories)) { fail(f, "stories 배열이 없다."); continue; }
  draftMode = !Array.isArray(issue) && issue.status === "draft";
  if (draftMode) console.log(`${C.d}  (draft — 실패를 경고로 낮춘다. 발행 전 status를 "ready"로 바꾼다.)${C.x}`);

  for (const st of stories) {
    const at = `${basename(f)} · ${st.id ?? "?"}`;

    /* --- id / range / domain --- */
    if (!/^\d{4}-w\d{2}-[a-z]+$/.test(st.id ?? ""))
      fail(at, `id 형식이 YYYY-wNN-key가 아니다.`);
    if (seenIds.has(st.id)) fail(at, "id가 중복된다.");
    seenIds.add(st.id);

    if (!/^\d{4}\.\d{2}\.\d{2} – \d{2}\.\d{2}$/.test(st.range ?? ""))
      fail(at, `range가 "YYYY.MM.DD – MM.DD" (en dash) 형식이 아니다: "${st.range}"`);

    const dom = DOM.find(d => d.name === st.domain);
    if (!dom) fail(at, `domain "${st.domain}"이 레지스트리에 없다.`);
    else if (!st.id?.endsWith("-" + dom.key)) fail(at, `id 접미사가 domain key(${dom.key})와 다르다.`);

    /* --- 블록 구조 --- */
    const types = (st.blocks ?? []).map(b => b.type).join(",");
    if (types !== "text,stat,text,quote,text")
      fail(at, `블록 구성이 text,stat,text,quote,text가 아니다: ${types || "(없음)"}`);
    if (!st.blocks) continue;

    const [b0, b1, b2, b3, b4] = st.blocks;

    /* --- 분량 예산 --- */
    const L = s => (s ?? "").length;
    const chk = (name, v, key) => {
      const [rec, max] = BUDGET[key];
      if (L(v) > max) fail(at, `${name} ${L(v)}자 > 절대상한 ${max}자. A4 1페이지가 깨진다.`);
      else if (L(v) > rec) warn(at, `${name} ${L(v)}자 > 권장 ${rec}자.`);
    };
    chk("kicker", st.kicker, "kicker");
    chk("headline", st.headline, "headline");
    chk("teaser", st.teaser, "teaser");
    [b0, b2, b4].forEach((b, i) => chk(`text[${[0,2,4][i]}]`, b?.text, "text"));
    chk("quote", b3?.text, "quote");
    chk("insight.concept", b3?.insight?.concept, "concept");
    chk("insight.note", b3?.insight?.note, "note_");
    chk("stat.label", b1?.label, "statLabel");
    chk("stat.value", b1?.value, "statValue");
    chk("axisCaption", b1?.axisCaption, "axisCaption");

    /* --- 필수값 --- */
    for (const [k, v] of [["headline", st.headline], ["teaser", st.teaser],
                          ["stat.value", b1?.value], ["quote.text", b3?.text],
                          ["insight.concept", b3?.insight?.concept], ["insight.note", b3?.insight?.note]])
      if (!v) fail(at, `${k}이(가) 비었다.`);

    /* --- 문장 규칙 --- */
    if (st.headline) {
      if (!st.headline.endsWith(".")) warn(at, "헤드라인이 마침표로 끝나지 않는다.");
      if (/[?!]|\.\.\.|…/.test(st.headline)) fail(at, "헤드라인에 물음표·느낌표·말줄임표를 쓰지 않는다.");
      if (/\p{Extended_Pictographic}/u.test(st.headline)) fail(at, "헤드라인에 이모지를 쓰지 않는다.");
    }
    const prose = [b0?.text, b2?.text, b4?.text, st.teaser].join(" ");
    if (/<[A-Za-z]/.test(prose))
      fail(at, "본문에 <영문> 꺾쇠가 있다. HTML 태그로 파싱되어 사라진다. 〈 〉(U+3008/3009)를 쓴다.");
    if (/놀랍게도|무려|충격적/.test(prose)) warn(at, "금지 수식어(놀랍게도/무려/충격적)가 있다.");

    /* --- trend --- */
    const tr = b1?.trend ?? [];
    if (tr.length < 2) fail(at, "trend 값이 2개 미만이라 스파크라인을 그릴 수 없다.");
    else if (tr.length < BUDGET.trendPoints[0] || tr.length > BUDGET.trendPoints[1])
      warn(at, `trend ${tr.length}점 — ${BUDGET.trendPoints.join("~")}점 권장.`);
    if (tr.some(v => typeof v !== "number" || !isFinite(v))) fail(at, "trend에 숫자가 아닌 값이 있다.");

    /* --- 출처 등급 --- */
    const j = judge(b1?.sourceUrl);
    if (j.status === "empty")         fail(at, "stat.sourceUrl이 비었다.");
    else if (j.status === "invalid")  fail(at, `sourceUrl 형식 오류: ${b1.sourceUrl}`);
    else if (j.status === "blocked")  fail(at, `차단된 출처 — ${j.host}`);
    else if (j.status === "unlisted") fail(at, `미등록 출처 — ${j.host}. sources/whitelist.json에 먼저 등록한다.`);
    else if (!j.urlOk)                fail(at, `${j.name}은 ${j.status} 등급이라 sourceUrl로 쓸 수 없다.`);
    else if (j.status === "conditional") warn(at, `${j.name}은 조건부 출처다. 기사에 출처 기관이 명시됐는지 확인할 것.`);

    /* --- 시장 정합성 (market-scope.md §5) --- */
    const m = st.market ?? "KR";
    if (j.market && j.market !== m && j.status !== "blocked" && j.status !== "unlisted")
      fail(at, `시장 불일치 — 스토리는 ${m}인데 출처 ${j.name}는 ${j.market}다.`);

    /* --- 기준일 · 시간 순서 (오디세이 사고 방지) --- */
    if (!st.anchorDate) {
      fail(at, "anchorDate(기준일)가 없다. market-scope.md §4에서 도메인별 정의를 확인한다.");
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(st.anchorDate)) {
      fail(at, `anchorDate 형식이 YYYY-MM-DD가 아니다: ${st.anchorDate}`);
    } else if (st.range) {
      const [y, mo, dd] = st.range.split(" – ")[0].split(".").map(Number);
      const start = Date.UTC(y, mo - 1, dd);
      const anchor = Date.parse(st.anchorDate + "T00:00:00Z");
      const days = Math.round((start - anchor) / 86400000);
      if (days < 0)
        fail(at, `기준일(${st.anchorDate})이 집계 시작일(${st.range.split(" – ")[0]})보다 ${-days}일 늦다. ` +
                 `그 주에 사건이 아직 일어나지 않았다 — 존재할 수 없는 인용이다. market-scope.md §2`);
      else {
        const wk = Math.floor(days / 7) + 1;
        const claimed = (b1?.label ?? "").match(/(\d+)\s*주\s*차/);
        if (claimed && Number(claimed[1]) !== wk)
          fail(at, `stat.label이 "${claimed[1]}주 차"라고 주장하지만 기준일 기준으로는 ${wk}주 차다.`);
      }
    }
    if (!st.anchorSourceUrl) fail(at, "anchorSourceUrl(기준일 출처)이 없다. 날짜도 검증 대상이다.");
    else {
      const aj = judge(st.anchorSourceUrl);
      if (["blocked", "unlisted", "invalid"].includes(aj.status))
        fail(at, `기준일 출처가 ${aj.status} — ${aj.host ?? st.anchorSourceUrl}`);
      else if (aj.market && aj.market !== m)
        fail(at, `기준일을 ${aj.market} 출처(${aj.name})에서 가져왔는데 스토리는 ${m}이다.`);
    }

    /* --- 개념 반복 --- */
    const wk = st.id?.slice(0, 8);
    if (b3?.insight?.concept) conceptLog.push({ wk, concept: b3.insight.concept, at });
  }
}

/* --- 개념 4주 연속 사용 검사 --- */
draftMode = false;
head("insight.concept 반복");
const byConcept = {};
for (const c of conceptLog) (byConcept[c.concept] ??= []).push(c.wk);
let repeated = false;
for (const [concept, wks] of Object.entries(byConcept)) {
  const uniq = [...new Set(wks)].sort();
  if (uniq.length >= 4) { warn("concept", `"${concept}"이 ${uniq.length}개 회차에서 쓰였다: ${uniq.join(", ")}`); repeated = true; }
}
if (!repeated) ok(`개념 ${Object.keys(byConcept).length}종, 4주 연속 사용 없음`);

/* ══════════════ 결과 ══════════════ */
console.log();
const tail = [
  warns ? `경고 ${warns}건` : null,
  drafts ? `draft 미해결 ${drafts}건` : null,
].filter(Boolean).join(", ");
if (fails) {
  console.log(`${C.r}실패 ${fails}건${C.x}${tail ? `, ${tail}` : ""} — 발행할 수 없다. CLAUDE.md §7`);
  process.exit(1);
}
console.log(`${C.g}검증 통과${C.x}${tail ? ` (${tail})` : ""}`);

/**
 * 폰트·이미지 에셋.
 *
 * 프로토타입은 4.07MB의 base64를 매 페이지에 인라인해 캐시가 되지 않았다.
 * 여기서는 파일로 분리해 한 번 받아 전 페이지에서 재사용한다.
 *
 * 서브셋은 선택이다. subset-font가 없으면 원본을 그대로 복사하고 경고를 남긴다 —
 * node_modules 없이 클론한 사람도 빌드할 수 있어야 한다.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";

export const FONTS = [
  { file: "Paperlogy-400.ttf", family: "Paperlogy", weight: 400 },
  { file: "Paperlogy-700.ttf", family: "Paperlogy", weight: 700 },
  { file: "Paperlogy-900.ttf", family: "Paperlogy", weight: 900 },
  { file: "NanumMyeongjo.otf", family: "NanumMyeongjo", weight: 400 },
  { file: "NanumMyeongjoBold.otf", family: "NanumMyeongjo", weight: 700 },
];

/* ── sfnt cmap 파싱 — 폰트가 실제로 한글을 갖고 있는지 확인한다 ──
   Fonts/ 폴더의 NotoSerif-*.ttf 72종은 라틴 전용이라 한글이 0자다.
   실수로 들어오면 두부(tofu)가 렌더되므로 테스트가 이 함수로 막는다. */
export function cmapSet(buf) {
  const numTables = buf.readUInt16BE(4);
  let cmapOff = null;
  for (let i = 0; i < numTables; i++) {
    const p = 12 + i * 16;
    if (buf.toString("latin1", p, p + 4) === "cmap") cmapOff = buf.readUInt32BE(p + 8);
  }
  if (cmapOff == null) return new Set();

  const n = buf.readUInt16BE(cmapOff + 2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const p = cmapOff + 4 + i * 8;
    const off = cmapOff + buf.readUInt32BE(p + 4);
    const format = buf.readUInt16BE(off);
    if (format === 12) best = { off, format };
    else if (format === 4 && (!best || best.format !== 12)) best = { off, format };
  }
  if (!best) return new Set();

  const set = new Set();
  if (best.format === 4) {
    const segX2 = buf.readUInt16BE(best.off + 6);
    const seg = segX2 / 2;
    const endO = best.off + 14;
    const startO = endO + segX2 + 2;
    const deltaO = startO + segX2;
    const rangeO = deltaO + segX2;
    for (let s = 0; s < seg; s++) {
      const end = buf.readUInt16BE(endO + s * 2);
      const start = buf.readUInt16BE(startO + s * 2);
      const delta = buf.readInt16BE(deltaO + s * 2);
      const rangeOff = buf.readUInt16BE(rangeO + s * 2);
      if (start === 0xffff) continue;
      for (let c = start; c <= end && c !== 0x10000; c++) {
        let g;
        if (rangeOff === 0) g = (c + delta) & 0xffff;
        else {
          const gi = rangeO + s * 2 + rangeOff + (c - start) * 2;
          if (gi + 1 >= buf.length) continue;
          g = buf.readUInt16BE(gi);
          if (g) g = (g + delta) & 0xffff;
        }
        if (g) set.add(c);
      }
    }
  } else {
    const nGroups = buf.readUInt32BE(best.off + 12);
    for (let i = 0; i < nGroups; i++) {
      const p = best.off + 16 + i * 12;
      const start = buf.readUInt32BE(p);
      const end = buf.readUInt32BE(p + 4);
      for (let c = start; c <= end; c++) set.add(c);
    }
  }
  return set;
}

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

export function hangulCoverage(buf) {
  const set = cmapSet(buf);
  let n = 0;
  for (let c = HANGUL_START; c <= HANGUL_END; c++) if (set.has(c)) n++;
  return n;
}

/** Answer_Zine.html의 base64에서 Paperlogy를 꺼낸다. 한 번만 쓰는 마이그레이션 도구다. */
export function extractPaperlogy(htmlPath, outDir) {
  const html = readFileSync(htmlPath, "utf8");
  const re = /@font-face\s*\{[^}]*?font-weight:\s*(\d+)[^}]*?src:\s*url\(data:[^;]*;base64,([A-Za-z0-9+/=]+)\)/g;
  mkdirSync(outDir, { recursive: true });
  const written = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const file = join(outDir, `Paperlogy-${m[1]}.ttf`);
    writeFileSync(file, Buffer.from(m[2], "base64"));
    written.push(file);
  }
  return written;
}

/** 빌드 대상 문자 집합. 아카이브가 전 회차 헤드라인을 보여주므로 합집합을 쓴다. */
export function usedCharset(issues, extra = "") {
  const chars = new Set();
  const add = (s) => { for (const c of String(s ?? "")) chars.add(c); };
  for (const issue of issues) {
    add(issue.issue); add(issue.range); add(issue.notes);
    for (const st of issue.stories ?? []) {
      add(st.headline); add(st.teaser); add(st.kicker); add(st.domain); add(st.range); add(st.id);
      for (const p of st.zineBody ?? []) add(p);
      for (const b of st.blocks ?? []) {
        add(b.text); add(b.label); add(b.value); add(b.axisCaption); add(b.sourceLabel);
        add(b.insight?.concept); add(b.insight?.note);
      }
    }
  }
  add(extra);
  return chars;
}

/** UI에 하드코딩된 문자열. 서브셋에 반드시 들어가야 한다. */
export const UI_CHARS =
  "ANSWERZINE 순위말고팔린이유전체영화음악유튜브도서아카이브이번호지난인쇄용진장" +
  "행동경제학출처확인하기다음전회차없음보기카테고리는아직신호가없다작업중" +
  "서울대한민국년월주차데이터기반읽기코드사진자리위라도설명할수싶지않으면싣" +
  "7편그선명하면다니라것들중에서왜팔렸는설명있만골라한를든" +
  "PaperNight 0123456789.,%+-–()〈〉·—→↗:;/&#'\"!?…";

export function copyAssets(root, outDir, opts = {}) {
  const srcFonts = join(root, "assets/fonts");
  const dstFonts = join(outDir, "assets/fonts");
  mkdirSync(dstFonts, { recursive: true });

  const result = { fonts: [], images: [], subset: false, bytes: 0, warnings: [] };

  for (const f of FONTS) {
    const src = join(srcFonts, f.file);
    if (!existsSync(src)) { result.warnings.push(`폰트 없음: ${f.file}`); continue; }
    let buf = readFileSync(src);
    if (opts.subsetter && opts.charset) {
      try {
        buf = opts.subsetter(buf, opts.charset, f.file);
        result.subset = true;
      } catch (e) {
        result.warnings.push(`서브셋 실패(${f.file}) — 원본을 쓴다: ${e.message}`);
      }
    }
    writeFileSync(join(dstFonts, f.file), buf);
    result.fonts.push(f.file);
    result.bytes += buf.length;
  }

  const srcImg = join(root, "assets/img");
  const dstImg = join(outDir, "assets/img");
  mkdirSync(dstImg, { recursive: true });
  if (existsSync(srcImg)) {
    for (const f of readdirSync(srcImg)) {
      copyFileSync(join(srcImg, f), join(dstImg, f));
      result.images.push(f);
    }
  }
  return result;
}

export function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

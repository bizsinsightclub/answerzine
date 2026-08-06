#!/usr/bin/env node
/**
 * PNG 여백 자르기 — 의존성 없음 (node:zlib만 쓴다).
 *
 *   node tools/crop-png.mjs <입력.png> <출력.png> [여백px]
 *
 * 로고 원본은 2000×2000 정사각인데 아트가 세로 41%만 차지한다.
 * 그대로 쓰면 마스트헤드에서 실제 워드마크가 지정 높이의 절반도 안 나온다.
 * (프로토타입의 34×34 마스트헤드 로고가 사실상 안 보였던 이유다.)
 *
 * 배경은 네 모서리 픽셀의 최빈값으로 판정한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunks(buf) {
  const out = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    out.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** 필터를 풀어 raw RGBA 픽셀을 만든다. 컬러타입 2(RGB)·6(RGBA)만 지원한다. */
function decode(file) {
  const buf = readFileSync(file);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("PNG가 아니다");
  const cs = chunks(buf);
  const ihdr = cs.find((c) => c.type === "IHDR").data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colorType = ihdr[9];
  if (depth !== 8) throw new Error(`비트깊이 ${depth}은 지원하지 않는다`);
  if (colorType !== 2 && colorType !== 6) throw new Error(`컬러타입 ${colorType}은 지원하지 않는다`);
  const ch = colorType === 6 ? 4 : 3;

  const idat = inflateSync(Buffer.concat(cs.filter((c) => c.type === "IDAT").map((c) => c.data)));
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);

  let p = 0;
  for (let y = 0; y < height; y++) {
    const ft = idat[p++];
    const row = idat.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      const v = row[x];
      cur[x] = (ft === 0 ? v : ft === 1 ? v + a : ft === 2 ? v + b
              : ft === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 0xff;
    }
  }
  return { width, height, ch, pixels: out };
}

function encode({ width, height, ch, pixels }) {
  const stride = width * ch;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // 필터 None
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = ch === 4 ? 6 : 2;
  return Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 배경과 다른 픽셀의 경계 상자. 알파가 있으면 알파를, 없으면 색 거리를 본다. */
export function contentBox({ width, height, ch, pixels }, tol = 24) {
  const at = (x, y) => (y * width + x) * ch;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]
    .map(([x, y]) => pixels.subarray(at(x, y), at(x, y) + ch));
  const bg = corners[0];
  const bgAlpha = ch === 4 ? bg[3] : 255;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      let differs;
      if (ch === 4 && bgAlpha === 0) differs = pixels[i + 3] > 8;
      else {
        differs = Math.abs(pixels[i] - bg[0]) > tol
               || Math.abs(pixels[i + 1] - bg[1]) > tol
               || Math.abs(pixels[i + 2] - bg[2]) > tol
               || (ch === 4 && Math.abs(pixels[i + 3] - bgAlpha) > tol);
      }
      if (differs) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("내용을 찾지 못했다 — 전부 배경색이다");
  return { minX, minY, maxX, maxY };
}

export function crop(img, box, pad = 0) {
  const minX = Math.max(0, box.minX - pad);
  const minY = Math.max(0, box.minY - pad);
  const maxX = Math.min(img.width - 1, box.maxX + pad);
  const maxY = Math.min(img.height - 1, box.maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = Buffer.alloc(w * h * img.ch);
  for (let y = 0; y < h; y++) {
    const from = ((minY + y) * img.width + minX) * img.ch;
    img.pixels.copy(out, y * w * img.ch, from, from + w * img.ch);
  }
  return { width: w, height: h, ch: img.ch, pixels: out };
}

/**
 * 배경색을 투명으로 뺀다.
 *
 * 로고 원본은 배경이 불투명이라 크림 지면에는 흰 사각형이, 먹빛 배경에는
 * 회색 사각형이 그대로 얹힌다. 아트가 단색(흰색 또는 검정)이므로
 * 배경으로부터의 거리를 알파로 바꾸면 어느 배경에도 얹을 수 있다.
 */
export function matte(img) {
  const { width, height, ch, pixels } = img;
  const n = width * height;
  const bgA = ch === 4 ? pixels[3] : 255;

  // 이미 배경이 투명하면 알파만 살리고 아트 색을 단색으로 통일한다.
  if (ch === 4 && bgA === 0) {
    let ink = [0, 0, 0], bestA = -1;
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      if (pixels[p + 3] > bestA) { bestA = pixels[p + 3]; ink = [pixels[p], pixels[p + 1], pixels[p + 2]]; }
    }
    const out = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      out[i * 4] = ink[0]; out[i * 4 + 1] = ink[1]; out[i * 4 + 2] = ink[2];
      out[i * 4 + 3] = pixels[i * 4 + 3];
    }
    return { width, height, ch: 4, pixels: out, ink, note: "원본이 이미 투명" };
  }

  const bg = [pixels[0], pixels[1], pixels[2]];
  const dist = (p) =>
    Math.abs(pixels[p] - bg[0]) + Math.abs(pixels[p + 1] - bg[1]) + Math.abs(pixels[p + 2] - bg[2]);

  // 아트 색 = 배경에서 가장 먼 픽셀
  let ink = bg, far = 0;
  for (let i = 0; i < n; i++) {
    const d = dist(i * ch);
    if (d > far) { far = d; ink = [pixels[i * ch], pixels[i * ch + 1], pixels[i * ch + 2]]; }
  }
  if (!far) throw new Error("아트를 찾지 못했다 — 배경과 구별되는 픽셀이 없다");

  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const a = Math.min(255, Math.round((dist(i * ch) / far) * 255));
    out[i * 4] = ink[0]; out[i * 4 + 1] = ink[1]; out[i * 4 + 2] = ink[2];
    out[i * 4 + 3] = a;
  }
  return { width, height, ch: 4, pixels: out, ink };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const [src, dst, padArg] = args.filter((a) => !a.startsWith("--"));
  if (!src || !dst) {
    console.error("사용법: node tools/crop-png.mjs [--matte] [--no-crop] <입력.png> <출력.png> [여백px]");
    process.exit(1);
  }
  let img = decode(src);
  const before = `${img.width}×${img.height}`;
  let boxNote = "";
  if (!flags.has("--no-crop")) {
    const box = contentBox(img);
    img = crop(img, box, Number(padArg ?? 0));
    boxNote = `  (내용 x ${box.minX}~${box.maxX}, y ${box.minY}~${box.maxY})`;
  }
  let inkNote = "";
  if (flags.has("--matte")) {
    const m = matte(img);
    inkNote = `  배경 투명화, 아트 rgb(${m.ink.join(",")})`;
    img = m;
  }
  writeFileSync(dst, encode(img));
  console.log(`${src} ${before} → ${dst} ${img.width}×${img.height}${boxNote}${inkNote}`);
}

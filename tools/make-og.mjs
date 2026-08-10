#!/usr/bin/env node
/**
 * 링크 미리보기 이미지(OG 카드) 생성.
 *
 *   node tools/make-og.mjs
 *
 * 카카오톡·슬랙·X에 주소를 붙였을 때 뜨는 그 그림이다.
 * 결과물 `assets/img/og.png`는 **저장소에 커밋한다** — 빌드가 Playwright에 의존하면
 * `npm install` 없이 빌드가 성공한다는 성질(CLAUDE.md §2.2)이 깨지기 때문이다.
 * 로고나 슬로건이 바뀌었을 때만 이 스크립트를 다시 돌린다.
 *
 * 왜 SVG가 아닌가: 카카오톡·페이스북 등 다수의 스크래퍼가 `og:image`로 SVG를 받지 않는다.
 * 미리보기는 "대부분의 클라이언트에서 뜨는가"가 전부라 PNG로 굽는다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { THEME } from "../build/lib/theme.mjs";
import { SITE } from "../build/lib/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** OG 카드 표준 규격. 1.91:1 — 페이스북·X·카카오톡이 공통으로 이 비율을 자른다. */
export const OG = { width: 1200, height: 630, file: "assets/img/og.png" };

/** 2026-08-10 — 인트로가 흰 배경으로 바뀌면서 OG 카드도 같은 톤(THEME)을 쓴다.
    예전엔 인트로 전용 고정 다크 팔레트(INTRO_THEME)를 따로 썼지만 이제 그런 예외가
    없다. 링크를 누르기 전과 후가 같은 톤이어야 한다는 원칙은 그대로다. */
export function ogHTML({ logoDataUri }) {
  const t = THEME;
  return `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${OG.width}px; height: ${OG.height}px;
    background: ${t.bg}; color: ${t.ink};
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  }
  .card { text-align: center; }
  .logo { width: 660px; height: auto; display: block; margin: 0 auto; }
  .rule {
    border-top: 6px solid ${t.rule}; border-bottom: 2px solid ${t.rule};
    height: 10px; width: 660px; margin: 34px auto 0;
  }
  .tagline {
    margin: 26px 0 0; font-size: 30px; font-weight: 700;
    letter-spacing: .16em; color: ${t.secondary};
  }
</style>
<div class="card">
  <img class="logo" src="${logoDataUri}" alt="">
  <div class="rule"></div>
  <p class="tagline">${SITE.tagline}</p>
</div>`;
}

export async function makeOG({ root = ROOT } = {}) {
  const logoPath = join(root, "assets/img/logo-dark.png");
  if (!existsSync(logoPath)) throw new Error(`로고가 없다: ${logoPath}`);
  const logoDataUri = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;

  const { chromium } = await import("playwright");
  // 환경에 이미 깔린 크로미움을 쓰고 싶을 때(CI 캐시·오프라인) 경로를 지정할 수 있다.
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: OG.width, height: OG.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(ogHTML({ logoDataUri }), { waitUntil: "load" });
    const buf = await page.screenshot({ type: "png" });
    const out = join(root, OG.file);
    writeFileSync(out, buf);
    return { out, bytes: buf.length };
  } finally {
    await browser.close();
  }
}

if (import.meta.url.startsWith("file:") && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const r = await makeOG();
    console.log(`\n  ${OG.width}×${OG.height} · ${(r.bytes / 1024).toFixed(0)}KB → ${OG.file}\n`);
  } catch (e) {
    console.error(`\n  ✕ ${e.message}`);
    console.error("    playwright가 필요하다: npm install && npx playwright install chromium\n");
    process.exit(1);
  }
}

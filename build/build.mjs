#!/usr/bin/env node
/**
 * ANSWER ZINE 빌드.
 *
 *   node build/build.mjs            dist/ 생성
 *   node build/build.mjs --serve    생성 후 로컬 미리보기
 *
 * issues/*.json이 유일한 정본이다. 웹·인쇄·메타데이터가 전부 여기서 나온다.
 * CLAUDE.md §9.3(정본 이중화)과 §9.4(라우팅 부재)는 이 구조에서 발생할 수 없다.
 */
import { readFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { loadIssues, loadRegistry, allStories, neighbors } from "./lib/data.mjs";
import { stylesheet } from "./lib/css.mjs";
import { page } from "./lib/layout.mjs";
import { renderStory } from "./lib/render-story.mjs";
import { renderIndex, renderIssue } from "./lib/render-index.mjs";
import { renderZinePreview } from "./lib/render-zine.mjs";
import { copyAssets, usedCharset, UI_CHARS, writeFile } from "./lib/assets.mjs";
import { setBase, getBase, u } from "./lib/site.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" fill="#16150F"/>
<rect x="5" y="8" width="22" height="3" fill="#F2EFE4"/>
<rect x="5" y="13" width="22" height="1" fill="#F2EFE4"/>
<rect x="5" y="18" width="14" height="2" fill="#F2EFE4"/>
<rect x="5" y="22" width="18" height="2" fill="#F2EFE4"/>
</svg>
`;

/** QR은 외부 의존 없이 만들 수 없으므로 URL을 읽을 수 있게 적은 플레이스홀더를 둔다. */
function qrPlaceholder(issueId) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
<rect width="60" height="60" fill="#fff"/>
<rect x="4" y="4" width="14" height="14" fill="none" stroke="#000" stroke-width="3"/>
<rect x="42" y="4" width="14" height="14" fill="none" stroke="#000" stroke-width="3"/>
<rect x="4" y="42" width="14" height="14" fill="none" stroke="#000" stroke-width="3"/>
<text x="30" y="34" font-size="5" text-anchor="middle" font-family="monospace">${issueId}</text>
<text x="30" y="40" font-size="3.4" text-anchor="middle" font-family="monospace">answerzine.kr</text>
</svg>
`;
}

async function loadSubsetter() {
  try {
    const mod = await import("subset-font");
    const subsetFont = mod.default ?? mod;
    return async (buf, charset, file) =>
      await subsetFont(buf, [...charset].join(""), {
        targetFormat: extname(file) === ".otf" ? "sfnt" : "sfnt",
      });
  } catch {
    return null;
  }
}

export async function build({ root = ROOT, out = join(ROOT, "dist"), quiet = false, base = process.env.BASE_PATH ?? "" } = {}) {
  const log = (...a) => { if (!quiet) console.log(...a); };
  const warnings = [];
  const files = [];

  // GitHub Pages 프로젝트 사이트는 /<저장소명>/ 하위에 놓인다.
  // 모든 내부 링크가 이 값을 앞에 달고 나간다.
  setBase(base);

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const registry = loadRegistry(root);
  const issues = loadIssues(root);
  const stories = allStories(issues, registry);

  const write = (rel, content) => { writeFile(join(out, rel), content); files.push(rel); };

  /* ── 스타일·스크립트·파비콘 ── */
  write("assets/style.css", stylesheet(registry.domains));
  write("assets/app.js", readFileSync(join(root, "assets/app.js"), "utf8"));
  write("assets/img/favicon.svg", FAVICON);

  /* ── 아카이브 인덱스 ── */
  const idx = renderIndex(issues, stories, registry);
  write("index.html", page({ ...idx, url: "/" }));

  /* ── 회차·스토리·인쇄 진 ── */
  for (const issue of issues) {
    const mine = stories.filter((s) => s.issue.issue === issue.issue);

    const iss = renderIssue(issue, stories, registry, issues);
    write(`${issue.issue}/index.html`, page({ ...iss, url: `/${issue.issue}/` }));

    const zine = renderZinePreview(issue, mine, registry);
    write(`${issue.issue}/print/index.html`, page({ ...zine, url: `/${issue.issue}/print/`, showChrome: false }));
    for (const w of zine.warnings) warnings.push(`${issue.issue}: ${w}`);

    write(`assets/img/qr-${issue.issue}.svg`, qrPlaceholder(issue.issue));

    for (const s of mine) {
      const st = renderStory(s, neighbors(stories, s.id));
      write(`${issue.issue}/${s.slug}/index.html`, page({ ...st, url: s.url }));
    }
  }

  /* ── 404 ── */
  write("404.html", page({
    title: "찾는 페이지가 없다",
    description: "요청한 주소에 해당하는 회차가 없다.",
    url: "/404.html",
    noindex: true,
    content: `<main class="shell"><h1>찾는 페이지가 없다.</h1>
<p class="teaser">주소를 다시 확인하거나 전체 아카이브로 돌아간다.</p>
<p><a class="btn" href="${u("/")}">전체 아카이브</a></p></main>`,
  }));

  /* ── 폰트 ── */
  const subsetter = await loadSubsetter();
  const charset = usedCharset(issues, UI_CHARS);
  const { FONTS } = await import("./lib/assets.mjs");

  // 폰트가 없으면 폴백 서체로 렌더된 사이트가 조용히 나간다.
  // 서브셋 도구가 없는 것(선택)과 폰트 파일이 없는 것(치명)은 다르다.
  const missing = FONTS.filter((f) => !existsSync(join(root, "assets/fonts", f.file)));
  if (missing.length) {
    throw new Error(
      `필수 폰트가 없다: ${missing.map((f) => f.file).join(", ")}\n` +
      `  assets/fonts/에 있어야 한다. design.md §3 참조.`
    );
  }

  let assetResult;
  if (subsetter) {
    assetResult = { fonts: [], images: [], subset: true, bytes: 0, warnings: [] };
    for (const f of FONTS) {
      const src = join(root, "assets/fonts", f.file);
      const orig = readFileSync(src);
      let buf = orig;
      try {
        buf = await subsetter(orig, charset, f.file);
      } catch (e) {
        assetResult.warnings.push(`서브셋 실패(${f.file}) — 원본을 쓴다: ${e.message}`);
        buf = orig;
      }
      writeFile(join(out, "assets/fonts", f.file), buf);
      assetResult.fonts.push(f.file);
      assetResult.bytes += buf.length;
    }
    // 이미지는 공용 경로로 복사
    const imgDir = join(root, "assets/img");
    if (existsSync(imgDir)) {
      for (const f of readdirSync(imgDir))
        writeFile(join(out, "assets/img", f), readFileSync(join(imgDir, f)));
    }
  } else {
    assetResult = copyAssets(root, out);
    warnings.push("subset-font가 없어 원본 폰트를 그대로 복사했다. `npm install`로 설치하면 전송량이 크게 줄어든다.");
  }
  warnings.push(...assetResult.warnings);

  log(`\n  회차 ${issues.length}개 · 스토리 ${stories.length}편 · 파일 ${files.length}개`);
  if (getBase()) log(`  기본 경로 ${getBase()}`);
  log(`  폰트 ${assetResult.fonts.length}벌 ${(assetResult.bytes / 1048576).toFixed(2)}MB` +
      (assetResult.subset ? ` (서브셋 ${charset.size}자)` : " (원본)"));
  for (const w of warnings) log(`  ! ${w}`);
  log(`  → ${out}\n`);

  return { files, warnings, issues, stories, charset, out };
}

/* ── 로컬 미리보기 ── */
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff2": "font/woff2",
  ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json; charset=utf-8",
};

function serve(dir, port = 8080, base = "") {
  createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    // 기본 경로로 빌드했다면 로컬 서버도 같은 접두사를 벗겨야 실제 배포와 같아진다.
    if (base && p.startsWith(base)) p = p.slice(base.length) || "/";
    let file = join(dir, p);
    try {
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file)) file = join(dir, "404.html");
      res.writeHead(existsSync(file) ? 200 : 404, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(500).end(String(e.message));
    }
  }).listen(port, "127.0.0.1", () => console.log(`  미리보기: http://127.0.0.1:${port}${base}/\n`));
}

if (import.meta.url.startsWith("file:") && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = await build();
  if (process.argv.includes("--serve")) serve(r.out, Number(process.env.PORT ?? 8080), getBase());
}

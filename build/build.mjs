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
import { readFileSync, existsSync, rmSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { loadIssues, loadRegistry, allStories, neighbors, latestByDomain, visibleDomains } from "./lib/data.mjs";
import { stylesheet } from "./lib/css.mjs";
import { page } from "./lib/layout.mjs";
import { renderStory } from "./lib/render-story.mjs";
import { renderIndex } from "./lib/render-index.mjs";
import { renderArchive } from "./lib/render-archive.mjs";
import { renderZinePreview } from "./lib/render-zine.mjs";
import { copyAssets, writeFile } from "./lib/assets.mjs";
import { setBase, getBase, u, absolute } from "./lib/site.mjs";

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

/** qrcode가 없을 때만 쓰는 자리표시자 — URL을 읽을 수 있게 적어만 둔다. */
function qrPlaceholder(issueId) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60">
<rect width="60" height="60" fill="#fff"/>
<rect x="4" y="4" width="14" height="14" fill="none" stroke="#000" stroke-width="3"/>
<rect x="42" y="4" width="14" height="14" fill="none" stroke="#000" stroke-width="3"/>
<rect x="4" y="42" width="14" height="14" fill="none" stroke="#000" stroke-width="3"/>
<text x="30" y="34" font-size="5" text-anchor="middle" font-family="monospace">${issueId}</text>
<text x="30" y="40" font-size="3" text-anchor="middle" font-family="monospace">플레이스홀더</text>
</svg>
`;
}

/**
 * 실제로 스캔되는 QR. 2026-08-07 사용자 승인으로 qrcode를 devDependency에 추가했다
 * (§7.3) — 종이로 나가는 코드가 자리표시자면 안 된다는 이유였다.
 * `npm install` 없이도 빌드는 성공해야 하므로(§2.2) 없으면 조용히 플레이스홀더로 접는다.
 */
async function loadQR() {
  try {
    const mod = await import("qrcode");
    const QRCode = mod.default ?? mod;
    return async (text) => QRCode.toString(text, { type: "svg", margin: 1 });
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

  // 마스트헤드 상단 내비 — 홈 카테고리 카드와 같은 목록·같은 "최신 스토리" 계산을 쓴다
  // (data.mjs의 visibleDomains/latestByDomain). 한 번 계산해 모든 페이지에 그대로 물린다.
  const categoryNav = visibleDomains(registry).map((d) => ({
    name: d.nameEn ?? d.name,
    href: latestByDomain(stories, d.key)?.url ?? null,
  }));

  const write = (rel, content) => { writeFile(join(out, rel), content); files.push(rel); };
  const genQR = await loadQR();
  if (!genQR) warnings.push("qrcode가 없어 QR을 플레이스홀더로 남겼다. `npm install`로 설치하면 실제 스캔되는 코드가 나온다.");

  /* ── 스타일·스크립트·파비콘 ── */
  write("assets/style.css", stylesheet(registry.domains));
  write("assets/app.js", readFileSync(join(root, "assets/app.js"), "utf8"));
  write("assets/img/favicon.svg", FAVICON);

  /* ── 아카이브 인덱스 ── */
  const idx = renderIndex(issues, stories, registry);
  write("index.html", page({ ...idx, url: "/", categoryNav }));

  /* ── 전체 아카이브 — 홈의 "전체 아카이브 보기" CTA가 여기로 온다 ── */
  const archive = renderArchive(stories);
  write("archive/index.html", page({ ...archive, url: "/archive/", categoryNav }));

  /* ── 회차·스토리·인쇄 진 ──
     2026-08-08부터 회차 목록 페이지(/YYYY-wNN/)는 만들지 않는다 — 홈 아카이브가 이미
     모든 스토리를 평면으로 낸다. 인쇄 진(/YYYY-wNN/print/)은 독립적으로 그대로 만든다. */
  for (const issue of issues) {
    const mine = stories.filter((s) => s.issue.issue === issue.issue);

    const zine = renderZinePreview(issue, mine, registry);
    write(`${issue.issue}/print/index.html`, page({ ...zine, url: `/${issue.issue}/print/`, showChrome: false }));
    for (const w of zine.warnings) warnings.push(`${issue.issue}: ${w}`);

    // QR은 홈 아카이브를 가리킨다 — 회차 목록 페이지가 없어졌으므로(2026-08-08) 그 자리를
    // 대신할 목적지는 사이트 전체다. SITE_ORIGIN·BASE_PATH로 계산한 절대 URL이라
    // 로컬 빌드(answerzine.kr 기본값)와 CI 배포(bizsinsightclub.github.io/answerzine)가 각자 맞는 값을 낸다.
    const qrTarget = absolute("/");
    write(`assets/img/qr-${issue.issue}.svg`, genQR ? await genQR(qrTarget) : qrPlaceholder(issue.issue));

    for (const s of mine) {
      const st = renderStory(s, neighbors(stories, s.id));
      write(`${issue.issue}/${s.slug}/index.html`, page({ ...st, url: s.url, categoryNav }));
    }
  }

  /* ── 404 ── */
  write("404.html", page({
    title: "찾는 페이지가 없다",
    description: "요청한 주소에 해당하는 회차가 없다.",
    url: "/404.html",
    noindex: true,
    categoryNav,
    content: `<main class="shell"><h1>찾는 페이지가 없다.</h1>
<p class="teaser">주소를 다시 확인하거나 전체 아카이브로 돌아간다.</p>
<p><a class="btn" href="${u("/")}">전체 아카이브</a></p></main>`,
  }));

  /* ── 이미지 ──
     2026-08-10부터 자체 호스팅 폰트가 없다 — 헬베티카는 시스템 폰트라 다운로드도
     서브셋도 필요 없다. copyAssets는 이제 assets/img/*만 dist로 복사한다. */
  const assetResult = copyAssets(root, out);
  warnings.push(...assetResult.warnings);

  log(`\n  회차 ${issues.length}개 · 스토리 ${stories.length}편 · 파일 ${files.length}개`);
  if (getBase()) log(`  기본 경로 ${getBase()}`);
  log(`  이미지 ${assetResult.images.length}개`);
  for (const w of warnings) log(`  ! ${w}`);
  log(`  → ${out}\n`);

  return { files, warnings, issues, stories, out };
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

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
import { renderAbout } from "./lib/render-about.mjs";
import { renderZinePreview } from "./lib/render-zine.mjs";
import { renderZinebook } from "./lib/render-zinebook.mjs";
import { copyAssets, writeFile } from "./lib/assets.mjs";
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

  /* 하단 CTA → DIY 진 미리보기/인쇄.
   *
   * 2026-08-11 되돌림 — 예전엔 "최신 회차(issue) 안의 스토리"만 썼다. 그런데 활성
   * 도메인이 4개뿐이고 그 주 결번이 흔해진 지금(§5), 최신 회차 파일 하나에는 보통
   * 1~2편만 있다 — 나머지 자리가 "결번" 플레이스홀더로 비어, 홈에는 4장이 다 떠 있는데
   * 진에는 절반이 빈 채로 나가는 모순이 생겼다. categoryNav와 똑같은 계산
   * (visibleDomains + latestByDomain, data.mjs) — "홈 카드 그리드에 지금 뜨는 것"을
   * 그대로 쓴다. 도메인이 결번이라도 지난 회차 스토리가 있으면 그걸 쓰고(카드와 동일),
   * 한 번도 발행된 적 없는 도메인만 진짜 결번 플레이스홀더로 남는다.
   */
  // 2026-08-12 스무 번째 라운드 — 7쪽이 QR/스캔 안내에서 통합 인사이트(issue.insight
  // + issue.insightNote)로 바뀌면서(사용자 요청, "page 7 삭제하고 UNEXPECTED & 오른쪽
  // 문단을 page 7에 넣어줘") QR 생성 자체가 필요 없어졌다 — loadQR()/qrSvg 전체를
  // 뺐다(qrcode devDependency도 package.json에서 제거). render-zinebook.mjs의
  // insightPanel() 참고.
  const latestIssue = issues[0] ?? null;
  const zineStories = visibleDomains(registry)
    .map((d) => latestByDomain(stories, d.key))
    .filter(Boolean);
  const zinebook = renderZinebook({ issue: latestIssue, stories: zineStories });

  const write = (rel, content) => { writeFile(join(out, rel), content); files.push(rel); };

  /* ── 스타일·스크립트·파비콘 ── */
  write("assets/style.css", stylesheet(registry.domains));
  write("assets/app.js", readFileSync(join(root, "assets/app.js"), "utf8"));
  write("assets/zinebook.js", readFileSync(join(root, "assets/zinebook.js"), "utf8"));
  write("assets/img/favicon.svg", FAVICON);

  /* ── 아카이브 인덱스 ── */
  const idx = renderIndex(issues, stories, registry);
  write("index.html", page({ ...idx, url: "/", categoryNav, zinebook }));

  /* ── 전체 아카이브 — 홈의 "전체 아카이브 보기" CTA가 여기로 온다 ── */
  const archive = renderArchive(stories);
  write("archive/index.html", page({ ...archive, url: "/archive/", categoryNav, zinebook }));

  /* ── About — 마스트헤드 상단 내비 맨 앞 링크 ── */
  const about = renderAbout();
  write("about/index.html", page({ ...about, url: "/about/", categoryNav, zinebook }));

  /* ── 회차·스토리·인쇄 진 ──
     2026-08-08부터 회차 목록 페이지(/YYYY-wNN/)는 만들지 않는다 — 홈 아카이브가 이미
     모든 스토리를 평면으로 낸다. 인쇄 진(/YYYY-wNN/print/)은 독립적으로 그대로 만든다. */
  for (const issue of issues) {
    const mine = stories.filter((s) => s.issue.issue === issue.issue);

    const zine = renderZinePreview(issue, mine, registry);
    write(`${issue.issue}/print/index.html`, page({ ...zine, url: `/${issue.issue}/print/`, showChrome: false }));
    for (const w of zine.warnings) warnings.push(`${issue.issue}: ${w}`);

    for (const s of mine) {
      const st = renderStory(s, neighbors(stories, s.id));
      write(`${issue.issue}/${s.slug}/index.html`, page({ ...st, url: s.url, categoryNav, zinebook }));
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

#!/usr/bin/env node
/**
 * 배포 — gh-pages 브랜치에 빌드 산출물을 올린다.
 *
 *   node tools/deploy.mjs          빌드 → gh-pages 강제 푸시
 *   node tools/deploy.mjs --dry    빌드까지만 하고 푸시하지 않는다
 *
 * GitHub Actions에 의존하지 않는다. 2026-08-06에 Actions 액션 다운로드 서비스가
 * 장애를 일으켜(`Failed to resolve action download info`) 발행이 막힌 적이 있다.
 * 주 1회 발행하는 매체가 남의 인프라 장애로 못 나가면 안 된다.
 *
 * Pages 설정은 `build_type=legacy`, `source.branch=gh-pages`, `source.path=/`다.
 */
import { execSync } from "node:child_process";
import { rmSync, cpSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGE = join(ROOT, ".deploy");
const DIST = join(ROOT, "dist");

const REPO = "https://github.com/bizsinsightclub/answerzine.git";
const BASE_PATH = process.env.BASE_PATH ?? "answerzine";
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://bizsinsightclub.github.io";

const run = (cmd, cwd = ROOT) =>
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, BASE_PATH, SITE_ORIGIN } });
const quiet = (cmd, cwd = ROOT) =>
  execSync(cmd, { cwd, encoding: "utf8", env: { ...process.env, BASE_PATH, SITE_ORIGIN } }).trim();

const dry = process.argv.includes("--dry");

console.log("\n── 1. 검증 ──────────────────────────────────────");
// 글롭을 셸에 맡기지 않는다. 윈도우 cmd.exe는 확장하지 않아 파일이 0개가 되고,
// node --test는 그걸 "테스트 없음"이 아니라 모듈 못 찾음으로 처리해 조용히 실패한다.
const testFiles = readdirSync(join(ROOT, "test"))
  .filter((f) => f.endsWith(".test.mjs"))
  .map((f) => `test/${f}`);
if (!testFiles.length) throw new Error("test/에 테스트 파일이 없다.");
run(`node --test ${testFiles.join(" ")}`);
run("node tools/qa.mjs");

console.log("\n── 2. 빌드 (배포 조건) ───────────────────────────");
run("node build/build.mjs");

console.log("\n── 3. 산출물 검증 ────────────────────────────────");
run("node build/verify.mjs");

console.log("\n── 4. 운영 도구 동봉 ─────────────────────────────");
// 대시보드·제작기는 저장소 JSON을 읽으므로 함께 올린다.
mkdirSync(join(DIST, "tools"), { recursive: true });
for (const f of ["dashboard.html", "zine-builder.html"])
  cpSync(join(ROOT, "tools", f), join(DIST, "tools", f));
for (const d of ["domains", "sources", "issues", "runs"])
  cpSync(join(ROOT, d), join(DIST, d), { recursive: true });
writeFileSync(join(DIST, ".nojekyll"), "");
console.log("  tools/ · domains/ · sources/ · issues/ · runs/ 동봉");

const sha = quiet("git rev-parse --short HEAD");
const dirty = quiet("git status --porcelain");
if (dirty) console.log(`\n  ⚠ 커밋되지 않은 변경이 있다. 배포는 main의 ${sha}가 아니라 지금 작업트리 기준이다.`);

console.log("\n── 5. gh-pages 푸시 ─────────────────────────────");
rmSync(STAGE, { recursive: true, force: true });
cpSync(DIST, STAGE, { recursive: true });

quiet("git init -q", STAGE);
quiet("git checkout -q -b gh-pages", STAGE);
quiet("git add -A", STAGE);
quiet(
  `git -c user.name="answerzine deploy" -c user.email="noreply@answerzine.kr" ` +
  `commit -q -m "deploy: ${sha}${dirty ? " (dirty)" : ""}"`,
  STAGE,
);

if (dry) {
  console.log(`  --dry — 푸시하지 않았다. 산출물은 ${STAGE}에 있다.`);
} else {
  run(`git push --force ${REPO} gh-pages:gh-pages`, STAGE);
  rmSync(STAGE, { recursive: true, force: true });
  console.log(`\n  https://bizsinsightclub.github.io/${BASE_PATH}/`);
  console.log("  Pages 반영에 1~2분 걸린다. 안 바뀌면:");
  console.log("    gh api repos/bizsinsightclub/answerzine/pages/builds -X POST\n");
}

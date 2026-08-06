#!/usr/bin/env node
/**
 * 테스트 러너.
 *
 *   node tools/test.mjs
 *
 * `node --test test/*.test.mjs`를 그대로 쓰지 않는 이유:
 * 윈도우 cmd.exe는 글롭을 확장하지 않아 node가 `test/*.test.mjs`를 파일명으로 받는다.
 * 그러면 "테스트 0건 통과"가 아니라 MODULE_NOT_FOUND로 죽는데, 로그만 보면
 * 테스트가 깨진 것처럼 보인다. 실제로 배포 스크립트에서 이 함정을 밟았다.
 *
 * `node --test test/`(디렉터리)도 이 Node 버전에서는 동작하지 않는다.
 * 파일을 직접 나열하는 방식만 리눅스·윈도우 양쪽에서 동일하게 돈다.
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(ROOT, "test");

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => `test/${f}`);

if (!files.length) {
  console.error("test/에 *.test.mjs가 없다.");
  process.exit(1);
}

try {
  execFileSync(process.execPath, ["--test", ...files, ...process.argv.slice(2)], {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch (e) {
  process.exit(e.status ?? 1);
}

/**
 * 이미지 에셋 복사 — assets/img/ 하위 폴더 지원.
 *
 * 2026-08-13 — assets/img/covers/(카드 호버 사진) 폴더가 생기면서 copyAssets()의
 * 평면 readdirSync + copyFileSync 조합이 EISDIR로 빌드를 통째로 죽였다. 재귀
 * 복사로 고쳤다 — 이 테스트가 그 회귀를 잡는다(하위 폴더가 있어도 안 죽는지 +
 * 실제로 복사되는지 둘 다 확인한다).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyAssets } from "../build/lib/assets.mjs";

test("assets/img 하위 폴더가 있어도 EISDIR 없이 재귀 복사된다", () => {
  const root = mkdtempSync(join(tmpdir(), "az-assets-"));
  const out = mkdtempSync(join(tmpdir(), "az-out-"));
  try {
    const imgDir = join(root, "assets/img");
    mkdirSync(join(imgDir, "covers"), { recursive: true });
    writeFileSync(join(imgDir, "favicon.svg"), "<svg></svg>");
    writeFileSync(join(imgDir, "covers", "movie.jpg"), "fake-jpg-bytes");

    const result = copyAssets(root, out);

    assert.equal(result.images.length, 2, "평면 파일 + 하위 폴더 파일 합쳐 2개여야 한다");
    assert.ok(existsSync(join(out, "assets/img/favicon.svg")), "평면 파일이 복사돼야 한다");
    assert.ok(existsSync(join(out, "assets/img/covers/movie.jpg")), "하위 폴더 파일이 복사돼야 한다");
    assert.equal(
      readFileSync(join(out, "assets/img/covers/movie.jpg"), "utf8"),
      "fake-jpg-bytes",
      "내용까지 그대로 복사돼야 한다",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test("assets/img가 없으면 빈 dist/assets/img만 만들고 조용히 끝난다", () => {
  const root = mkdtempSync(join(tmpdir(), "az-assets-empty-"));
  const out = mkdtempSync(join(tmpdir(), "az-out-empty-"));
  try {
    const result = copyAssets(root, out);
    assert.equal(result.images.length, 0);
    assert.ok(existsSync(join(out, "assets/img")));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

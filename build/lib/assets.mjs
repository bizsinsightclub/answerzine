/**
 * 이미지 에셋.
 *
 * 프로토타입은 4.07MB의 base64를 매 페이지에 인라인해 캐시가 되지 않았다.
 * 여기서는 파일로 분리해 한 번 받아 전 페이지에서 재사용한다.
 *
 * 2026-08-10부터 자체 호스팅 폰트(Paperlogy·나눔명조)를 걷어내고 시스템 헬베티카
 * 스택으로 바꿨다 — 폰트 서브셋·cmap 커버리지 검사·다운로드가 전부 없어졌다.
 * 이 파일은 이제 이미지만 복사한다.
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

export function copyAssets(root, outDir) {
  const result = { images: [], bytes: 0, warnings: [] };

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

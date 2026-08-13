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
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";

/* 2026-08-13 — assets/img/covers/(카드 호버 사진, design.md "카드 호버" 절) 폴더가
   생기면서 readdirSync 한 겹짜리 평면 복사가 EISDIR로 죽었다 — 하위 폴더를 파일처럼
   copyFileSync에 넘기면 그렇게 된다. 재귀로 바꿔 하위 폴더가 몇 겹이든 그대로
   복사되게 한다. README.md처럼 이미지가 아닌 파일도 함께 복사된다 — dist/에 안
   나갔으면 하는 문서면 여기서 확장자로 거를 수 있지만, 지금은 그럴 이유가 없다
   (README 하나 더 나가는 게 해가 없다). */
function copyDir(src, dst, srcRoot, result) {
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) {
    const s = join(src, f);
    const d = join(dst, f);
    if (statSync(s).isDirectory()) {
      copyDir(s, d, srcRoot, result);
    } else {
      copyFileSync(s, d);
      result.images.push(relative(srcRoot, s));
    }
  }
}

export function copyAssets(root, outDir) {
  const result = { images: [], bytes: 0, warnings: [] };

  const srcImg = join(root, "assets/img");
  const dstImg = join(outDir, "assets/img");
  if (existsSync(srcImg)) {
    copyDir(srcImg, dstImg, srcImg, result);
  } else {
    mkdirSync(dstImg, { recursive: true });
  }
  return result;
}

export function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

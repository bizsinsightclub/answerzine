/**
 * 링크 미리보기(OG 카드).
 *
 * 카카오톡·슬랙·X는 우리 페이지 **밖에서** 이 태그들을 읽는다. 그래서 여기서 틀리면
 * 사이트는 멀쩡한데 링크만 맨몸으로 뜬다 — 화면을 봐서는 절대 발견되지 않는 종류의 결함이다.
 * 실제로 이전에는 `twitter:card`를 선언해 놓고 이미지가 없었다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { page } from "../build/lib/layout.mjs";
import { setBase } from "../build/lib/site.mjs";
import { OG } from "../tools/make-og.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const render = (url = "/2026-w31/ott/") =>
  page({ title: "제목", description: "설명", url, content: "<main>본문</main>" });

test("모든 페이지가 og:image를 낸다", () => {
  assert.match(render(), /<meta property="og:image" content="[^"]+"/);
  assert.match(render("/"), /<meta property="og:image" content="[^"]+"/);
});

test("og:image가 절대 URL이다 — 상대 경로면 스크래퍼가 못 가져간다", () => {
  const html = render();
  const src = /<meta property="og:image" content="([^"]+)"/.exec(html)[1];
  assert.ok(src.startsWith("https://"), `절대 URL이 아니다: ${src}`);
});

test("하위 경로 배포에서도 og:image가 저장소 접두사를 포함한다", () => {
  // GitHub Pages 프로젝트 사이트는 /<저장소명>/ 아래에 놓인다.
  // 접두사가 빠지면 이미지 404가 나고 미리보기가 빈 채로 뜬다.
  setBase("/answerzine");
  try {
    const src = /<meta property="og:image" content="([^"]+)"/.exec(render())[1];
    assert.ok(src.includes("/answerzine/assets/img/og.png"), src);
  } finally {
    setBase("");
  }
});

test("summary_large_image를 선언했으면 twitter:image가 함께 있다", () => {
  const html = render();
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/[^"]+"/);
});

test("og:image의 크기 선언이 실제 규격과 같다", () => {
  const html = render();
  assert.match(html, new RegExp(`og:image:width" content="${OG.width}"`));
  assert.match(html, new RegExp(`og:image:height" content="${OG.height}"`));
  // 1.91:1은 페이스북·X·카카오톡이 공통으로 자르는 비율이다.
  assert.ok(Math.abs(OG.width / OG.height - 1.91) < 0.02, `비율이 1.91:1이 아니다`);
});

test("커밋된 og.png가 실제로 있다 — 빌드는 이 파일을 만들지 않는다", () => {
  // 이미지 생성은 Playwright가 필요하지만 빌드는 npm install 없이도 성공해야 한다.
  // 그래서 결과물을 저장소에 커밋한다. 파일이 사라지면 미리보기가 통째로 죽는다.
  assert.ok(existsSync(join(ROOT, OG.file)), `${OG.file}이 없다. node tools/make-og.mjs로 굽는다.`);
});

test("인쇄 페이지에도 미리보기 태그가 붙는다", () => {
  // showChrome:false여도 <head>는 같아야 한다. 진 주소를 공유하는 경우가 있다.
  const html = page({
    title: "인쇄", description: "설명", url: "/2026-w31/print/",
    content: "<main>지면</main>", showChrome: false,
  });
  assert.match(html, /<meta property="og:image"/);
});

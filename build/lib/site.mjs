/**
 * 사이트 상수와 기본 경로.
 *
 * GitHub Pages 프로젝트 사이트는 `/<저장소명>/` 하위 경로에 놓인다.
 * 절대 경로(`/assets/...`)로 만들면 전부 404가 난다.
 * 모든 내부 링크는 여기의 `u()`를 거쳐야 한다 — `test/site.test.mjs`가 강제한다.
 *
 *   BASE_PATH=/answerzine node build/build.mjs
 *   SITE_ORIGIN=https://bizsinsightclub.github.io node build/build.mjs
 */

export const SITE = {
  name: "ANSWER ZINE",
  tagline: "순위 말고, 팔린 이유.",
  origin: (process.env.SITE_ORIGIN ?? "https://answerzine.kr").replace(/\/$/, ""),
};

let BASE = "";

/** 빌드 시작 시 한 번 부른다. 끝의 슬래시는 떼고, 앞의 슬래시는 붙인다. */
export function setBase(b) {
  const s = String(b ?? "").trim().replace(/\/+$/, "");
  BASE = s && !s.startsWith("/") ? `/${s}` : s;
  return BASE;
}

export function getBase() {
  return BASE;
}

/** 사이트 루트 기준 경로를 실제 URL로 바꾼다. `/assets/x` → `/answerzine/assets/x` */
export function u(path) {
  if (!path.startsWith("/")) return path;
  return BASE + path;
}

/** canonical·OG용 절대 URL. */
export function absolute(path) {
  return SITE.origin + u(path);
}

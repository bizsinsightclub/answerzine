/**
 * HTML 이스케이프와 템플릿 헬퍼.
 *
 * 이 저장소의 모든 사용자 문자열은 여기를 통과한다. CLAUDE.md §9.7의 뿌리다.
 * 프로토타입은 WEEKS의 모든 값을 이스케이프 없이 innerHTML에 넣었고,
 * 그래서 <Odyssey> 같은 영문 꺾쇠 제목이 미지의 태그로 파싱돼 사라졌다.
 */

const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHTML(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => MAP[c]);
}

/** 속성값용. 이스케이프 규칙이 같아 별칭이지만, 의도를 드러내려고 이름을 나눠둔다. */
export const attr = escapeHTML;

const RAW = Symbol("raw");

/** 이미 안전한 마크업임을 표시한다. 이 표시가 없으면 h가 이스케이프한다. */
export function raw(s) {
  return { [RAW]: true, value: String(s) };
}

function render(v) {
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(render).join("");
  if (typeof v === "object" && v[RAW]) return v.value;
  return escapeHTML(v);
}

/**
 * 태그드 템플릿. 보간값은 기본 이스케이프되고 raw()로 감싼 것만 그대로 들어간다.
 * 배열은 join된다 — 반복 마크업을 map으로 만들 때 쓴다.
 */
export function h(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return out;
}

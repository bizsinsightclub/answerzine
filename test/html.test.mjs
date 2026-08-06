import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHTML, attr, raw, h } from "../build/lib/html.mjs";

test("escapeHTML은 다섯 문자를 엔티티로 바꾼다", () => {
  assert.equal(escapeHTML(`<a href="x" & 'y'>`), "&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;");
});

test("escapeHTML은 영문 꺾쇠 작품명을 태그로 만들지 않는다", () => {
  // 프로토타입에서 <Odyssey>가 미지의 태그로 파싱돼 사라지던 사고
  assert.equal(escapeHTML("<Odyssey>"), "&lt;Odyssey&gt;");
});

test("escapeHTML은 한글 꺾쇠(U+3008)는 그대로 두고 ASCII 꺾쇠만 처리한다", () => {
  assert.equal(escapeHTML("〈투명한 나선〉"), "〈투명한 나선〉");
  assert.equal(escapeHTML("<투명한 나선>"), "&lt;투명한 나선&gt;");
});

test("escapeHTML은 null/undefined를 빈 문자열로 만든다", () => {
  assert.equal(escapeHTML(null), "");
  assert.equal(escapeHTML(undefined), "");
});

test("h는 보간값을 이스케이프한다", () => {
  const evil = `"><script>alert(1)</script>`;
  const out = h`<p>${evil}</p>`;
  assert.ok(!out.includes("<script>"), "스크립트 태그가 살아 있으면 안 된다");
  assert.ok(out.includes("&lt;script&gt;"));
});

test("h는 raw()로 감싼 값만 그대로 넣는다", () => {
  assert.equal(h`<div>${raw("<b>x</b>")}</div>`, "<div><b>x</b></div>");
});

test("h는 배열을 join한다", () => {
  assert.equal(h`<ul>${[raw("<li>a</li>"), raw("<li>b</li>")]}</ul>`, "<ul><li>a</li><li>b</li></ul>");
});

test("h는 null/undefined/false를 빈 문자열로 만든다", () => {
  assert.equal(h`<p>${null}${undefined}${false}</p>`, "<p></p>");
});

test("attr은 속성값에 안전한 문자열을 만든다", () => {
  assert.equal(attr(`a"b`), "a&quot;b");
});

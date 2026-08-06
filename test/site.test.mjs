import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setBase, getBase, u, absolute, SITE } from "../build/lib/site.mjs";
import { build } from "../build/build.mjs";

test("setBase는 앞 슬래시를 붙이고 끝 슬래시를 뗀다", () => {
  assert.equal(setBase("answerzine"), "/answerzine");
  assert.equal(setBase("/answerzine/"), "/answerzine");
  assert.equal(setBase(""), "");
  assert.equal(setBase(undefined), "");
});

test("u는 사이트 루트 경로에만 접두사를 붙인다", () => {
  setBase("/answerzine");
  assert.equal(u("/assets/style.css"), "/answerzine/assets/style.css");
  assert.equal(u("/2026-w31/book/"), "/answerzine/2026-w31/book/");
  assert.equal(u("https://yes24.com/x"), "https://yes24.com/x", "외부 URL은 건드리지 않는다");
  setBase("");
  assert.equal(u("/assets/style.css"), "/assets/style.css");
});

test("absolute는 canonical용 절대 URL을 만든다", () => {
  setBase("/answerzine");
  assert.equal(absolute("/2026-w31/"), `${SITE.origin}/answerzine/2026-w31/`);
  setBase("");
});

const OUT = "dist-test-base";
after(() => rmSync(OUT, { recursive: true, force: true }));

test("기본 경로로 빌드하면 모든 내부 링크에 접두사가 붙는다", async () => {
  rmSync(OUT, { recursive: true, force: true });
  await build({ root: ".", out: OUT, quiet: true, base: "/answerzine" });

  const htmls = [];
  (function walk(d) {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith(".html")) htmls.push(p);
    }
  })(OUT);

  const bad = [];
  for (const file of htmls) {
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
      if (!m[1].startsWith("/answerzine/")) bad.push(`${file} → ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], `접두사 없는 절대 링크:\n${bad.join("\n")}`);
});

test("기본 경로로 빌드해도 파일 구조는 그대로다", async () => {
  // 접두사는 링크에만 붙고 디렉터리에는 붙지 않는다 — Pages가 그렇게 서빙한다
  for (const p of ["index.html", "2026-w31/book/index.html", "assets/style.css"])
    assert.ok(existsSync(join(OUT, p)), `${p} 없음`);
  assert.ok(!existsSync(join(OUT, "answerzine")), "출력에 접두사 디렉터리를 만들면 안 된다");
});

test("스타일시트의 폰트 경로에도 접두사가 붙는다", () => {
  const css = readFileSync(join(OUT, "assets/style.css"), "utf8");
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 5, "폰트 url이 5개 이상이어야 한다");
  for (const url of urls)
    assert.ok(url.startsWith("/answerzine/"), `접두사 없는 폰트 경로: ${url}`);
});

test("canonical이 배포 주소를 가리킨다", () => {
  const html = readFileSync(join(OUT, "2026-w31/book/index.html"), "utf8");
  assert.match(html, /<link rel="canonical" href="[^"]*\/answerzine\/2026-w31\/book\/">/);
});

test("기본 경로가 없으면 접두사도 없다", async () => {
  const plain = "dist-test-base-plain";
  rmSync(plain, { recursive: true, force: true });
  await build({ root: ".", out: plain, quiet: true, base: "" });
  const html = readFileSync(join(plain, "index.html"), "utf8");
  assert.match(html, /href="\/assets\/style\.css"/);
  rmSync(plain, { recursive: true, force: true });
});

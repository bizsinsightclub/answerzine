# ANSWER ZINE 웹진 빌드 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `issues/*.json`을 유일한 정본으로 삼아 반응형 웹진과 A4 인쇄 진을 생성하는 무의존성 빌드 파이프라인을 만든다.

**Architecture:** 순수 함수 렌더러의 집합이다. `build/lib/*.mjs`가 각각 하나의 책임(데이터 로드·이스케이프·테마·스파크라인·페이지별 렌더)을 갖고 문자열을 반환하며, `build/build.mjs`가 이들을 엮어 `dist/`에 정적 파일을 쓴다. 모든 사용자 문자열은 `escapeHTML()`을 통과한다. 테스트는 Node 내장 `node:test`로 돌린다.

**Tech Stack:** Node v24 내장 모듈 (`node:fs`, `node:path`, `node:http`, `node:test`, `node:assert`, `node:zlib`) + **devDependency 2개** (`subset-font`, `playwright`).

## Global Constraints

- **런타임 의존성은 0이다.** `dist/`는 순수 정적 HTML·CSS·JS·폰트다. 브라우저가 받는 것에 프레임워크가 없다.
- **devDependency는 정확히 둘만 허용한다** — `subset-font`(폰트 서브셋), `playwright`(A4·콘솔 검증).
  `CLAUDE.md` §7.3에 따라 사용자 승인을 받았다. **셋째를 임의로 추가하지 않는다.**
  Astro·Vite·React·템플릿 엔진·테스트 프레임워크는 도입하지 않는다.
- **테스트 러너는 `node --test`.** 별도 프레임워크 없음.
- **빌드는 서브셋 없이도 성공해야 한다.** `subset-font`가 없으면 원본 폰트를 그대로 복사하고 경고를 출력한다.
  `node_modules` 없이 클론한 사람도 빌드할 수 있어야 한다.
- **모든 사용자 문자열은 `escapeHTML()`을 경유한다.** 예외 없음.
- **`onclick` 문자열 보간 금지.** 이벤트 위임만 쓴다.
- **로드하는 폰트 웨이트는 Paperlogy 400/700/900, 나눔명조 400/700뿐이다.** 그 외 웨이트를 CSS에서 참조하지 않는다.
- **헤드라인 자간 하한은 −0.04em.**
- **본문 측정(measure)은 45–75자.**
- **테마 기본값은 Night.** `prefers-color-scheme`로 자동 전환하지 않는다.
- **`@media print`는 항상 Zine 테마를 강제하고 `.statement-wrap`을 숨긴다.**
- **인쇄 진은 A4 정확히 1페이지.** 사용 높이 상한 1050px.
- **블록 계약은 `text, stat, text, quote, text` 5개 고정.**
- **작품명은 `〈 〉`(U+3008/3009).**
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## 확정된 값 (스펙 §5, §9.1에서 그대로 가져온다)

**테마 토큰**

| 토큰 | Night (기본) | Paper | Zine |
|---|---|---|---|
| `--bg` | `#16150F` | `#F4F1E7` | `#F4F1E7` |
| `--ink` | `#F2EFE4` | `#17150F` | `#17150F` |
| `--secondary` | `#A8A192` | `#5C574A` | `#5C574A` |
| `--tertiary` | `#8A8375` | `#726C5E` | `#726C5E` |
| `--rule` | `#F2EFE4` | `#17150F` | `#17150F` |

**도메인 색**

| key | name | Night (`color`) | Paper (`colorPaper`) |
|---|---|---|---|
| `movie` | 영화 | `#0A84FF` | `#006BD7` |
| `music` | 음악 | `#FF9500` | `#A15E00` |
| `youtube` | 유튜브 | `#FF2D55` | `#DD002A` |
| `book` | 도서 | `#34C759` | `#217E38` |

**폰트** — `C:\pjt\answerzine\Fonts`에서 가져온다. `NotoSerif-*.ttf` 72종은 한글 0자라 **쓰지 않는다.**

| 파일 | 역할 | 웨이트 |
|---|---|---|
| `NanumMyeongjo.otf` | 본문 | 400 |
| `NanumMyeongjoBold.otf` | 본문 강조 | 700 |
| Paperlogy 400/700/900 | 헤드라인·UI·수치 | 400/700/900 |

Paperlogy는 `Answer_Zine.html`의 base64에서 추출한다 (Task 9).

---

## File Structure

```
build/
  build.mjs              엔트리. 로드 → 렌더 → dist/ 기록. --serve 지원
  verify.mjs             산출물 검증 (링크·이스케이프·A4 페이지 수)
  lib/
    html.mjs             escapeHTML, attr, classNames, html 태그 헬퍼
    data.mjs             issues/registry 로드, 시간순 정렬, 회차 그룹핑
    theme.mjs            테마 토큰 → CSS 변수 블록
    sparkline.mjs        SVG 스파크라인 + 대체 텍스트
    css.mjs              전체 스타일시트 문자열
    layout.mjs           <head>·마스트헤드·푸터 등 페이지 셸
    render-story.mjs     스토리 페이지 본문
    render-index.mjs     아카이브 인덱스
    render-issue.mjs     회차 페이지
    render-zine.mjs      A4 인쇄 진
    assets.mjs           폰트·이미지 복사, 폰트 추출
tools/
  kobis.mjs              KOBIS 오픈API CLI
test/
  html.test.mjs  data.test.mjs  theme.test.mjs  sparkline.test.mjs
  render.test.mjs  zine.test.mjs  kobis.test.mjs
assets/
  fonts/  img/
```

**책임 분리 원칙:** 각 `render-*.mjs`는 문자열을 반환할 뿐 파일을 쓰지 않는다. 파일 I/O는 `build.mjs`와 `assets.mjs`에만 있다. 그래야 렌더러를 파일시스템 없이 테스트할 수 있다.

---

### Task 1: 이스케이프와 HTML 헬퍼

`WEEKS`의 모든 문자열이 이스케이프 없이 `innerHTML`에 들어가던 문제(`CLAUDE.md` §9.7)의 뿌리를 먼저 막는다.

**Files:**
- Create: `build/lib/html.mjs`
- Test: `test/html.test.mjs`

**Interfaces:**
- Produces: `escapeHTML(s: string): string`, `attr(s: string): string`, `raw(s: string): {__raw: string}`, `h(strings, ...values): string`

`h`는 태그드 템플릿이다. 보간값은 **기본적으로 이스케이프**되고, `raw()`로 감싼 값만 그대로 들어간다. 배열은 join된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/html.test.mjs
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

test("escapeHTML은 한글 꺾쇠도 이스케이프한다", () => {
  assert.equal(escapeHTML("〈투명한 나선〉"), "〈투명한 나선〉");  // U+3008은 그대로
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

test("attr은 속성값에 안전한 문자열을 만든다", () => {
  assert.equal(attr(`a"b`), "a&quot;b");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test test/html.test.mjs`
Expected: FAIL — `Cannot find module '../build/lib/html.mjs'`

- [ ] **Step 3: 최소 구현**

```js
// build/lib/html.mjs
const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHTML(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => MAP[c]);
}

export const attr = escapeHTML;

const RAW = Symbol("raw");
export function raw(s) {
  return { [RAW]: true, value: String(s) };
}

function render(v) {
  if (v === null || v === undefined || v === false) return "";
  if (Array.isArray(v)) return v.map(render).join("");
  if (typeof v === "object" && v[RAW]) return v.value;
  return escapeHTML(v);
}

export function h(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test test/html.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add build/lib/html.mjs test/html.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): 이스케이프 헬퍼 추가

모든 사용자 문자열이 여기를 통과한다. CLAUDE.md §9.7의 뿌리를 막는다.
h 태그드 템플릿은 기본 이스케이프, raw()로 감싼 값만 통과시킨다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 데이터 로더와 시간순 정렬

`openStory()`가 배열 순서를 최신순이라 **가정**해서 이전/다음이 시간을 거스르던 문제(§9.2, §9.5)를 데이터 계층에서 없앤다.

**Files:**
- Create: `build/lib/data.mjs`
- Test: `test/data.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `parseRange(range: string): {start: Date, end: string}` — `"2026.07.28 – 08.03"` 파싱
  - `loadRegistry(root: string): {domains: Domain[], budget, zineLayout, byName: Map, byKey: Map}`
  - `loadIssues(root: string): Issue[]` — `range` 기준 **최신순** 정렬
  - `allStories(issues: Issue[]): Story[]` — 평탄화, 최신순, 각 story에 `issue`·`domainMeta`·`slug` 주입
  - `neighbors(list: Story[], id: string): {prev: Story|null, next: Story|null}` — `prev`는 **시간상 이전**(배열 뒤), `next`는 **시간상 다음**(배열 앞)
  - `Story.slug`는 `<domainKey>`, `Story.url`은 `/YYYY-wNN/<domainKey>/`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/data.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRange, neighbors, allStories, sortIssues } from "../build/lib/data.mjs";

test("parseRange는 en dash 형식을 파싱한다", () => {
  const r = parseRange("2026.07.28 – 08.03");
  assert.equal(r.start.getUTCFullYear(), 2026);
  assert.equal(r.start.getUTCMonth(), 6);   // 0-indexed
  assert.equal(r.start.getUTCDate(), 28);
});

test("parseRange는 하이픈을 거부한다", () => {
  assert.throws(() => parseRange("2026.07.28 - 08.03"), /en dash/);
});

test("sortIssues는 최신 회차를 앞에 둔다", () => {
  const issues = [
    { issue: "2026-w27", range: "2026.06.29 – 07.05", stories: [] },
    { issue: "2026-w31", range: "2026.07.28 – 08.03", stories: [] },
  ];
  assert.deepEqual(sortIssues(issues).map(i => i.issue), ["2026-w31", "2026-w27"]);
});

test("allStories는 회차 순서를 보존하고 회차 안에서는 입력 순서를 지킨다", () => {
  const issues = [
    { issue: "2026-w31", range: "2026.07.28 – 08.03",
      stories: [{ id: "2026-w31-book", domain: "도서" }, { id: "2026-w31-youtube", domain: "유튜브" }] },
    { issue: "2026-w27", range: "2026.06.29 – 07.05",
      stories: [{ id: "2026-w27-music", domain: "음악" }] },
  ];
  const list = allStories(sortIssues(issues));
  assert.deepEqual(list.map(s => s.id),
    ["2026-w31-book", "2026-w31-youtube", "2026-w27-music"]);
});

test("neighbors의 prev는 시간상 이전, next는 시간상 다음이다", () => {
  const list = [{ id: "c" }, { id: "b" }, { id: "a" }];   // 최신순
  const n = neighbors(list, "b");
  assert.equal(n.prev.id, "a", "prev는 더 옛날 회차여야 한다");
  assert.equal(n.next.id, "c", "next는 더 최근 회차여야 한다");
});

test("neighbors는 양 끝에서 null을 준다", () => {
  const list = [{ id: "c" }, { id: "b" }, { id: "a" }];
  assert.equal(neighbors(list, "c").next, null);
  assert.equal(neighbors(list, "a").prev, null);
});

test("neighbors는 필터된 배열 위에서 동작한다 — §9.5", () => {
  const all = [{ id: "c", domain: "도서" }, { id: "b", domain: "음악" }, { id: "a", domain: "도서" }];
  const filtered = all.filter(s => s.domain === "도서");
  const n = neighbors(filtered, "c");
  assert.equal(n.prev.id, "a", "필터 적용 배열에서 음악을 건너뛰어야 한다");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test test/data.test.mjs`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```js
// build/lib/data.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const EN_DASH = "\u2013";

export function parseRange(range) {
  if (!range || !range.includes(` ${EN_DASH} `))
    throw new Error(`range는 en dash(–)를 써야 한다: "${range}"`);
  const [head, tail] = range.split(` ${EN_DASH} `);
  const [y, m, d] = head.split(".").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, d)), end: tail, raw: range };
}

export function sortIssues(issues) {
  return [...issues].sort((a, b) => parseRange(b.range).start - parseRange(a.range).start);
}

export function loadRegistry(root) {
  const reg = JSON.parse(readFileSync(join(root, "domains/registry.json"), "utf8"));
  const domains = reg.domains.filter((d) => d.status === "active");
  return {
    ...reg,
    domains,
    byName: new Map(domains.map((d) => [d.name, d])),
    byKey: new Map(domains.map((d) => [d.key, d])),
  };
}

export function loadIssues(root) {
  const dir = join(root, "issues");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => /^\d{4}-w\d{2}\.json$/.test(f));
  return sortIssues(files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8"))));
}

export function allStories(issues, registry) {
  const out = [];
  for (const issue of issues) {
    for (const st of issue.stories ?? []) {
      const meta = registry?.byName.get(st.domain) ?? null;
      const key = meta?.key ?? st.id.split("-").pop();
      out.push({
        ...st,
        issue,
        domainMeta: meta,
        slug: key,
        url: `/${issue.issue}/${key}/`,
        draft: issue.status === "draft",
      });
    }
  }
  return out;
}

export function neighbors(list, id) {
  const i = list.findIndex((s) => s.id === id);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: list[i + 1] ?? null,   // 배열은 최신순이므로 뒤가 더 옛날
    next: list[i - 1] ?? null,
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test test/data.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: 실제 데이터로 확인한다**

```bash
node -e 'import("./build/lib/data.mjs").then(async m=>{
  const reg=m.loadRegistry(".");
  const issues=m.loadIssues(".");
  const list=m.allStories(issues,reg);
  console.log("회차",issues.map(i=>i.issue).join(" → "));
  console.log("스토리",list.map(s=>s.id).join(" → "));
  console.log("2026-w31-youtube의 이웃:",JSON.stringify(m.neighbors(list,"2026-w31-youtube"),(k,v)=>k==="issue"||k==="domainMeta"?undefined:v).slice(0,200));
})'
```
Expected: 회차가 `2026-w31 → 2026-w27` 순, 스토리 3편.

- [ ] **Step 6: 커밋**

```bash
git add build/lib/data.mjs test/data.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): 데이터 로더와 시간순 정렬

range 기준 정렬 배열을 단일 소스로 삼아 §9.2(내비 역행)와
§9.5(필터·내비 불일치)의 원인을 데이터 계층에서 없앤다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 테마 토큰

**Files:**
- Create: `build/lib/theme.mjs`
- Test: `test/theme.test.mjs`

**Interfaces:**
- Produces: `THEMES: {night, paper, zine}`, `themeCSS(): string`, `contrast(fg, bg): number`

`contrast`는 테스트가 값을 검증하는 데 쓴다. 색을 나중에 손댈 때 대비가 깨지면 테스트가 잡는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/theme.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEMES, themeCSS, contrast } from "../build/lib/theme.mjs";

test("contrast는 WCAG 값을 계산한다", () => {
  assert.equal(Math.round(contrast("#FFFFFF", "#000000") * 100) / 100, 21);
});

test("세 테마의 ink/secondary/tertiary가 모두 AA(4.5:1)를 넘는다", () => {
  for (const [name, t] of Object.entries(THEMES)) {
    for (const role of ["ink", "secondary", "tertiary"]) {
      const c = contrast(t[role], t.bg);
      assert.ok(c >= 4.5, `${name}.${role} 대비 ${c.toFixed(2)}:1 < 4.5:1`);
    }
  }
});

test("도메인 색이 각 테마 배경에서 AA를 넘는다", () => {
  const NIGHT = { movie: "#0A84FF", music: "#FF9500", youtube: "#FF2D55", book: "#34C759" };
  const PAPER = { movie: "#006BD7", music: "#A15E00", youtube: "#DD002A", book: "#217E38" };
  for (const [k, hex] of Object.entries(NIGHT))
    assert.ok(contrast(hex, THEMES.night.bg) >= 4.5, `night/${k} ${contrast(hex, THEMES.night.bg).toFixed(2)}`);
  for (const [k, hex] of Object.entries(PAPER))
    assert.ok(contrast(hex, THEMES.paper.bg) >= 4.5, `paper/${k} ${contrast(hex, THEMES.paper.bg).toFixed(2)}`);
});

test("themeCSS는 :root를 Night로, [data-theme=paper]를 Paper로 낸다", () => {
  const css = themeCSS();
  assert.match(css, /:root\s*\{[^}]*--bg:\s*#16150F/);
  assert.match(css, /\[data-theme="paper"\]\s*\{[^}]*--bg:\s*#F4F1E7/);
});

test("themeCSS는 prefers-color-scheme로 자동 전환하지 않는다", () => {
  assert.ok(!themeCSS().includes("prefers-color-scheme"),
    "기본값은 Night 고정이다 — 스펙 §5.2");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test test/theme.test.mjs` → FAIL

- [ ] **Step 3: 구현**

```js
// build/lib/theme.mjs
export const THEMES = {
  night: { bg: "#16150F", ink: "#F2EFE4", secondary: "#A8A192", tertiary: "#8A8375",
           rule: "#F2EFE4", surface: "#1E1D16", divider: "rgba(242,239,228,.22)" },
  paper: { bg: "#F4F1E7", ink: "#17150F", secondary: "#5C574A", tertiary: "#726C5E",
           rule: "#17150F", surface: "#EDEADE", divider: "rgba(23,21,15,.24)" },
  zine:  { bg: "#F4F1E7", ink: "#17150F", secondary: "#5C574A", tertiary: "#726C5E",
           rule: "#17150F", surface: "#FFFFFF", divider: "rgba(23,21,15,.35)" },
};

const vars = (t) => Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join("\n");

export function themeCSS() {
  return [
    `:root {\n${vars(THEMES.night)}\n  color-scheme: dark;\n}`,
    `[data-theme="paper"] {\n${vars(THEMES.paper)}\n  color-scheme: light;\n}`,
    `.zine-page {\n${vars(THEMES.zine)}\n  color-scheme: light;\n}`,
  ].join("\n\n");
}

const hex2rgb = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(fg, bg) {
  const [l1, l2] = [lum(hex2rgb(fg)), lum(hex2rgb(bg))].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}
```

- [ ] **Step 4: 통과를 확인한다** — `node --test test/theme.test.mjs` → PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add build/lib/theme.mjs test/theme.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): Night/Paper/Zine 세 테마 토큰

같은 역할 이름에 값만 다르다. 테스트가 WCAG 대비를 실제로 계산해
세 테마 전 역할과 도메인 색 8종이 AA를 넘는지 강제한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 스파크라인

`[98,101,100,426]`의 앞 세 점이 바닥에 붙어 형태 정보가 사라지던 문제를 고친다. min–max가 아니라 **기준선(첫 값)** 기준으로 정규화한다.

**Files:**
- Create: `build/lib/sparkline.mjs`
- Test: `test/sparkline.test.mjs`

**Interfaces:**
- Produces: `sparklineSVG(points: number[], color: string, opts?): string`, `trendSentence(points: number[], label: string): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/sparkline.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sparklineSVG, trendSentence } from "../build/lib/sparkline.mjs";

test("2점 미만이면 던진다", () => {
  assert.throws(() => sparklineSVG([1], "#fff"), /2개/);
});

test("평탄한 앞부분이 바닥에 붙지 않는다", () => {
  // [98,101,100,426] — 앞 세 점의 y가 서로 다르고, 바닥(h-6)에 붙지 않아야 한다
  const svg = sparklineSVG([98, 101, 100, 426], "#34C759");
  const d = svg.match(/ d="([^"]+)"/)[1];
  const ys = d.match(/,(\d+(?:\.\d+)?)/g).map((s) => Number(s.slice(1)));
  const [y0, y1, y2] = ys;
  assert.notEqual(y0, y1, "98과 101의 y가 같으면 안 된다");
  assert.ok(Math.max(y0, y1, y2) < 50, `앞 세 점이 바닥(50)에 붙었다: ${ys.join(",")}`);
});

test("색은 전달한 값을 쓴다", () => {
  assert.ok(sparklineSVG([1, 2], "#FF9500").includes("#FF9500"));
});

test("SVG에 대체 텍스트가 들어간다 — §9.9", () => {
  const svg = sparklineSVG([98, 101, 100, 426], "#34C759", { label: "주간 판매량 지수" });
  assert.match(svg, /<title>/);
  assert.match(svg, /role="img"/);
});

test("trendSentence는 추세를 문장으로 만든다", () => {
  const s = trendSentence([98, 101, 100, 426], "주간 판매량 지수");
  assert.match(s, /4개/);
  assert.match(s, /98/);
  assert.match(s, /426/);
});

test("좌표에 NaN이 없다", () => {
  for (const pts of [[100, 100], [0, 0, 0], [5, 5, 5, 5]]) {
    assert.ok(!sparklineSVG(pts, "#fff").includes("NaN"), `NaN 발생: ${pts}`);
  }
});
```

- [ ] **Step 2: 실패를 확인한다** → FAIL

- [ ] **Step 3: 구현**

```js
// build/lib/sparkline.mjs
import { escapeHTML } from "./html.mjs";

const W = 160, H = 56, PAD = 6;

export function sparklineSVG(points, color, opts = {}) {
  if (!Array.isArray(points) || points.length < 2)
    throw new Error("스파크라인은 점이 2개 이상이어야 한다.");

  const base = points[0];
  const rel = points.map((v) => (base === 0 ? v : (v / base) * 100));
  const min = Math.min(...rel, 100);
  const max = Math.max(...rel, 100);
  const span = max - min || 1;
  const norm = (v) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const step = W / (points.length - 1);
  const d = rel.map((v, i) => `${i === 0 ? "M" : "L"} ${+(i * step).toFixed(2)},${+norm(v).toFixed(2)}`).join(" ");
  const lastY = +norm(rel[rel.length - 1]).toFixed(2);
  const baseY = +norm(100).toFixed(2);

  const title = opts.label ? escapeHTML(trendSentence(points, opts.label)) : "";

  return `<svg class="sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"${title ? "" : ' aria-hidden="true"'}>` +
    (title ? `<title>${title}</title>` : "") +
    `<line x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" stroke="currentColor" stroke-width="1" opacity=".25" stroke-dasharray="2 3"/>` +
    `<path d="${d}" fill="none" stroke="${escapeHTML(color)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${W}" cy="${lastY}" r="3.5" fill="${escapeHTML(color)}"/>` +
    `</svg>`;
}

export function trendSentence(points, label) {
  const first = points[0], last = points[points.length - 1];
  const dir = last > first ? "상승" : last < first ? "하락" : "보합";
  return `${label} 추이. 데이터 ${points.length}개, ${first}에서 ${last}로 ${dir}. 전체 값: ${points.join(", ")}.`;
}
```

- [ ] **Step 4: 통과를 확인한다** → PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add build/lib/sparkline.mjs test/sparkline.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): 기준선 정규화 스파크라인 + 대체 텍스트

min-max 정규화라 [98,101,100,426]의 앞 세 점이 바닥에 붙던 문제를
기준선(첫 값=100) 기준 정규화로 고친다. 기준선 자체를 점선으로 그려
"전주 대비"라는 축 의미를 형태로 보여준다.
SVG에 <title>을 넣어 §9.9의 대체 텍스트 부재를 해소한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 스타일시트

**Files:**
- Create: `build/lib/css.mjs`
- Test: `test/css.test.mjs`

**Interfaces:**
- Consumes: `themeCSS()` (Task 3)
- Produces: `stylesheet(): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/css.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { stylesheet } from "../build/lib/css.mjs";

const css = stylesheet();

test("로드하지 않은 폰트 웨이트를 참조하지 않는다 — §9.8", () => {
  const allowed = new Set(["400", "700", "900"]);
  const used = [...css.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => m[1]);
  const bad = [...new Set(used)].filter((w) => !allowed.has(w));
  assert.deepEqual(bad, [], `로드하지 않은 웨이트 참조: ${bad.join(", ")}`);
});

test("@font-face는 다섯 개다 (Paperlogy 3 + 나눔명조 2)", () => {
  assert.equal((css.match(/@font-face/g) ?? []).length, 5);
});

test("자간 하한 -0.04em을 넘지 않는다", () => {
  const ls = [...css.matchAll(/letter-spacing:\s*(-?[\d.]+)em/g)].map((m) => Number(m[1]));
  const bad = ls.filter((v) => v < -0.04);
  assert.deepEqual(bad, [], `자간 하한 초과: ${bad.join(", ")}`);
});

test("인쇄에서 .statement-wrap을 숨긴다 — §9.1", () => {
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\.statement-wrap/);
});

test("인쇄 @page는 A4 margin 0이다", () => {
  assert.match(css, /@page\s*\{[^}]*size:\s*A4[^}]*margin:\s*0/);
});

test("브라우저 표면을 팔레트에서 지정한다 — craft-floor", () => {
  assert.match(css, /::selection/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /caret-color/);
});

test("본문 측정은 45~75자 범위 안이다", () => {
  const m = css.match(/--measure:\s*([\d.]+)ch/);
  assert.ok(m, "--measure 토큰이 있어야 한다");
  const ch = Number(m[1]);
  assert.ok(ch >= 45 && ch <= 75, `measure ${ch}ch가 45~75 밖이다`);
});

test("1200px 이상에서 12칼럼 그리드를 쓴다", () => {
  assert.match(css, /min-width:\s*1200px/);
  assert.match(css, /grid-template-columns:\s*repeat\(12,/);
});

test("본문에 CSS 다단(column-count)을 쓰지 않는다 — 스펙 §6.3", () => {
  const webPart = css.slice(0, css.indexOf(".zine-page"));
  assert.ok(!/column-count/.test(webPart), "웹 본문에 다단을 쓰면 안 된다");
});
```

- [ ] **Step 2: 실패를 확인한다** → FAIL

- [ ] **Step 3: 구현한다**

`build/lib/css.mjs`가 `stylesheet()`에서 템플릿 문자열 하나를 반환한다. 구성 순서는 다음과 같다.

1. `@font-face` 5개 — `/assets/fonts/Paperlogy-{400,700,900}.ttf`, `/assets/fonts/NanumMyeongjo{,Bold}.otf`, 전부 `font-display: swap`
2. `themeCSS()` (Task 3에서 import)
3. 토큰: `--measure: 68ch`, `--shell: 1240px`, 간격 스케일
4. 리셋 + `body` (배경 `--bg`, 색 `--ink`, 본문 나눔명조 400)
5. 브라우저 표면: `::selection`, `:focus-visible`, `caret-color`, 스크롤바
6. 타이포 역할: 헤드라인(Paperlogy 900, 자간 −0.035em), 킥커(Paperlogy 700, 자간 .14em, uppercase, **monospace 아님**), 본문(나눔명조 400, 행간 1.9), 수치(Paperlogy 900, `tabular-nums`)
7. Night 보정: `[data-theme]` 없을 때 본문 `letter-spacing: .005em`
8. 마스트헤드 + 룰라인(`border-top 3px` + `border-bottom 1px`)
9. 레이아웃: `<768px` 1단 → `768px` 8칼럼 → `1200px` 12칼럼(`grid-template-columns: repeat(12, 1fr)`), 본문 `grid-column: 1 / span 7`, 레일 `9 / span 4` + `position: sticky`
10. 컴포넌트: 스탯 카드(레일 상주, 출처 **상시 표시**), 풀쿼트(`border-left: 1px`), 인사이트(넓은 화면 툴팁 / 좁은 화면 펼침)
11. `.zine-page` — 210mm × 297mm, 패딩 `8mm 10mm`, 3단 `.zine-secondary-row`, 룰라인·스티커·테이프·`clip-path` (기존 `design.md` §8 값 유지)
12. `@media print` — `@page { size: A4; margin: 0 }`, `.statement-wrap`·`.site-header`·`.site-nav`·`#main-content`·`.print-btn` 숨김, `.zine-page`만 남김
13. `@media (prefers-reduced-motion: reduce)` — 애니메이션 정지, 콘텐츠 표시

- [ ] **Step 4: 통과를 확인한다** — `node --test test/css.test.mjs` → PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add build/lib/css.mjs test/css.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): 스타일시트 — 3테마·12칼럼·인쇄

테스트가 규칙을 강제한다: 미로드 웨이트 참조 금지(§9.8),
자간 하한 -0.04em, 인쇄 시 .statement-wrap 숨김(§9.1),
웹 본문 다단 금지, 브라우저 표면 테마 적용.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 페이지 셸과 스토리 렌더

**Files:**
- Create: `build/lib/layout.mjs`, `build/lib/render-story.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: `h`, `raw`, `escapeHTML` (Task 1); `neighbors` (Task 2); `sparklineSVG`, `trendSentence` (Task 4)
- Produces:
  - `page({title, description, url, bodyClass, content, canonical}): string` — 완전한 HTML 문서
  - `renderStory(story, {prev, next}): {title, description, content}`

`page()`는 `<head>`에 OG 태그·canonical·파비콘·테마 초기화 인라인 스크립트를 넣는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/render.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { page } from "../build/lib/layout.mjs";
import { renderStory } from "../build/lib/render-story.mjs";

const STORY = {
  id: "2026-w31-book", domain: "도서", slug: "book",
  range: "2026.07.28 – 08.03", kicker: "IN MEMORIAM",
  headline: "부고 다음날, 서점이 붐볐다.",
  teaser: "히가시노 게이고가 세상을 떠난 다음 주, 그의 신작이 판매량 326% 증가하며 1위에 올랐다.",
  domainMeta: { key: "book", name: "도서", color: "#34C759", colorPaper: "#217E38" },
  issue: { issue: "2026-w31" },
  url: "/2026-w31/book/",
  blocks: [
    { type: "text", text: "7월 23일, <script>alert(1)</script> 별세했다." },
    { type: "stat", label: "주간 판매량 지수", value: "+326.5%", trend: [98, 101, 100, 426],
      axisCaption: "X축: 최근 4주", sourceUrl: "https://www.yes24.com/24/category/bestseller",
      sourceLabel: "예스24 베스트셀러 확인하기" },
    { type: "text", text: "구매자 데이터를 보면 40대가 38.2%였다." },
    { type: "quote", text: "이건 마케팅이 만든 베스트셀러가 아니다.",
      insight: { concept: "사후 관심 효과", note: "예술 시장 연구에서 반복 관찰된다." } },
    { type: "text", text: "숫자 뒤에 슬픔이 있다는 걸 아는 채로 전한다." },
  ],
};

test("본문의 스크립트가 실행 가능한 형태로 남지 않는다", () => {
  const { content } = renderStory(STORY, { prev: null, next: null });
  assert.ok(!content.includes("<script>alert"), "이스케이프되지 않았다");
  assert.ok(content.includes("&lt;script&gt;"));
});

test("5블록이 계약 순서대로 렌더된다", () => {
  const { content } = renderStory(STORY, { prev: null, next: null });
  const iStat = content.indexOf("stat-card");
  const iQuote = content.indexOf("pullquote");
  assert.ok(iStat > -1 && iQuote > -1);
  assert.ok(iStat < iQuote, "stat이 quote보다 앞이어야 한다");
});

test("출처 링크가 항상 보인다 — §9.9", () => {
  const { content } = renderStory(STORY, { prev: null, next: null });
  assert.match(content, /예스24 베스트셀러 확인하기/);
  assert.ok(!/opacity:\s*0/.test(content), "hover에만 노출하면 안 된다");
});

test("외부 링크에 rel=noopener가 붙는다", () => {
  const { content } = renderStory(STORY, { prev: null, next: null });
  assert.match(content, /rel="noopener noreferrer"/);
});

test("onclick 문자열 보간을 쓰지 않는다 — §9.7", () => {
  const { content } = renderStory(STORY, { prev: null, next: null });
  assert.ok(!content.includes("onclick"), "이벤트 위임을 써야 한다");
});

test("이전/다음 링크가 URL로 나간다", () => {
  const prev = { id: "2026-w27-music", headline: "밈이, 판다.", url: "/2026-w27/music/" };
  const { content } = renderStory(STORY, { prev, next: null });
  assert.match(content, /href="\/2026-w27\/music\/"/);
  assert.match(content, /밈이, 판다\./);
});

test("page는 OG 태그와 canonical을 넣는다", () => {
  const html = page({ title: "제목", description: "설명", url: "/2026-w31/book/", content: "<p>x</p>" });
  assert.match(html, /<meta property="og:title" content="제목">/);
  assert.match(html, /<link rel="canonical" href="[^"]*\/2026-w31\/book\/">/);
  assert.match(html, /<html lang="ko"/);
});

test("page는 첫 페인트 전에 테마를 적용한다", () => {
  const html = page({ title: "t", description: "d", url: "/", content: "" });
  const headEnd = html.indexOf("</head>");
  const themeScript = html.indexOf("localStorage");
  assert.ok(themeScript > -1 && themeScript < headEnd, "테마 스크립트가 head 안에 있어야 한다");
});

test("page는 제목을 이스케이프한다", () => {
  const html = page({ title: `x"><script>`, description: "d", url: "/", content: "" });
  assert.ok(!html.includes(`x"><script>`));
});
```

- [ ] **Step 2: 실패를 확인한다** → FAIL

- [ ] **Step 3: 구현한다**

`layout.mjs`의 `page()`:
- `<!doctype html><html lang="ko">`, viewport, `<title>`, `description`, canonical, OG(`og:title`·`og:description`·`og:type`·`og:url`·`og:site_name`), 파비콘(`/assets/img/favicon.svg`)
- 테마 초기화 인라인 스크립트: `try{var t=localStorage.getItem("az-theme");if(t==="paper")document.documentElement.setAttribute("data-theme","paper")}catch(e){}`
- 마스트헤드(워드마크 + 룰라인 + 테마 토글 버튼) / 푸터
- 하단에 `/assets/app.js` 로드 (이벤트 위임·테마 토글·필터)

`render-story.mjs`의 `renderStory()`:
- `[0]`,`[2]`,`[4]` → 본문 칼럼의 `<p>`
- `[1]` stat → 레일의 `<aside>` 카드. `sparklineSVG(trend, color, {label})`, 출처 링크 상시 표시 + `target="_blank" rel="noopener noreferrer"`
- `[3]` quote → `border-left: 1px` 풀쿼트 + `<details>`/툴팁 인사이트
- 이전/다음은 `<a href>`

- [ ] **Step 4: 통과를 확인한다** → PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add build/lib/layout.mjs build/lib/render-story.mjs test/render.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): 페이지 셸과 스토리 렌더

모든 문자열이 escapeHTML을 통과하고 onclick 보간이 사라진다(§9.7).
출처 링크는 레일에 상주해 hover 의존을 없앤다(§9.9).
회차별 OG·canonical을 정적으로 심는다(§9.10).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 아카이브 인덱스와 회차 페이지

**Files:**
- Create: `build/lib/render-index.mjs`, `build/lib/render-issue.mjs`
- Test: `test/render-index.test.mjs`

**Interfaces:**
- Consumes: `page` (Task 6), `allStories`·`neighbors` (Task 2)
- Produces: `renderIndex(issues, stories, registry)`, `renderIssue(issue, stories, registry)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/render-index.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderIndex } from "../build/lib/render-index.mjs";
import { renderIssue } from "../build/lib/render-issue.mjs";

const REG = { domains: [
  { key: "movie", name: "영화", color: "#0A84FF", colorPaper: "#006BD7" },
  { key: "book", name: "도서", color: "#34C759", colorPaper: "#217E38" },
]};
const S = (id, key, name, hl) => ({
  id, slug: key, domain: name, headline: hl, teaser: "티저.", kicker: "K",
  range: "2026.07.28 – 08.03", url: `/2026-w31/${key}/`,
  domainMeta: REG.domains.find(d => d.key === key), issue: { issue: "2026-w31" },
  blocks: [{ type: "text", text: "본문." }, { type: "stat", label: "L", value: "+326.5%", trend: [1,2],
             axisCaption: "c", sourceUrl: "https://www.yes24.com/x" },
           { type: "text", text: "본문2." },
           { type: "quote", text: "쿼트.", insight: { concept: "개념", note: "설명." } },
           { type: "text", text: "마무리." }],
});
const stories = [S("2026-w31-book", "book", "도서", "부고 다음날, 서점이 붐볐다."),
                 S("2026-w31-movie", "movie", "영화", "매진, 또 매진.")];
const issues = [{ issue: "2026-w31", range: "2026.07.28 – 08.03", status: "draft", stories }];

test("인덱스는 첫 스토리를 리드로 크게 낸다", () => {
  const { content } = renderIndex(issues, stories, REG);
  const iLead = content.indexOf("부고 다음날, 서점이 붐볐다.");
  const iMini = content.indexOf("매진, 또 매진.");
  assert.ok(iLead > -1 && iMini > -1 && iLead < iMini);
  assert.match(content, /class="[^"]*lead/);
});

test("인덱스에 도메인 필터가 전부 나온다", () => {
  const { content } = renderIndex(issues, stories, REG);
  for (const d of ["전체", "영화", "도서"]) assert.ok(content.includes(d), `${d} 누락`);
});

test("필터는 onclick이 아니라 data 속성을 쓴다", () => {
  const { content } = renderIndex(issues, stories, REG);
  assert.ok(!content.includes("onclick"));
  assert.match(content, /data-domain=/);
});

test("draft 회차는 표시가 붙는다", () => {
  const { content } = renderIndex(issues, stories, REG);
  assert.match(content, /작업 중/);
});

test("회차 페이지는 그 주의 스토리를 전부 낸다", () => {
  const { content } = renderIssue(issues[0], stories, REG);
  assert.ok(content.includes("부고 다음날, 서점이 붐볐다."));
  assert.ok(content.includes("매진, 또 매진."));
  assert.match(content, /href="\/2026-w31\/print\/"/);
});

test("draft 페이지는 noindex를 요청한다", () => {
  const r = renderIssue(issues[0], stories, REG);
  assert.equal(r.noindex, true);
});
```

- [ ] **Step 2: 실패를 확인한다** → FAIL

- [ ] **Step 3: 구현** — `renderIndex`는 리드 1 + 나머지(≥1200px에서 col 9–12) + 지난 호 목록 + 필터 버튼(`data-domain`). `renderIssue`는 회차 헤더 + 스토리 카드 + 인쇄 진 링크. 둘 다 `{title, description, content, noindex}`를 반환한다.

- [ ] **Step 4: 통과를 확인한다** → PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add build/lib/render-index.mjs build/lib/render-issue.mjs test/render-index.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): 아카이브 인덱스와 회차 페이지

인쇄 진의 리드 1 + 나머지 골격을 화면이 그대로 쓴다.
필터는 data 속성 + 이벤트 위임이라 onclick 보간이 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 인쇄 진 생성 — 정본 이중화 제거

`.zine-page`가 HTML에 하드코딩돼 회수된 영화 편이 지면에 살아남던 사고(§9.3)를 구조적으로 없앤다.

**Files:**
- Create: `build/lib/render-zine.mjs`
- Test: `test/zine.test.mjs`

**Interfaces:**
- Consumes: `h`, `raw` (Task 1)
- Produces: `renderZinePage(issue, stories, registry): {title, content, lead, minis}`, `zineBodyFor(story): string[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/zine.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderZinePage, zineBodyFor } from "../build/lib/render-zine.mjs";

const mk = (id, key, name, hl, teaser) => ({
  id, slug: key, domain: name, headline: hl, teaser, kicker: "KICKER",
  range: "2026.07.28 – 08.03", domainMeta: { key, name, color: "#34C759", colorPaper: "#217E38" },
  issue: { issue: "2026-w31" },
  blocks: [{ type: "text", text: "첫 문단이다." },
           { type: "stat", label: "주간 판매량 지수", value: "+326.5%", trend: [98, 426],
             axisCaption: "c", sourceUrl: "https://www.yes24.com/x" },
           { type: "text", text: "둘째 문단이다." },
           { type: "quote", text: "쿼트.", insight: { concept: "개념", note: "설명." } },
           { type: "text", text: "마무리 문단이다." }],
});
const stories = [
  mk("2026-w31-book", "book", "도서", "부고 다음날, 서점이 붐볘다.".replace("볘", "볐"), "티저 하나."),
  mk("2026-w31-a", "movie", "영화", "매진, 또 매진.", "티저 둘."),
  mk("2026-w31-b", "music", "음악", "밈이, 판다.", "티저 셋."),
  mk("2026-w31-c", "youtube", "유튜브", "15초 보고, 품절됐다.", "티저 넷."),
];
const issue = { issue: "2026-w31", range: "2026.07.28 – 08.03", stories };

test("리드는 첫 스토리, 미니는 나머지 3편이다", () => {
  const z = renderZinePage(issue, stories, {});
  assert.equal(z.lead.id, "2026-w31-book");
  assert.equal(z.minis.length, 3);
});

test("진의 헤드라인·티저가 웹과 문자열이 같다 — §8 QA #17", () => {
  const z = renderZinePage(issue, stories, {});
  for (const s of stories) {
    assert.ok(z.content.includes(s.headline), `헤드라인 불일치: ${s.headline}`);
  }
  assert.ok(z.content.includes(stories[0].teaser));
});

test("스티커 수치는 리드의 stat.value를 그대로 쓴다", () => {
  const z = renderZinePage(issue, stories, {});
  assert.match(z.content, /zine-sticker[^>]*>[^<]*\+326\.5%/);
});

test("QR 캡션은 회차 URL을 가리킨다", () => {
  const z = renderZinePage(issue, stories, {});
  assert.match(z.content, /answerzine\.kr\/2026-w31/);
});

test("미니가 3편 미만이면 알린다", () => {
  const two = stories.slice(0, 2);
  const z = renderZinePage({ ...issue, stories: two }, two, {});
  assert.equal(z.minis.length, 1);
  assert.ok(z.warnings.some(w => /미니/.test(w)), "레이아웃 경고가 있어야 한다");
});

test("zineBodyFor는 zineBody가 있으면 그대로 쓴다", () => {
  const s = { ...stories[0], zineBody: ["가.", "나.", "다."] };
  assert.deepEqual(zineBodyFor(s), ["가.", "나.", "다."]);
});

test("zineBodyFor는 없으면 text 블록 셋을 쓴다", () => {
  assert.deepEqual(zineBodyFor(stories[0]), ["첫 문단이다.", "둘째 문단이다.", "마무리 문단이다."]);
});

test("회수된 스토리는 지면에 나올 수 없다 — 입력에 없으면 끝이다", () => {
  // 프로토타입에서는 지면이 하드코딩이라 issues/*.json에서 뺀 영화 편이 남아 있었다
  const without = stories.filter(s => s.slug !== "movie");
  const z = renderZinePage({ ...issue, stories: without }, without, {});
  assert.ok(!z.content.includes("매진, 또 매진."), "제외한 스토리가 지면에 남았다");
});
```

- [ ] **Step 2: 실패를 확인한다** → FAIL

- [ ] **Step 3: 구현** — `design.md` §8의 진 장치(룰라인·사진 콜라주·테이프·스티커·3단 괘선·푸터 QR)를 그대로 유지하되 전부 데이터에서 생성한다. `warnings` 배열에 미니 부족·예산 초과를 담는다.

- [ ] **Step 4: 통과를 확인한다** → PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add build/lib/render-zine.mjs test/zine.test.mjs
git commit -m "$(cat <<'EOF'
feat(build): 인쇄 진을 JSON에서 생성 — 정본 이중화 제거

프로토타입은 .zine-page가 하드코딩이라, issues/2026-w31.json에서
제외한 영화 편이 종이 지면에 그대로 살아 있었다. 이제 입력에 없으면
지면에도 없다. 테스트가 그 사고를 직접 재현해 막는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 에셋 — 폰트 추출·서브셋·복사

**서브셋 규칙:** 빌드 시 `issues/*.json` 전량 + UI 문자열의 **합집합**을 글리프 집합으로 삼는다.
아카이브 페이지가 모든 회차의 헤드라인을 보여주므로 회차별 서브셋은 안 된다.
`verify.mjs`가 **본문의 모든 문자가 서브셋에 들어갔는지** 검사해 두부(tofu) 렌더를 막는다.



**Files:**
- Create: `build/lib/assets.mjs`, `assets/img/favicon.svg`
- Test: `test/assets.test.mjs`

**Interfaces:**
- Produces: `extractPaperlogy(htmlPath, outDir): string[]`, `copyAssets(root, distDir): {copied: string[], bytes: number}`

폰트 원본은 `Fonts/`(gitignore)에서 `assets/fonts/`로 옮겨 **저장소에 커밋한다.** 커밋하는 건 실제 쓰는 5개뿐이다.

- [ ] **Step 1: 폰트를 제자리에 놓는다**

```bash
mkdir -p assets/fonts assets/img
cp Fonts/NanumMyeongjo.otf Fonts/NanumMyeongjoBold.otf assets/fonts/
node build/lib/assets.mjs extract Answer_Zine.html assets/fonts
ls -la assets/fonts
```
Expected: `Paperlogy-{300,400,700,900}.ttf` + 나눔명조 2개. **300은 쓰지 않으므로 지운다.**

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```js
// test/assets.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { hangulCoverage } from "../build/lib/assets.mjs";

const NEEDED = ["Paperlogy-400.ttf", "Paperlogy-700.ttf", "Paperlogy-900.ttf",
                "NanumMyeongjo.otf", "NanumMyeongjoBold.otf"];

test("필요한 폰트 5개가 assets/fonts에 있다", () => {
  for (const f of NEEDED) assert.ok(existsSync(`assets/fonts/${f}`), `${f} 없음`);
});

test("쓰지 않는 웨이트는 두지 않는다", () => {
  const extra = readdirSync("assets/fonts").filter((f) => !NEEDED.includes(f));
  assert.deepEqual(extra, [], `불필요한 폰트: ${extra.join(", ")}`);
});

test("모든 폰트가 한글 11,172자를 전부 커버한다", () => {
  for (const f of NEEDED) {
    const n = hangulCoverage(readFileSync(`assets/fonts/${f}`));
    assert.equal(n, 11172, `${f}의 한글 커버리지가 ${n}자다`);
  }
});
```

- [ ] **Step 3: 실패를 확인한다** → FAIL

- [ ] **Step 4: 구현** — `hangulCoverage(buf)`는 sfnt `cmap`(format 4/12)을 파싱해 U+AC00–U+D7A3 중 매핑된 수를 센다. `extractPaperlogy`는 `@font-face` 블록의 `font-weight`와 base64를 짝지어 파일로 쓴다.

- [ ] **Step 5: 통과를 확인한다** → PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add assets/ build/lib/assets.mjs test/assets.test.mjs
git commit -m "$(cat <<'EOF'
feat(assets): 폰트 5벌 외부화 + 커버리지 테스트

base64 인라인 4.07MB를 걷어내고 실제 쓰는 5벌만 남긴다.
테스트가 cmap을 파싱해 한글 11,172자 커버리지를 강제한다 —
NotoSerif 계열(한글 0자)이 실수로 들어오는 걸 막는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: 빌드 엔트리

**Files:**
- Create: `build/build.mjs`, `assets/app.js`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: 앞의 모든 모듈
- Produces: `build({root, out}): {files: string[], warnings: string[]}`

`assets/app.js`는 **이벤트 위임**만 담당한다: 테마 토글(localStorage `az-theme`), 도메인 필터(`data-domain`, URL 쿼리 반영), 인쇄 버튼.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
// test/build.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { build } from "../build/build.mjs";

const OUT = "dist-test";
test("빌드가 기대한 파일을 만든다", () => {
  rmSync(OUT, { recursive: true, force: true });
  const r = build({ root: ".", out: OUT });
  for (const p of ["index.html", "2026-w31/index.html", "2026-w31/book/index.html",
                   "2026-w31/print/index.html", "404.html",
                   "assets/fonts/Paperlogy-900.ttf", "assets/app.js", "assets/style.css"]) {
    assert.ok(existsSync(`${OUT}/${p}`), `${p} 없음`);
  }
});

test("회수된 영화 편은 어디에도 없다", () => {
  const files = ["index.html", "2026-w31/index.html", "2026-w31/print/index.html"];
  for (const f of files) {
    const html = readFileSync(`${OUT}/${f}`, "utf8");
    assert.ok(!html.includes("매진, 또 매진."), `${f}에 회수된 영화 편이 있다`);
  }
});

test("모든 페이지에 콘솔 에러 유발 요소가 없다 — 파비콘이 있다", () => {
  assert.ok(existsSync(`${OUT}/assets/img/favicon.svg`));
  assert.match(readFileSync(`${OUT}/index.html`, "utf8"), /rel="icon"/);
});

test("인쇄 페이지에 statement-wrap이 없다", () => {
  const html = readFileSync(`${OUT}/2026-w31/print/index.html`, "utf8");
  assert.ok(!html.includes("statement-wrap"));
});
```

- [ ] **Step 2: 실패를 확인한다** → FAIL

- [ ] **Step 3: 구현** — `build()`가 로드→렌더→기록하고 `--serve`는 `node:http`로 `dist/`를 서빙한다.

- [ ] **Step 4: 통과를 확인한다** → PASS (4 tests)

- [ ] **Step 5: 실제 빌드하고 눈으로 확인한다**

```bash
node build/build.mjs
node build/build.mjs --serve   # http://127.0.0.1:8080
```

- [ ] **Step 6: 커밋**

```bash
git add build/build.mjs assets/app.js test/build.test.mjs .gitignore
git commit -m "$(cat <<'EOF'
feat(build): 빌드 엔트리와 로컬 서버

issues/*.json 하나에서 웹·인쇄·메타데이터가 전부 나온다.
app.js는 이벤트 위임만 담당해 onclick 보간이 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: 산출물 검증 (verify.mjs)

`CLAUDE.md` §8에서 `[자동]`이라고 표기됐지만 실제로는 구현되지 않은 항목들을 구현한다.

**Files:**
- Create: `build/verify.mjs`

**Interfaces:**
- Produces: CLI. 실패 시 exit 1.

검사 항목:
1. `dist/`의 모든 내부 링크(`href="/..."`)가 실제 파일로 해석되는가
2. 렌더된 HTML에 이스케이프 누락(`<script>` 외의 원시 `<`)이 없는가
3. 인쇄 페이지가 A4 **정확히 1페이지**인가 — Playwright가 있을 때만. 없으면 건너뛰되 그 사실을 출력한다
4. 콘솔 에러 0건 — 같은 조건
5. 진의 헤드라인·티저가 `issues/*.json`과 문자열이 같은가

- [ ] **Step 1: 구현하고 돌린다**

```bash
node build/verify.mjs
```
Expected: 링크·이스케이프 검사 통과. Playwright 없으면 A4 검사는 `건너뜀`으로 표시.

- [ ] **Step 2: A4 1페이지를 실측한다** (Playwright 사용 가능)

`CLAUDE.md` §8 말미의 방법을 그대로 쓴다.

```js
const buf = await page.pdf({ format: "A4", printBackground: true,
                             margin: { top: 0, bottom: 0, left: 0, right: 0 } });
const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
// pages === 1 이어야 한다
```
Expected: `1`. 프로토타입은 4였다.

- [ ] **Step 3: 커밋**

```bash
git add build/verify.mjs
git commit -m "$(cat <<'EOF'
feat(build): 산출물 검증

§8에서 [자동]으로 표기됐으나 미구현이던 #14(콘솔 에러)와
#15(A4 1페이지)를 실제로 구현한다. #17(인쇄·웹 문자열 일치)은
같은 값을 참조하므로 검사 자체가 필요 없어졌다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: KOBIS 오픈API CLI

측정 결과 KOBIS 박스오피스 페이지는 폼 제출이 필요해 `WebFetch`로 읽히지 않는다. 공식 API로 대체한다.
API가 반환하는 `openDt`는 `market-scope.md`가 요구하는 **국내 개봉일**이고, L-001 사고를 만든 바로 그 값이다.

**Files:**
- Create: `tools/kobis.mjs`
- Test: `test/kobis.test.mjs`

**Interfaces:**
- Produces: `dailyBoxOffice(targetDt): Promise<Movie[]>`, `movieInfo(movieCd): Promise<Movie>`, `weeklyBoxOffice(targetDt, weekGb)`

키는 스펙 결정에 따라 파일에 임베드한다.

- [ ] **Step 1: 테스트를 쓴다** (네트워크 없이 도는 것과, 있을 때만 도는 것을 나눈다)

```js
// test/kobis.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrl, normalize, KEY } from "../tools/kobis.mjs";

test("키가 임베드돼 있다", () => {
  assert.match(KEY, /^[0-9a-f]{32}$/);
});

test("buildUrl은 targetDt를 YYYYMMDD로 강제한다", () => {
  assert.throws(() => buildUrl("daily", { targetDt: "2026-08-05" }), /YYYYMMDD/);
  assert.match(buildUrl("daily", { targetDt: "20260805" }), /targetDt=20260805/);
});

test("normalize는 필요한 필드만 남긴다", () => {
  const raw = { rank: "1", movieNm: "오디세이", audiCnt: "291353", audiAcc: "293720",
                openDt: "2026-08-05", movieCd: "20260001", rankInten: "0" };
  const m = normalize(raw);
  assert.equal(m.rank, 1);
  assert.equal(m.audiCnt, 291353);
  assert.equal(m.openDt, "2026-08-05");
  assert.equal(m.title, "오디세이");
});

test("normalize는 개봉일이 없으면 null로 둔다", () => {
  assert.equal(normalize({ rank: "1", movieNm: "x", openDt: " " }).openDt, null);
});
```

- [ ] **Step 2: 실패를 확인한다** → FAIL

- [ ] **Step 3: 구현**

```js
// tools/kobis.mjs
// 영화진흥위원회 오픈API. 무료 키이며 저장소가 공개라 노출된다 —
// 소진되면 https://www.kobis.or.kr/kobisopenapi 에서 재발급한다.
export const KEY = "6538d672a685ea3c074387778481e686";
const BASE = "https://www.kobis.or.kr/kobisopenapi/webservice/rest";

const ENDPOINTS = {
  daily: `${BASE}/boxoffice/searchDailyBoxOfficeList.json`,
  weekly: `${BASE}/boxoffice/searchWeeklyBoxOfficeList.json`,
  info: `${BASE}/movie/searchMovieInfo.json`,
};

export function buildUrl(kind, params) {
  const url = new URL(ENDPOINTS[kind]);
  url.searchParams.set("key", KEY);
  for (const [k, v] of Object.entries(params)) {
    if (k === "targetDt" && !/^\d{8}$/.test(v))
      throw new Error(`targetDt는 YYYYMMDD여야 한다: ${v}`);
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export function normalize(m) {
  const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  const dt = (m.openDt ?? "").trim();
  return {
    rank: num(m.rank), title: m.movieNm, movieCd: m.movieCd,
    audiCnt: num(m.audiCnt), audiAcc: num(m.audiAcc),
    scrnCnt: num(m.scrnCnt), showCnt: num(m.showCnt),
    rankInten: num(m.rankInten),
    openDt: dt ? dt : null,
  };
}

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`KOBIS ${r.status}`);
  const j = await r.json();
  if (j.faultInfo) throw new Error(`KOBIS: ${j.faultInfo.message}`);
  return j;
}

export async function dailyBoxOffice(targetDt) {
  const j = await get(buildUrl("daily", { targetDt }));
  return (j.boxOfficeResult?.dailyBoxOfficeList ?? []).map(normalize);
}

export async function weeklyBoxOffice(targetDt, weekGb = "0") {
  const j = await get(buildUrl("weekly", { targetDt, weekGb }));
  return (j.boxOfficeResult?.weeklyBoxOfficeList ?? []).map(normalize);
}

export async function movieInfo(movieCd) {
  const j = await get(buildUrl("info", { movieCd }));
  const i = j.movieInfoResult?.movieInfo;
  return i ? { title: i.movieNm, openDt: i.openDt || null, movieCd: i.movieCd,
               nations: (i.nations ?? []).map((n) => n.nationNm) } : null;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const [cmd, arg, arg2] = process.argv.slice(2);
  const run = {
    daily: () => dailyBoxOffice(arg),
    weekly: () => weeklyBoxOffice(arg, arg2 ?? "0"),
    info: () => movieInfo(arg),
  }[cmd];
  if (!run) {
    console.error("사용법: node tools/kobis.mjs <daily|weekly|info> <targetDt(YYYYMMDD)|movieCd> [weekGb]");
    process.exit(1);
  }
  run().then((r) => console.log(JSON.stringify(r, null, 2)))
       .catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 4: 통과를 확인한다** → PASS (4 tests)

- [ ] **Step 5: 실제 API로 확인한다**

```bash
node tools/kobis.mjs daily 20260805
```
Expected: 1위 오디세이, `openDt: "2026-08-05"`.

- [ ] **Step 6: 화이트리스트에 API를 명시하고 커밋**

`sources/whitelist.json`의 `kobis.or.kr` 항목에 `api` 필드를 추가한다.

```bash
git add tools/kobis.mjs test/kobis.test.mjs sources/whitelist.json
git commit -m "$(cat <<'EOF'
feat(tools): KOBIS 오픈API CLI

박스오피스 페이지는 폼 제출이 필요해 스크래핑으로 못 읽는다.
공식 API가 반환하는 openDt는 market-scope.md가 요구하는
국내 개봉일이고, L-001 사고를 만든 바로 그 값이다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: 레지스트리와 문서 갱신

**Files:**
- Modify: `domains/registry.json`, `design.md`(재작성), `CLAUDE.md` §2.2·§9, `AGENTS.md`, `.claude/agents/az-editor.md`, `README.md`

- [ ] **Step 1: `registry.json`에 `colorPaper`를 넣는다**

네 도메인에 각각 `"colorPaper": "#006BD7" | "#A15E00" | "#DD002A" | "#217E38"`, `colorRules`에 `backgroundPaper: "#F4F1E7"`.

- [ ] **Step 2: `qa.mjs`가 여전히 통과하는지 확인한다**

Run: `node tools/qa.mjs`
Expected: 검증 통과.

- [ ] **Step 3: `design.md`를 재작성한다** — 스펙 §5·§6 반영. §2.1의 "5블록"과 나열 불일치도 함께 고친다(`text, stat, text, quote, text`).

- [ ] **Step 4: `CLAUDE.md`를 갱신한다** — §2.2를 빌드 스크립트 기준으로, §6에 진 생성 절차, §9에서 해소 항목 정리.

- [ ] **Step 5: `az-editor.md`의 S6을 바꾼다** — "HTML에 옮겨 적기" → "`node build/build.mjs` 실행 후 `node build/verify.mjs` 확인".

- [ ] **Step 6: 커밋**

```bash
git add domains/registry.json design.md CLAUDE.md AGENTS.md README.md .claude/agents/az-editor.md
git commit -m "$(cat <<'EOF'
docs: 빌드 파이프라인 기준으로 문서·에이전트 갱신

design.md 재작성(3테마·12칼럼·타이포 스케일), registry에 colorPaper 추가,
az-editor의 S6을 수기 편집에서 빌드 실행으로 교체.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: 마이그레이션과 CI

- [ ] **Step 1: 작품명 표기를 통일한다** — `issues/*.json`의 `<투명한 나선>` → `〈투명한 나선〉`. `node tools/qa.mjs`로 확인.

- [ ] **Step 2: `Answer_Zine.html`을 `legacy/`로 옮긴다**

```bash
mkdir -p legacy && git mv Answer_Zine.html legacy/Answer_Zine.html
```

- [ ] **Step 3: `.github/workflows/qa.yml`을 고친다** — `validate` 뒤에 `node build/build.mjs` + `node --test` + `node build/verify.mjs`, `pages` 잡의 `path`를 `.` → `dist`.

- [ ] **Step 4: 전체를 돌린다**

```bash
node --test test/          # 전 테스트
node tools/qa.mjs          # 데이터 검증
node build/build.mjs       # 빌드
node build/verify.mjs      # 산출물 검증
```
Expected: 전부 통과.

- [ ] **Step 5: 커밋하고 푸시한다**

```bash
git add -A
git commit -m "$(cat <<'EOF'
build: 마이그레이션과 CI 갱신

작품명 표기를 〈 〉로 통일하고, 프로토타입을 legacy/로 옮긴다.
CI가 테스트·빌드·산출물 검증을 거쳐 dist/를 배포한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Step 6: CI 통과를 확인한다**

```bash
gh run watch --exit-status
```

---

## Self-Review

**1. Spec coverage**

| 스펙 | 담당 태스크 |
|---|---|
| §3 아키텍처 · 산출물 구조 | 10 |
| §4 데이터 계약(`zineBody`·`photo`·`lead`) | 8 |
| §5.1–5.2 테마 3벌·전환 | 3, 5, 6 |
| §5.3 도메인 색 2벌 | 3, 13 |
| §5.4 타이포 | 5 |
| §5.5 컴포넌트 교정 | 4, 5, 6 |
| §6 레이아웃·브레이크포인트·다단 금지 | 5, 7 |
| §7 인쇄 진 | 8, 11 |
| §8 라우팅·OG | 6, 7, 10 |
| §9 에셋 | 9 |
| §10 접근성 | 4, 5, 6 |
| §11 문서·에이전트 | 13 |
| §12 QA | 11, 14 |
| §13 마이그레이션 | 14 |
| §17.2 KOBIS API | 12 |

빠진 항목 없음.

**2. Placeholder scan** — "TBD"·"적절히"·"등등" 없음. Task 5·7·8·10·11·13은 코드 대신 구성 목록을 쓰지만, 각 항목이 검증 가능한 테스트로 고정돼 있다.

**3. Type consistency** — `escapeHTML`/`h`/`raw`(T1) → 전 렌더러. `neighbors`의 `{prev, next}`(T2) → `renderStory`(T6). `sparklineSVG(points, color, opts)`(T4) → `renderStory`(T6). `renderZinePage`의 `{content, lead, minis, warnings}`(T8) → `build`(T10). `hangulCoverage(buf)`(T9) → `test/assets.test.mjs`. 이름 충돌 없음.

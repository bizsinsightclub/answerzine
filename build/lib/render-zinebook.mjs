/**
 * DIY 진 — 인쇄용 미니 8쪽 진(A4 랜드스케이프 2장, 양면) + 인쇄 전 전체를 훑어보는
 * 정적 그리드 미리보기.
 *
 * 2026-08-11 아홉 번째 라운드 신규, 같은 날 늦게 "Print Zine Refinement" 요청으로
 * 대폭 개편(열두 번째 라운드 안팎). 기존 "한 장 요약"(`/YYYY-wNN/print/`, A4 세로 1장,
 * `render-zine.mjs`)과는 완전히 별개의 산출물이다 — 그건 그대로 둔다. 이건 그 주 상위
 * 4편을 접어서 만드는 물리적인 소책자용이다.
 *
 * 물리 구조(사용자 지정, 그대로 따른다 — 실측으로 이미 올바른 새들스티치 임포지션임을
 * 확인했다: 논리 페이지 1~8을 8/1, 2/7, 6/3, 4/5로 짝지으면 2장을 겹쳐 반으로 접었을 때
 * 정확히 읽는 순서가 나온다):
 *   Sheet 1(겉장) 앞면 = [뒤표지 | 앞표지]        Sheet 1 뒷면 = [About | Notes]
 *   Sheet 2(속지) 앞면 = [기사4 | 기사1]           Sheet 2 뒷면 = [기사2 | 기사3]
 * 논리적 읽는 순서(그리드 미리보기가 이 순서로 나열한다):
 *   앞표지 → About+QR → 기사1 → 기사2 → 기사3 → 기사4 → Notes → 뒤표지  (총 8장)
 *
 * 8개 "논리 페이지" 콘텐츠를 각각 한 번만 만들고, 그리드 미리보기와 인쇄 시트(물리 배치)에
 * 같은 문자열을 재사용한다 — 정본이 둘로 갈라지지 않는다(CLAUDE.md §9.3와 같은 원칙).
 *
 * 데이터는 "지금 홈 카드 그리드에 뜨는 도메인별 최신 스토리" 4편이다(build.mjs가
 * data.mjs의 visibleDomains+latestByDomain으로 계산해 넘긴다) — 예전엔 "최신 회차 파일
 * 안의 스토리"만 썼는데, 활성 도메인이 4개뿐이고 결번이 흔해진 지금은 최신 회차 파일
 * 하나에 1~2편만 있는 주가 많아 진의 절반이 빈 채로 나가는 모순이 있었다. 결번 도메인도
 * 지난 회차 스토리가 있으면 그걸 쓰는 게 홈 카드와 일관된다 — 한 번도 발행된 적 없는
 * 도메인만 진짜 결번 플레이스홀더로 남는다(§7.3 "확인되지 않은 내용 채우지 않기"는 여전히
 * 지킨다 — 없는 도메인에 억지로 내용을 채우지 않을 뿐).
 *
 * 표지(겉장, Sheet 1 앞면 절반)는 2026-08-11 흰 배경·검정 글자로 뒤집었다(사용자 요청) —
 * "THE ANSWER ZINE"이 페이지에 거의 꽉 차게 눌러 담긴 느낌을 노린다. 속지(About·Notes·
 * 기사)는 원래도 흰 배경·검정 글자였다.
 */
import { h, raw } from "./html.mjs";
import { blocksOf } from "./data.mjs";

/** 표지 타이포를 "그대로 진하게 남는 부분"과 "옅어지는 부분"으로 쪼갠다 — layout.mjs
    intro()의 splitWord()와 같은 기법이다(홈 인트로의 "ANZINE" 강조와 같은 문법을 진
    표지에도 적용해 사이트 전체에서 일관된 브랜드 마크로 읽히게 한다). 여기는 스크롤
    애니메이션이 없는 정적 인쇄물이라 두 색을 처음부터 고정해서 낸다 — app.js 같은
    스크립트가 필요 없다. 낱말 안 글자 순서 그대로 이어붙이므로(intro()의 splitWord()와
    같은 이유) 공백 없이 join한다. */
function splitCoverWord(word, keepStart, keepEnd) {
  const prefix = word.slice(0, keepStart);
  const keep = word.slice(keepStart, keepEnd + 1);
  const suffix = word.slice(keepEnd + 1);
  const parts = [];
  if (prefix) parts.push(`<span class="zb-wrap-fade">${prefix}</span>`);
  if (keep) parts.push(`<span class="zb-wrap-keep">${keep}</span>`);
  if (suffix) parts.push(`<span class="zb-wrap-fade">${suffix}</span>`);
  return parts.join("");
}

/* ── 아이콘 ── 전부 인라인 SVG. 래스터 이미지를 새로 안 만든다(요구사항 #5). */
const ICON = {
  close: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5L19 19M19 5L5 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9V3h12v6M6 18h12v3H6v-3zM3 9h18v7H3V9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

/**
 * 진 꾸미기 스티커 — 2026-08-12 일곱 번째 라운드 신규(사용자 요청, 참고 이미지의
 * 플랫 지오메트릭 스티커 그리드). 전부 인라인 SVG, 래스터 이미지 없음(요구사항 #5와
 * 같은 원칙). 10종, 참고 이미지의 색·형태 어휘(원·부채꼴·아치·고리·반원·네잎클로버·
 * 팩맨·점 4개·별·꽃)를 흑백이 아닌 원색으로 재현했다 — 스티커는 장식 레이어라
 * "흑백만 쓴다"(요구사항 #5, 본문 규칙) 제약 밖이다.
 *
 * `assets/zinebook.js`는 이 SVG를 직접 그리지 않는다 — 팔레트 칩의 `innerHTML`을
 * 그대로 복제해 캔버스에 놓는다. 그래서 스티커 모양은 여기 한 곳에만 정의된다.
 *
 * 2026-08-12 열아홉 번째 라운드 — 놓은 스티커 크기를 조절할 수 있게 했다(사용자
 * 요청, "ZINE 안에 스티커는 사이즈도 Adjustable하게"). 스티커 우측 하단에 작은
 * 손잡이(`.zb-sticker-resize`)가 붙고, 그걸 끌면 커지거나 작아진다 — 이동(스티커
 * 몸통을 끄는 것)과 같은 포인터 이벤트 방식이라 마우스·터치 둘 다 동작한다
 * (`assets/zinebook.js`의 `startResizeDrag()` 참고). 아래 안내 문구에도 반영했다.
 */
const STICKERS = [
  { id: "circle-red", svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#E8453C"/></svg>` },
  { id: "quarter-yellow", svg: `<svg viewBox="0 0 100 100"><path d="M0 0 H100 A100 100 0 0 1 0 100 Z" fill="#F4B400"/></svg>` },
  { id: "arch-pink", svg: `<svg viewBox="0 0 100 100"><path d="M10 92 V50 A40 40 0 0 1 90 50 V92 Z" fill="#F2A6C6"/></svg>` },
  { id: "ring-green", svg: `<svg viewBox="0 0 100 100"><path d="M50 8 A42 42 0 1 1 8 50" fill="none" stroke="#1E8E5A" stroke-width="16" stroke-linecap="round"/></svg>` },
  { id: "dome-blue", svg: `<svg viewBox="0 0 100 100"><path d="M50 5 A45 45 0 0 0 50 95 H10 V5 Z" fill="#1C4FA0"/></svg>` },
  { id: "clover-orange", svg: `<svg viewBox="0 0 100 100"><path d="M50 50 L50 10 A40 40 0 0 1 90 50 Z M50 50 L90 50 A40 40 0 0 1 50 90 Z M50 50 L50 90 A40 40 0 0 1 10 50 Z M50 50 L10 50 A40 40 0 0 1 50 10 Z" fill="#E8720C"/></svg>` },
  { id: "pacman-red", svg: `<svg viewBox="0 0 100 100"><path d="M50 50 L90 30 A45 45 0 1 1 90 70 Z" fill="#E8453C"/></svg>` },
  { id: "dots-yellow", svg: `<svg viewBox="0 0 100 100"><circle cx="30" cy="30" r="18" fill="#F4B400"/><circle cx="70" cy="30" r="18" fill="#F4B400"/><circle cx="30" cy="70" r="18" fill="#F4B400"/><circle cx="70" cy="70" r="18" fill="#F4B400"/></svg>` },
  { id: "burst-green", svg: `<svg viewBox="0 0 100 100"><path d="M50 5 L61 39 L95 39 L67 60 L78 95 L50 74 L22 95 L33 60 L5 39 L39 39 Z" fill="#1E8E5A"/></svg>` },
  { id: "flower-blue", svg: `<svg viewBox="0 0 100 100"><circle cx="50" cy="25" r="22" fill="#1C4FA0"/><circle cx="75" cy="50" r="22" fill="#1C4FA0"/><circle cx="50" cy="75" r="22" fill="#1C4FA0"/><circle cx="25" cy="50" r="22" fill="#1C4FA0"/></svg>` },
];

/**
 * 스티커 팔레트 — 미리보기 화면 하단(사용자 요청 — "on the bottom of the preview
 * page"). 인쇄에는 안 나온다(`.zb-sticker-palette`를 `@media print`가 숨긴다) — 팔레트
 * 자체는 도구지 콘텐츠가 아니다. 드래그·터치 로직은 전부 `assets/zinebook.js`가
 * 맡는다 — 여기서는 마크업만 낸다.
 */
function stickerPaletteHTML() {
  const chips = STICKERS.map(
    (s) => h`<button type="button" class="zb-sticker-chip" data-zb-sticker="${s.id}" aria-label="스티커 놓기: ${s.id}">${raw(s.svg)}</button>`
  );
  return h`<div class="zb-sticker-palette" data-zb-sticker-palette>
  <p class="zb-sticker-hint">스티커를 진 위로 끌어놓아 꾸며보세요. 놓은 스티커는 다시 끌어 옮기거나, 모서리 손잡이를 끌어 크기를 조절할 수 있고, 두 번 탭하면 지워집니다.</p>
  <div class="zb-sticker-tray">${raw(chips.join(""))}</div>
</div>`;
}

/* ── 8개 논리 페이지 콘텐츠 빌더 ── 각자 한 번만 호출되고, 플립북·인쇄 양쪽에 그대로 꽂힌다. */

/**
 * 표지 — 2026-08-12 세 번째 라운드, 실사 참고 사진 기준으로 "랩어라운드"로 다시 짰다.
 * 사용자가 실제로 접어 만든 실물 사진을 보내며 "이 사진과 똑같이"라고 요청 — 사진은
 * "THE ANSWER ZINE" 타이포가 접힌 선(스파인)을 가로질러 뒤표지·앞표지 두 면에
 * 걸쳐 하나로 이어진다. 이게 바로 sheet1-front의 물리 구조다(cover-back|cover-front가
 * 나란히 인쇄되고 그 사이가 접히는 선 — `SHEETS` 참고) — 지금까지는 그 경계를 존중해
 * 타이포를 앞면 한 쪽에만 가뒀는데, 사진은 경계를 무시하고 통짜 캔버스로 다룬다.
 *
 * 구현: 폭 1122px(561×2 — 시트 전체 폭)짜리 캔버스 하나에 문구를 한 번만 그리고,
 * 뒤·앞 두 패널이 각자 561px짜리 창(overflow:hidden)으로 그 캔버스의 왼쪽/오른쪽
 * 절반만 잘라 보여준다(`zb-wrap-canvas--back`은 offset 0, `--front`는 -561px).
 * 두 패널이 완전히 독립된 HTML 조각으로 렌더되지만(그리드 미리보기에서는 나란히
 * 붙어 있지 않다), 같은 폭·같은 폰트 크기·같은 세로 중앙 정렬을 쓰므로 인쇄돼
 * 실제로 나란히 놓일 때 이음매 없이 맞아떨어진다 — 실측(스크린샷)으로 확인했다.
 * 그리드 미리보기에서는 앞·뒤 타일이 서로 안 붙어 있어 각자 "반쪽 글자"로 보인다 —
 * 이건 랩어라운드 표지의 구조적 특성이다(실물도 펼치기 전엔 반쪽씩 보인다). 인쇄
 * 시트가 진짜 결과물이고, 사용자가 보낸 사진도 인쇄물이었다.
 *
 * 2026-08-12 열아홉 번째 라운드 — 문구를 "THE ANSWER ZINE"에서 "THE ANSWER
 * MAGAZINE"으로 바꾸고(layout.mjs 인트로가 이미 2026-08-12 열네 번째 라운드에서
 * 같은 전환을 했다 — 사이트 이름 자체는 안 바뀐다, 표시용 문구만), 그 안에 숨은
 * "ANZINE"(ANSWER의 A·N + MAGAZINE의 Z·I·N·E)만 진하게, 나머지는 회색으로
 * 강조했다(사용자 요청). 인트로는 스크롤에 맞춰 이 강조를 애니메이션으로
 * 드러내지만, 표지는 정적 인쇄물이라 처음부터 두 색으로 고정해서 낸다(위
 * splitCoverWord() 참고) — 같은 브랜드 마크가 인트로(동적)와 표지(정적) 두 곳에서
 * 일관되게 읽힌다. */
function wraparoundCanvas(side) {
  return h`<div class="zb-wrap-viewport">
  <div class="zb-wrap-canvas zb-wrap-canvas--${side}" aria-hidden="true">
    <span class="zb-wrap-word zb-wrap-fade">THE</span>
    <span class="zb-wrap-word">${raw(splitCoverWord("ANSWER", 0, 1))}</span>
    <span class="zb-wrap-word">${raw(splitCoverWord("MAGAZINE", 4, 7))}</span>
  </div>
</div>`;
}

/**
 * 2026-08-12 여섯 번째 라운드 — eyebrow·caption 텍스트를 뺐다(사용자 요청, "delete
 * texts"). 랩어라운드 타이포만 남는다 — 위아래 여백은 `.zb-wrap-viewport`가
 * `position:absolute; inset:0`로 패널 전체를 이미 차지하고 있어 텍스트를 빼도
 * 레이아웃이 그대로다.
 */
function coverFront() {
  return h`<div class="zb-panel zb-panel--cover">
  ${raw(wraparoundCanvas("front"))}
</div>`;
}

function coverBack() {
  return h`<div class="zb-panel zb-panel--cover" aria-label="뒤표지 — 앞표지 타이포의 왼쪽 절반이 이어진다">
  ${raw(wraparoundCanvas("back"))}
</div>`;
}

/**
 * About — 표지 바로 뒷장, 한 페이지 전체(사용자 요청 — "full booklet page, not
 * a small section").
 *
 * 2026-08-12 다섯 번째 라운드 — 사용자가 이 페이지 본문을 통째로 지정해 교체했다.
 * `render-about.mjs`(웹의 /about/ 문구)를 줄여 재사용하던 이전 방식과 달리, 이 카피는
 * 웹 About 페이지와 다른 문구다 — 명시적 요청이라 그대로 옮긴다(웹 /about/은 안 건드림).
 * 제목은 "About"(36px, `.zb-about-title`) 하나뿐이고, 본문은 18~24px 사이에서 실측으로
 * 페이지 높이에 맞춘 크기를 쓴다(`.zb-about-body p`). 문단 사이 여백으로 원문의 빈 줄을
 * 표현하고, 한 문단 안의 개행은 `<br>`로 그대로 살린다.
 *
 * 2026-08-12 여섯 번째 라운드 — 두 가지를 뺐다(사용자 요청): "Answer Zine은 여기서
 * 멈추지 않습니다." 한 문장과, 하단 QR+URL 띠 전체. QR은 이 페이지의 장식이 아니라
 * 페이지 7 전용 콘텐츠로 옮겼다(아래 `scanPanel()` 참고) — 본문 텍스트만 남아 페이지
 * 전체를 순수하게 쓴다.
 */
function aboutPanel() {
  return h`<div class="zb-panel zb-panel--about">
  <h2 class="zb-about-title">About</h2>
  <div class="zb-about-body">
    <p>Answer Zine은 ‘트렌드 뉴스’가 아닙니다.</p>
    <p>영화가 흥행했다.<br>책이 1위에 올랐다.<br>노래가 잘 팔렸다.<br>밈이 유행했다.</p>
    <p>그런데, 왜?</p>
    <p>결과보다 이유를 봅니다.<br>순위보다 왜 팔렸는지를 봅니다.<br>유행보다 무엇이
    유행을 만들었는지를 봅니다.</p>
    <p>모두가 볼 수 있는 결과에서<br>아무도 묻지 않았던 이유를 찾아냅니다.</p>
    <p>그게 Answer Zine이 보는 것입니다.</p>
  </div>
</div>`;
}

/**
 * 스캔 페이지(구 Notes, 논리 키는 여전히 "notes" — `SHEETS`/`FLIP_ORDER`가 물리 배치
 * 계약이라 키 이름은 그대로 둔다). 2026-08-12 여섯 번째 라운드 — 이전 디자인(줄 쳐진
 * 노트 배경 + "NOTES" 라벨 + 메모 안내문)을 전부 빼고, 페이지 정중앙에 QR 코드
 * 하나만 남긴다(사용자 요청 — "Leave only the QR code perfectly centered"). QR은
 * About 페이지(2쪽)에서 옮겨왔다 — 거기는 이제 순수 텍스트 페이지다.
 *
 * `qrSvg`가 없으면(로컬에서 `npm install` 없이 빌드한 경우) 캡션만 남기고 QR 자리를
 * 비운다 — 빌드는 그래도 성공해야 한다(§2.2). URL 텍스트는 안 낸다 — 사용자 요청이
 * "QR + 'Scan for Mobile' 캡션, 그 외 없음"으로 명확했다.
 */
function scanPanel({ qrSvg }) {
  return h`<div class="zb-panel zb-panel--scan">
  <div class="zb-scan-center">
    ${qrSvg ? raw(`<div class="zb-qr zb-qr--large" aria-hidden="true">${qrSvg}</div>`) : ""}
    <p class="zb-scan-caption">Scan for Mobile</p>
  </div>
</div>`;
}

/**
 * 인쇄용 출처 한 줄 — 2026-08-12 여섯 번째 라운드 도입. 인쇄물은 링크를 못 누른다
 * (사용자 요청 — "users cannot click links... replace with a detailed formal
 * citation"). 웹의 `sourceLabel`("뉴스1 Nbox 확인하기" 같은 클릭 유도 문구)은 인쇄에서
 * 뜻이 없다 — "확인하기" 같은 클릭 동사를 떼고, 매체명 · 확정된 기준일(`story.anchorDate`,
 * 이미 검증된 날짜다) · 원본 URL 순서로 다시 조합한다.
 *
 * **한계— 저자·정확한 기사 제목은 못 채웠다.** 이번 세션은 네트워크 egress 프록시가
 * 실제 출처 도메인(news1.kr·edaily.co.kr 등)을 차단해 원문을 열어 바이라인·정확한
 * 표제를 확인할 수 없었다(§7.3 "확인되지 않은 사실을 싣지 않는다" — 저자명·기사 제목을
 * 지어내지 않는다).
 *
 * **한터차트·예스24는 매체명만 낸다(2026-08-12 여덟 번째 라운드, 사용자 요청 — "저자
 * 없이 매체명만 남겨줘").** 이 둘은 애초에 기사가 아니라 실시간 차트·베스트셀러 페이지라
 * 저자 바이라인 자체가 없다 — 그런데도 날짜·URL을 붙여 기사 인용처럼 보이게 하면 없는
 * 정확성을 있는 척하는 것이다. 그래서 이 두 출처만 매체명 하나로 줄인다. 그 외
 * 출처(뉴스1·이데일리 등 실제 기사)는 그대로 매체명·날짜·URL을 낸다 — 사람이 원문을
 * 열어 저자·표제를 추가하거나, 네트워크가 열리면 다시 채워야 한다.
 */
const NAME_ONLY_OUTLETS = [
  { match: /^한터차트/, name: "한터차트" },
  { match: /^예스24/, name: "예스24" },
];

function citationLine(stat, anchorDate) {
  if (!stat?.sourceLabel) return "";
  const outlet = stat.sourceLabel.replace(/\s*확인하기\s*$/, "");
  const nameOnly = NAME_ONLY_OUTLETS.find((o) => o.match.test(outlet));
  if (nameOnly) return nameOnly.name;
  const date = anchorDate ? anchorDate.replace(/-/g, ".") : "";
  return [outlet, date, stat.sourceUrl].filter(Boolean).join(" · ");
}

/**
 * 기사 페이지 — 2026-08-11 전면 확장. 예전엔 헤드라인+티저+스탯+쿼트뿐이라 웹 스토리의
 * 축약본이었다("promotional summary"). 사용자 요청대로 5블록 전부(현상→스탯→맥락→
 * 쿼트+인사이트→마무리)를 웹과 같은 문장으로 낸다 — teaser는 뺐다(texts[0]이 이미 더
 * 자세한 같은 역할이라 나란히 두면 중복이다). "누군가 이 진만 읽고도 이야기와 인사이트를
 * 이해할 수 있어야 한다"는 요구를 그대로 따른 것 — 웹의 축약판이 아니라 인쇄판이다.
 *
 * 2026-08-12 여섯 번째 라운드 — 헤더를 "인사이트 01/04 · 영화"(번호 매기기 + 한글
 * 도메인명)에서 영문 도메인명 하나("MOVIE")만, 우측 상단으로 바꿨다(사용자 요청).
 * `story.domainMeta.nameEn`(registry.json 단일 소스, `allStories()`가 주입)을 대문자로
 * 쓴다 — 없으면(테스트용 목 데이터 등) 한글 도메인명으로 되돌아간다.
 */
function articlePanel(story) {
  if (!story) {
    return h`<div class="zb-panel zb-panel--article zb-panel--empty">
    <p class="zb-empty-note">이 자리는 통과분이 4편에 못 미쳐 비웠다. 확인 안 되는 이야기를
    채우기보다 결번으로 둔다 — 다음 호에 채워진다.</p>
  </div>`;
  }
  const { texts, stat, quote } = blocksOf(story);
  const [t0, t1, t2] = texts;
  const domainLabel = story.domainMeta?.nameEn ? story.domainMeta.nameEn.toUpperCase() : story.domain;
  return h`<div class="zb-panel zb-panel--article">
  <p class="zb-article-domain">${domainLabel}</p>
  <h2 class="zb-article-headline">${story.headline}</h2>
  ${t0 ? raw(h`<p class="zb-article-body">${t0.text}</p>`) : ""}
  ${stat ? raw(h`<div class="zb-stat">
    <span class="zb-stat-label">${stat.label}</span>
    <span class="zb-stat-value">${stat.value}</span>
  </div>`) : ""}
  ${t1 ? raw(h`<p class="zb-article-body">${t1.text}</p>`) : ""}
  ${quote ? raw(h`<p class="zb-quote"><span class="zb-quote-label">THE ANSWER</span>${quote.text}</p>`) : ""}
  ${quote?.insight?.note ? raw(h`<p class="zb-insight-note">${quote.insight.note}</p>`) : ""}
  ${t2 ? raw(h`<p class="zb-article-body zb-article-body--close">${t2.text}</p>`) : ""}
  ${stat ? raw(h`<p class="zb-source">${citationLine(stat, story.anchorDate)}</p>`) : ""}
</div>`;
}

/**
 * 8개 논리 페이지를 한 번씩 만들어 이름으로 찾을 수 있는 맵을 반환한다.
 * `stories`는 지금 홈 카드 그리드에 뜨는 도메인별 최신 스토리 — 모자라면(한 번도
 * 발행된 적 없는 도메인) null로 채워 결번을 낸다.
 */
function buildPages({ stories, qrSvg }) {
  const four = [0, 1, 2, 3].map((i) => stories[i] ?? null);
  return {
    "cover-front": coverFront(),
    "cover-back": coverBack(),
    about: aboutPanel(),
    notes: scanPanel({ qrSvg }),
    "article-1": articlePanel(four[0]),
    "article-2": articlePanel(four[1]),
    "article-3": articlePanel(four[2]),
    "article-4": articlePanel(four[3]),
  };
}

/** 논리적 읽는 순서. §맨 위 주석 참고 — 그리드 미리보기·인쇄 시트 둘 다 이 순서를
    기준으로 번호를 매긴다(그리드는 이 순서로 나열, 인쇄는 SHEETS가 별도로 접는 순서). */
const FLIP_ORDER = ["cover-front", "about", "article-1", "article-2", "article-3", "article-4", "notes", "cover-back"];

/** 물리 인쇄 시트 — 사용자가 지정한 그대로. 바꾸지 않는다. 논리 페이지 1~8을
    8/1, 2/7, 6/3, 4/5로 짝짓는 새들스티치 임포지션이 실제로 맞는지 실측으로
    확인했다(2026-08-11) — 2장을 겹쳐 반으로 접으면 정확히 읽는 순서가 나온다. */
const SHEETS = [
  { id: "sheet1-front", halves: ["cover-back", "cover-front"] },
  { id: "sheet1-back", halves: ["about", "notes"] },
  { id: "sheet2-front", halves: ["article-4", "article-1"] },
  { id: "sheet2-back", halves: ["article-2", "article-3"] },
];

/**
 * 인쇄 전 전체 미리보기 — 2026-08-11 개편. 예전엔 3D 페이지 넘김으로 한 번에 한 쪽만
 * 보여줬다("cropped, partial preview" — 사용자 지적). 8쪽을 읽는 순서 그대로 정적
 * 그리드에 한 번에 다 낸다 — 인쇄 전에 전체 호를 훑어볼 수 있어야 한다는 요구를
 * 그대로 따른 것. 회전·3D 변환 같은 연출은 없앴다 — "불필요한 장식·애니메이션·새
 * UI 시스템을 더하지 말라"는 요구와도 맞는 방향(오히려 이전보다 단순해졌다).
 */
/* `data-zb-page`(논리 페이지 키)를 타일·시트 반쪽 양쪽에 심는다 — 2026-08-12 일곱
   번째 라운드, 스티커 기능이 이 속성으로 "같은 논리 페이지"를 찾아 그리드에 놓은
   스티커를 인쇄 시트 쪽에도 그대로 미러링한다(assets/zinebook.js). 콘텐츠 자체는
   여전히 한 번만 만들어 재사용한다(파일 맨 위 주석) — 이 속성은 그 두 사본을
   런타임에 다시 짝짓는 용도일 뿐이다. */
function gridPreviewHTML(pages) {
  const tiles = FLIP_ORDER.map(
    (key, i) => h`<figure class="zb-tile" data-zb-tile="${i}">
    <figcaption class="zb-tile-num">${i + 1} / ${FLIP_ORDER.length}</figcaption>
    <div class="zb-tile-face" data-zb-page="${key}">${raw(pages[key])}</div>
  </figure>`
  );
  return h`<div class="zb-grid" data-zb-grid>
  ${raw(tiles.join("\n"))}
</div>`;
}

function printSheetsHTML(pages) {
  const sheets = SHEETS.map(
    ({ id, halves }) => h`<section class="zb-sheet" data-zb-sheet="${id}">
    <div class="zb-half" data-zb-page="${halves[0]}">${raw(pages[halves[0]])}</div>
    <div class="zb-fold" aria-hidden="true"></div>
    <div class="zb-half" data-zb-page="${halves[1]}">${raw(pages[halves[1]])}</div>
  </section>`
  );
  return h`<div class="zb-print-sheets" aria-hidden="true">
  ${raw(sheets.join("\n"))}
</div>`;
}

/**
 * `build.mjs`가 한 번 호출해 모든 showChrome 페이지에 그대로 물려준다(categoryNav와 같은
 * 패턴). `issue`가 없으면(회차가 하나도 없는 초기 상태) 아무것도 렌더하지 않는다 —
 * CTA 바가 빈 진을 열어보여주는 것보다 아예 없는 게 낫다.
 *
 * 2026-08-12 여섯 번째 라운드 — 툴바 제목("이번 호 미니 진 — 8쪽 전체 미리보기")과
 * 인쇄 안내 문단을 뺐다(사용자 요청, "delete texts"). 툴바는 이제 버튼(인쇄·닫기)만
 * 남는다 — `.zb-toolbar`가 `justify-content:flex-end`로 오른쪽 정렬한다(css.mjs).
 *
 * 2026-08-12 열세 번째 라운드 — 양면 인쇄 뒷면이 거꾸로 나온다는 사용자 신고로
 * `.zb-duplex-hint`를 새로 추가했다. 코드를 실측한 결론(파일 맨 위 주석·design.md
 * §11.4 참고)은: 페이지 배치·순서에는 버그가 없고(8/1·2/7·6/3·4/5 새들스티치
 * 임포지션이 표준이고 실측 검증됐다), 어느 쪽으로도 회전 CSS가 없다 — 원인은
 * OS/프린터 드라이버의 양면 인쇄 뒤집기 축(긴 변/짧은 변) 설정이다. 이건 웹페이지가
 * 제어할 수 있는 값이 아니다(CSS `@page`에도, 어떤 브라우저 인쇄 API에도 이 축을
 * 지정하는 방법이 없다). 그래서 "구현을 고쳐라"에 대한 실제로 가능한 답은 둘이다:
 * (1) 배치·회전에 숨은 버그가 없는지 실측으로 재확인하는 것(했다), (2) 사용자가
 * 인쇄 대화상자에서 반드시 골라야 하는 그 설정을 절대 놓치지 않게 만드는 것. 이
 * 문구가 (2)다 — 툴바 안이라 인쇄 버튼을 보는 순간 항상 같이 보이고, `.zb-toolbar`
 * 전체가 인쇄에서는 숨는 규칙(css.mjs)을 그대로 물려받아 실제 진 지면에는 안
 * 찍힌다. */
export function renderZinebook({ issue, stories, qrSvg }) {
  if (!issue) return "";
  const pages = buildPages({ stories, qrSvg });

  return h`<button type="button" class="zb-cta" data-zb-open>Create The Answer Zine</button>
<div class="zb-overlay" data-zb-overlay hidden>
  <div class="zb-toolbar">
    <p class="zb-duplex-hint">인쇄 설정 — A4 · 가로(Landscape) · 양면 인쇄 · <strong>짧은 변 기준 뒤집기</strong>(Flip on Short Edge). 이 옵션을 안 고르면 뒷면이 거꾸로 인쇄됩니다.</p>
    <div class="zb-toolbar-actions">
      <button type="button" class="zb-btn zb-btn--print" data-zb-print>${raw(ICON.print)}<span>Print Zine</span></button>
      <button type="button" class="zb-btn zb-btn--icon" data-zb-close aria-label="닫기">${raw(ICON.close)}</button>
    </div>
  </div>

  <div class="zb-viewer">
    ${raw(gridPreviewHTML(pages))}
  </div>

  ${raw(stickerPaletteHTML())}

  ${raw(printSheetsHTML(pages))}
</div>`;
}

export { FLIP_ORDER, SHEETS };

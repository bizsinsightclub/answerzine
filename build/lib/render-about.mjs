/**
 * About — 2026-08-11 도입. 참고 이미지(nippori.lamm.tokyo)의 하단 내비에 있던
 * "ABOUT" 탭을 마스트헤드 상단 내비 맨 앞에 옮겨 달았다(build/lib/layout.mjs의
 * header()). 내용은 README.md·CLAUDE.md §1의 편집 명제를 독자용 문장으로 옮긴 것이다
 * — 원문(반말 지시문)을 그대로 복사하지 않고 사이트 문장 규칙(평서문 '-다',
 * 수식어 없음)에 맞춰 다시 썼다.
 *
 * 2026-08-11 두 번째 개정 — 사용자의 브랜드 방향 문서 §9("홈은 3가지를 빠르게
 * 전달해야 한다: 뭔가 일어났다 / 숨은 이유가 있었다 / 우리가 그걸 답으로 바꾼다")를
 * 반영했다. 홈 인트로 카피는 그대로 둔다(2026-08-10 결정 유지, 사용자 확인) — 이
 * 3단 포지셔닝은 대신 /about/ 첫 문단에 넣는다. 아래 사실 관계를 설명하는 문단들은
 * 안 건드렸다 — 정확하니 그대로 둔다. 바뀐 건 첫 문단(프레이밍)뿐이다.
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { SITE } from "./layout.mjs";

export function renderAbout() {
  const content = h`<main class="shell">
  <a class="back-link" href="${u("/")}">← 홈으로</a>
  <h1>${SITE.tagline}</h1>
  <p class="teaser">뭔가 팔렸다. 거기엔 눈에 안 띄는 이유가 있었다. 우리는 그 이유를 찾아 답으로 바꾼다.</p>

  <div class="story-body">
    <p>순위는 결과다. 우리가 싣는 건 그 결과를 만든 계기다. 1위여도 이유를 못 대면 싣지 않고,
    7위여도 이유가 선명하면 싣는다 — 순위표를 나열하는 화면·기사는 만들지 않는다.</p>

    <p>도메인마다 실 구매·실 소비 숫자(관객수·판매지수·음반 실물 판매 등)를 1차 출처에서
    가져오고, 그 변화를 만든 계기를 특정한다. 숫자와 계기 둘 다 공개 출처로 확인되지 않으면
    후보에서 빠진다 — 확인 안 되는 숫자를 싣는 것보다 결번이 낫다고 본다.</p>

    <p>한 호가 나오면 이 아카이브가 갱신되고, A4 한 장짜리 인쇄용 요약지가 함께 나온다. 지금은
    영화·음악·유튜브·도서 네 카테고리를 다룬다.</p>
  </div>

  <p style="margin-top:32px"><a class="back-link" href="${u("/archive/")}">전체 아카이브 보기 →</a></p>
</main>`;

  return {
    title: `About — ${SITE.name}`,
    description: `${SITE.name}이 무엇을 어떻게 고르는지.`,
    content,
    noindex: false,
  };
}

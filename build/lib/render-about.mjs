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
 *
 * 2026-08-13 세 번째 개정 — "ANZINE — ABOUT / WHY ANZINE Refinement". 사용자가
 * "WHY ANZINE을 사이트에서 가장 강한 편집 모먼트 중 하나로 만들라"고 요청하며 코어
 * 카피를 직접 줬다(§2, 원문 그대로 사용 — "의미를 크게 다시 쓰지 말 것"). 이전
 * 개정의 옅은 h1+티저 오프닝("순위 말고, 팔린 이유." + "뭔가 팔렸다...")을 걷어내고
 * 그 자리에 이 WHY ANZINE 블록을 앉혔다 — 둘이 같은 이야기("결과보다 이유")를
 * 하고 있어서, 약한 버전을 강한 버전으로 교체한 것이지 새 섹션을 얹은 게 아니다.
 * SITE.tagline 자체는 안 지웠다(site.mjs에 그대로 있고 홈 메타 설명·OG 이미지 alt에
 * 계속 쓰인다) — 이 페이지의 화면 표시 자리에서만 뺐다.
 *
 * 구조(요청 §3 위계 그대로): WHY ANZINE(eyebrow) → 리드(무엇이 흥행하는지 나열, 대비
 * 설정) → 중심 질문(가장 큰 시각 요소, 페이지의 진짜 h1) → 설명 두 문단 → 닫는 문장
 * ("결과보다 이유를, 순위보다 왜 팔렸는지를" — SITE.tagline의 확장판, quote.text가
 * 쓰는 "답의 순간" 문법과 같은 자리). 그 아래 기존 사실 관계 문단(선정 기준·데이터
 * 출처·발행 주기)은 문장 하나 안 고치고 그대로 두되, 괘선(.about-mechanics)으로
 * WHY ANZINE과 시각적으로 분리했다 — "저 위는 왜, 이 아래는 어떻게"로 읽힌다.
 *
 * About 페이지에는 원래도 "UNEXPECTED" 문구가 없었다(2026-08-13 Editorial
 * Readability Pass에서 텍스트 검색 + 스크린샷으로 확인 — 화면에 없다). 그 표현은
 * 홈(.issue-insight)과 DIY 진에만 있고 둘 다 이번 요청 §6·§7의 보호 대상이다 —
 * 그래서 이 파일에서 UNEXPECTED 관련해 뺀 것도 바꾼 것도 없다.
 */
import { h, raw } from "./html.mjs";
import { u } from "./site.mjs";
import { SITE } from "./layout.mjs";

export function renderAbout() {
  const content = h`<main class="shell">
  <a class="back-link" href="${u("/")}">← 홈으로</a>

  <section class="why-anzine">
    <span class="why-eyebrow">Why ANZINE</span>
    <p class="why-lead">영화가 흥행하고, 책이 팔리고, 음악이 차트에 오르고, 콘텐츠가 바이럴됩니다.
    하지만 ANZINE이 궁금한 건 무엇이 떴는지가 아닙니다.</p>

    <h1 class="why-question">사람들은 지금 무엇에 돈을 쓰고 있을까.<br>그리고 왜 그곳에 지갑을 열었을까.</h1>

    <div class="why-body">
      <p>ANZINE은 실제 판매·매출·소비 데이터와 시장의 이상 신호를 따라가며, 사람들이 무엇을
      선택했는지보다 <strong>왜 그것을 선택하고 소비했는지</strong>를 찾아냅니다.</p>

      <p>많이 언급되는 트렌드를 나열하는 대신, 평소와 다른 움직임을 발견하고 그 뒤의 소비자 행동과
      문화적 맥락을 연결합니다.</p>
    </div>

    <p class="why-closing">결과보다 이유를,<br>순위보다 왜 팔렸는지를.</p>
  </section>

  <div class="story-body about-mechanics">
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
    description: `${SITE.tagline} ${SITE.name}이 무엇을 어떻게 고르는지.`,
    content,
    noindex: false,
  };
}

/**
 * 이벤트 위임만 담당한다.
 *
 * 프로토타입은 onclick 속성에 스토리 id를 문자열로 보간했다 (CLAUDE.md §9.7).
 * 여기서는 document 하나에 리스너를 걸고 data 속성으로 분기한다.
 * 콘텐츠는 이미 서버(빌드)에서 렌더돼 있으므로 이 파일이 없어도 읽기는 된다.
 */
(function () {
  "use strict";

  /* ── 단일 위임 리스너 ──
     2026-08-10부터 도메인 필터(.seg)가 없다 — 홈이 카테고리 카드 그리드로 바뀌면서
     "골라서 좁혀 본다"는 필터 개념 자체가 없어졌다(카드 하나 = 도메인 하나, 클릭하면
     바로 그 도메인의 최신 스토리로 간다). 그래서 여기 남은 위임 대상은 인쇄 버튼뿐이다. */
  document.addEventListener("click", function (e) {
    var print = e.target.closest("[data-print]");
    if (print) {
      window.print();
      return;
    }
  });

  /* ── 진입 화면 ──
     2026-08-10 리디자인: 큰 워드마크가 중앙에 겹쳐 있다가, 스크롤하면 갈라지며 그 뒤의
     아카이브가 드러난다. 스테이트먼트 단계는 없앴다 — 인트로 섹션 하나만 있다. 홈에서만
     나오고, 세션에 한 번 봤다고 건너뛰지 않는다 — 뒤로 가기로 돌아와도 매번 다시 보인다.
     2026-08-11 여덟 번째 라운드: "THE ANSWER"를 THE·ANSWER 두 단어로 뗐다(layout.mjs
     intro() 주석) — 세 줄이 됐으니 방향도 셋으로 나눈다: THE·ZINE은 오른쪽,
     ANSWER는 왼쪽(사용자 요청 — 위아래 두 줄이 같은 방향, 가운데 줄만 반대로 갈라진다).
     2026-08-12 열네 번째 라운드: 셋째 줄 문구가 ZINE→MAGAZINE으로 바뀌면서 클래스도
     intro-word-zine→intro-word-magazine으로 바뀌었다(layout.mjs intro() 주석 — "ANZINE"
     글자 강조 효과). */
  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 인트로는 뷰포트보다 큰 상자(css.mjs .intro { height: 160svh })라 안쪽 콘텐츠가
     sticky로 고정된 채 남는다. 그 "여유분"(상자 높이 − 뷰포트 높이)만큼 스크롤하는 동안
     진행률을 0→1로 잡아야, 고정돼 있는 동안 실제로 갈라지는 게 보인다 — 그냥 뷰포트
     높이로 나누면 상자가 이미 다 지나간 뒤에야 p가 1이 되어 버려서, 고정 구간 내내
     화면은 그대로인 채 스크롤만 되는 것처럼 보인다(모션이 없어 보이는 원인).
     스크립트가 없거나 동작 최소화 환경이면 세 줄은 그냥 중앙에 겹친 채로 스크롤되어
     지나간다 — 내용(텍스트)은 어느 쪽이든 항상 읽힌다. */
  function bootIntroMotion() {
    var introEl = document.getElementById("intro");
    var wordmarkEl = introEl && introEl.querySelector(".intro-wordmark");
    var wordThe = introEl && introEl.querySelector(".intro-word-the");
    var wordAnswer = introEl && introEl.querySelector(".intro-word-answer");
    var wordMagazine = introEl && introEl.querySelector(".intro-word-magazine");
    if (!introEl || !wordmarkEl || !wordThe || !wordAnswer || !wordMagazine || prefersReduce()) return;

    var raf = null;
    function update() {
      raf = null;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var introBox = introEl.getBoundingClientRect();
      var pinRange = Math.max(1, introBox.height - vh);
      var p = clamp(-introBox.top / pinRange, 0, 1);

      wordThe.style.transform = "translateX(" + (p * 70) + "vw)";
      wordMagazine.style.transform = "translateX(" + (p * 70) + "vw)";
      wordAnswer.style.transform = "translateX(" + (p * -70) + "vw)";
      // 진행률 60% 지점부터 옅어져, 다 갈라지기 전에 사라지고 본문이 자연스럽게 이어진다.
      var fade = clamp(1 - (p - 0.6) / 0.4, 0, 1);
      wordThe.style.opacity = String(fade);
      wordAnswer.style.opacity = String(fade);
      wordMagazine.style.opacity = String(fade);
      // 스크롤을 시작하는 순간(아주 조금만 움직여도) "ANZINE" 강조 클래스를 켠다 — 연속
      // 값이 아니라 켬/끔 하나면 충분해서(css.mjs .intro-wordmark.is-revealing 참고),
      // 매 프레임 낱글자 색을 다시 계산하지 않는다. classList.toggle은 상태가 실제로
      // 바뀔 때만 DOM에 반영되므로 매 프레임 호출해도 비용이 없다.
      wordmarkEl.classList.toggle("is-revealing", p > 0.02);
    }
    function onScroll() { if (raf === null) raf = requestAnimationFrame(update); }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* ── 스크롤 등장 ──
     본문은 이미 HTML에 있다. 이건 읽는 순서에 리듬을 주는 장치일 뿐이라,
     IntersectionObserver가 없는 브라우저에서는 전부 그냥 보이게 두고 끝낸다. */
  function bootReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    if (prefersReduce() || !("IntersectionObserver" in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add("is-in");
      return;
    }

    // 화면에 순서대로 들어오도록 형제 사이에 계단 지연을 준다.
    var seen = {};
    for (var j = 0; j < items.length; j++) {
      var key = items[j].parentNode ? items[j].parentNode.className || "root" : "root";
      seen[key] = (seen[key] || 0) + 1;
      items[j].style.setProperty("--i", String(Math.min(seen[key] - 1, 6)));
    }

    var io = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        if (!entries[k].isIntersecting) continue;
        entries[k].target.classList.add("is-in");
        io.unobserve(entries[k].target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

    for (var m = 0; m < items.length; m++) io.observe(items[m]);
  }

  /* ── 초기화 ── */
  bootIntroMotion();
  bootReveal();
})();

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
     2026-08-12 열네 번째 라운드: 셋째 줄 문구가 ZINE→MAGAZINE으로 바뀌면서 클래스도
     intro-word-zine→intro-word-magazine으로 바뀌었다(layout.mjs intro() 주석 — "ANZINE"
     글자 강조 효과).
     2026-08-12 열다섯 번째 라운드 — 안무를 다시 짰다(사용자 요청). 예전엔(여덟 번째
     라운드) 세 줄 전체가 좌우로 갈라지며 사라졌는데, 이제는: (1) 스크롤을 시작하면
     "ANZINE"이 아닌 글자가 회색으로 옅어지고(레이아웃 안 바뀜, 기존 유지), (2) 더
     스크롤하면 그 옅어진 글자들이 완전히 투명해지면서 "AN"·"ZINE" 두 조각이 화면
     정중앙으로 함께 이동해 "ANZINE"이 완성된다.
     2026-08-12 열여섯 번째 라운드 — "AN도 움직여서 정중앙에서 만나도록" 요청으로
     한 번 더 고쳤다. 바로 앞 라운드는 AN을 고정점으로 두고 ZINE만 그 오른쪽으로
     옮겼는데, 그러면 AN이 원래 있던 자리(ANSWER 단어의 왼쪽 절반이라 화면 중앙보다
     왼쪽)가 그대로 합쳐진 자리가 돼 "ANZINE"이 화면 정중앙이 아니라 살짝 왼쪽에
     자리 잡았다. 이제 둘 다 움직인다 — 목표 지점을 "합쳐진 폭(AN 너비+ZINE 너비)이
     화면 정중앙에 오도록" 계산해서, AN은 오른쪽으로, ZINE은 왼쪽으로 서로를 향해
     이동한다. */
  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 인트로는 뷰포트보다 큰 상자(css.mjs .intro { height: 160svh })라 안쪽 콘텐츠가
     sticky로 고정된 채 남는다. 그 "여유분"(상자 높이 − 뷰포트 높이)만큼 스크롤하는 동안
     진행률을 0→1로 잡아야, 고정돼 있는 동안 실제로 전환이 보인다 — 그냥 뷰포트
     높이로 나누면 상자가 이미 다 지나간 뒤에야 p가 1이 되어 버려서, 고정 구간 내내
     화면은 그대로인 채 스크롤만 되는 것처럼 보인다(모션이 없어 보이는 원인).
     스크립트가 없거나 동작 최소화 환경이면 텍스트는 그냥 검정으로 중앙에 남은 채
     스크롤되어 지나간다 — 내용(텍스트)은 어느 쪽이든 항상 읽힌다. */
  function bootIntroMotion() {
    var introEl = document.getElementById("intro");
    var wordmarkEl = introEl && introEl.querySelector(".intro-wordmark");
    var wordThe = introEl && introEl.querySelector(".intro-word-the");
    var an = introEl && introEl.querySelector('[data-intro-role="an"]');
    var zine = introEl && introEl.querySelector('[data-intro-role="zine"]');
    var fades = introEl ? Array.prototype.slice.call(introEl.querySelectorAll(".intro-fade")) : [];
    if (!introEl || !wordmarkEl || !wordThe || !an || !zine || !fades.length || prefersReduce()) return;

    // AN·ZINE 둘 다 움직여 화면 정중앙에서 만난다(사용자 요청 — 처음엔 AN을 고정점
    // 삼아 ZINE만 옮겼는데, "AN도 움직여서 정중앙에서 만나도록" 다시 잡았다). 목표
    // 지점은 "합쳐진 ANZINE 한 단어가 뷰포트 한가운데 놓였을 때" AN이 있어야 할 자리와
    // ZINE이 있어야 할 자리다 — 두 조각의 실측 너비(wA·wZ)를 더한 폭을 화면 중앙에
    // 맞추고, AN은 그 블록의 왼쪽 절반, ZINE은 오른쪽 절반을 차지한다. 세로는 둘 다
    // `.intro-inner`(뷰포트를 꽉 채우는 sticky 상자)의 세로 중심으로 모인다. 뷰포트
    // 크기가 바뀌면(반응형 clamp() 폰트 크기) 값도 달라지므로 resize마다 다시 잰다 —
    // 재는 순간엔 이전 프레임의 transform이 섞여 들어가지 않도록 먼저 원상태로
    // 되돌린 뒤 잰다.
    var dxAN = 0, dyAN = 0, dxZine = 0, dyZine = 0;
    function measure() {
      an.style.transform = "none";
      zine.style.transform = "none";
      var innerRect = introEl.querySelector(".intro-inner").getBoundingClientRect();
      var anRect = an.getBoundingClientRect();
      var zineRect = zine.getBoundingClientRect();
      var centerX = innerRect.left + innerRect.width / 2;
      var centerY = innerRect.top + innerRect.height / 2;
      var mergedLeft = centerX - (anRect.width + zineRect.width) / 2;
      var targetANCenterX = mergedLeft + anRect.width / 2;
      var targetZineCenterX = mergedLeft + anRect.width + zineRect.width / 2;

      dxAN = targetANCenterX - (anRect.left + anRect.width / 2);
      dyAN = centerY - (anRect.top + anRect.height / 2);
      dxZine = targetZineCenterX - (zineRect.left + zineRect.width / 2);
      dyZine = centerY - (zineRect.top + zineRect.height / 2);
    }

    // 0~CONVERGE_START: 색만 옅어진다(기존 1단계, 레이아웃 안 바뀜).
    // CONVERGE_START~CONVERGE_END: 옅어진 조각이 완전히 투명해지고 ZINE이 AN 옆으로
    // 이동해 "ANZINE"을 완성한다.
    // CONVERGE_END~1: 완성된 "ANZINE"이 그대로 화면에 붙박여 있다가(.intro-inner가
    // sticky로 고정된 마지막 구간), p가 1을 넘는 순간 고정이 풀리며 화면 밖으로
    // 스크롤되어 나간다. 이 마지막 구간이 없으면(예전엔 CONVERGE_END를 1로 잡았다)
    // "ANZINE"이 완성되자마자 곧바로 화면 밖으로 밀려나 완성된 모습을 볼 틈이 없다 —
    // 실측(Playwright로 p=1 스크린샷)에서 발견했다.
    var CONVERGE_START = 0.2;
    var CONVERGE_END = 0.75;

    var raf = null;
    function update() {
      raf = null;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var introBox = introEl.getBoundingClientRect();
      var pinRange = Math.max(1, introBox.height - vh);
      var p = clamp(-introBox.top / pinRange, 0, 1);

      // 스크롤을 시작하는 순간(아주 조금만 움직여도) "ANZINE" 강조 클래스를 켠다 — 연속
      // 값이 아니라 켬/끔 하나면 충분해서(css.mjs .intro-wordmark.is-revealing 참고),
      // 매 프레임 낱글자 색을 다시 계산하지 않는다. classList.toggle은 상태가 실제로
      // 바뀔 때만 DOM에 반영되므로 매 프레임 호출해도 비용이 없다.
      wordmarkEl.classList.toggle("is-revealing", p > 0.02);

      var p2 = clamp((p - CONVERGE_START) / (CONVERGE_END - CONVERGE_START), 0, 1);
      var fadeOpacity = String(1 - p2);
      wordThe.style.opacity = fadeOpacity;
      for (var i = 0; i < fades.length; i++) fades[i].style.opacity = fadeOpacity;
      // transform은 CSS 트랜지션을 안 건다(css.mjs) — 스크롤 자체가 이미 매 프레임
      // 값을 보간해 주므로, 트랜지션까지 걸면 스크롤 위치와 실제 화면이 어긋난다.
      an.style.transform = "translate(" + (dxAN * p2) + "px, " + (dyAN * p2) + "px)";
      zine.style.transform = "translate(" + (dxZine * p2) + "px, " + (dyZine * p2) + "px)";
    }
    function onScroll() { if (raf === null) raf = requestAnimationFrame(update); }
    function onResize() { measure(); onScroll(); }

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
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

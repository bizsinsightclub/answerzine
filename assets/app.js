/**
 * 이벤트 위임만 담당한다.
 *
 * 프로토타입은 onclick 속성에 스토리 id를 문자열로 보간했다 (CLAUDE.md §9.7).
 * 여기서는 document 하나에 리스너를 걸고 data 속성으로 분기한다.
 * 콘텐츠는 이미 서버(빌드)에서 렌더돼 있으므로 이 파일이 없어도 읽기는 된다.
 */
(function () {
  "use strict";

  /* ── 도메인 필터 ── */
  function applyFilter(key) {
    var items = document.querySelectorAll("[data-domain]:not(button)");
    var shown = 0;
    for (var i = 0; i < items.length; i++) {
      var match = key === "all" || items[i].getAttribute("data-domain") === key;
      items[i].hidden = !match;
      // 숨어 있던 동안에는 화면에 들어온 적이 없어 등장 상태가 안 붙는다.
      // 필터로 다시 꺼낸 항목이 투명한 채 남지 않도록 여기서 확정한다.
      if (match) { items[i].classList.add("is-in"); shown++; }
    }

    // 통합 인사이트(issue.insight)는 그 주 전체를 관통하는 제목이다 — 한 도메인으로
    // 좁혀 보는 중에는(전체가 아닌 필터) 그 관통이 안 맞으므로 "전체"에서만 보인다.
    var insight = document.querySelector(".issue-insight");
    if (insight) insight.hidden = key !== "all";

    var btns = document.querySelectorAll(".seg button[data-domain]");
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute("aria-pressed", btns[j].getAttribute("data-domain") === key ? "true" : "false");
    }

    var empty = document.querySelector("[data-empty]");
    if (empty) empty.hidden = shown !== 0;

    var url = new URL(location.href);
    if (key === "all") url.searchParams.delete("domain");
    else url.searchParams.set("domain", key);
    history.replaceState(null, "", url);
  }

  /* ── 단일 위임 리스너 ── */
  document.addEventListener("click", function (e) {
    var print = e.target.closest("[data-print]");
    if (print) {
      window.print();
      return;
    }

    var seg = e.target.closest(".seg button[data-domain]");
    if (seg) {
      applyFilter(seg.getAttribute("data-domain"));
    }
  });

  /* ── 진입 화면 ──
     2026-08-10 리디자인: "THE ANSWER" / "COMPANY" 두 줄이 중앙에 겹쳐 있다가, 스크롤하면
     첫 줄은 오른쪽으로 둘째 줄은 왼쪽으로 갈라지며 그 뒤의 아카이브가 드러난다. 스테이트먼트
     단계는 없앴다 — 인트로 섹션 하나만 있다. 홈에서만 나오고, 세션에 한 번 봤다고
     건너뛰지 않는다 — 뒤로 가기로 돌아와도 매번 다시 보인다. */
  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 인트로는 뷰포트보다 큰 상자(css.mjs .intro { height: 160svh })라 안쪽 콘텐츠가
     sticky로 고정된 채 남는다. 그 "여유분"(상자 높이 − 뷰포트 높이)만큼 스크롤하는 동안
     진행률을 0→1로 잡아야, 고정돼 있는 동안 실제로 갈라지는 게 보인다 — 그냥 뷰포트
     높이로 나누면 상자가 이미 다 지나간 뒤에야 p가 1이 되어 버려서, 고정 구간 내내
     화면은 그대로인 채 스크롤만 되는 것처럼 보인다(모션이 없어 보이는 원인).
     스크립트가 없거나 동작 최소화 환경이면 두 줄은 그냥 중앙에 겹친 채로 스크롤되어
     지나간다 — 내용(텍스트)은 어느 쪽이든 항상 읽힌다. */
  function bootIntroMotion() {
    var introEl = document.getElementById("intro");
    var word1 = introEl && introEl.querySelector(".intro-word-1");
    var word2 = introEl && introEl.querySelector(".intro-word-2");
    if (!introEl || !word1 || !word2 || prefersReduce()) return;

    var raf = null;
    function update() {
      raf = null;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var introBox = introEl.getBoundingClientRect();
      var pinRange = Math.max(1, introBox.height - vh);
      var p = clamp(-introBox.top / pinRange, 0, 1);

      word1.style.transform = "translateX(" + (p * 70) + "vw)";
      word2.style.transform = "translateX(" + (p * -70) + "vw)";
      // 진행률 60% 지점부터 옅어져, 다 갈라지기 전에 사라지고 본문이 자연스럽게 이어진다.
      var fade = clamp(1 - (p - 0.6) / 0.4, 0, 1);
      word1.style.opacity = String(fade);
      word2.style.opacity = String(fade);
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

  var initial = new URL(location.href).searchParams.get("domain");
  if (initial && document.querySelector(".seg button[data-domain]")) applyFilter(initial);
})();

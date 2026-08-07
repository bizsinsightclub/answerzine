/**
 * 이벤트 위임만 담당한다.
 *
 * 프로토타입은 onclick 속성에 스토리 id를 문자열로 보간했다 (CLAUDE.md §9.7).
 * 여기서는 document 하나에 리스너를 걸고 data 속성으로 분기한다.
 * 콘텐츠는 이미 서버(빌드)에서 렌더돼 있으므로 이 파일이 없어도 읽기는 된다.
 */
(function () {
  "use strict";

  var root = document.documentElement;

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
     로고 → 스테이트먼트 → 본문 섹션은 문서 흐름 안에 그냥 있다 (CSS 100svh + 스크롤).
     JS가 하는 일은 하나뿐이다 — 본문(#main-content)에 닿으면 "이번 세션엔 이미
     봤다"는 표시를 남겨서, 같은 세션의 다음 페이지부터는 건너뛰게 한다. */
  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function markIntroSeen() {
    try { sessionStorage.setItem("az-intro", "1"); } catch (e) {}
  }

  function bootIntro() {
    var main = document.getElementById("main-content");
    if (!main) return;
    if (root.className.indexOf("intro-done") !== -1) { markIntroSeen(); return; }

    if (!("IntersectionObserver" in window)) { markIntroSeen(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        markIntroSeen();
        io.disconnect();
      }
    }, { threshold: 0 });
    io.observe(main);
  }

  /* ── 스테이트먼트 CTA 페이드 ──
     "아카이브 보기"는 버튼이 아니라 뜬 힌트다. 그 구간에 막 들어왔을 때만 보이고,
     아래로 스크롤을 시작하는 순간 옅어져 사라진다. 위로 돌아오면 다시 보인다.
     스크립트가 없으면 그냥 늘 보이는 채로 있다가 섹션과 함께 스크롤되어 나간다. */
  function bootStatementFade() {
    var cta = document.querySelector(".statement-cta");
    var wrap = document.getElementById("statement");
    if (!cta || !wrap) return;

    var raf = null;
    function update() {
      raf = null;
      var rect = wrap.getBoundingClientRect();
      var inView = rect.top < window.innerHeight && rect.bottom > 0;
      var past = inView ? Math.max(0, -rect.top) : 999;
      var opacity = Math.max(0, 1 - past / 80);
      cta.style.opacity = String(opacity);
      cta.style.pointerEvents = opacity < 0.05 ? "none" : "";
    }
    function onScroll() { if (raf === null) raf = requestAnimationFrame(update); }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
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
  bootIntro();
  bootStatementFade();
  bootReveal();

  var initial = new URL(location.href).searchParams.get("domain");
  if (initial && document.querySelector(".seg button[data-domain]")) applyFilter(initial);
})();

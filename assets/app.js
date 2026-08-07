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
  var KEY = "az-theme";

  /* ── 테마 ── */
  function currentTheme() {
    return root.getAttribute("data-theme") === "paper" ? "paper" : "night";
  }

  function applyTheme(name) {
    if (name === "paper") root.setAttribute("data-theme", "paper");
    else root.removeAttribute("data-theme");
    try { localStorage.setItem(KEY, name); } catch (e) {}
    syncToggleLabels();
  }

  function syncToggleLabels() {
    var next = currentTheme() === "paper" ? "Night" : "Paper";
    var btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = next;
      btns[i].setAttribute("aria-label", next + " 테마로 전환");
    }
  }

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

    // 나머지가 전부 걸러졌으면 그 층을 여는 라벨도 함께 내린다.
    // 안 그러면 아무것도 없는 자리에 "함께 실린 기사"만 남는다.
    var restLabel = document.querySelector("[data-rest-label]");
    if (restLabel) {
      var rows = document.querySelectorAll(".index-rest [data-domain]");
      var visible = 0;
      for (var r = 0; r < rows.length; r++) if (!rows[r].hidden) visible++;
      restLabel.hidden = visible === 0;
    }

    var url = new URL(location.href);
    if (key === "all") url.searchParams.delete("domain");
    else url.searchParams.set("domain", key);
    history.replaceState(null, "", url);
  }

  /* ── 단일 위임 리스너 ── */
  document.addEventListener("click", function (e) {
    var toggle = e.target.closest("[data-theme-toggle]");
    if (toggle) {
      applyTheme(currentTheme() === "paper" ? "night" : "paper");
      return;
    }

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

  /* ── 인트로 로딩 화면 ──
     걷히는 것 자체는 CSS 애니메이션이 한다 (JS가 없어도 사라진다).
     여기서 하는 일은 셋뿐이다 — 걷히는 동안 스크롤을 잠그고, 끝나면 DOM에서 지우고,
     같은 세션에서는 두 번 보여주지 않도록 표시를 남긴다. */
  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function endSplash(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    root.className = root.className.replace(/\s*splash-lock/g, "") + " splash-gone";
    try { sessionStorage.setItem("az-intro", "1"); } catch (e) {}
  }

  /** 인트로가 끝나면 next()를 부른다. 인트로가 없으면 즉시 부른다. */
  function bootSplash(next) {
    var el = document.querySelector("[data-splash]");
    var seen = root.className.indexOf("splash-done") !== -1;
    if (!el || seen || prefersReduce()) { endSplash(el); return next(); }

    root.className += " splash-lock";
    var done = false;
    var finish = function () { if (done) return; done = true; endSplash(el); next(); };

    el.addEventListener("animationend", function (e) {
      if (e.animationName === "splash-out") finish();
    });
    // 애니메이션 이벤트가 오지 않는 경우(배경 탭, 애니메이션 차단)에도 잠금이 남으면 안 된다.
    setTimeout(finish, 2600);
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

  /* ── 초기화 ──
     등장은 인트로가 걷힌 뒤에 시작한다. 로고 화면 뒤에서 몰래 다 끝나 있으면
     인트로가 걷혔을 때 이미 정지된 화면을 보게 된다. */
  syncToggleLabels();
  bootSplash(bootReveal);

  var initial = new URL(location.href).searchParams.get("domain");
  if (initial && document.querySelector(".seg button[data-domain]")) applyFilter(initial);
})();

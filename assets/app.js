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
      if (match) shown++;
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

  /* ── 초기화 ── */
  syncToggleLabels();

  var initial = new URL(location.href).searchParams.get("domain");
  if (initial && document.querySelector(".seg button[data-domain]")) applyFilter(initial);
})();

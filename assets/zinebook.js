/**
 * DIY 진 — 하단 CTA(숨김) 또는 홈 마퀴 밴드 → 8쪽 전체 미리보기 오버레이 → 인쇄.
 *
 * app.js와 분리된 별도 모듈이다(요구사항 #5 "모듈화") — 이 기능이 없는 페이지
 * (예: 인쇄 전용 `/print/` 라우트)는 이 스크립트 자체를 안 받는다(layout.mjs가
 * zinebook 마크업이 있을 때만 <script> 태그를 심는다).
 *
 * 2026-08-11 개편 — 예전엔 3D 페이지 넘김(CSS `perspective`+`rotateY`)으로 한 번에
 * 한 쪽만 보여줬다. 지금은 8쪽을 읽는 순서 그대로 정적 그리드에 한 번에 낸다(사용자
 * 요청 — "인쇄 전에 전체 호를 볼 수 있어야 한다"). 각 타일의 축소 배율은 CSS 컨테이너
 * 쿼리 단위(cqw)로 계산해 css.mjs가 전담한다 — JS는 열고/닫고/인쇄하는 것만 한다.
 * 페이지 넘김 상태 자체가 없어져 리사이즈 리스너·배율 계산 로직이 통째로 필요 없어졌다.
 */
(function () {
  "use strict";

  function boot() {
    // 하단 고정 CTA(.zb-cta)는 화면에서 숨겼지만(display:none) 마크업은 남아 있다.
    // 홈의 마퀴 밴드(.category-divider)도 같은 오버레이를 여는 두 번째 진입점이라
    // 트리거가 하나 이상일 수 있다 — querySelectorAll로 전부 잡는다.
    var ctas = Array.prototype.slice.call(document.querySelectorAll("[data-zb-open]"));
    var overlay = document.querySelector("[data-zb-overlay]");
    if (!ctas.length || !overlay) return;

    var closeBtn = overlay.querySelector("[data-zb-close]");
    var printBtn = overlay.querySelector("[data-zb-print]");
    var lastFocused = null;

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    function open() {
      lastFocused = document.activeElement;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKey);
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
      else if (ctas[0]) ctas[0].focus();
    }

    ctas.forEach(function (cta) { cta.addEventListener("click", open); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

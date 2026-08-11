/**
 * DIY 진 — 하단 CTA → 3D 플립북 오버레이 → 인쇄.
 *
 * app.js와 분리된 별도 모듈이다(요구사항 #5 "모듈화") — 이 기능이 없는 페이지
 * (예: 인쇄 전용 `/print/` 라우트)는 이 스크립트 자체를 안 받는다(layout.mjs가
 * zinebook 마크업이 있을 때만 <script> 태그를 심는다).
 *
 * 3D 플립은 물리 페이지 넘김을 시뮬레이션하지 않는다 — CSS `perspective` +
 * `rotateY` 회전을 쓰는 "책장 넘기기" 기법이다(카드 뒤집기와 같은 원리를 8장에
 * 적용한 것). 외부 라이브러리 없이 이 정도가 신뢰성 있게 구현할 수 있는 선이라고
 * 판단했다 — CLAUDE.md §7.3(빌드 도구·의존성 추가는 사용자 승인 사항)과도 맞는다.
 */
(function () {
  "use strict";

  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* 미리보기 패널은 인쇄판과 같은 고정 캔버스(561×794px, 148.5mm×210mm @96dpi)로 그려진
     뒤 실제 leaf 크기에 맞춰 scale된다(css.mjs .zb-leaf-face .zb-panel 주석 참고).
     그 배율을 여기서 실측해 --zb-scale로 써 넣는다. */
  var DESIGN_W = 561;

  function boot() {
    // 2026-08-11 — 하단 고정 CTA(.zb-cta)는 화면에서 숨겼지만(display:none) 마크업은
    // 남아 있다. 홈의 마퀴 밴드(.category-divider)도 같은 오버레이를 여는 두 번째
    // 진입점이라 트리거가 하나 이상일 수 있다 — querySelectorAll로 전부 잡는다.
    var ctas = Array.prototype.slice.call(document.querySelectorAll("[data-zb-open]"));
    var overlay = document.querySelector("[data-zb-overlay]");
    if (!ctas.length || !overlay) return;

    var stage = overlay.querySelector("[data-zb-stage]");
    var leaves = Array.prototype.slice.call(overlay.querySelectorAll(".zb-leaf"));
    var closeBtn = overlay.querySelector("[data-zb-close]");
    var prevBtn = overlay.querySelector("[data-zb-prev]");
    var nextBtn = overlay.querySelector("[data-zb-next]");
    var printBtn = overlay.querySelector("[data-zb-print]");
    var indicator = overlay.querySelector("[data-zb-indicator]");
    var total = leaves.length;
    var current = 0;
    var lastFocused = null;
    var scaleRaf = null;

    function updateScale() {
      scaleRaf = null;
      if (!stage) return;
      var w = stage.getBoundingClientRect().width;
      if (w > 0) stage.style.setProperty("--zb-scale", String(w / DESIGN_W));
    }
    function queueScale() { if (scaleRaf === null) scaleRaf = requestAnimationFrame(updateScale); }

    function renderLeaves() {
      leaves.forEach(function (leaf, i) {
        var flipped = i < current;
        leaf.style.transform = flipped ? "rotateY(-180deg)" : "rotateY(0deg)";
        leaf.style.zIndex = String(flipped ? i : total - i);
      });
      if (indicator) indicator.textContent = (current + 1) + " / " + total;
      if (prevBtn) prevBtn.disabled = current <= 0;
      if (nextBtn) nextBtn.disabled = current >= total - 1;
    }

    function next() { if (current < total - 1) { current++; renderLeaves(); } }
    function prev() { if (current > 0) { current--; renderLeaves(); } }

    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }

    function open() {
      lastFocused = document.activeElement;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      renderLeaves();
      queueScale();
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", queueScale);
      if (closeBtn) closeBtn.focus();
    }
    function close() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", queueScale);
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
      else if (ctas[0]) ctas[0].focus();
    }

    ctas.forEach(function (cta) { cta.addEventListener("click", open); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (nextBtn) nextBtn.addEventListener("click", next);
    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

    leaves.forEach(function (leaf, i) {
      leaf.addEventListener("click", function () { if (i === current) next(); });
      leaf.addEventListener("keydown", function (e) {
        if ((e.key === "Enter" || e.key === " ") && i === current) { e.preventDefault(); next(); }
      });
    });

    // 동작 최소화 환경에서는 회전 애니메이션 지속시간이 전역 규칙(css.mjs MOTION)으로
    // 이미 .001ms로 눌린다 — 여기서 따로 처리할 게 없다. 첫 렌더만 맞춰 둔다.
    if (prefersReduce()) { /* transition-duration은 CSS가 담당 */ }

    renderLeaves();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

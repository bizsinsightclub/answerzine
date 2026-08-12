/**
 * DIY 진 — 하단 CTA(숨김) 또는 홈 마퀴 밴드 → 8쪽 전체 미리보기 오버레이 → 인쇄
 * → 스티커로 꾸미기.
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
 *
 * 2026-08-12 일곱 번째 라운드 — 스티커 드래그앤드롭 추가(사용자 요청, 참고 이미지의
 * 스티커 팔레트). 마우스·터치 둘 다 Pointer Events 하나로 처리한다(HTML5 드래그앤드롭
 * API는 터치에서 안 통한다 — "click/touch and drag" 요구를 그대로 지원하려면 포인터
 * 이벤트가 맞다). 좌표는 픽셀이 아니라 %로 저장한다 — 그리드 타일(.zb-tile-face)과
 * 인쇄 시트 반쪽(.zb-half)이 종횡비(148.5:210)만 같고 실제 크기는 다르므로, %가
 * 유일하게 두 컨텍스트에 그대로 옮겨 쓸 수 있는 단위다. 스티커를 놓거나 옮길 때마다
 * data-zb-page가 같은 두 컨테이너(그리드 사본 + 인쇄 사본)에 동시에 반영한다 —
 * 그래야 화면에서 꾸민 게 실제 인쇄물에도 그대로 나온다.
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
    // 스티커를 놓는 순간 e.target이 overlay 자체로 잡히는 실측 버그가 있다(아래
    // bootStickers 주석 참고) — 드래그 직후의 클릭은 무시한다.
    overlay.addEventListener("click", function (e) {
      if (overlay.__zbSuppressClose) return;
      if (e.target === overlay) close();
    });

    bootStickers(overlay);
  }

  /**
   * 스티커 드래그앤드롭. 두 가지 드래그를 같은 포인터 이벤트 흐름으로 처리한다:
   *  1) 팔레트 칩 → 새 스티커를 캔버스(.zb-tile-face)에 놓는다.
   *  2) 이미 놓인 스티커(.zb-sticker) → 같은 캔버스 안에서 옮긴다.
   * 두 번 탭(dblclick)하면 지운다.
   */
  function bootStickers(overlay) {
    var palette = overlay.querySelector("[data-zb-sticker-palette]");
    if (!palette) return;
    var chips = Array.prototype.slice.call(palette.querySelectorAll("[data-zb-sticker]"));
    var ghost = null;
    var nextId = 1;

    // "캔버스"란 .zb-tile-face(그리드 미리보기) 하나를 말한다 — 사용자는 그리드에서만
    // 직접 조작한다. 인쇄 시트(.zb-half) 쪽은 언제나 미러링 결과일 뿐, 직접 드래그
    // 대상이 아니다(화면에 항상 안 보이므로 애초에 조작할 수도 없다).
    function findCanvasAt(x, y) {
      var el = document.elementFromPoint(x, y);
      return el ? el.closest(".zb-tile-face") : null;
    }

    function clampPct(v) {
      return Math.max(0, Math.min(86, v));
    }

    function pctFromPoint(canvas, x, y) {
      var rect = canvas.getBoundingClientRect();
      var xPct = ((x - rect.left) / rect.width) * 100 - 6.5; // 스티커 폭(13%)의 절반만큼 중심 보정
      var yPct = ((y - rect.top) / rect.height) * 100 - 6.5;
      return { x: clampPct(xPct), y: clampPct(yPct) };
    }

    function mirrorHalf(pageKey) {
      if (!pageKey) return null;
      return document.querySelector('.zb-half[data-zb-page="' + pageKey + '"]');
    }

    function applyPosition(el, x, y) {
      el.style.left = x + "%";
      el.style.top = y + "%";
    }

    // 실측으로 찾은 버그: 컨테이너 쿼리 컨테이너(.zb-tile-face, container-type:
    // inline-size)에 자식을 추가하는 순간, 그 직후 발생하는 합성 click 이벤트의
    // e.target이 (레이아웃이 그 프레임에 아직 안정되지 않아) 타일이 아니라 배경
    // overlay로 잡히는 경우가 있다 — "오버레이 바깥 클릭 시 닫기" 핸들러가 걸려
    // 스티커를 놓자마자 오버레이가 닫혀버렸다. 스티커를 놓거나 옮긴 직후의 클릭
    // 한 번은 무시한다 — 진짜 "배경 클릭으로 닫기"는 이 짧은 창을 벗어난 클릭에서만
    // 여전히 동작한다.
    function suppressOverlayCloseOnce() {
      overlay.__zbSuppressClose = true;
      setTimeout(function () { overlay.__zbSuppressClose = false; }, 0);
    }

    // 같은 스티커의 두 사본(그리드+인쇄)을 data-zb-instance로 묶는다.
    function upsertMirror(pageKey, instanceId, svgHTML, x, y) {
      var half = mirrorHalf(pageKey);
      if (!half) return;
      var mirror = half.querySelector('[data-zb-instance="' + instanceId + '"]');
      if (!mirror) {
        mirror = document.createElement("div");
        mirror.className = "zb-sticker";
        mirror.setAttribute("data-zb-instance", instanceId);
        mirror.setAttribute("aria-hidden", "true");
        mirror.innerHTML = svgHTML;
        half.appendChild(mirror);
      }
      applyPosition(mirror, x, y);
    }

    function removeInstance(instanceId) {
      var nodes = document.querySelectorAll('[data-zb-instance="' + instanceId + '"]');
      nodes.forEach(function (n) { n.parentNode && n.parentNode.removeChild(n); });
    }

    function makeGridSticker(canvas, instanceId, svgHTML, x, y) {
      var el = document.createElement("div");
      el.className = "zb-sticker";
      el.setAttribute("data-zb-instance", instanceId);
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", "놓인 스티커. 끌어서 옮기거나 두 번 눌러 지웁니다.");
      el.innerHTML = svgHTML;
      applyPosition(el, x, y);
      canvas.appendChild(el);
      wireExistingSticker(el);
      return el;
    }

    function wireExistingSticker(el) {
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        startMoveDrag(el, e);
      });
      el.addEventListener("dblclick", function (e) {
        e.preventDefault();
        removeInstance(el.getAttribute("data-zb-instance"));
      });
    }

    function startMoveDrag(el, downEvent) {
      var instanceId = el.getAttribute("data-zb-instance");
      var startCanvas = el.closest(".zb-tile-face");
      el.classList.add("is-dragging");
      var moved = false;

      function onMove(e) {
        moved = true;
        var canvas = findCanvasAt(e.clientX, e.clientY) || startCanvas;
        var pos = pctFromPoint(canvas, e.clientX, e.clientY);
        if (canvas !== el.parentNode) canvas.appendChild(el);
        applyPosition(el, pos.x, pos.y);
        var pageKey = canvas.getAttribute("data-zb-page");
        var svgHTML = el.querySelector("svg") ? el.querySelector("svg").outerHTML : "";
        upsertMirror(pageKey, instanceId, svgHTML, pos.x, pos.y);
      }
      function onUp() {
        el.classList.remove("is-dragging");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (moved) suppressOverlayCloseOnce();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }

    function startPlaceDrag(chipId, svgHTML, downEvent) {
      ghost = document.createElement("div");
      ghost.className = "zb-drag-ghost";
      ghost.innerHTML = svgHTML;
      ghost.style.left = downEvent.clientX + "px";
      ghost.style.top = downEvent.clientY + "px";
      document.body.appendChild(ghost);

      function onMove(e) {
        ghost.style.left = e.clientX + "px";
        ghost.style.top = e.clientY + "px";
      }
      function onUp(e) {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (ghost) { ghost.remove(); ghost = null; }
        var canvas = findCanvasAt(e.clientX, e.clientY);
        if (!canvas) return; // 캔버스 밖에서 놓으면 취소 — 아무것도 안 만든다.
        var pos = pctFromPoint(canvas, e.clientX, e.clientY);
        var instanceId = "st" + nextId++;
        makeGridSticker(canvas, instanceId, svgHTML, pos.x, pos.y);
        upsertMirror(canvas.getAttribute("data-zb-page"), instanceId, svgHTML, pos.x, pos.y);
        suppressOverlayCloseOnce();
      }
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        var svgHTML = chip.querySelector("svg") ? chip.querySelector("svg").outerHTML : "";
        startPlaceDrag(chip.getAttribute("data-zb-sticker"), svgHTML, e);
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

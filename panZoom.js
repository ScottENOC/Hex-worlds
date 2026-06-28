// Pan/zoom via SVG viewBox manipulation.
// Uses the Pointer Events API (mouse, touch, stylus all unified).
// touch-action:none on #map-container prevents browser-level scroll/zoom.

(function () {
  const CONTENT_W = 1900;  // approximate pixel width of map content
  const CONTENT_H = 1600;
  const WHEEL_FACTOR = 1.12;
  const MIN_W = 300;
  const MAX_W = 6000;
  const DRAG_THRESHOLD = 8; // px — below this, a press is a tap not a drag

  const mc = document.getElementById("map-container");

  let vb = { x: 0, y: 0, w: CONTENT_W, h: CONTENT_H };
  const pointers = new Map(); // pointerId → { x, y, startX, startY, moved }
  let didDrag = false;

  // ─── Initialise SVG ────────────────────────────────────────────────────────
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("viewBox", `0 0 ${CONTENT_W} ${CONTENT_H}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  svg.style.width  = "100%";
  svg.style.height = "100%";
  svg.style.display = "block";

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function applyVB() {
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  // Convert a client (screen) point to SVG viewBox coordinates.
  function clientToSVG(cx, cy) {
    const r = svg.getBoundingClientRect();
    return {
      x: vb.x + (cx - r.left) / r.width  * vb.w,
      y: vb.y + (cy - r.top)  / r.height * vb.h,
    };
  }

  // Zoom by `factor`, keeping the SVG point under (cx,cy) stationary.
  function zoomAt(cx, cy, factor) {
    const newW = Math.max(MIN_W, Math.min(MAX_W, vb.w * factor));
    if (newW === vb.w) return;
    const f = newW / vb.w;
    const p = clientToSVG(cx, cy);   // grab SVG coords BEFORE resize
    vb.w = newW;
    vb.h = vb.h * f;
    const r = svg.getBoundingClientRect();
    vb.x = p.x - (cx - r.left) / r.width  * vb.w;
    vb.y = p.y - (cy - r.top)  / r.height * vb.h;
    applyVB();
  }

  // ─── Mouse wheel ──────────────────────────────────────────────────────────
  mc.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR);
  }, { passive: false });

  // ─── Pointer events (mouse + touch + stylus) ──────────────────────────────
  // We listen on window in capture phase so we receive moves even when the
  // pointer drifts outside mc, without using setPointerCapture (which would
  // redirect click events away from the hex/unit elements).

  window.addEventListener("pointerdown", e => {
    if (!mc.contains(e.target)) return;
    pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY,
      startX: e.clientX, startY: e.clientY,
      moved: false,
    });
    mc.classList.add("panning");
  }, { capture: true });

  window.addEventListener("pointermove", e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;

    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const totalDist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);

    if (!p.moved && totalDist > DRAG_THRESHOLD) {
      p.moved = true;
      didDrag = true;
    }

    if (pointers.size === 1) {
      // ── Single pointer: pan ──
      if (p.moved) {
        const r = svg.getBoundingClientRect();
        vb.x -= dx / r.width  * vb.w;
        vb.y -= dy / r.height * vb.h;
        applyVB();
      }
    } else if (pointers.size === 2) {
      // ── Two pointers: pinch zoom + pan ──
      p.moved = true;
      didDrag = true;

      const other = [...pointers.values()].find(o => o !== p);
      if (!other) { pointers.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY }); return; }

      const prevMid  = { x: (p.x + other.x) / 2,        y: (p.y + other.y) / 2 };
      const currMid  = { x: (e.clientX + other.x) / 2,  y: (e.clientY + other.y) / 2 };
      const prevDist = Math.hypot(p.x - other.x, p.y - other.y);
      const currDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);

      // Pan by midpoint movement first
      const r = svg.getBoundingClientRect();
      vb.x -= (currMid.x - prevMid.x) / r.width  * vb.w;
      vb.y -= (currMid.y - prevMid.y) / r.height * vb.h;

      // Pinch zoom around new midpoint
      if (prevDist > 0 && currDist > 0) {
        zoomAt(currMid.x, currMid.y, prevDist / currDist);
      } else {
        applyVB();
      }
    }

    pointers.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY });
  }, { capture: true });

  window.addEventListener("pointerup", e => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size === 0) mc.classList.remove("panning");

    if (!p) return;

    // On touch devices, if this was a tap (no drag), dispatch a synthetic click
    // because we didn't call preventDefault on pointerdown, but let's be explicit
    // on iOS where SVG element click reliability varies.
    if (!p.moved && e.pointerType === "touch") {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== mc) {
        el.dispatchEvent(new MouseEvent("click", {
          bubbles: true, cancelable: true,
          clientX: e.clientX, clientY: e.clientY,
          view: window,
        }));
      }
    }

    // Reset drag state once all fingers are up
    if (pointers.size === 0) {
      // Small delay so the click-suppression listener can fire first
      setTimeout(() => { didDrag = false; }, 50);
    }
  }, { capture: true });

  window.addEventListener("pointercancel", e => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      mc.classList.remove("panning");
      setTimeout(() => { didDrag = false; }, 50);
    }
  }, { capture: true });

  // Suppress the click event that would fire at the end of a drag.
  // Runs in capture phase so it fires before any element's click handler.
  mc.addEventListener("click", e => {
    if (didDrag) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, { capture: true });

})();

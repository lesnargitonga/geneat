/* ── THE PAGE KNOWS WHERE YOU ARE ────────────────────────────────────────────
   Two signals, both continuous, both free: how far down the document you are,
   and whether you have left the top of it. A page that never acknowledges
   scrolling feels like a printed sheet no matter how good the type is.

   Written as custom properties on the root, so all the actual behaviour lives
   in CSS and this file never touches layout. One passive listener, one rAF,
   no work when nothing moved. */
(function () {
  "use strict";
  var root = document.documentElement;
  var ticking = false, last = -1;

  function write() {
    ticking = false;
    var max = root.scrollHeight - window.innerHeight;
    var y = window.pageYOffset || root.scrollTop || 0;
    var p = max > 0 ? y / max : 0;
    p = p < 0 ? 0 : p > 1 ? 1 : p;

    if (Math.abs(p - last) > 0.001) {
      root.style.setProperty("--sp", p.toFixed(4));
      last = p;
    }
    if (y > 40) root.setAttribute("data-scrolled", "1");
    else root.removeAttribute("data-scrolled");
  }

  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(write); } }

  addEventListener("scroll", tick, { passive: true });
  addEventListener("resize", tick, { passive: true });
  write();
})();

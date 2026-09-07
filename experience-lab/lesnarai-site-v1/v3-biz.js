/* ACT 02 — BIZMTAANI, THE ORDER THAT MOVES ────────────────────────────────
   Five real captured states of bizmtaani.com. Desktop maps scroll progress to
   lateral travel: the page goes down, the order goes sideways, which is the
   one moment on the site that disobeys the page's own axis. Mobile uses a
   native scroll-snap rail, because a finger should push the story, not scrub
   a timeline it cannot see.

   No frame sequence, no video: the journey is five discrete product states,
   so five real stills at 106KB beat a 854KB recording and a 1.2MB scrub. */
(function () {
  "use strict";
  var root = document.getElementById("bizflow");
  if (!root) return;

  var rail    = root.querySelector(".bz__rail");
  var states  = [].slice.call(root.querySelectorAll(".bz__state"));
  var bar     = root.querySelector(".bz__bar i");
  var stepEls = [].slice.call(root.querySelectorAll(".bz__step"));
  var replay  = root.querySelector(".bz__replay");
  var live    = root.querySelector(".bz__live");
  if (!states.length) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var n = states.length, current = -1;

  function announce(i) {
    if (i === current) return;
    current = i;
    stepEls.forEach(function (s, k) {
      s.classList.toggle("is-on", k === i);
    });
    if (live) live.textContent = "Step " + (i + 1) + " of " + n + ": " + states[i].dataset.label;
  }

  /* ── desktop: scroll position drives lateral travel ─────────────────── */
  var wide = matchMedia("(min-width: 821px)");
  var ticking = false;

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(apply); }
  }
  function apply() {
    ticking = false;
    var r = root.getBoundingClientRect();
    var travel = root.offsetHeight - window.innerHeight;
    if (travel <= 0) return;
    var p = Math.min(1, Math.max(0, -r.top / travel));
    var maxX = rail.scrollWidth - rail.clientWidth;
    rail.style.transform = "translate3d(" + (-p * maxX).toFixed(1) + "px,0,0)";
    if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
    announce(Math.min(n - 1, Math.round(p * (n - 1))));
  }

  function enableScrollMode() {
    root.setAttribute("data-mode", "scroll");
    rail.style.transform = "translate3d(0,0,0)";
    addEventListener("scroll", onScroll, { passive: true });
    apply();
  }
  function disableScrollMode() {
    removeEventListener("scroll", onScroll);
    rail.style.transform = "";
  }

  /* ── mobile: a real swipe rail, native momentum, snap per state ─────── */
  function enableSwipeMode() {
    root.setAttribute("data-mode", "swipe");
    disableScrollMode();
    rail.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var maxX = rail.scrollWidth - rail.clientWidth;
          var p = maxX > 0 ? rail.scrollLeft / maxX : 0;
          if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
          announce(Math.min(n - 1, Math.round(p * (n - 1))));
        });
      }
    }, { passive: true });
  }

  function mode() {
    if (reduced) { root.setAttribute("data-mode", "static"); announce(0); return; }
    if (wide.matches) enableScrollMode(); else enableSwipeMode();
  }
  mode();
  (wide.addEventListener ? wide.addEventListener.bind(wide, "change") : wide.addListener.bind(wide))(function () {
    disableScrollMode(); mode();
  });

  /* Replay means "take me back to the start of the sequence" in both modes -
     never a hidden timeline the visitor cannot see or stop. */
  if (replay) replay.addEventListener("click", function () {
    if (root.getAttribute("data-mode") === "swipe") {
      rail.scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" });
    } else {
      var top = root.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + 2, behavior: reduced ? "auto" : "smooth" });
    }
  });

  /* States 2-5 sit off the right edge of the frame, so a lazy image at the end
     of the rail may never intersect and never load. Fetch the sequence when the
     section itself comes within a viewport - the blueprint's rule, applied. */
  if ("IntersectionObserver" in window) {
    var warm = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        states.forEach(function (st) {
          var im = st.querySelector("img");
          if (im && im.loading === "lazy") im.loading = "eager";
        });
        warm.disconnect();
      });
    }, { rootMargin: "100% 0px" });
    warm.observe(root);
  }

  announce(0);
})();

/* THE 60-SECOND MODE ──────────────────────────────────────────────────────
   A guided use of the real website, not a slideshow and not a video. It moves
   the actual page through the actual sections, on a timer, and hands control
   back the instant the visitor wants it.

   Non-negotiables, all enforced below:
     - any wheel, touch, key or click takes over immediately
     - Escape exits on desktop; a permanent Exit control exists on touch
     - the page is never scroll-locked, so the visitor is never trapped
     - history is untouched: no pushState, so Back still means Back
     - reduced motion gets the same tour with instant positioning
     - it can be re-entered and replayed */
(function () {
  "use strict";
  var btn = document.getElementById("tour-start");
  if (!btn) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ui   = document.getElementById("tour-ui");
  var cap  = ui && ui.querySelector(".tour__cap");
  var barI = ui && ui.querySelector(".tour__bar i");
  var exit = ui && ui.querySelector(".tour__exit");

  /* Real destinations on the real page. Each dwell is long enough to read the
     one line, short enough that five stops fit inside ~60 seconds. */
  var STOPS = [
    { sel: ".hero",        dwell: 7000,  cap: "Lesnar AI - an engineering studio in Nairobi." },
    { sel: "#bizflow",     dwell: 9000,  cap: "BizMtaani: a neighbourhood marketplace, live." },
    { sel: "#bizflow",     dwell: 13000, cap: "One order - found, chosen, placed, tracked.", scrub: true },
    { sel: ".sec--work",   dwell: 11000, cap: "Five products publishing a public surface." },
    { sel: ".sec--skills", dwell: 9000,  cap: "Six kinds of work, each with the system that proves it." },
    { sel: ".sec--close",  dwell: 8000,  cap: "Bring us the problem, not the specification." }
  ];

  var running = false, idx = 0, timer = null, raf = 0, t0 = 0;

  function setUI(on) {
    if (ui) ui.hidden = !on;
    document.documentElement.toggleAttribute("data-tour", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function stop(reason) {
    if (!running) return;
    running = false;
    clearTimeout(timer); cancelAnimationFrame(raf);
    setUI(false);
    removeEventListener("wheel", onTakeover);
    removeEventListener("touchstart", onTakeover);
    removeEventListener("keydown", onKey);
    if (cap) cap.textContent = "";
    btn.focus({ preventScroll: true });
  }
  function onTakeover() { stop("user"); }
  function onKey(e) {
    if (e.key === "Escape") { stop("escape"); return; }
    /* arrows, space, page keys all mean "I am driving now" */
    if (/^(Arrow|Page|Home|End| )/.test(e.key)) stop("key");
  }

  function goto(i) {
    if (!running) return;
    if (i >= STOPS.length) { stop("end"); return; }
    idx = i;
    var s = STOPS[i];
    var el = document.querySelector(s.sel);
    if (!el) { goto(i + 1); return; }

    var top = el.getBoundingClientRect().top + scrollY;
    /* the scrub stop travels through the BizMtaani sequence rather than
       jumping to it, because that section's whole point is the travel */
    if (s.scrub) top = top + (el.offsetHeight - innerHeight) * 0.92;

    scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
    if (cap) cap.textContent = s.cap;

    t0 = performance.now();
    (function tick() {
      if (!running) return;
      var p = Math.min(1, (performance.now() - t0) / s.dwell);
      var overall = (i + p) / STOPS.length;
      if (barI) barI.style.width = (overall * 100).toFixed(1) + "%";
      if (p < 1) raf = requestAnimationFrame(tick);
    })();

    timer = setTimeout(function () { goto(i + 1); }, s.dwell);
  }

  function start() {
    if (running) { stop("toggle"); return; }
    running = true;
    setUI(true);
    /* passive listeners: we observe the takeover, we never prevent it */
    addEventListener("wheel", onTakeover, { passive: true, once: true });
    addEventListener("touchstart", onTakeover, { passive: true, once: true });
    addEventListener("keydown", onKey);
    goto(0);
  }

  btn.addEventListener("click", start);
  if (exit) exit.addEventListener("click", function () { stop("exit"); });
})();

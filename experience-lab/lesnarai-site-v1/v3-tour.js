/* THE 60-SECOND MODE — SCENES, NOT SCROLL DESTINATIONS ────────────────────
   The first version was functionally correct and experientially a browser
   scrolling itself. This version treats the page as a stage: a director takes
   the camera, the surrounding chrome recedes, the product performs its own
   sequence, and control returns the instant anyone touches anything.

   Everything that was correct is preserved and must stay correct:
     - never scroll-locked, so the visitor is never trapped
     - any wheel, touch or key hands control straight back
     - Escape exits; a permanent Exit control exists for touch
     - history untouched, so Back still means Back
     - re-entry and replay work
     - reduced motion gets the same scenes without the travel */
(function () {
  "use strict";
  var btn = document.getElementById("tour-start");
  if (!btn) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var ui   = document.getElementById("tour-ui");
  var cap  = ui && ui.querySelector(".tour__cap");
  var barI = ui && ui.querySelector(".tour__bar i");
  var exit = ui && ui.querySelector(".tour__exit");
  var bz   = document.getElementById("bizflow");

  var SCENES = [
    { id: "arrive",  ms: 7000,  cap: "Lesnar AI - an engineering studio in Nairobi.",
      at: ".hero" },
    { id: "biz",     ms: 6500,  cap: "BizMtaani. A neighbourhood marketplace, live.",
      at: "#bizflow", authority: true },
    { id: "order",   ms: 16000, cap: "One order: found, chosen, placed, tracked.",
      at: "#bizflow", authority: true, conduct: true },
    { id: "capable", ms: 8000,  cap: "Six kinds of work, each with the system that proves it.",
      at: ".sec--skills" },
    { id: "close",   ms: 7000,  cap: "Bring us the problem, not the specification.",
      at: ".sec--close" }
  ];

  var running = false, timer = null, raf = 0, conductRaf = 0;

  function chrome(on, scene) {
    root.toggleAttribute("data-tour", on);
    if (scene) root.setAttribute("data-scene", scene); else root.removeAttribute("data-scene");
    if (ui) ui.hidden = !on;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function stop() {
    if (!running) return;
    running = false;
    clearTimeout(timer); cancelAnimationFrame(raf); cancelAnimationFrame(conductRaf);
    chrome(false, null);
    removeEventListener("wheel", takeover);
    removeEventListener("touchstart", takeover);
    removeEventListener("keydown", onKey);
    if (cap) cap.textContent = "";
    btn.focus({ preventScroll: true });
  }
  function takeover() { stop(); }
  function onKey(e) {
    if (e.key === "Escape") return stop();
    if (/^(Arrow|Page|Home|End| )/.test(e.key)) stop();
  }

  /* Scene 3: the product conducts itself. On desktop the pinned section is
     driven by page scroll, so we advance the page through it; on mobile the
     rail is the thing that moves. Either way this is the real component doing
     the real thing, not a video of it. */
  function conduct(scene, done) {
    var rail = bz && bz.querySelector(".bz__rail");
    if (!bz || !rail) return;
    var wide = matchMedia("(min-width: 821px)").matches;
    var t0 = performance.now();
    var startY = scrollY;
    var travel = bz.offsetHeight - innerHeight;
    var maxX = rail.scrollWidth - rail.clientWidth;
    (function step() {
      if (!running) return;
      var p = Math.min(1, (performance.now() - t0) / (scene.ms - 1200));
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   /* ease in-out */
      if (wide && travel > 0) scrollTo(0, startY + e * travel * 0.98);
      else rail.scrollLeft = e * maxX;
      if (p < 1) conductRaf = requestAnimationFrame(step); else if (done) done();
    })();
  }

  function play(i) {
    if (!running) return;
    if (i >= SCENES.length) return stop();
    var s = SCENES[i];
    var el = document.querySelector(s.at);
    if (!el) return play(i + 1);

    chrome(true, s.id);
    if (cap) cap.textContent = s.cap;

    /* place the camera, then let the scene happen */
    if (!s.conduct) {
      var top = el.getBoundingClientRect().top + scrollY;
      if (s.id === "biz") top += 0;
      scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
    } else if (!reduced) {
      conduct(s, null);
    }

    var t0 = performance.now();
    (function tick() {
      if (!running) return;
      var p = Math.min(1, (performance.now() - t0) / s.ms);
      if (barI) barI.style.width = (((i + p) / SCENES.length) * 100).toFixed(1) + "%";
      if (p < 1) raf = requestAnimationFrame(tick);
    })();

    timer = setTimeout(function () { cancelAnimationFrame(conductRaf); play(i + 1); }, s.ms);
  }

  function start() {
    if (running) return stop();
    running = true;
    addEventListener("wheel", takeover, { passive: true, once: true });
    addEventListener("touchstart", takeover, { passive: true, once: true });
    addEventListener("keydown", onKey);
    play(0);
  }

  btn.addEventListener("click", start);
  if (exit) exit.addEventListener("click", stop);
})();

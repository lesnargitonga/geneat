/* THE FOUR PRIMITIVES ────────────────────────────────────────────────────────
   ASSEMBLE  parts forming a system        chapter 2, and Jamii's record
   ADVANCE   one real state to the next    BizMtaani laterally, CarePro stamping
   DEPTH     response to pointer or touch  chapter 4
   RESOLVE   lives in v4-field.js

   Nothing here fades anything up, and nothing loops. Reduced motion is not a
   degraded version: every element is already in its finished state in CSS, so
   turning motion off leaves the page complete rather than empty. */
(function () {
  "use strict";
  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IO = "IntersectionObserver" in window;

  /* ── ASSEMBLE ───────────────────────────────────────────────────────── */
  function assemble() {
    var targets = [].slice.call(document.querySelectorAll("[data-assemble], .jam__l"));
    if (!targets.length) return;
    if (reduced || !IO) {
      targets.forEach(function (t) { t.setAttribute("data-in", "1"); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.setAttribute("data-in", "1");
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ── ADVANCE · BizMtaani ────────────────────────────────────────────────
     The rail moves sideways by exactly the distance it overflows, mapped to
     the distance scrolled through a tall container. Transform only, so the
     page never reflows while it moves. */
  function biz() {
    var box = document.querySelector('[data-adv="biz"]');
    if (!box || reduced) return;
    var rail = box.querySelector(".biz__rail");
    var stick = box.querySelector(".biz__stick");
    if (!rail || !stick) return;
    if (!window.matchMedia("(min-width: 821px)").matches) return;

    var ticking = false;
    function write() {
      ticking = false;
      var r = box.getBoundingClientRect();
      var travel = rail.scrollWidth - window.innerWidth;
      if (travel < 1) { box.style.setProperty("--bx", "0"); return; }
      var span = box.offsetHeight - window.innerHeight;
      if (span < 1) return;
      var p = (-r.top) / span;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      box.style.setProperty("--bx", (p * travel).toFixed(1));
      box.style.setProperty("--bp", p.toFixed(4));
    }
    function tick() { if (!ticking) { ticking = true; requestAnimationFrame(write); } }
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", tick, { passive: true });
    write();
  }

  /* ── ADVANCE · CarePro ──────────────────────────────────────────────────
     Each check stamps when it is genuinely reached, so the sequence is the
     reader's progress through it rather than a timed animation. */
  function care() {
    var list = document.querySelector('[data-adv="care"]');
    if (!list) return;
    var items = [].slice.call(list.children);
    if (reduced || !IO) {
      items.forEach(function (li) { li.setAttribute("data-on", "1"); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) e.target.setAttribute("data-on", "1");
      });
    }, { threshold: 0.7, rootMargin: "0px 0px -18% 0px" });
    items.forEach(function (li) { io.observe(li); });
  }

  /* ── DEPTH ──────────────────────────────────────────────────────────────
     Pointer tilt where there is a real pointer; press feedback everywhere
     else, which the interaction layer already provides in CSS. */
  function depth() {
    var host = document.querySelector("[data-depth]");
    if (!host || reduced) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var cards = [].slice.call(host.querySelectorAll(".cap__c"));

    cards.forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var b = c.getBoundingClientRect();
        var x = (e.clientX - b.left) / b.width - 0.5;
        var y = (e.clientY - b.top) / b.height - 0.5;
        c.style.setProperty("--ry", (x * 5).toFixed(2) + "deg");
        c.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
      });
      c.addEventListener("pointerleave", function () {
        c.style.setProperty("--ry", "0deg");
        c.style.setProperty("--rx", "0deg");
      });
    });
  }

  assemble(); biz(); care(); depth();
})();

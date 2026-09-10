/* THE SCENE ENGINE ───────────────────────────────────────────────────────────
   One requestAnimationFrame, one number per scene.

   Every narrative scene declares how its progress is measured:

     data-scene="through"   p = (vh - top) / (vh + height)
                            the scene's own height plus a viewport is the
                            scroll distance; costs the page nothing
     data-scene="pin"       p = -top / (height - stickHeight)
                            a tall container with a sticky stage inside it
     data-scene="lead"      p = -top / (height * 0.55)
                            the hero, which is at p=0 when you arrive
     data-scene="focal"     p = (START - ref) / (START - END), in viewport
                            units, where ref is a point on the scene's FOCAL
                            SUBJECT rather than anywhere in the document

   FOCAL is the mode the other three could not express. A band cut from a
   scene's transit fires at a fixed fraction of the SECTION's journey, so the
   deeper an element sits inside its section, the later it finishes relative
   to its own position on screen. Measured at 390x844 that put the last
   CarePro gate's reveal 8% of a viewport ABOVE the top edge and the last
   Jamii stage 3% above it: the reader scrolled the subject off the screen
   while it was still arriving, which is the failure a reader describes as
   "I kept scrolling while it slowly finished above me".

   In focal mode progress is a function of where the SUBJECT is:

     ref     the point of the subject the eye tracks - its centre, or, once
             the subject is taller than a viewport, a point half a viewport
             below its top edge
     START   the viewport height at which the performance begins (0.92)
     END     the viewport height by which it must be complete (0.30)

   Everything above END is RELEASE. Nothing meaningful happens there, so a
   subject that has climbed out of the focal zone has nothing left to say.
   Stagger stops being declared, too: rows land in order because they reach
   the zone in order.

   [data-fp] does the same for a single element that is spatially detached
   from its scene's subject - an evidence plate beside or below the thing
   performing - which would otherwise finish before it had entered.

   The value is written to a custom property on the scene root and every
   element inside derives its own 0 -> 1 from a band of it, in CSS. That is
   what makes the whole thing reversible: p is a pure function of scroll
   position, so scrolling up is not a second animation, it is the same
   function read backwards. Stopping freezes it. Jumping arrives correct.

   IntersectionObserver appears exactly once, and only to decide which scenes
   are worth computing. It never sets a completed state, and nothing here
   unobserves anything.

   The resting value of every property is the finished picture (--p:1, --he:1,
   --hq:0), so no JavaScript, reduced motion, and a scene that has not been
   reached all render the page complete rather than empty.               */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── the scenes ─────────────────────────────────────────────────────── */
  var scenes = [];
  var fps = [];
  var live = 0, ticking = false;
  var vw = root.clientWidth, vh = root.clientHeight;

  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  function collect() {
    scenes = [].map.call(document.querySelectorAll("[data-scene]"), function (el) {
      var band = (el.getAttribute("data-band") || "0,1").split(",");
      return {
        el: el,
        mode: el.getAttribute("data-scene"),
        prop: el.getAttribute("data-var") || "--p",
        a: num(band[0], 0),
        b: num(band[1], 1),
        rest: num(el.getAttribute("data-rest"), 1),
        stick: el.querySelector("[data-stick]"),
        focus: pick(el, el.getAttribute("data-focus")),
        zone: zoneOf(el),
        stickTop: 0,
        on: false,
        last: -1
      };
    });

    fps = [].map.call(document.querySelectorAll("[data-fp]"), function (el) {
      return { el: el, zone: zoneOf(el), last: -1 };
    });
  }

  /* querySelector throws on an empty or malformed selector, and one throw
     inside collect() would take the whole engine with it. */
  function pick(el, sel) {
    if (!sel) return el;
    try { return el.querySelector(sel) || el; } catch (e) { return el; }
  }

  /* "start,end" in viewport fractions, defaulting to the focal zone */
  /* END is the viewport height by which a reveal must be finished. 0.34
     rather than the 0.30 the rule states, so that a subject whose reveal
     tracks its own geometry closely - a compact register row - still clears
     the line instead of landing exactly on it. */
  var FP_START = 0.92, FP_END = 0.34;
  function zoneOf(el) {
    var z = (el.getAttribute("data-zone") || "").split(",");
    return [num(z[0], FP_START), num(z[1], FP_END)];
  }

  /* Where the eye sits on this subject. Past half a viewport tall, the top
     region leads - otherwise a full-height stage would have to travel almost
     entirely past the screen before its "centre" reached the focal zone. */
  function refOf(el) {
    var r = el.getBoundingClientRect();
    return r.top + (r.height / 2 < vh * 0.5 ? r.height / 2 : vh * 0.5);
  }
  function focal(el, zone) {
    var s = zone[0] * vh, e = zone[1] * vh;
    return s - e < 1 ? 0 : (s - refOf(el)) / (s - e);
  }

  /* A sticky stage now starts below the header rather than underneath it, so
     the point at which it pins is its own `top`, not zero. Read once per
     resize rather than once per frame. */
  function stickTops() {
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      s.stickTop = s.stick ? (parseFloat(getComputedStyle(s.stick).top) || 0) : 0;
    }
  }

  function raw(s) {
    var top = s.el.getBoundingClientRect().top, span;
    if (s.mode === "pin") {
      span = s.el.offsetHeight - (s.stick ? s.stick.offsetHeight : vh);
      /* On a short viewport - a phone held sideways - the stage is taller than
         the space it would be pinned in, so the layout stops pinning it. With
         no travel there is no pin progress to read, and the scene would sit at
         zero forever. It is measured as an ordinary scene instead. */
      if (span < 1) return (vh - top) / (vh + s.el.offsetHeight);
      return (s.stickTop - top) / span;
    }
    if (s.mode === "focal") return focal(s.focus, s.zone);
    /* The hero resolves decisively rather than trailing the reader up the
       page: its release is complete while it is still substantially on
       screen, and what follows is simply the hero leaving. */
    if (s.mode === "lead") {
      span = s.el.offsetHeight * 0.55;
      return span < 1 ? 0 : -top / span;
    }
    span = vh + s.el.offsetHeight;
    return span < 1 ? 0 : (vh - top) / span;
  }

  function clamp(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  function commit(s, p) {
    if (s.b > s.a) p = clamp((p - s.a) / (s.b - s.a));
    if (Math.abs(p - s.last) < 0.0004) return;
    s.last = p;
    s.el.style.setProperty(s.prop, p.toFixed(4));
  }

  /* Read every rect, then write every value. Interleaving them would make each
     setProperty invalidate style and each following getBoundingClientRect
     force a fresh layout - three forced layouts a frame instead of one. */
  var vals = [], fvals = [];
  function run(all) {
    var i, n = scenes.length, m = fps.length;
    for (i = 0; i < n; i++) vals[i] = (all || scenes[i].on) ? clamp(raw(scenes[i])) : -1;
    for (i = 0; i < m; i++) fvals[i] = clamp(focal(fps[i].el, fps[i].zone));
    for (i = 0; i < n; i++) if (vals[i] >= 0) commit(scenes[i], vals[i]);
    for (i = 0; i < m; i++) {
      if (Math.abs(fvals[i] - fps[i].last) < 0.0004) continue;
      fps[i].last = fvals[i];
      fps[i].el.style.setProperty("--n", fvals[i].toFixed(4));
    }
  }

  /* A scene that is jumped over - an in-page anchor, End, a restored scroll
     position - is never seen by the observer, so it is never computed, and it
     keeps whatever progress it had when the page loaded. Off screen that is
     invisible, but it means a scene the reader has passed is not in its
     terminal state, which is a promise this engine makes. Any scroll larger
     than most of a viewport recomputes everything once. */
  var lastY = 0;
  function frame() {
    ticking = false;
    var y = window.pageYOffset || 0;
    var jump = Math.abs(y - lastY) > vh * 0.9;
    lastY = y;
    if (live < 1 && !jump) return;
    run(jump);
  }

  /* Every scene rests at its finished state so that no JavaScript and reduced
     motion both render a complete page. That means a scene below the fold is
     sitting at 1 until something looks at it, and the observer switching it on
     would step it 1 -> 0. It happens well off-screen, but it is still a scene
     going backwards while the reader goes forwards, and it would make the
     progress gate's monotonicity check a lie. So every scene is measured once
     at start-up, before anything is observed. */
  function writeAll() { run(true); }
  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  /* Reduced motion is not a degraded page. Scenes take their resting value;
     focal elements are simply left alone, because an unset --n makes every
     declaration that reads it invalid, and the element renders finished.
     That is the same path no-JS takes. */
  function settle() {
    scenes.forEach(function (s) {
      s.last = -1;
      s.el.style.setProperty(s.prop, String(s.rest));
    });
  }

  function engine() {
    collect();
    if (!scenes.length) return;

    /* Reduced motion is not a degraded page: every scene is simply already at
       its resting value, and no listener is installed at all. */
    if (reduced || !("IntersectionObserver" in window)) { settle(); return; }
    addEventListener("load", function () { stickTops(); lastY = window.pageYOffset || 0; writeAll(); });

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i], s = null;
        for (var j = 0; j < scenes.length; j++) {
          if (scenes[j].el === e.target) { s = scenes[j]; break; }
        }
        if (!s || s.on === e.isIntersecting) continue;
        s.on = e.isIntersecting;
        live += e.isIntersecting ? 1 : -1;
      }
      tick();
    }, { rootMargin: "60% 0px 60% 0px" });
    scenes.forEach(function (s) { io.observe(s.el); });
    stickTops();
    writeAll();

    addEventListener("scroll", tick, { passive: true });

    /* On a phone the address bar retracting fires resize with a height change
       of 60-90px and no width change. Treating that as a real resize makes
       every pinned scene jump, so it is ignored: the layout is written in
       small-viewport units and did not actually move. */
    addEventListener("resize", function () {
      var w = root.clientWidth, h = root.clientHeight;
      if (w === vw && Math.abs(h - vh) < vh * 0.2) { tick(); return; }
      vw = w; vh = h;
      scenes.forEach(function (s) { s.last = -1; });
      fps.forEach(function (f) { f.last = -1; });
      stickTops();
      writeAll();
    }, { passive: true });
  }

  /* ── DEPTH ──────────────────────────────────────────────────────────────
     Chapter 4 is the one place with no entrance motion, so its whole job is
     to answer an input. The previous version rotated 1.25 degrees at a
     quarter offset, which is a value a computed style can report and a person
     cannot see. A card now lifts onto its own layer, carries a highlight
     under the pointer and pushes its neighbours back; press and focus get the
     same treatment in CSS, so touch and keyboard are not left out.

     The listener is attached on enter and removed on leave. Nothing runs
     while the pointer is elsewhere and nothing runs while the page is idle. */
  function depth() {
    var host = document.querySelector("[data-depth]");
    if (!host || reduced) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    var held = null;

    function clear(c) {
      if (!c) return;
      c.style.removeProperty("--rx");
      c.style.removeProperty("--ry");
    }

    function move(e) {
      var c = e.target.closest && e.target.closest(".cap__c");
      if (c !== held) { clear(held); held = c; }
      if (!c) return;
      var b = c.getBoundingClientRect();
      var x = (e.clientX - b.left) / b.width;
      var y = (e.clientY - b.top) / b.height;
      c.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      c.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      c.style.setProperty("--ry", ((x - 0.5) * 11).toFixed(2) + "deg");
      c.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg");
    }

    host.addEventListener("pointerenter", function () {
      host.addEventListener("pointermove", move, { passive: true });
    });
    host.addEventListener("pointerleave", function () {
      host.removeEventListener("pointermove", move);
      clear(held); held = null;
    });
  }

  engine();
  depth();
})();

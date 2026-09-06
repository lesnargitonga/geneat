/* ═══════════════════════════════════════════════════════════════════════════
   ARTIFACT-FIRST V5 · MOTION LAYER

   Contract, in order of importance:

   1. Scroll position IS the clock. There is no timeline. Stop scrolling and
      every scene stops on the exact frame the scroll position selects.
   2. The scheduler is event driven. scroll / resize / orientationchange
      schedule at most one animation frame; that frame reads geometry, computes
      progress, writes changed custom properties, and stops. Nothing
      reschedules itself, so an idle reader pays nothing.
   3. Meaning never depends on movement. This file is the only thing that sets
      data-af-motion="on", and every motion rule in the stylesheet is gated
      behind it. No JavaScript, or reduced motion, renders the accepted static
      composition.
   4. Fast scroll settles directly. Stage and progress are pure functions of
      scroll position, so there is no queue to replay and no catch-up to run.

   Three principal scenes only: hero extraction, product separation, action
   progression. System, Capability and Work do not animate.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Geometry that only changes on resize, measured once and reused. */
  var cache = null;

  /* Written state, so a frame can skip a write that would change nothing. */
  var written = {
    index: -1, hero: -1, product: -1, stage: -1, system: -1 };

  /* Diagnostics. Counted, never rendered. */
  var stats = { writes: 0, frames: 0, scheduled: false, lastReason: "init" };

  /* Pointer channel. Event driven like everything else: it writes only while
     the pointer is actually moving, and a still pointer costs nothing. Fine
     pointers only, so a touch screen never pays for it. */
  var ptr = { x: 0, y: 0, on: false, last: 9e9 };

  /* ── the clock ────────────────────────────────────────────────────────────
     Scroll position still drives everything, but the page reads it through a
     critically damped follower rather than raw. A hard scrub stops every pixel
     the instant the wheel stops, which is why it felt mechanical: no weight,
     no settle, no follow through.

     What this does NOT change: position is still the only input. There is no
     timeline and no autoplay, reversing the scroll still reverses the motion,
     and once the follower catches up the page is genuinely at rest — idle
     still costs zero frames and zero writes. It settles; it does not drift. */
  /* Damp the OUTPUT, never the input.

     The first version of this smoothed the scroll position itself and read
     every element's rect through it. That is wrong, and visibly so: elements
     are painted at the REAL scroll position, so a lagging clock believes a
     block is lower than it is actually drawn and its motion fires after the
     reader has already passed it. Triggers must key off where a thing really
     is; only the value travelling toward its target may ease. */
  var LAG_TAU = 0.085;      /* seconds to fall to ~37% of the remaining gap */
  var EPS = 0.0008;         /* close enough to call it arrived */
  var clock = { t: 0, k: 1, settling: false };

  function advanceClock() {
    var now = performance.now();
    var dt = clock.t ? (now - clock.t) / 1000 : 1;
    clock.t = now;
    if (dt > 0.1) dt = 0.1;                       /* a backgrounded tab must not jump */
    clock.k = reduceQuery.matches ? 1 : 1 - Math.exp(-dt / LAG_TAU);
    clock.settling = false;
  }

  /* Ease `store[key]` toward target and report whether it has arrived. */
  function ease(store, key, target) {
    var cur = store[key];
    if (cur === undefined || cur === null || clock.k >= 1) { store[key] = target; return target; }
    var next = cur + (target - cur) * clock.k;
    if (Math.abs(target - next) < EPS) next = target;
    else clock.settling = true;
    store[key] = next;
    return next;
  }

  var eased = {};

  function rectOf(el) { return el.getBoundingClientRect(); }
  var finePointer = window.matchMedia("(pointer: fine)");

  /* Reading position versus record. visualStage follows the scroll and may go
     backwards. semanticHistory records which stages the reader actually
     reached and is never regressed: a reverse scroll is a reading position,
     not a retraction of evidence. */
  var visualStage = -1;
  var semanticHistory = [];

  var els = {};

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* Progress of a sticky scene: how far its tall wrapper has travelled past
     the top of the viewport, over the distance it can travel. Not a
     viewport-crossing fraction, which would be wrong for a pinned scene. */
  function sceneProgress(el, vh) {
    var r = rectOf(el);
    var travel = r.height - vh;
    if (travel <= 0) return r.top <= 0 ? 1 : 0;
    return clamp(-r.top / travel, 0, 1);
  }

  /* How far the hero itself has left the top of the viewport. At rest this is
     0, so the index starts at its own beginning rather than mid-word. */
  function heroTravel(el) {
    var r = rectOf(el);
    if (r.height <= 0) return 0;
    return clamp(-r.top / r.height, 0, 1);
  }

  /* Progress of an ordinary block as it passes through the viewport. */
  /* Progress for something that BUILDS ITSELF in front of the reader.

     bandProgress spans height + viewport, so it only reaches 1 once the
     element has completely passed the top of the screen — measured at 73% of a
     viewport past it for the System plate, which is why the graph finished
     assembling after it was gone. A build has to complete while the thing is
     still being looked at, so this runs from the element entering to the
     element sitting centred, and is done there. */
  function buildProgress(el, vh) {
    var r = rectOf(el);
    var start = vh * 0.95;
    /* Where "done" is depends on whether the reader can hold the whole thing
       at once. Something shorter than the viewport is done when it sits
       centred. Something taller has content still below the fold at that
       point, so it is done when its BOTTOM has come up into view — otherwise
       the build finishes before the reader has seen what was built. */
    var end = r.height <= vh ? (vh - r.height) / 2 : (vh * 0.92 - r.height);
    var span = start - end;
    if (span <= 0) return r.top <= end ? 1 : 0;
    return clamp((start - r.top) / span, 0, 1);
  }

  function bandProgress(el, vh) {
    var r = rectOf(el);
    var span = r.height + vh;
    if (span <= 0) return 0;
    return clamp((vh - r.top) / span, 0, 1);
  }

  function collect() {
    els.heroScene = document.querySelector('[data-af-scene="extract"]');
    els.hero = document.querySelector(".hero");
    els.indexTrack = document.querySelector(".hero__index-track");
    els.indexWrap = document.querySelector(".hero__index");
    els.cp = document.querySelector(".cp");
    els.lit = document.querySelector(".cp__lit");
    els.frame = document.querySelector(".cp__frame");
    els.thread = document.querySelector(".hero__thread");
    els.prodScene = document.querySelector('[data-af-scene="product"]');
    els.shots = els.prodScene ? els.prodScene.querySelectorAll(".prod > .shot") : [];
    els.joint = document.querySelector(".joint");
    els.seq = document.querySelector('[data-af-scene="action"]');
    els.stages = els.seq ? els.seq.querySelectorAll("[data-af-stage]") : [];
    els.head = document.querySelector(".af-head");
    els.plate = document.querySelector('[data-af-scene="system"]');
    collectReveals();
  }

  /* ── page-wide scrubbed reveals ───────────────────────────────────────────
     Three scrub scenes left the rest of the page inert: everything between
     them simply sat there. These give the whole document a response to the
     scroll without inventing a second clock. Same contract as the scenes:
     position drives it, reversing scroll reverses it, stopping stops it.

     Two reveal languages, not one, so this does not read as a fade-up
     template. Type wipes horizontally, the way a line is set. Blocks rise and
     resolve their rule. */
  var WIPE_SEL = ".kicker, .sec h2";
  /* .cap, .anchor and .src__g belonged to sections that no longer exist.
     The skills cards are new and were never wired, so they arrived with no
     motion at all. */
  /* Was seven selectors, four of which matched nothing on this page and two of
     which - .lede and .sk__c - were a 34px rise on ordinary body copy. The
     records are the one thing here whose arrival means something. */
  var RISE_SEL = ".rec";

  function collectReveals() {
    var list = [];
    function add(nodes, kind) {
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.closest('[data-af-scene="action"]')) continue; /* scene 03 owns these */
        var parent = el.parentNode;
        var idx = 0, n = parent ? parent.firstElementChild : null;
        while (n && n !== el) { idx++; n = n.nextElementSibling; }
        list.push({ el: el, kind: kind, delay: Math.min(idx, 4) * 0.08, last: -1 });
      }
    }
    add(document.querySelectorAll(WIPE_SEL), "wipe");
    add(document.querySelectorAll(RISE_SEL), "rise");
    els.reveals = list;
    collectDepth();
    collectAnchors();
    els.sys = document.querySelector(".sys");
    els.notes = els.sys ? els.sys.querySelectorAll(".sys__notes>div") : [];
    els.notesCol = els.sys ? els.sys.querySelector(".sys__notes") : null;
    buildRail();
    stretchNotes();
    /* The carried ground may never reach any text, or the incoming section's
       own colour is painted under type meant for the other ground. Cap each
       band inside that section's top padding, measured, not assumed. */
    els.edges = [];
    var eds = document.querySelectorAll('[data-af-edge]');
    for (var e = 0; e < eds.length; e++) {
      var pad = parseFloat(getComputedStyle(eds[e]).paddingTop) || 0;
      els.edges.push({ el: eds[e], max: Math.max(0, pad * 0.8) });
    }
  }

  /* The window matters more than the easing. Completing a third of a viewport
     after the top edge crosses means an element is already settled by the time
     it is properly on screen, which is motion you cannot see. This runs from
     just inside the bottom edge to a comfortable reading position, so roughly
     six tenths of a viewport of scroll drives it. */
  var REVEAL_IN = 0.94, REVEAL_OUT = 0.30;
  /* Keyed to where the reader is looking, not to the element's top edge. A
     record is roughly 500px tall, so by the time its screenshot is on screen
     its top crossed the trigger hundreds of pixels ago and the arrival was
     finished before it could be seen. That is why every effect built on this
     read as nothing happening. Tall blocks now report from a point set into
     them, capped so a very tall block does not wait forever. */
  function revealProgress(el, vh) {
    var r = rectOf(el);
    var ref = r.top + Math.min(r.height * 0.42, vh * 0.34);
    var a = vh * REVEAL_IN, b = vh * REVEAL_OUT;
    if (ref >= a) return 0;
    if (ref <= b) return 1;
    return clamp((a - ref) / (a - b), 0, 1);
  }

  /* ── depth ───────────────────────────────────────────────────────────────
     Everything on this page travelled at exactly scroll speed, which is what
     made it read as a document rather than a composition. These layers travel
     at their own rate against the page: grounds drag, evidence inside a frame
     leads. Only figures that already clip take image parallax, so no focus
     ring is ever cut. */
  var DEPTH = [
    { sel: ".sec--product, .sec--system, .sec--action", rate: -0.055, prop: "--afd-g" },
    { sel: ".shot img, .joint__spec img", rate: 0.085, prop: "--afd-i" },
    { sel: ".sec h2", rate: -0.038, prop: "--afd-h" }
  ];

  function collectDepth() {
    var out = [];
    for (var d = 0; d < DEPTH.length; d++) {
      var nodes = document.querySelectorAll(DEPTH[d].sel);
      for (var i = 0; i < nodes.length; i++) {
        out.push({ el: nodes[i], rate: DEPTH[d].rate, prop: DEPTH[d].prop, last: 9e9 });
      }
    }
    els.depth = out;
  }

  /* Offset is measured from the element's own centre against the viewport
     centre, so it is zero when the element is centred and symmetric either
     side. That keeps the effect from accumulating down a long page. */
  function writeDepth(vh) {
    var list = els.depth;
    if (!list) return 0;
    var wrote = 0, mid = vh / 2;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var r = rectOf(it.el);
      if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) continue;
      var off = (r.top + r.height / 2) - mid;
      var px = off * it.rate;
      if (px > 90) px = 90; else if (px < -90) px = -90;
      if (Math.abs(px - it.last) < 0.4) continue;
      it.last = px;
      it.el.style.setProperty(it.prop, px.toFixed(1) + "px");
      wrote++;
    }
    return wrote;
  }

  /* A small, bounded lean toward the cursor. It is parallax, not a cursor
     effect: the layers already exist and only their offset changes. */
  function writePointer() {
    if (!ptr.on) return 0;
    var key = ptr.x * 1000 + ptr.y;
    if (Math.abs(key - ptr.last) < 0.5) return 0;
    ptr.last = key;
    var st = root.style;
    st.setProperty("--afm-x", (ptr.x * 10).toFixed(2) + "px");
    st.setProperty("--afm-y", (ptr.y * 7).toFixed(2) + "px");
    return 1;
  }

  /* The carried ground is deepest as the boundary reaches the bottom edge and
     is gone by the time the section is properly in view. */
  var EDGE_DEPTH = 132;
  function writeEdges(vh) {
    var list = els.edges;
    if (!list || !list.length) return 0;
    var wrote = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var el = item.el;
      var r = rectOf(el);
      if (r.top > vh * 1.15 || r.bottom < 0) continue;
      var t = ease(item, "cur", clamp((vh - r.top) / (vh * 0.5), 0, 1));
      var px = Math.min(EDGE_DEPTH, item.max) * (1 - t);
      if (item.last !== undefined && Math.abs(px - item.last) < 0.5) continue;
      item.last = px;
      el.style.setProperty("--afb", px.toFixed(1) + "px");
      wrote++;
    }
    return wrote;
  }

  /* ── scene 05: the record reads back ─────────────────────────────────────
     Each capability anchor is a recorded check: a subject, its result, and a
     note. Scrolling a territory reads its rows back in the order the record
     stores them, and each result lands after the subject it belongs to,
     because that is the order in which the thing was actually established.

     Deliberately NOT a running check. No cursor, no blink, no spinner: these
     are results recorded on a date, and motion that implied they were being
     fetched now would be a lie the rest of the page is careful not to tell. */
  /* Scrubbing means a reader who simply stops can hold a row part way. So the
     whole record must be fully legible well before the anchor is centred, not
     at the end of its travel: the step shrinks as rows are added, so a four
     row anchor resolves in the same distance as a three row one. */
  var ROW_SPAN = 0.26, RESULT_LAG = 0.09, ROWS_BUDGET = 0.32;

  function collectAnchors() {
    var out = [];
    var anchors = document.querySelectorAll(".anchor");
    for (var a = 0; a < anchors.length; a++) {
      var rows = anchors[a].querySelectorAll("tr");
      if (!rows.length) continue;
      out.push({ el: anchors[a], rows: rows, last: -1 });
    }
    els.anchors = out;
  }

  function writeAnchors(vh) {
    var list = els.anchors;
    if (!list) return 0;
    var wrote = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var p = ease(item, "cur", revealProgress(item.el, vh));
      if (Math.abs(p - item.last) < 0.004) continue;
      item.last = p;
      var step = item.rows.length > 1 ? ROWS_BUDGET / (item.rows.length - 1) : 0;
      for (var r = 0; r < item.rows.length; r++) {
        var base = r * step;
        var tr = clamp((p - base) / ROW_SPAN, 0, 1);
        var ts = clamp((p - base - RESULT_LAG) / ROW_SPAN, 0, 1);
        var er = 1 - Math.pow(1 - tr, 3);
        var es = 1 - Math.pow(1 - ts, 3);
        var st = item.rows[r].style;
        st.setProperty("--afk-o", er.toFixed(3));
        st.setProperty("--afk-r", es.toFixed(3));
        st.setProperty("--afk-y", ((1 - es) * 7).toFixed(2) + "px");
        wrote++;
      }
    }
    return wrote;
  }

  /* ── scene 06: the plate is held while the reading advances ───────────────
     Proper scrollytelling rather than another reveal: the graph stops moving
     and the observations step past it, one at a time, each lighting the region
     of the graph its reference mark already points at. The mapping is not
     invented for the motion — those marks exist in the static page precisely
     to tie an observation to a place on the plate. This makes the tie legible
     by reading them in sequence instead of all at once. */
  /* Pinning needs the reading column to be LONGER than the thing being held:
     the plate's grid row was exactly the plate's own height, so sticky had no
     travel at all. The notes are absolutely placed at authored offsets, so
     stretching the column means scaling those offsets with it. Motion only —
     the static page keeps the compact composition that was accepted. */
  var NOTE_STRETCH = 2.45;
  function stretchNotes() {
    if (!els.notesCol || !els.notes || !els.notes.length) return;
    for (var i = 0; i < els.notes.length; i++) {
      var n = els.notes[i];
      if (n.__at === undefined) {
        n.__at = parseFloat(getComputedStyle(n).getPropertyValue("--at")) || 0;
      }
      n.style.setProperty("--at", Math.round(n.__at * NOTE_STRETCH) + "px");
    }
    var base = els.notesCol.__min ||
      (els.notesCol.__min = parseFloat(getComputedStyle(els.notesCol).minHeight) || 648);
    els.notesCol.style.minHeight = Math.round(base * NOTE_STRETCH) + "px";
  }

  /* The rail is built here rather than authored into the page so the static
     and no-JavaScript renders stay exactly as accepted. */
  var rail = { el: null, marks: [], sections: [], active: -1 };
  function buildRail() {
    if (rail.el) return;
    var secs = document.querySelectorAll(".sec, .hero");
    if (!secs.length) return;
    var el = document.createElement("div");
    el.className = "af-rail";
    el.setAttribute("aria-hidden", "true");
    for (var i = 0; i < secs.length; i++) {
      rail.sections.push(secs[i]);
      var m = document.createElement("i");
      el.appendChild(m);
      rail.marks.push(m);
    }
    document.body.appendChild(el);
    rail.el = el;
  }

  function writeRail(vh) {
    if (!rail.el) return 0;
    var line = vh * 0.42, active = 0;
    for (var i = 0; i < rail.sections.length; i++) {
      if (rectOf(rail.sections[i]).top <= line) active = i;
    }
    if (active === rail.active) return 0;
    rail.active = active;
    for (var j = 0; j < rail.marks.length; j++) {
      rail.marks[j].setAttribute("data-on", j === active ? "1" : (j < active ? "past" : "0"));
    }
    return 1;
  }

  var noteState = { i: -1 };
  function writeNotes(vh) {
    if (!els.sys || !els.notes || !els.notes.length) return 0;
    var line = vh * 0.46;          /* the reading line */
    var active = -1;
    for (var i = 0; i < els.notes.length; i++) {
      if (rectOf(els.notes[i]).top <= line) active = i;
    }
    if (active === noteState.i) return 0;
    noteState.i = active;
    els.sys.setAttribute("data-af-note", active < 0 ? "none" : String(active + 1));
    /* Camera. The plate is not a running system and must never pretend to be,
       so nothing here moves the graph's own parts: the frame moves across a
       fixed drawing, the way a shot examines a diagram. Each observation
       pushes in on the region its reference mark points at, and the last pulls
       back to the whole topology. */
    /* No camera move. The drawing already fills its plate, so every zoom or
       pan crops a node — measured at 6 crops across 10 positions — and a
       section claiming to show the committed topology cannot show part of it.
       The reading is carried by emphasis instead: the nodes belonging to the
       observation come forward, the rest recede, and the whole graph stays on
       screen the entire time. */
    var SHOT = [
      { x: 0, y: 0, s: 1 }, { x: 0, y: 0, s: 1 }, { x: 0, y: 0, s: 1 },
      { x: 0, y: 0, s: 1 }, { x: 0, y: 0, s: 1 }
    ];
    /* Per-node emphasis is NOT wired: this plate renders its nodes as one
       group, not five addressable elements, so an index-based highlight dims
       the whole graph instead of one region. Left undone rather than shipped
       dimming everything. The reference marks already carry the mapping. */
    var shot = SHOT[active + 1] || SHOT[0];
    var g = els.sys.querySelector(".sys__machine svg");
    if (g) {
      g.style.setProperty("--afg-x", shot.x + "%");
      g.style.setProperty("--afg-y", shot.y + "%");
      g.style.setProperty("--afg-s", String(shot.s));
    }
    for (var j = 0; j < els.notes.length; j++) {
      els.notes[j].setAttribute("data-af-read", j === active ? "on" : (j < active ? "past" : "ahead"));
    }
    return 1;
  }

  function writeReveals(vh) {
    var list = els.reveals;
    if (!list) return 0;
    var active = document.activeElement;
    if (active === document.body) active = null;
    var wrote = 0;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      /* Focus must never sit on a partly revealed block. An element already
         in view does not trigger a scroll when focused, so position alone
         cannot be trusted here. */
      /* Focus must arrive resolved, not eased into. Easing toward 1 leaves a
         keyboard user on a block that is still transparent for the length of
         the settle, which is the same invisible-focus failure as before,
         reintroduced by the follow-through. Snap past the follower. */
      var focused = active && item.el.contains(active);
      if (focused) { item.cur = 1; }
      var raw = focused ? 1 : revealProgress(item.el, vh);
      var d = item.delay;
      var t = ease(item, "cur", d >= 1 ? raw : clamp((raw - d) / (1 - d), 0, 1));
      /* Blocks arrive with weight: they overshoot their resting place and
         settle back into it. Cubic was correct and completely inert — the
         whole page read as text fading up. This is the same scrubbed window,
         eased so the arrival has a bump in it.

         The overshoot is bounded and applied to translate and scale only, so
         nothing can push a wider box than its own column and reintroduce
         horizontal overflow. */
      var inv = 1 - t;
      var e = 1 - inv * inv * inv;
      var OVER = 1.42;
      var back = t >= 1 ? 1 : 1 + (OVER + 1) * Math.pow(t - 1, 3) + OVER * Math.pow(t - 1, 2);
      item.back = back;
      if (Math.abs(e - item.last) < 0.004) continue;
      item.last = e;
      if (item.kind === "wipe") {
        item.el.style.setProperty("--afv-w", ((1 - e) * 100).toFixed(2) + "%");
      } else {
        var b = item.back === undefined ? e : item.back;
        item.el.style.setProperty("--afv-y", ((1 - b) * 62).toFixed(2) + "px");
        item.el.style.setProperty("--afv-o", Math.min(1, e * 1.35).toFixed(3));
        item.el.style.setProperty("--afv-k", (0.955 + b * 0.045).toFixed(4));
        item.el.style.setProperty("--afv-s", (1 + (1 - e) * 0.075).toFixed(4));
      }
      wrote++;
    }
    return wrote;
  }

  /* ── measure ─────────────────────────────────────────────────────────────
     The hero panel is extracted FROM the selected region, so the distance and
     scale it travels are derived from where those two things actually sit.
     Nothing is hard coded, which is why it survives a resize or a font swap. */
  function measure() {
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var mobile = vw <= 900;

    var next = {
      vh: vh,
      vw: vw,
      mobile: mobile,
      /* Hero scene range. Roughly 1.5 viewports of travel on desktop, shorter
         on mobile where the composition is already vertical. */
      heroRange: mobile ? 190 : 250,
      thread: null,
      gap: 0
    };

    if (els.thread && els.frame) {
      /* Neutralise any current transform before measuring the resting place.
         .cp carries the pointer lean and .cp__frame is measured THROUGH it, so
         without this the panel's resting geometry depends on where the cursor
         happened to be at the last measure. */
      var prevT = els.thread.style.transform;
      var prevCp = els.cp ? els.cp.style.transform : null;
      els.thread.style.transform = "none";
      if (els.cp) els.cp.style.transform = "none";
      var t = rectOf(els.thread);
      var f = rectOf(els.frame);
      els.thread.style.transform = prevT;
      if (els.cp) els.cp.style.transform = prevCp;

      if (t.width > 0 && f.width > 0) {
        var scale = clamp((f.width * 0.62) / t.width, 0.55, 0.82);
        next.thread = {
          dx: (f.left + f.width * 0.62) - (t.left + t.width / 2),
          dy: (f.top + f.height * 0.55) - (t.top + t.height / 2),
          scale: scale
        };
      }
    }

    /* Separation travel. Each product moves inward far enough at progress 0 to
       overlap the static column gap entirely, so the pair reads as one field,
       and outward past it at progress 1 so the resolved cut is legible without
       the heading. Measured from the real column gap rather than hard coded. */
    if (els.shots.length === 2) {
      /* Neutralise any separation transform first. Measuring through a live
         transform reported a zero column gap and silently poisoned the whole
         separation geometry. */
      var p0 = els.shots[0].style.transform, p1 = els.shots[1].style.transform;
      els.shots[0].style.transform = "none";
      els.shots[1].style.transform = "none";
      var a = els.shots[0].getBoundingClientRect();
      var b = els.shots[1].getBoundingClientRect();
      els.shots[0].style.transform = p0;
      els.shots[1].style.transform = p1;
      var columnGap = mobile ? Math.max(0, b.top - a.bottom) : Math.max(0, b.left - a.right);
      /* half the closing distance plus half the extra opening we want */
      var openTo = clamp(columnGap * 1.9, 48, 80);           /* resolved gap */
      next.gapClose = columnGap / 2;                          /* joined at p=0 */
      next.gapOpen = Math.max(0, (openTo - columnGap) / 2);   /* extra at p=1 */
      next.columnGap = columnGap;
      next.resolvedGap = columnGap + next.gapOpen * 2;
    }

    /* Rail coordinates for the diagnostic read-head, in seq-local pixels. */
    if (els.seq && els.stages.length) {
      var seqTop = rectOf(els.seq).top;
      next.rail = [];
      for (var i = 0; i < els.stages.length; i++) {
        var r = els.stages[i].getBoundingClientRect();
        next.rail.push(r.top - seqTop + Math.min(30, r.height * 0.34));
      }
    }

    cache = next;
    root.style.setProperty("--af-hero-range", next.heroRange + "vh");
  }

  /* ── scene 01 · hero, evidence extraction ────────────────────────────────
     context → selected region → extracted panel → customer-side result.
     Phases overlap slightly so nothing snaps between them. */
  var SEL = { t: 12, r: 6, b: 46, l: 42 };

  /* The hero index: the register's own names, travelling under the scroll.
     Distance is derived from how much track actually overflows, so it never
     scrolls past its own end or stalls short of it at any viewport. */
  function writeIndex(p) {
    if (!els.indexTrack || !els.indexWrap) return false;
    if (Math.abs(p - written.index) < 0.0015) return false;
    written.index = p;
    var over = els.indexTrack.scrollWidth - els.indexWrap.clientWidth;
    if (over <= 0) { els.indexTrack.style.setProperty("--afi-x", "0px"); return true; }
    els.indexTrack.style.setProperty("--afi-x", (-over * clamp(p, 0, 1)).toFixed(1) + "px");
    return true;
  }

  function writeHero(p) {
    if (!els.lit) return false;
    if (Math.abs(p - written.hero) < 0.0015) return false;
    written.hero = p;

    /* Phase A/B: the lit region narrows from the whole plane to the selection,
       and the veil deepens over everything outside it. */
    var narrow = clamp((p - 0.04) / 0.5, 0, 1);
    var st = root.style;
    st.setProperty("--afh-ct", lerp(0, SEL.t, narrow).toFixed(2) + "%");
    st.setProperty("--afh-cr", lerp(0, SEL.r, narrow).toFixed(2) + "%");
    st.setProperty("--afh-cb", lerp(0, SEL.b, narrow).toFixed(2) + "%");
    st.setProperty("--afh-cl", lerp(0, SEL.l, narrow).toFixed(2) + "%");
    st.setProperty("--afh-veil", lerp(0.34, 1, narrow).toFixed(3));
    st.setProperty("--afh-frame", clamp((p - 0.16) / 0.26, 0, 1).toFixed(3));

    /* Phase C: the panel physically leaves the selected region. It is SOLID
       throughout. What changes is how much of it is unclipped and where it is,
       never how transparent it is, so two readable conversations can never
       occupy the same pixels at any stopped progress value. */
    var out = clamp((p - 0.5) / 0.42, 0, 1);
    var eased = out * out * (3 - 2 * out);
    var g = cache && cache.thread;
    if (g) {
      st.setProperty("--afh-tx", (g.dx * (1 - eased)).toFixed(1) + "px");
      st.setProperty("--afh-ty", (g.dy * (1 - eased)).toFixed(1) + "px");
      st.setProperty("--afh-ts", lerp(g.scale, 1, eased).toFixed(3));
    }

    /* Reveal is a top-down wipe, so the first thing that appears is the panel's
       own header and it is immediately recognisable as the customer app rather
       than a stray fragment. Below the start of the wipe the panel has no area
       at all, so nothing is readable through anything. */
    var wipe = clamp((p - 0.5) / 0.18, 0, 1);
    var w = wipe * wipe * (3 - 2 * wipe);
    st.setProperty("--afh-kt", "0%");
    st.setProperty("--afh-kb", lerp(100, -6, w).toFixed(2) + "%");
    st.setProperty("--afh-kl", "-2%");
    st.setProperty("--afh-kr", "-2%");
    st.setProperty("--afh-cap", clamp((p - 0.84) / 0.12, 0, 1).toFixed(3));
    return true;
  }

  /* ── scene 02 · product, runtime separation ──────────────────────────────
     One enclosing runtime field holding both products, then a boundary opens
     and each product resolves inside its own. The route specimen is registered
     to the shared field first and settles as coupling evidence afterwards. */
  function writeProduct(p) {
    if (!els.prodScene) return false;
    if (Math.abs(p - written.product) < 0.0015) return false;
    written.product = p;

    var open = clamp((p - 0.18) / 0.5, 0, 1);
    var eased = open * open * (3 - 2 * open);
    var st = root.style;

    if (cache && cache.columnGap !== undefined) {
      /* joined at 0, past the static gap at 1. The axis follows the layout:
         desktop separates horizontally, mobile separates vertically along the
         cut between a stacked pair. The same semantic event either way. */
      var d = lerp(cache.gapClose, -cache.gapOpen, eased);
      if (cache.mobile) {
        st.setProperty("--afp-dx1", "0px");
        st.setProperty("--afp-dx2", "0px");
        st.setProperty("--afp-dy1", d.toFixed(1) + "px");
        st.setProperty("--afp-dy2", (-d).toFixed(1) + "px");
      } else {
        st.setProperty("--afp-dx1", d.toFixed(1) + "px");
        st.setProperty("--afp-dx2", (-d).toFixed(1) + "px");
        st.setProperty("--afp-dy1", "0px");
        st.setProperty("--afp-dy2", "0px");
      }
    }
    /* The shared frame holds while the cut opens, then hands over to the two
       independent boundaries rather than simply dissolving early. */
    st.setProperty("--afp-field", (1 - clamp((p - 0.55) / 0.3, 0, 1)).toFixed(3));
    var edge = clamp((p - 0.5) / 0.32, 0, 1);
    st.setProperty("--afp-edgew", (1 + edge).toFixed(2) + "px");
    st.setProperty("--afp-edge", edge > 0.5 ? "var(--ink)" : "var(--rule-s)");
    st.setProperty("--afp-jy", (-16 * (1 - eased)).toFixed(1) + "px");
    st.setProperty("--afp-jt", clamp((p - 0.5) / 0.28, 0, 1).toFixed(3));
    return true;
  }

  /* ── scene 04 · the graph builds itself ─────────────────────────────────
     Five edges in the order the source declares them, each drawn over its own
     window, and each node resolving as the edge that reaches it lands. */
  var EDGE_WINDOWS = [[0.06,0.30],[0.22,0.46],[0.38,0.62],[0.52,0.74],[0.64,0.86]];
  var NODE_AT      = [0.06, 0.28, 0.44, 0.72, 0.84];

  function writeSystem(p) {
    if (!els.plate) return 0;
    if (Math.abs(p - written.system) < 0.002) return 0;
    written.system = p;
    var st = root.style, wrote = 0, i, t;
    for (i = 0; i < 5; i++) {
      t = clamp((p - EDGE_WINDOWS[i][0]) / (EDGE_WINDOWS[i][1] - EDGE_WINDOWS[i][0]), 0, 1);
      t = t * t * (3 - 2 * t);
      if (i < 3) st.setProperty("--afs-e" + (i + 1), (1 - t).toFixed(3));
      else st.setProperty("--afs-e" + (i + 1), t.toFixed(3));
      wrote++;
    }
    for (i = 0; i < 5; i++) {
      t = clamp((p - NODE_AT[i]) / 0.1, 0, 1);
      t = t * t * (3 - 2 * t);
      st.setProperty("--afs-n" + (i + 1), t.toFixed(3));
      st.setProperty("--afs-s" + (i + 1), (0.86 + 0.14 * t).toFixed(3));
      wrote += 2;
    }
    return wrote;
  }

  /* ── scene 03 · action, diagnostic progression ───────────────────────────
     The current stage is a pure function of scroll position, so a fast scroll
     settles on the right stage directly rather than replaying the sequence. */
  /* Split into a read half and a write half. The previous version interleaved
     them: writeHero and writeProduct set custom properties, then writeAction
     called getBoundingClientRect seven times, forcing a synchronous layout in
     the middle of every frame. The file claimed "all reads, then all writes"
     and the code did not do it. */
  function readAction(vh) {
    if (!els.seq || !els.stages.length) return null;
    var mid = vh * 0.52;
    var idx = -1;
    for (var i = 0; i < els.stages.length; i++) {
      if (els.stages[i].getBoundingClientRect().top <= mid) idx = i;
    }
    var head = null;
    if (els.head && cache && cache.rail && cache.rail.length) {
      var rail = cache.rail;
      var line = mid - rectOf(els.seq).top;
      var y = clamp(line, rail[0], rail[rail.length - 1]);
      head = {
        y: y.toFixed(1) + "px",
        tail: Math.max(0, y - rail[0]).toFixed(1) + "px",
        opacity: (line >= rail[0] - 90 && line <= rail[rail.length - 1] + 160) ? "1" : "0"
      };
    }
    return { idx: idx, head: head };
  }

  /* Written head state, so an unchanged frame writes nothing at all. */
  var writtenHead = { y: null, tail: null, opacity: null };

  function writeAction(state) {
    if (!state) return 0;
    var wrote = 0;
    var h = state.head;
    if (h) {
      /* The read-head position is continuous, not stepped: it is the scroll
         line in rail coordinates, so it moves between stages as well as at
         stage changes. */
      if (h.y !== writtenHead.y) { root.style.setProperty("--afa-y", h.y); writtenHead.y = h.y; wrote++; }
      if (h.tail !== writtenHead.tail) { root.style.setProperty("--afa-tail", h.tail); writtenHead.tail = h.tail; wrote++; }
      if (h.opacity !== writtenHead.opacity) { els.head.style.opacity = h.opacity; writtenHead.opacity = h.opacity; wrote++; }
    }

    var idx = state.idx;
    if (idx === written.stage) return wrote;
    written.stage = idx;
    visualStage = idx;

    if (idx >= 0 && semanticHistory.indexOf(idx) === -1) semanticHistory.push(idx);

    els.seq.setAttribute("data-af-action-stage", String(idx));
    for (var j = 0; j < els.stages.length; j++) {
      els.stages[j].setAttribute(
        "data-af-stage-state",
        idx < 0 ? "future" : j < idx ? "past" : j === idx ? "current" : "future"
      );
    }
    return wrote + 1;
  }

  /* ── the frame ───────────────────────────────────────────────────────────
     One pass. All reads, then all writes. Never reschedules itself. */
  function frame() {
    stats.scheduled = false;
    stats.frames++;
    advanceClock();
    var vh = window.innerHeight;

    /* READ half. Every geometry query happens here, before anything is
       written, so no write can force a synchronous layout for a later read. */
    var heroP = ease(eased, "hero", els.heroScene ? sceneProgress(els.heroScene, vh) : 0);
    var indexP = ease(eased, "index", els.hero ? heroTravel(els.hero) : 0);
    var prodP = ease(eased, "prod", els.prodScene ? buildProgress(els.prodScene, vh) : 0);
    var actionState = readAction(vh);
    var sysP = ease(eased, "sys", els.plate ? buildProgress(els.plate, vh) : 0);

    /* WRITE half. */
    var wrote = 0;
    if (writeHero(heroP)) wrote++;
    if (writeIndex(indexP)) wrote++;
    if (writeProduct(prodP)) wrote++;
    wrote += writeAction(actionState);
    wrote += writeSystem(sysP);
    wrote += writeReveals(vh);
    wrote += writeDepth(vh);
    wrote += writePointer();
    wrote += writeEdges(vh);
    wrote += writeAnchors(vh);
    wrote += writeNotes(vh);
    wrote += writeRail(vh);
    stats.writes += wrote;
    /* Keep the follower running until it has arrived, then stop dead. */
    if (clock.settling) schedule("settle");
  }

  function schedule(reason) {
    stats.lastReason = reason || "scroll";
    if (stats.scheduled) return;
    stats.scheduled = true;
    requestAnimationFrame(frame);
  }

  function onResize() {
    measure();
    written.hero = written.product = written.stage = written.system = -1;
    writtenHead.y = writtenHead.tail = writtenHead.opacity = null;
    schedule("resize");
  }

  /* ── enable / disable ────────────────────────────────────────────────── */
  function clearWrites() {
    var names = ["--afh-ct", "--afh-cr", "--afh-cb", "--afh-cl", "--afh-veil",
      "--afh-frame", "--afh-tx", "--afh-ty", "--afh-ts", "--afh-cap",
      "--afh-kt", "--afh-kr", "--afh-kb", "--afh-kl",
      "--afp-dx1", "--afp-dx2", "--afp-dy1", "--afp-dy2",
      "--afp-field", "--afp-jy", "--afp-jt",
      "--afp-edge", "--afp-edgew", "--afa-y", "--afa-tail",
      "--afs-e1","--afs-e2","--afs-e3","--afs-e4","--afs-e5",
      "--afs-n1","--afs-n2","--afs-n3","--afs-n4","--afs-n5",
      "--afs-s1","--afs-s2","--afs-s3","--afs-s4","--afs-s5",
      "--af-hero-range"];
    for (var i = 0; i < names.length; i++) root.style.removeProperty(names[i]);
    if (els.seq) els.seq.removeAttribute("data-af-action-stage");
    for (var j = 0; j < els.stages.length; j++) els.stages[j].removeAttribute("data-af-stage-state");
  }

  var enabled = false;

  function enable() {
    if (enabled) return;
    enabled = true;
    collect();
    root.setAttribute("data-af-motion", "on");
    measure();
    /* Resolve the first frame synchronously so nothing is painted unresolved. */
    frame();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { onResize(); });
    }
    window.addEventListener("load", onResize);
    if (finePointer.matches) {
      ptr.on = true;
      window.addEventListener("pointermove", function (e) {
        ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
        ptr.y = (e.clientY / window.innerHeight) * 2 - 1;
        schedule(e);
      }, { passive: true });
    }
    window.addEventListener("scroll", schedule, { passive: true });
    /* Resolve focus synchronously. Deferring to the next frame leaves the
       focused block unresolved for a frame, which is a race a keyboard user
       can lose. */
    window.addEventListener("focusin", function () { frame(); }, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    root.removeAttribute("data-af-motion");
    clearWrites();
    written.hero = written.product = written.stage = written.system = -1;
    writtenHead.y = writtenHead.tail = writtenHead.opacity = null;
    if (els.head) els.head.style.opacity = "";
  }

  if (!reduceQuery.matches) enable();
  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener("change", function (e) { e.matches ? disable() : enable(); });
  }

  /* ── diagnostics, console only, never rendered ───────────────────────── */
  window.afMotionState = function () {
    var vh = window.innerHeight;
    return {
      enabled: enabled,
      reducedMotion: reduceQuery.matches,
      /* raw is where the page IS; rendered is what the reader can see. They
         differ while motion is carrying, and a diagnostic that reports only
         raw makes easing invisible to every test that reads it. */
      heroProgress: els.heroScene ? +sceneProgress(els.heroScene, vh).toFixed(4) : null,
      heroRendered: eased.hero === undefined ? null : +eased.hero.toFixed(4),
      productRendered: eased.prod === undefined ? null : +eased.prod.toFixed(4),
      systemRendered: eased.sys === undefined ? null : +eased.sys.toFixed(4),
      settling: clock.settling,
      /* Must use the SAME function the frame uses. When these drifted apart,
         every test that seeks a progress value was searching a curve the page
         had stopped using, and reported a failure that did not exist. */
      productProgress: els.prodScene ? +buildProgress(els.prodScene, vh).toFixed(4) : null,
      systemProgress: els.plate ? +buildProgress(els.plate, window.innerHeight).toFixed(4) : null,
      actionStage: visualStage,
      actionStageName: ["symptom", "isolate", "measure", "classify", "contain", "recover"][visualStage] || null,
      schedulerWrites: stats.writes,
      schedulerFrames: stats.frames,
      rafScheduled: stats.scheduled,
      lastReason: stats.lastReason,
      viewport: { w: window.innerWidth, h: vh, mobile: cache ? cache.mobile : null },
      resolvedProductGapPx: cache ? cache.resolvedGap : null,
      staticColumnGapPx: cache ? cache.columnGap : null,
      separationAxis: cache ? (cache.mobile ? "vertical" : "horizontal") : null
    };
  };
  window.afMotionHistory = function () {
    return { visualStage: visualStage, semanticHistory: semanticHistory.slice() };
  };
  window.afMotionResetStats = function () { stats.writes = 0; stats.frames = 0; };
})();

/* ── EVIDENCE STAGING ──────────────────────────────────────────────────────
   The record's claim is already on screen; its proof resolves as the image
   travels from the lower edge into the reading zone. Driven by position so the
   window is wide enough to be seen — the block's own reveal is far too fast. */
(function () {
  "use strict";
  var figs = [].slice.call(document.querySelectorAll(".rec__proof"));
  if (!figs.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var START = 0.92, END = 0.46, ticking = false;   /* viewport fractions */

  function write() {
    ticking = false;
    var vh = window.innerHeight || 1;
    for (var i = 0; i < figs.length; i++) {
      var f = figs[i], r = f.getBoundingClientRect();
      if (r.bottom < -200) continue;
      if (r.top > vh + 200) {
        if (f.__p !== 0) { f.__p = 0; f.style.setProperty("--proof", "0"); }
        continue;
      }
      var t = (r.top / vh - START) / (END - START);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var e = 1 - Math.pow(1 - t, 3);
      var prev = f.__p;
      if (prev === undefined || Math.abs(e - prev) > 0.004) {
        f.__p = e;
        f.style.setProperty("--proof", e.toFixed(3));
      }
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(write); } }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  write();
})();

/* ── HEADLINE WIDTH RESERVE ────────────────────────────────────────────────
   Measures the h1 at its final width and pins that height before the width
   animation runs, so opening the axis reflows the line inside the block and
   never moves the page beneath it. */
(function () {
  "use strict";
  var h1 = document.querySelector(".hero h1[data-set], .page h1[data-set], .sys-hero h1[data-set]");
  if (!h1) return;
  function reserve() {
    h1.style.minHeight = "";
    var prev = h1.style.getPropertyValue("--wd");
    h1.style.setProperty("--wd", "104");
    var h = h1.getBoundingClientRect().height;
    if (prev) h1.style.setProperty("--wd", prev); else h1.style.removeProperty("--wd");
    h1.style.minHeight = Math.ceil(h) + "px";
  }
  reserve();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
  var t; addEventListener("resize", function () { clearTimeout(t); t = setTimeout(reserve, 150); }, { passive: true });
})();

/* ── REGISTER STRIP: ORDER, AND A RESERVED HEIGHT ──────────────────────────
   Indexes each name so the stagger has an order, then pins the track at the
   height it occupies once every name has reached its final width. Without this
   the names narrowing from 118 to 88 change how many fit per row, the strip
   re-wraps mid-animation and the rows visibly jump: measured 0.0234 CLS. */
(function () {
  "use strict";
  var t = document.querySelector(".hero__index-track[data-set]");
  if (!t) return;
  var n = t.querySelectorAll(".hx");
  for (var i = 0; i < n.length; i++) n[i].style.setProperty("--i", i);

  function reserve() {
    t.style.minHeight = "";
    for (var i = 0; i < n.length; i++) n[i].style.setProperty("--wb", "88");
    var h = t.getBoundingClientRect().height;
    for (var j = 0; j < n.length; j++) n[j].style.removeProperty("--wb");
    t.style.minHeight = Math.ceil(h) + "px";
  }
  reserve();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
  var d; addEventListener("resize", function () {
    clearTimeout(d); d = setTimeout(reserve, 150);
  }, { passive: true });
})();

/* ── NAME HEIGHT RESERVE ───────────────────────────────────────────────────
   A name changing width can re-wrap inside its column and move everything
   under it. Each name is measured at its settled width and pinned there, so
   the axis reflows the line and never the record. */
(function () {
  "use strict";
  var sets = [[".live-e h3", "--rw", "96"], [".held-e__name", "--cw", "88"],
              [".sv__t h2", "--rw", "82"], [".pr__t h2", "--rw", "82"],
              [".reg-band__h h2", "--rw", "80"]];
  function reserve() {
    sets.forEach(function (s) {
      var els = document.querySelectorAll(s[0]);
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        e.style.minHeight = "";
        e.style.setProperty(s[1], s[2]);
        var h = e.getBoundingClientRect().height;
        e.style.removeProperty(s[1]);
        e.style.minHeight = Math.ceil(h) + "px";
      }
    });
  }
  reserve();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);
  var t; addEventListener("resize", function () {
    clearTimeout(t); t = setTimeout(reserve, 150);
  }, { passive: true });
})();

/* ── NAMES SET THEMSELVES AS YOU REACH THEM ────────────────────────────────
   Position-driven, not arrival-driven. The shared reveal value saturates in
   roughly 225px of scroll and does it below the reading line, so a name tied
   to it snapped to its end state before it could be seen. This runs across
   ~40% of the viewport, in the band where the name is actually being read. */
(function () {
  "use strict";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  /* 88->96 and 100->88 were 8 and 12 units of travel on an axis that runs
     62 to 125. Measurable, and invisible: you cannot see a name widen by 8%
     while reading it. These are 24 and 18 units, and both open from narrow so
     the settled state is also the widest - which keeps the reserved height
     correct without padding the block. */
  /* Re-pointed back. This list was aimed at /work/ and project-page selectors
     after the homepage records were removed - none of which exist on this page,
     so the axis ran nowhere below the hero. The records are restored and the
     stylesheet still wires .rec h3 to --rw, so the signature runs on the
     largest type on the page, which is where it reads. */
  var groups = [
    { els: [].slice.call(document.querySelectorAll(".rec h3")), prop: "--rw", from: 66, to: 96 }
  ].filter(function (g) { return g.els.length; });
  if (!groups.length) return;

  var START = 0.95, END = 0.42, ticking = false;
  function write() {
    ticking = false;
    var vh = window.innerHeight || 1;
    groups.forEach(function (g) {
      for (var i = 0; i < g.els.length; i++) {
        var e = g.els[i], r = e.getBoundingClientRect();
        if (r.bottom < -150 || r.top > vh + 150) continue;
        var t = (r.top / vh - START) / (END - START);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var k = 1 - Math.pow(1 - t, 3);
        var v = g.from + (g.to - g.from) * k;
        if (e.__w === undefined || Math.abs(v - e.__w) > 0.15) {
          e.__w = v;
          e.style.setProperty(g.prop, v.toFixed(2));
        }
      }
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(write); } }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  write();
})();

/* the evidence rules draw themselves in when the section is reached */
(function () {
  "use strict";
  var cards = [].slice.call(document.querySelectorAll(".sk__c"));
  if (!cards.length) return;
  cards.forEach(function (c, i) { c.style.setProperty("--i", i); });
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cards.forEach(function (c) { c.classList.add("is-in"); }); return;
  }
  if (!("IntersectionObserver" in window)) {
    cards.forEach(function (c) { c.classList.add("is-in"); }); return;
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: 0.35 });
  cards.forEach(function (c) { io.observe(c); });
})();

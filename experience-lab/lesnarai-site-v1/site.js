/* Site motion.
 *
 * The same language the home route uses, reduced to what every page needs:
 * type wipes in from the left the way a line is set, blocks rise and resolve.
 * The rules that made it work there are the rules that matter here too.
 *
 *   - Position is the only input. No timeline, no autoplay.
 *   - Triggers key off where an element REALLY is. Damping applies to the
 *     value travelling toward its target, never to the reading of position,
 *     or motion arrives after the reader has already gone past.
 *   - It settles. Once every value has arrived the page costs nothing:
 *     zero frames, zero writes.
 *   - Focus snaps past the easing. A keyboard user must never land on a block
 *     that is still fading in.
 *   - Nothing is gated on JavaScript. Without this file, or under reduced
 *     motion, every page renders complete.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;

  /* Motion earns its place by meaning something. The width-axis wipe is the
     identity, so it stays on the section marker and the headline. Rise is kept
     for evidence - the fact rows and maturity marks - where arrival tells you
     something has been asserted. Everything else was a 34px rise and an opacity
     ramp on ordinary body copy: 92 elements of it, including 60 footer
     paragraphs, which is the motion that made the footer clip and which reads
     as generic no matter how good the easing underneath is. .reg li and .rule
     matched nothing at all and are gone. */
  var WIPE = ".kicker, h1";
  var RISE = ".fact div, .mat";

  var items = [];
  var scheduled = false;
  var lastT = 0;
  var settling = false;
  var stats = { frames: 0, writes: 0 };

  var TAU = 0.085;
  var EPS = 0.0009;

  /* where the headline axis finishes: .page h1 / .sys-hero h1 / .nf h1 all
     rest at wdth 100, and the keyframe runs 72 -> 100 */
  var SETTLED = "100";

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }


  /* ── headline, set letter by letter ──────────────────────────────────────
     Built from the text already in the page, so without JavaScript the
     headline is simply the headline. Each character carries its own delay and
     rides in on a clip, so the line assembles the way type is set rather than
     fading in as a block. */
  /* ── committing the wrap before the axis opens ───────────────────────────
     The headline opens from wdth 72 to 100 over 1050ms. Thirty units of glyph
     width is enough to carry a word onto another line, and every time one
     moves, everything below the headline moves with it. That is not a small
     effect: /engagement/ at 390 measured 1.1402 CLS, essentially all of it
     from this one animation, and /about/ at 1440 measured 0.4028.

     Freezing the axis would remove the site's signature, so the wrap is
     decided first instead. Measure where the lines actually break at the
     settled width, carry those breaks into the rebuilt headline as real <br>,
     and the axis then changes how wide each line is - never which words are
     on it. The glyphs still animate; the page no longer moves.

     Measured at the SETTLED width because that is the widest the line ever
     gets: every intermediate value of the animation is narrower and therefore
     still fits inside a break committed here. */
  /* The headline is capped at 18ch. A ch is the advance of the zero glyph in
     the current font, so with "wdth" animating 72 -> 100 the cap animates with
     it: measured 468px wide at 72 and 630px at 100 on /about/ at 1024. The
     text is then wrapping against a box that is itself moving, and the line
     count is not even monotonic - 4 lines at wdth 90, 5 at 92, 4 at 95, 5 at
     98, 4 at 100 - which is how /about/ scored 1.6191 at 1024x768 with the
     line breaks already committed.

     Resolve the authored cap once, at the settled axis value, and pin it in
     pixels. The design intent (18ch at rest) is preserved exactly; what goes
     away is the cap moving while the glyphs open. */
  function pinWidth(h) {
    var prev = h.style.getPropertyValue("--wd");
    h.style.setProperty("--wd", SETTLED);
    var mw = getComputedStyle(h).maxWidth;
    if (prev) h.style.setProperty("--wd", prev);
    else h.style.removeProperty("--wd");
    if (mw && mw !== "none" && mw.indexOf("px") === mw.length - 2)
      h.style.maxWidth = mw;
  }

  function lineStarts(h) {
    var prev = h.style.getPropertyValue("--wd");
    h.style.setProperty("--wd", SETTLED);

    var walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    var range = document.createRange();
    var node, g = 0, at = {}, lastTop = null;
    while ((node = walker.nextNode())) {
      var t = node.textContent;
      for (var i = 0; i < t.length; i++, g++) {
        /* a space straddles the break, so only real glyphs decide the line */
        if (!/\S/.test(t.charAt(i))) continue;
        range.setStart(node, i); range.setEnd(node, i + 1);
        var r = range.getBoundingClientRect();
        if (!r.height) continue;
        var top = Math.round(r.top);
        if (lastTop === null) lastTop = top;
        else if (Math.abs(top - lastTop) > 4) { at[g] = 1; lastTop = top; }
      }
    }

    if (prev) h.style.setProperty("--wd", prev);
    else h.style.removeProperty("--wd");
    return at;
  }

  function splitHeadline() {
    var h = document.querySelector("h1");
    if (!h || h.dataset.split === "1" || reduce.matches) return;

    /* The hero headline has its own committed-line implementation in
       v3-h1.js, already measured at 0.0104 on the homepage. Leave it alone. */
    var hero = h.closest && h.closest(".hero");
    if (!hero) pinWidth(h);           /* before measuring: the wrap depends on it */
    var breakAt = hero ? {} : lineStarts(h);
    if (h.__orig === undefined) h.__orig = h.innerHTML;

    /* Walk the child nodes rather than reading textContent. textContent drops
       every element, so an authored line break in "build<br>for you" vanished
       and the two words were split as the single token "buildfor" - rendered
       joined, and announced joined in the aria-label. Line breaks are carried
       through as real <br> elements and count as a space in the label. */
    var ci = 0, label = "", gi = 0;
    var frag = document.createDocumentFragment();

    function emitText(text) {
      var words = text.split(/(\s+)/);
      for (var w = 0; w < words.length; w++) {
        if (words[w] === "") continue;
        if (/^\s+$/.test(words[w])) {
          frag.appendChild(document.createTextNode(" "));
          gi += words[w].length;
          continue;
        }
        if (breakAt[gi]) {
          /* the break replaces the space it fell on, and never doubles a
             line break the markup already authored */
          var tail = frag.lastChild;
          if (tail && tail.nodeType === 3 && !/\S/.test(tail.textContent))
            frag.removeChild(tail);
          if (!(frag.lastChild && frag.lastChild.nodeName === "BR"))
            frag.appendChild(document.createElement("br"));
        }
        var word = document.createElement("span");
        word.className = "sw";
        for (var c = 0; c < words[w].length; c++) {
          var ch = document.createElement("span");
          ch.className = "sc";
          ch.setAttribute("aria-hidden", "true");
          ch.style.setProperty("--i", ci++);
          ch.textContent = words[w][c];
          word.appendChild(ch);
        }
        frag.appendChild(word);
        gi += words[w].length;
      }
    }

    function walk(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var n = node.childNodes[i];
        if (n.nodeType === 3) { emitText(n.textContent); label += n.textContent; }
        else if (n.nodeType === 1 && n.tagName === "BR") {
          frag.appendChild(document.createElement("br"));
          label += " ";
        } else if (n.nodeType === 1) { walk(n); }
      }
    }
    walk(h);

    /* Emptying the element first collapsed the headline to zero height for a
       frame, which scored a larger shift than the animation it was meant to
       fix. Pin the measured box, swap in one operation, and only release the
       pin if the rebuilt headline occupies exactly what the original did. */
    var box = Math.ceil(h.getBoundingClientRect().height);
    h.dataset.split = "1";
    h.setAttribute("aria-label", label.replace(/\s+/g, " ").trim());
    /* The hero keeps the original path exactly: v3-h1.js pins and rebuilds it
       straight afterwards, and a second pin from here would fight that one. */
    if (hero) { h.textContent = ""; h.appendChild(frag); }
    else {
      h.style.minHeight = box + "px";
      if (h.replaceChildren) h.replaceChildren(frag);
      else { h.textContent = ""; h.appendChild(frag); }
      if (Math.ceil(h.getBoundingClientRect().height) === box) h.style.minHeight = "";
    }
    requestAnimationFrame(function () { h.setAttribute("data-set", "on"); });
  }

  function collect() {
    items = [];
    function add(nodes, kind) {
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var parent = el.parentNode;
        var idx = 0, n = parent ? parent.firstElementChild : null;
        while (n && n !== el) { idx++; n = n.nextElementSibling; }
        items.push({ el: el, kind: kind, delay: Math.min(idx, 5) * 0.07, cur: 0, last: -1 });
      }
    }
    add(document.querySelectorAll(WIPE), "wipe");
    add(document.querySelectorAll(RISE), "rise");
  }

  /* From just inside the bottom edge to a comfortable reading position, so a
     block finishes while it is being looked at rather than after it has gone. */
  function progressOf(el, applied) {
    /* getBoundingClientRect INCLUDES transforms, so measuring a block that is
       currently offset by the rise feeds its own displacement back into its
       progress and the value never settles. Subtract what we put there. */
    var r = el.getBoundingClientRect();
    var top = r.top - (applied || 0);
    var vh = window.innerHeight;
    /* The window has to close early enough that the EASED value still lands
       while the block is on screen. Completing the trigger at 0.30vh left the
       damping tail arriving after the block had gone, which is the late-motion
       fault this whole system exists to avoid. */
    var a = vh * 0.98, b = vh * 0.46;
    /* A block at the very end of the document - the footer above all - can
       never rise to the completion line, because the page runs out of scroll
       first. Left alone it stays permanently mid-reveal, which clipped the
       footer text. Completion has to be measured against the highest position
       the block can actually reach, not one it can never attain. */
    var doc = document.documentElement;
    var remaining = doc.scrollHeight - (window.pageYOffset + vh);
    if (remaining < 0) remaining = 0;
    var end = top - remaining > b ? top - remaining : b;
    if (top >= a) return 0;
    if (top <= end) return 1;
    if (a - end <= 0) return 1;
    return clamp((a - top) / (a - end), 0, 1);
  }

  function frame() {
    scheduled = false;
    stats.frames++;
    var now = performance.now();
    var dt = lastT ? (now - lastT) / 1000 : 1;
    lastT = now;
    if (dt > 0.1) dt = 0.1;
    var k = 1 - Math.exp(-dt / TAU);
    settling = false;

    var active = document.activeElement;
    if (active === document.body) active = null;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var focused = active && it.el.contains(active);
      var applied = it.kind === "rise" ? (1 - it.cur) * 34 : 0;
      var raw = focused ? 1 : progressOf(it.el, applied);
      var d = it.delay;
      var target = d >= 1 ? raw : clamp((raw - d) / (1 - d), 0, 1);
      var t = target < 1 ? 1 - Math.pow(1 - target, 3) : 1;

      if (focused) { it.cur = 1; }
      else {
        if (it.done && target < 0.98) it.done = false;
        var next = it.cur + (t - it.cur) * k;
        if (Math.abs(t - next) < EPS) next = t;
        else settling = true;
        it.cur = next;
      }

      /* The write was skipped whenever the step was under 0.004, which is
         exactly what the last approach to fully-revealed produces. The final
         write never happened, so elements sat permanently at ~0.4% clipped -
         the reveal could not finish, on every page, forever.

         Settled elements now drop the custom properties entirely and are
         marked done, so they cost nothing on later frames. */
      var settled = it.cur > 0.999;
      if (!settled && Math.abs(it.cur - it.last) < 0.004) continue;
      if (settled && it.done) continue;
      it.last = it.cur;

      if (settled) {
        it.cur = 1;
        it.done = true;
        it.el.style.removeProperty("--sv-w");
        it.el.style.removeProperty("--sv-y");
        it.el.style.removeProperty("--sv-o");
        it.el.setAttribute("data-sv-in", "");
      } else if (it.kind === "wipe") {
        it.el.style.setProperty("--sv-w", ((1 - it.cur) * 100).toFixed(2) + "%");
      } else {
        it.el.style.setProperty("--sv-y", ((1 - it.cur) * 34).toFixed(2) + "px");
        it.el.style.setProperty("--sv-o", it.cur.toFixed(3));
      }
      stats.writes++;
    }

    if (settling) schedule();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(frame);
  }

  /* A committed wrap belongs to one width. Re-measure when the width actually
     changes - not when a mobile URL bar collapses, which fires resize on
     height alone and would otherwise rebuild the headline mid-scroll. */
  var lastW = window.innerWidth, rt;
  function recommit() {
    var h = document.querySelector("h1");
    if (!h || h.__orig === undefined || (h.closest && h.closest(".hero"))) return;
    h.style.minHeight = "";
    h.style.maxWidth = "";            /* the cap is viewport-dependent too */
    h.innerHTML = h.__orig;
    delete h.dataset.split;
    /* data-set is deliberately left in place: re-setting an attribute to the
       value it already holds does not restart the CSS animation, so the
       headline does not replay itself every time the window is dragged. */
    splitHeadline();
    collect();
  }

  function enable() {
    if (reduce.matches) return;
    root.setAttribute("data-sv-motion", "on");
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", function () {
      collect(); schedule();
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(rt);
      rt = setTimeout(recommit, 200);
    }, { passive: true });
    window.addEventListener("focusin", function () { frame(); }, { passive: true });

    /* The wrap has to be measured in Archivo, not in the fallback: committing
       the fallback's line breaks would re-wrap the moment the real face
       arrives, which is the shift this exists to prevent. */
    function start() { splitHeadline(); collect(); frame(); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  }

  function disable() {
    root.removeAttribute("data-sv-motion");
    for (var i = 0; i < items.length; i++) {
      var s = items[i].el.style;
      s.removeProperty("--sv-w"); s.removeProperty("--sv-y"); s.removeProperty("--sv-o");
    }
  }

  if (reduce.addEventListener) {
    reduce.addEventListener("change", function (e) { e.matches ? disable() : enable(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enable);
  } else { enable(); }

  window.svMotionState = function () {
    return { enabled: root.getAttribute("data-sv-motion") === "on",
             reducedMotion: reduce.matches, tracked: items.length,
             frames: stats.frames, writes: stats.writes, settling: settling };
  };
  window.svMotionReset = function () { stats.frames = 0; stats.writes = 0; };
})();

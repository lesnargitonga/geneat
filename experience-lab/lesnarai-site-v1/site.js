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

  var WIPE = ".kicker, h1, .site-foot p";
  var RISE = ".lede, .reg li, .fact div, .stop, .mat, .rule";

  var items = [];
  var scheduled = false;
  var lastT = 0;
  var settling = false;
  var stats = { frames: 0, writes: 0 };

  var TAU = 0.085;
  var EPS = 0.0009;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }


  /* ── headline, set letter by letter ──────────────────────────────────────
     Built from the text already in the page, so without JavaScript the
     headline is simply the headline. Each character carries its own delay and
     rides in on a clip, so the line assembles the way type is set rather than
     fading in as a block. */
  function splitHeadline() {
    var h = document.querySelector("h1");
    if (!h || h.dataset.split === "1" || reduce.matches) return;

    /* Walk the child nodes rather than reading textContent. textContent drops
       every element, so an authored line break in "build<br>for you" vanished
       and the two words were split as the single token "buildfor" - rendered
       joined, and announced joined in the aria-label. Line breaks are carried
       through as real <br> elements and count as a space in the label. */
    var ci = 0, label = "";
    var frag = document.createDocumentFragment();

    function emitText(text) {
      var words = text.split(/(\s+)/);
      for (var w = 0; w < words.length; w++) {
        if (words[w] === "") continue;
        if (/^\s+$/.test(words[w])) { frag.appendChild(document.createTextNode(" ")); continue; }
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

    h.dataset.split = "1";
    h.setAttribute("aria-label", label.replace(/\s+/g, " ").trim());
    h.textContent = "";
    h.appendChild(frag);
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
    if (top >= a) return 0;
    if (top <= b) return 1;
    return clamp((a - top) / (a - b), 0, 1);
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

  function enable() {
    if (reduce.matches) return;
    splitHeadline();
    collect();
    root.setAttribute("data-sv-motion", "on");
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", function () { collect(); schedule(); }, { passive: true });
    window.addEventListener("focusin", function () { frame(); }, { passive: true });
    frame();
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

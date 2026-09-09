/* ── THEME TOGGLE ──────────────────────────────────────────────────────────
   The theme is already painted by the inline head script, so this only wires
   the control, remembers the choice, and gives the switch itself a duration.

   A theme change that repaints in one frame reads as a fault rather than a
   choice. `data-theme-x` is stamped on the root for the length of the change,
   and the stylesheet uses that to transition grounds, type, rules and strokes
   together. It is armed BEFORE the theme attribute changes, because a
   transition has to exist before the value it transitions moves. Pages that
   define no rule for it are simply unaffected. */
(function () {
  "use strict";
  var root = document.documentElement;
  var btn = document.querySelector(".theme-t");
  if (!btn) return;
  var label = btn.querySelector(".theme-t__l");
  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* The class has to outlive the transition it arms, or removing it cuts the
     switch off mid-way and everything jumps to its final colour. The tokens
     settle together at ~370ms; 520 leaves room for a slow frame without
     leaving the page armed for noticeably longer than the change itself. */
  var CROSS = 520;
  var timer = null;

  /* The browser chrome was painted from a static theme-color, so on mobile it
     stayed dark after switching to light. Read the surface actually painted
     rather than repeating the token here, so the two cannot drift apart. */
  var meta = document.querySelector('meta[name="theme-color"]');
  function chrome() {
    if (!meta || !document.body) return;
    var bg = getComputedStyle(document.body).backgroundColor;
    if (bg && bg !== "transparent" && bg.indexOf("rgba(0, 0, 0, 0)") === -1) {
      meta.setAttribute("content", bg);
    }
  }

  function paint() {
    var dark = root.getAttribute("data-theme") === "dark";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    if (label) label.textContent = dark ? "Light" : "Dark";
  }
  paint(); chrome();

  function set(next) {
    if (reduced) {
      root.setAttribute("data-theme", next);
      paint(); chrome();
      return;
    }
    root.setAttribute("data-theme-x", "1");
    root.setAttribute("data-theme", next);
    paint();
    /* the ground is mid-transition until it settles, so the chrome colour is
       read at the end rather than sampled halfway through */
    clearTimeout(timer);
    timer = setTimeout(function () {
      root.removeAttribute("data-theme-x");
      chrome();
    }, CROSS);
  }

  btn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem("lai-theme", next); } catch (e) { /* private mode: session only */ }
    set(next);
  });

  /* follow the OS only while the visitor has expressed no preference */
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  var onSys = function (e) {
    var stored; try { stored = localStorage.getItem("lai-theme"); } catch (err) { stored = null; }
    if (stored === "dark" || stored === "light") return;
    set(e.matches ? "dark" : "light");
  };
  if (mq.addEventListener) mq.addEventListener("change", onSys);
  else if (mq.addListener) mq.addListener(onSys);
})();

/* ── THEME TOGGLE ──────────────────────────────────────────────────────────
   The theme is already painted by the inline head script, so this only wires
   the control and remembers the choice. Untouched preference follows the OS;
   an explicit choice wins until the visitor changes it again. */
(function () {
  "use strict";
  var root = document.documentElement;
  var btn = document.querySelector(".theme-t");
  if (!btn) return;
  var label = btn.querySelector(".theme-t__l");

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
    chrome();
  }
  paint();

  btn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("lai-theme", next); } catch (e) { /* private mode: session only */ }
    paint();
  });

  /* follow the OS only while the visitor has expressed no preference */
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  var onSys = function (e) {
    var stored; try { stored = localStorage.getItem("lai-theme"); } catch (err) { stored = null; }
    if (stored === "dark" || stored === "light") return;
    root.setAttribute("data-theme", e.matches ? "dark" : "light");
    paint();
  };
  if (mq.addEventListener) mq.addEventListener("change", onSys);
  else if (mq.addListener) mq.addListener(onSys);
})();

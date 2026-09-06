/* THE WALKTHROUGH ─────────────────────────────────────────────────────────
   A stage-by-stage view of what a product does, driven entirely by the
   visitor. No autoplay, no loop to sit through, nothing that finishes off
   screen while you are reading something else.

   Implemented as a real tablist: arrow keys move, Home and End jump, focus
   follows selection. With JavaScript off, stage one is already open and every
   panel is in the markup, so the content is never hidden behind a script. */
(function () {
  "use strict";
  var root = document.getElementById("flow");
  if (!root) return;

  var tabs  = [].slice.call(root.querySelectorAll('[role="tab"]'));
  var pans  = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
  var metas = tabs.map(function (_, i) { return document.getElementById("fm" + i); });
  var bar   = document.getElementById("flow-bar");
  var at    = document.getElementById("flow-at");
  var prev  = document.getElementById("flow-prev");
  var next  = document.getElementById("flow-next");
  if (!tabs.length) return;

  var i = 0;

  function show(n, focus) {
    i = Math.max(0, Math.min(tabs.length - 1, n));
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (pans[k]) pans[k].hidden = !on;
      if (metas[k]) metas[k].hidden = !on;
    });
    if (bar) bar.style.width = ((i + 1) / tabs.length * 100) + "%";
    if (at) at.textContent = String(i + 1);
    if (prev) prev.disabled = i === 0;
    if (next) next.textContent = i === tabs.length - 1 ? "Start again" : "Next stage";
    if (focus) tabs[i].focus();
  }

  tabs.forEach(function (t, k) {
    t.addEventListener("click", function () { show(k); });
  });

  root.querySelector('[role="tablist"]').addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown") { show(i + 1, true); e.preventDefault(); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { show(i - 1, true); e.preventDefault(); }
    else if (k === "Home") { show(0, true); e.preventDefault(); }
    else if (k === "End") { show(tabs.length - 1, true); e.preventDefault(); }
  });

  if (prev) prev.addEventListener("click", function () { show(i - 1); });
  if (next) next.addEventListener("click", function () {
    show(i === tabs.length - 1 ? 0 : i + 1);
  });

  show(0);
})();

/* ═══ MODEL B · SCROLL-ASSISTED · TEST ARTEFACT, NOT A CANDIDATE FOR SHIP ═══
   Built to be judged, so it is built at its best: the sequence pins while the
   reader scrolls a fixed distance, and scroll progress is FLOORED to a whole
   position. Ownership never interpolates — no 40%-held, no cross-fade between
   two holders. Every frame shows one of the same seven discrete states Model
   A shows.                                                                  */
(function () {
  "use strict";
  var op = document.querySelector(".op[data-map]");
  if (!op) return;
  var map = JSON.parse(op.getAttribute("data-map"));
  var steps = [].slice.call(op.querySelectorAll(".step"));
  var bounds = [].slice.call(op.querySelectorAll(".bound"));
  var say = op.querySelector(".ctl__say");
  var ctl = op.querySelector(".ctl");

  var regions = {};
  steps.forEach(function (s) { var r = s.getAttribute("data-region"); (regions[r] = regions[r] || []).push(s); });
  Object.keys(regions).forEach(function (r) {
    var w = document.createElement("i"); w.className = "own"; regions[r][0].appendChild(w);
  });
  op.setAttribute("data-js", "");
  say.setAttribute("aria-live", "polite");

  /* the scroll track: one viewport height of travel per position */
  var track = document.createElement("div");
  track.className = "track";
  op.parentNode.insertBefore(track, op);
  track.appendChild(op);
  track.style.height = (map.length + 1) * 100 + "vh";
  op.style.position = "sticky";
  op.style.top = "12vh";

  var pos = document.createElement("span");
  pos.className = "ctl__pos"; ctl.appendChild(pos);

  var at = -1;
  function render(n) {
    if (n === at) return;
    at = n;
    var p = n < 0 ? null : map[n];
    Object.keys(regions).forEach(function (r) {
      var n = Number(r), rows = regions[r];
      var own = !p ? "" : p.hold === n ? "held" : p.rel === n ? "released" : p.watch === n ? "watch" : "";
      rows.forEach(function (s, i) {
        if (own) s.setAttribute("data-own", own); else s.removeAttribute("data-own");
        if (own && own !== "watch") {
          s.setAttribute("data-run", rows.length === 1 ? "only" : i === 0 ? "first" : i === rows.length - 1 ? "last" : "mid");
        } else s.removeAttribute("data-run");
      });
      rows[0].querySelector(".own").textContent =
        own === "held" ? "Holds it" : own === "released" ? "Has released" : own === "watch" ? "Watching" : "";
    });
    bounds.forEach(function (b, i) {
      if (p && p.b === i) b.setAttribute("data-live", ""); else b.removeAttribute("data-live");
    });
    say.textContent = p ? p.t : overview;
    pos.textContent = n < 0 ? "Overview" : (n + 1) + " of " + map.length;
    op.setAttribute("data-state", String(n + 1));
  }
  var overview = say.textContent.trim();

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var r = track.getBoundingClientRect();
      var travelled = -r.top;
      var per = window.innerHeight;
      var n = Math.floor(travelled / per);          /* FLOORED — never fractional */
      render(Math.max(-1, Math.min(map.length - 1, n)));
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  render(-1);
  onScroll();
}());

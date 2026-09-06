/* THE WIDTH AXIS ───────────────────────────────────────────────────────────
   Archivo carries a width axis from 62 to 125. Names open along it as you
   reach them, which is the one motion on this site that could not be done with
   another typeface.

   This lives on its own because it belongs to every page. It was previously
   inside motion.js, which only the homepage loads, so the site's signature
   motion ran on exactly one heading and nothing else - not because it was hard
   but because nothing was listening for it anywhere else.

   Driven by each element's position in the viewport, never by a scroll-linked
   reveal value: those saturate inside roughly 225px and finish below the
   reading line, so the travel happens where nobody can see it.

   Every element reserves the height it occupies at its settled width before
   the axis moves, so opening the axis reflows the line and never the page. */
(function () {
  "use strict";

  var GROUPS = [
    [".live-e h3",      "--rw", 63, 96],
    [".held-e__name",   "--cw", 63, 88],
    [".sv__t h2",       "--rw", 66, 82],
    [".pr__t h2",       "--rw", 66, 82],
    [".reg-band__h h2", "--rw", 66, 80],
    [".sk__c h3",       "--rw", 66, 82],
    [".onward__l b",    "--cw", 70, 88]
  ];

  var groups = GROUPS
    .map(function (g) {
      return { els: [].slice.call(document.querySelectorAll(g[0])),
               prop: g[1], from: g[2], to: g[3] };
    })
    .filter(function (g) { return g.els.length; });

  if (!groups.length) return;

  /* Pin the settled height first, whatever happens next. Even with motion
     off, a name that re-wraps on resize would otherwise move the page. */
  function reserve() {
    groups.forEach(function (g) {
      g.els.forEach(function (e) {
        e.style.minHeight = "";
        e.style.setProperty(g.prop, String(g.to));
        var h = e.getBoundingClientRect().height;
        e.style.removeProperty(g.prop);
        e.style.minHeight = Math.ceil(h) + "px";
      });
    });
  }
  reserve();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve);

  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;                      /* settled markup is already correct */

  var START = 0.94, END = 0.44, ticking = false;

  function write() {
    ticking = false;
    var vh = window.innerHeight || 1;
    groups.forEach(function (g) {
      for (var i = 0; i < g.els.length; i++) {
        var e = g.els[i], r = e.getBoundingClientRect();
        if (r.bottom < -160 || r.top > vh + 160) continue;
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

  var t;
  addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () { reserve(); write(); }, 150);
  }, { passive: true });

  write();
})();

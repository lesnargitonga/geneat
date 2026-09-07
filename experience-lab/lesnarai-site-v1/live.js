/* LIVE PRODUCT FOOTAGE ───────────────────────────────────────────────────────
   The register entries are running products, so the evidence can be a
   recording of the real thing rather than a screenshot of it. Each clip is a
   read-only session: the product was browsed, never written to.

   The markup keeps its still. A figure carries data-clip and nothing else, so
   without JavaScript - or with reduced motion, or on a slow connection where
   nothing is worth downloading - the page is exactly the art-directed capture
   it was before. The video is layered over the still only when it is going to
   be watched, which is why the mobile crop and the poster stay correct and no
   space has to be reserved twice.

   Rules, in order of who they serve:

   - Reduced motion does not autoplay, but it does not hide the footage
     either. It gets a play control and a single pass with no loop. The
     preference is about motion that starts on its own, not about putting
     the evidence out of reach - and a phone in battery saver reports the
     same preference, which had made the entire page inert.
   - Nothing downloads until the figure is nearly on screen.
   - A phone gets the clip recorded on a phone. Scaling 1000px-wide desktop
     footage into a 390px card produces text nobody can read, which is not
     evidence of anything.
   - A clip plays while it is being looked at and stops the moment it is not,
     including when the tab goes to the background. */
(function () {
  "use strict";

  var figs = [].slice.call(document.querySelectorAll("[data-clip]"));
  if (!figs.length || !("IntersectionObserver" in window)) return;

  var reduce = window.matchMedia &&
               window.matchMedia("(prefers-reduced-motion: reduce)");
  var quiet = function () { return !!(reduce && reduce.matches); };

  var narrow = window.matchMedia &&
               window.matchMedia("(max-width: 640px)").matches;

  /* Lay the clip exactly over the still it replaces - not over the figure,
     which on the homepage also carries a caption that must stay readable. */
  function place(fig, v) {
    var still = fig.querySelector("img");
    if (!still || !still.offsetWidth) return;
    /* offset*, not getBoundingClientRect: the rect includes transforms, and
       these figures are inside blocks that motion.js is still moving as you
       scroll. Measuring the transformed box made the clip chase the reveal
       and land 18px short of the still it is covering. The layout box does
       not move, and the transform carries the clip along with everything
       else because it applies to the shared ancestor. */
    v.style.left = still.offsetLeft + "px";
    v.style.top = still.offsetTop + "px";
    v.style.width = still.offsetWidth + "px";
    v.style.height = still.offsetHeight + "px";
  }

  function build(fig) {
    if (fig.__v) return fig.__v;
    /* Paths come from the markup rather than being assembled from an id, so
       every file the page can load is greppable in the page that loads it -
       which is also what lets the media integrity check find them. */
    var suffix = narrow ? "-m" : "";

    var v = document.createElement("video");
    v.className = "clip";
    v.muted = true; v.loop = !quiet(); v.playsInline = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("aria-hidden", "true");
    v.tabIndex = -1;
    v.disablePictureInPicture = true;
    v.preload = "none";

    var found = 0;
    [["webm", "video/webm"], ["mp4", "video/mp4"]].forEach(function (f) {
      var url = fig.getAttribute("data-clip-" + f[0] + suffix);
      if (!url) return;
      var srcEl = document.createElement("source");
      srcEl.src = url;
      srcEl.type = f[1];
      v.appendChild(srcEl);
      found++;
    });
    if (!found) return null;

    /* Only reveal once there is a frame to show, so the still is never
       replaced by a blank box on a slow connection. */
    v.addEventListener("loadeddata", function () {
      place(fig, v);
      fig.setAttribute("data-clip-on", "1");
    });
    fig.appendChild(v);
    fig.__v = v;
    place(fig, v);

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { place(fig, v); });
      ro.observe(fig);
    } else {
      addEventListener("resize", function () { place(fig, v); }, { passive: true });
    }
    return v;
  }

  /* A control, not an autoplay. Shown when motion is reduced, and also when
     autoplay is refused outright - a data saver or a battery policy we do not
     control. Either way the viewer can still choose to watch the product. */
  function control(fig) {
    if (fig.__btn) return;
    /* The register cards are wrapped in an <a>. A button inside a link is
       invalid, and a tap on it would navigate rather than play. Those figures
       keep the still; the record page behind the link carries the same
       footage with a control that works. */
    if (fig.closest && fig.closest("a,button")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "clip-play";
    /* The glyph sits on the button itself, not in a bare <span>. A span has
       no background of its own, so a contrast check that samples what is
       behind the text sees the figure underneath and scores the mark at
       2.95:1 - the button's own ground never enters the calculation. The
       aria-label already carries the meaning, so the glyph is decoration. */
    b.textContent = "\u25B6 Play";
    b.setAttribute("aria-label", "Play the recorded session of this product");
    b.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      start(fig, true);
    });
    fig.appendChild(b);
    fig.__btn = b;
  }

  function start(fig, byHand) {
    var v = build(fig);
    if (!v) return;
    if (!v.dataset.loaded) { v.dataset.loaded = "1"; v.preload = "auto"; v.load(); }
    var r = v.play();
    if (r && r.then) {
      r.then(function () {
        if (fig.__btn) { fig.__btn.remove(); fig.__btn = null; }
      }).catch(function () {
        if (!byHand) control(fig);        /* offer it instead of failing quietly */
      });
    }
  }

  function play(fig) {
    if (quiet()) { build(fig); control(fig); return; }
    start(fig, false);
  }

  var warm = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) build(e.target); });
  }, { rootMargin: "80% 0px" });

  var watch = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio > 0.3) play(e.target);
      else if (e.target.__v && !e.target.__v.paused) e.target.__v.pause();
    });
  }, { threshold: [0, 0.3, 0.6] });

  figs.forEach(function (f) { warm.observe(f); watch.observe(f); });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) return;
    figs.forEach(function (f) { if (f.__v && !f.__v.paused) f.__v.pause(); });
  });

  if (reduce && reduce.addEventListener) {
    reduce.addEventListener("change", function (e) {
      figs.forEach(function (f) {
        if (!f.__v) return;
        f.__v.loop = !e.matches;
        if (e.matches && !f.__v.paused) { f.__v.pause(); control(f); }
      });
    });
  }
})();

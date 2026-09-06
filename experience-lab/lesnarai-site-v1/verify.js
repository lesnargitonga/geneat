/* THE RECORD VERIFIES ITSELF ───────────────────────────────────────────────
   Every record used to print "HTTP 200" under a screenshot taken days ago —
   an assertion about a moment that had passed, on a site whose entire argument
   is that it doesn't do that. Now each record contacts its own host when you
   reach it, and the caption is written from the answer.

   The scan is not an animation played over a picture. It starts when the
   request goes out and stops when it comes back, so its duration is the
   latency: a slow host visibly takes longer. Nothing is faked to look brisk.

   Cross-origin rules make the response opaque — we can see the request
   completed, not what status came back. So it reports "answered in N ms", the
   same wording as the check section, and never claims a status code.

   A failure desaturates the screenshot and says "no answer". That is the point:
   a picture of a healthy-looking product must not outlive the product. */
(function () {
  "use strict";
  var figs = [].slice.call(document.querySelectorAll("[data-probe]"));
  if (!figs.length) return;

  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* 8s left a dead host sitting on "checking…" long enough to read as frozen.
     A surface that has not answered in four seconds has not answered. */
  var TIMEOUT = 4000;

  function scan(fig, run) {
    if (reduced) return function () {};
    var t0 = performance.now(), raf = 0, alive = true;
    (function step() {
      if (!alive) return;
      var t = ((performance.now() - t0) / 900) % 1;          /* one sweep ≈ .9s */
      fig.style.setProperty("--scan", "1");
      fig.style.setProperty("--scanY", (t * 4800).toFixed(0));  /* 0 → 4800% of a 2px bar */
      raf = requestAnimationFrame(step);
    })();
    return function stop() {
      alive = false; cancelAnimationFrame(raf);
      fig.style.setProperty("--scan", "0");
    };
  }

  function probe(fig) {
    if (fig.pvBusy) return;
    fig.pvBusy = true;
    var host = fig.getAttribute("data-probe");
    var out = fig.querySelector(".pv");
    var stop = scan(fig, true);
    var t0 = performance.now(), settled = false;

    /* count up while the request is in flight, so a slow or dead host reads as
       busy rather than frozen */
    var tick = setInterval(function () {
      if (settled || !out) return;
      out.textContent = "checking… " + ((performance.now() - t0) / 1000).toFixed(1) + "s";
    }, 100);

    function settle(ok) {
      if (settled) return;
      settled = true;
      fig.pvBusy = false;
      fig.pvLast = Date.now();
      clearInterval(tick);
      stop();
      var ms = Math.round(performance.now() - t0);
      fig.setAttribute("data-state", ok ? "ok" : "fail");
      if (out) out.textContent = ok ? "answered in " + ms + " ms" : "no answer";
    }

    var timer = setTimeout(function () { settle(false); }, TIMEOUT);
    fetch("https://" + host + "/?_v=" + Date.now(), {
      mode: "no-cors", cache: "no-store", redirect: "follow"
    }).then(function () { clearTimeout(timer); settle(true); })
      .catch(function () { clearTimeout(timer); settle(false); });
  }

  /* A reading taken when you arrived is an assertion about a moment that has
     passed - the exact thing this record refuses to do elsewhere. So the check
     repeats while you are actually looking at it: only for records on screen,
     only while the tab is in front, and never on top of a request already in
     flight. A host that comes back up corrects itself without a reload. */
  var PERIOD = 30000;

  function due(fig) {
    return !fig.pvBusy && fig.pvOn && !document.hidden &&
           (!fig.pvLast || Date.now() - fig.pvLast >= PERIOD);
  }

  function sweep() { figs.forEach(function (f) { if (due(f)) probe(f); }); }

  if (!("IntersectionObserver" in window)) {
    figs.forEach(function (f) { f.pvOn = true; });
    sweep();
    setInterval(sweep, 5000);
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      e.target.pvOn = e.isIntersecting;
      if (e.isIntersecting && due(e.target)) probe(e.target);
    });
  }, { threshold: 0.25 });
  figs.forEach(function (f) { io.observe(f); });

  /* Coming back to the tab is exactly when a stale reading is most misleading. */
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) sweep();
  });

  setInterval(sweep, 5000);
})();

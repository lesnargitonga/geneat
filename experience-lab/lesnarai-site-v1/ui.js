/* ── THE SHELL, CONTROLLED ───────────────────────────────────────────────────
   Three jobs, all shared by every page.

   1  Scroll position, published as --sp and [data-scrolled], and the reader's
      place kept across a rotation.
   2  The height the header actually occupies, published as --head-h, so a
      pinned scene can begin below it instead of underneath it.
   3  Opening and closing the navigation panel.

   What this file does NOT do, deliberately: it does not create the menu
   button, the quick links or the panel, and it does not move the theme switch
   between parents. All of that is in the markup, and which layout renders is
   settled before first paint. An earlier version built the mobile bar here,
   and the page jumped 28-37px at ~66ms when it did - 0.043 of layout shift on
   every page of the site. Script may control this shell. It may not build it. */
(function () {
  "use strict";
  var root = document.documentElement;

  /* ── 1 · scroll position ─────────────────────────────────────────────── */
  var ticking = false, last = -1;
  function write() {
    ticking = false;
    var max = root.scrollHeight - window.innerHeight;
    var y = window.pageYOffset || root.scrollTop || 0;
    var p = max > 0 ? y / max : 0;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (Math.abs(p - last) > 0.001) { root.style.setProperty("--sp", p.toFixed(4)); last = p; }
    if (y > 40) root.setAttribute("data-scrolled", "1");
    else root.removeAttribute("data-scrolled");
    capture();
  }
  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(write); } }
  addEventListener("scroll", tick, { passive: true });
  addEventListener("resize", tick, { passive: true });

  /* ── 1b · keep the reader's place across a rotation ────────────────────
     Turning a phone sideways can halve the document. The browser clamps
     scrollY, so somebody reading CarePro at 52% of the page was put down in
     the footer. The block nearest the middle of the screen is remembered and
     put back. Only a change of WIDTH counts: a phone hiding its address bar
     fires the same event with the height alone changing. */
  var anchor = null, anchorAt = 0, settling = false;
  function capture() {
    /* A resize also schedules the ordinary scroll frame, and that frame runs
       after the browser has already clamped scrollY to the new document.
       Capturing there would record the footer and faithfully restore it. */
    if (settling) return;
    var now = performance.now();
    if (now - anchorAt < 400) return;
    anchorAt = now;
    var el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    while (el && el !== document.body && el.getBoundingClientRect().height < 48) el = el.parentElement;
    if (!el || el === document.body || el === root) { anchor = null; return; }
    var r = el.getBoundingClientRect();
    anchor = { el: el, f: r.height ? (window.innerHeight / 2 - r.top) / r.height : 0 };
  }
  function restore() {
    if (!anchor || !anchor.el.isConnected) return;
    var r = anchor.el.getBoundingClientRect();
    var want = r.top + (window.pageYOffset || 0) + anchor.f * r.height - window.innerHeight / 2;
    window.scrollTo(0, Math.max(0, Math.round(want)));
  }
  var lastW = window.innerWidth, rotTimer = null;
  addEventListener("resize", function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    settling = true;
    clearTimeout(rotTimer);
    rotTimer = setTimeout(function () {
      restore();
      requestAnimationFrame(function () { settling = false; anchorAt = 0; });
    }, 160);
  }, { passive: true });

  write();

  /* ── 2 · how tall the header is ──────────────────────────────────────── */
  var head = document.querySelector(".site-head");
  function measure() {
    if (!head) return;
    var h = Math.round(head.getBoundingClientRect().height);
    if (h > 0) root.style.setProperty("--head-h", h + "px");
  }
  measure();
  addEventListener("resize", measure, { passive: true });
  addEventListener("load", measure);

  /* ── 3 · opening and closing the panel ───────────────────────────────── */
  var btn = head && head.querySelector(".nav-t");
  var nav = head && head.querySelector(".site-nav");
  if (!btn || !nav) return;

  var isOpen = function () { return head.getAttribute("data-nav") === "open"; };

  function open(yes) {
    if (yes) {
      head.setAttribute("data-nav", "open");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Close navigation");
      var first = nav.querySelector("a");
      if (first) first.focus();
    } else {
      head.removeAttribute("data-nav");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Open navigation");
    }
  }

  btn.addEventListener("click", function () { open(!isOpen()); });

  /* Escape closes and gives the trigger back the focus it took */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !isOpen()) return;
    open(false); btn.focus();
  });

  /* Following a link closes it, so coming back does not land on a page with a
     menu already hanging open. */
  nav.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("a")) open(false);
  });

  /* The panel sits over the page. Tabbing out of it would put focus on
     something underneath, so leaving the panel closes it instead. */
  head.addEventListener("focusout", function (e) {
    if (!isOpen()) return;
    var to = e.relatedTarget;
    if (to && (nav.contains(to) || to === btn)) return;
    open(false);
  });

  document.addEventListener("pointerdown", function (e) {
    if (!isOpen() || head.contains(e.target)) return;
    open(false);
  }, true);

  /* above the breakpoint the panel is the ordinary inline navigation again */
  var small = window.matchMedia("(max-width: 719px)");
  function onBreak() { if (!small.matches) open(false); }
  if (small.addEventListener) small.addEventListener("change", onBreak);
  else if (small.addListener) small.addListener(onBreak);
})();

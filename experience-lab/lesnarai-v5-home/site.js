// LESNAR AI homepage. The page is complete without this file: it adds the flight
// replay, plays the recordings only while they are on screen, and, unless the
// visitor asked for reduced motion, the GSAP scroll motion.
(function () {
  "use strict";
  var doc = document.documentElement;
  var motion = doc.classList.contains("motion") && window.gsap && window.ScrollTrigger;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ------------------------------------------------ recordings: play in view only
  var videos = $$("video");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster;
          if (v.preload === "none") { v.preload = "auto"; v.load(); }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else if (!v.paused) { v.pause(); }
      });
    }, { rootMargin: "200px 0px" });
    videos.forEach(function (v) { io.observe(v); });
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    videos.forEach(function (v) { v.removeAttribute("autoplay"); v.pause(); v.controls = true; });
  }

  // --------------------------------------------------------- header behaviour
  var top = $("[data-top]"), lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    top.classList.toggle("is-solid", y > 24);
    top.classList.toggle("is-hidden", y > 480 && y > lastY + 4);
    if (y < lastY - 4) top.classList.remove("is-hidden");
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ------------------------------------------------------------ flight replay
  var replay = (function () {
    var el = $("#flight-data"), svg = $(".replay__svg");
    var data = el && el.textContent.trim() ? JSON.parse(el.textContent) : null;
    if (!data || !svg) { var rp = $(".replay"); if (rp) rp.classList.add("no-data"); return null; }
    var S = data.samples, P = data.plan, E = data.events, T = data.duration_s;
    var NS = "http://www.w3.org/2000/svg";
    function node(tag, cls, parent) { var n = document.createElementNS(NS, tag); if (cls) n.setAttribute("class", cls); (parent || svg).appendChild(n); return n; }
    var gGrid = node("path", "r-grid"), gPlanGround = node("path", "r-plan"), gShadow = node("path", "r-shadow");
    var gPlan = node("path", "r-plan"), gPath = node("path", "r-path"), gDrop = node("line", "r-drop");
    var wps = P.slice(2, 5).map(function (_, i) { return { c: node("circle", "r-wp"), t: node("text", "r-wpl") }; });
    var home = { c: node("circle", "r-wp"), t: node("text", "r-wpl") };
    var drone = node("g", "r-drone");
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (d) {
      var a = node("line", "arm", drone); a.setAttribute("x1", 0); a.setAttribute("y1", 0); a.setAttribute("x2", d[0] * 13); a.setAttribute("y2", d[1] * 13);
      var r = node("circle", "rotor", drone); r.setAttribute("cx", d[0] * 13); r.setAttribute("cy", d[1] * 13); r.setAttribute("r", 8);
    });
    var body = node("circle", "body", drone); body.setAttribute("r", 5);
    // Scene: the 25 m box and a margin around it, seen from above at an angle that turns slowly.
    var minX = -8, maxX = 33, minY = -8, maxY = 33, cxm = 12.5, cym = 12.4;
    var SC = 15.2, EL = 32 * Math.PI / 180, SE = Math.sin(EL), CE = Math.cos(EL);
    function proj(x, y, z, th) {
      var dx = x - cxm, dy = y - cym, c = Math.cos(th), s = Math.sin(th);
      var X = dx * c - dy * s, Y = dx * s + dy * c;
      return [500 + X * SC, 390 - Y * SC * SE - z * SC * CE];
    }
    function line(pts, th) { return pts.map(function (p, i) { var q = proj(p[0], p[1], p[2], th); return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(""); }
    var R = { status: $("[data-r=status]"), time: $("[data-r=time]"), alt: $("[data-r=alt]"), speed: $("[data-r=speed]"), dist: $("[data-r=dist]"), bar: $("[data-r=bar]") };
    function statusAt(t, z) {
      var label = "On the ground, waiting for its mission";
      for (var i = 0; i < E.length; i++) if (E[i][0] <= t) label = E[i][1];
      if (label === "Landing" && z < 0.3) label = "Landed where it took off";
      return label;
    }
    function fmt(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s; }
    var lastKey = "";
    function set(p) {
      p = Math.max(0, Math.min(1, p));
      var t = p * T, th = (-34 + 16 * p) * Math.PI / 180;
      var i = 0, lo = 0, hi = S.length - 1;
      while (lo <= hi) { var mid = (lo + hi) >> 1; if (S[mid][0] <= t) { i = mid; lo = mid + 1; } else hi = mid - 1; }
      var a = S[i], b = S[Math.min(i + 1, S.length - 1)], f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
      var cur = [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
      var key = th.toFixed(3);
      if (key !== lastKey) {
        lastKey = key;
        var g = "";
        for (var x = minX; x <= maxX; x += 5) g += line([[x, minY, 0], [x, maxY, 0]], th);
        for (var y = minY; y <= maxY; y += 5) g += line([[minX, y, 0], [maxX, y, 0]], th);
        gGrid.setAttribute("d", g);
        gPlan.setAttribute("d", line(P.slice(1), th));
        gPlanGround.setAttribute("d", line(P.slice(1).map(function (q) { return [q[0], q[1], 0]; }), th));
        gPlanGround.style.opacity = .35;
        P.slice(2, 5).forEach(function (q, k) {
          var s2 = proj(q[0], q[1], q[2], th);
          wps[k].c.setAttribute("cx", s2[0]); wps[k].c.setAttribute("cy", s2[1]); wps[k].c.setAttribute("r", 5);
          wps[k].t.setAttribute("x", s2[0] + 12); wps[k].t.setAttribute("y", s2[1] - 10); wps[k].t.textContent = "Waypoint " + (k + 1);
        });
        var h = proj(0, 0, 0, th);
        home.c.setAttribute("cx", h[0]); home.c.setAttribute("cy", h[1]); home.c.setAttribute("r", 5);
        home.t.setAttribute("x", h[0] - 14); home.t.setAttribute("y", h[1] + 26); home.t.textContent = "Take-off and landing";
      }
      var flown = S.slice(0, i + 1).map(function (s) { return [s[1], s[2], s[3]]; }).concat([cur]);
      gPath.setAttribute("d", line(flown, th));
      gShadow.setAttribute("d", line(flown.map(function (q) { return [q[0], q[1], 0]; }), th));
      var sp = proj(cur[0], cur[1], cur[2], th), gp = proj(cur[0], cur[1], 0, th);
      gDrop.setAttribute("x1", sp[0]); gDrop.setAttribute("y1", sp[1]); gDrop.setAttribute("x2", gp[0]); gDrop.setAttribute("y2", gp[1]);
      var yaw = a[5] + th * 180 / Math.PI;
      // On a narrow screen the drawing shrinks; the drone stays big enough to follow.
      var k = Math.min(2.2, Math.max(1, 700 / (svg.getBoundingClientRect().width || 700)));
      drone.setAttribute("transform", "translate(" + sp[0].toFixed(1) + " " + sp[1].toFixed(1) + ") scale(" + k.toFixed(2) + " " + (k * SE).toFixed(2) + ") rotate(" + yaw.toFixed(0) + ")");
      R.status.textContent = statusAt(t, cur[2]);
      R.time.textContent = fmt(t);
      R.alt.textContent = Math.max(0, cur[2]).toFixed(1);
      R.speed.textContent = (a[4] + (b[4] - a[4]) * f).toFixed(1);
      R.dist.textContent = Math.round(a[6]);
      R.bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    }
    var range = $(".replay__range");
    if (range) range.addEventListener("input", function () { set(range.value / 1000); });
    set(1);
    return { set: set };
  })();

  if (!motion) { doc.classList.remove("motion"); return; }

  // =========================================================== GSAP motion
  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  if (window.DrawSVGPlugin) gsap.registerPlugin(window.DrawSVGPlugin);
  if (window.ScrambleTextPlugin) gsap.registerPlugin(window.ScrambleTextPlugin);
  gsap.defaults({ ease: "power3.out" });

  function split(el) {
    if (!window.SplitText) return [el];
    var s = window.SplitText.create(el, { type: "lines", mask: "lines", linesClass: "split-line-inner" });
    return s.lines;
  }

  // The hero's entrance is CSS (styles.css), so the headline paints without waiting for scripts.

  // The showreel grows to full width as it comes up.
  var reel = $(".reel__frame");
  gsap.fromTo(reel, { scale: .86, borderRadius: 32 }, {
    scale: 1, borderRadius: 22, ease: "none",
    scrollTrigger: { trigger: "[data-reel]", start: "top 92%", end: "top 12%", scrub: .6 }
  });

  // Section headings rise line by line as they arrive.
  $$("[data-split]").forEach(function (el) {
    if (el.classList.contains("hero__title")) return;
    var lines = split(el);
    gsap.from(lines, { yPercent: 110, duration: 1, stagger: .08, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
  });

  // Paragraphs and small blocks fade up in groups.
  gsap.set("[data-reveal]", { autoAlpha: 0, y: 32 });
  ST.batch("[data-reveal]", {
    start: "top 90%",
    onEnter: show, onLeave: show, onEnterBack: show
  });
  function show(els) { gsap.to(els, { autoAlpha: 1, y: 0, duration: .9, stagger: .08, overwrite: true }); }

  // Counters.
  $$("[data-count]").forEach(function (el) {
    var n = +el.dataset.count, o = { v: 0 };
    el.textContent = "0";
    ST.create({ trigger: el, start: "top 92%", once: true, onEnter: function () {
      gsap.to(o, { v: n, duration: n > 100 ? 1.8 : 1.2, ease: "power2.out", onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString("en-GB"); } });
    } });
  });

  var mm = gsap.matchMedia();

  // Product frames drift up into place, with a little depth.
  $$("[data-rise]").forEach(function (el) {
    gsap.fromTo(el, { y: 90, scale: .95 }, { y: 0, scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "top 35%", scrub: .6 } });
  });

  // BizMtaani: the three phone screens fan out from behind the browser.
  mm.add("(min-width: 721px)", function () {
    var ph = $$("[data-phones] .phone");
    gsap.from(ph, { x: function (i) { return -120 - i * 60; }, y: 120, rotate: function (i) { return -8 + i * 3; }, autoAlpha: 0, stagger: .1, ease: "none",
      scrollTrigger: { trigger: "[data-phones]", start: "top 95%", end: "top 45%", scrub: .7 } });
  });

  // CarePro: each check turns green as it passes the middle of the screen.
  $$("[data-checks] li").forEach(function (li) {
    ST.create({ trigger: li, start: "top 62%", onEnter: function () { li.classList.add("is-on"); }, onLeaveBack: function () { li.classList.remove("is-on"); } });
  });
  gsap.from("[data-checks] li", { autoAlpha: 0, x: -24, stagger: .1, duration: .8, scrollTrigger: { trigger: "[data-checks]", start: "top 85%" } });

  // Dark panels open out from a rounded card to the full width.
  $$("[data-panel]").forEach(function (el) {
    gsap.fromTo(el, { scale: .94, borderRadius: 48 }, { scale: 1, borderRadius: 28, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "top 30%", scrub: .6 } });
  });

  // MediMatch: routes draw across Kenya, shortest first; hospitals appear before them.
  var map = $("[data-mm-map] svg");
  if (map && window.DrawSVGPlugin) {
    var routes = $$(".mm-route", map).sort(function (a, b) { return a.getTotalLength() - b.getTotalLength(); });
    var tl = gsap.timeline({ scrollTrigger: { trigger: map, start: "top 80%", end: "bottom 60%", scrub: .8 } });
    tl.from($$(".mm-hub, .mm-need", map), { scale: 0, transformOrigin: "50% 50%", stagger: .03, duration: .3, ease: "back.out(2)" })
      .from(routes, { drawSVG: 0, stagger: .12, duration: .6, ease: "none" }, ">-.1");
  }

  // Operation Sentinel: the replay flies as you scroll, pinned in place.
  if (replay) {
    replay.set(0);
    mm.add({ wide: "(min-width: 721px)", narrow: "(max-width: 720px)" }, function (c) {
      ST.create({
        trigger: "[data-replay]", pin: ".replay__pin", start: "top top",
        end: c.conditions.wide ? "+=260%" : "+=200%", scrub: .5,
        onUpdate: function (self) { replay.set(self.progress); }
      });
    });
  }

  // Gold Trader: each strategy's result grows out from zero.
  gsap.from("[data-bars] .bars__b i", { scaleX: 0, duration: 1.2, stagger: .07, ease: "expo.out", scrollTrigger: { trigger: "[data-bars]", start: "top 78%" } });

  // Simy: the message is sealed on one phone, crosses the relay, and opens on the other.
  var sy = $("[data-simy]"), msg = $(".sy__msg"), txt = $(".sy__txt");
  if (sy && msg) {
    var plain = txt.textContent, sealed = "8fQ2xL0v+Kc9wZ3tR7mB1yN5hJ4sD6aE";
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789+/";
    var row = $(".sy__row", sy), nodes = $$(".sy__node", sy), steps = $$(".sy__steps li", sy);
    // The centre of node n, as the message's top-left position inside the row.
    var at = function (n, axis) {
      return function () {
        var a = row.getBoundingClientRect(), r = nodes[n].getBoundingClientRect();
        if (axis === "x") return r.left - a.left + r.width / 2 - msg.offsetWidth / 2;
        // Across the relay the envelope rides its top edge, so what the relay can see stays readable.
        return n === 1 ? r.top - a.top - msg.offsetHeight * .55 : r.top - a.top + r.height * .42 - msg.offsetHeight / 2;
      };
    };
    function step(i) { steps.forEach(function (s, k) { s.classList.toggle("is-on", k === i); }); }
    step(0);
    mm.add({ wide: "(min-width: 721px)", narrow: "(max-width: 720px)" }, function (c) {
      gsap.set(msg, { x: at(0, "x"), y: at(0, "y") });
      var tl = gsap.timeline({ scrollTrigger: {
        trigger: sy, pin: ".sy__pin", start: "top top", end: c.conditions.wide ? "+=190%" : "+=160%", scrub: .5, invalidateOnRefresh: true,
        onUpdate: function (self) {
          var p = self.progress;
          msg.classList.toggle("is-sealed", p > .17 && p < .84);
          step(p < .3 ? 0 : p < .62 ? 1 : 2);
        },
        onRefresh: function () { if (tl.progress() === 0) gsap.set(msg, { x: at(0, "x")(), y: at(0, "y")() }); }
      } });
      tl.fromTo(msg, { x: at(0, "x"), y: at(0, "y") }, { x: at(0, "x"), y: at(0, "y"), duration: .2, immediateRender: false })
        .to(txt, { duration: 1, scrambleText: { text: sealed, chars: chars, speed: .6 } })
        .to(msg, { duration: 1.4, x: at(1, "x"), y: at(1, "y"), ease: "power2.inOut" })
        .to({}, { duration: .5 })
        .to(msg, { duration: 1.4, x: at(2, "x"), y: at(2, "y"), ease: "power2.inOut" })
        .to(txt, { duration: 1, scrambleText: { text: plain, chars: chars, speed: .6 } })
        .to({}, { duration: .4 });
      return function () { gsap.set(msg, { clearProps: "transform" }); msg.classList.remove("is-sealed"); };
    });
  }

  // More products: on wide screens the track slides sideways as it scrolls past. It is
  // not pinned: a pinned strip counts as the layout jumping.
  mm.add("(min-width: 721px)", function () {
    var track = $(".more__track");
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    gsap.fromTo(track, { x: 0 }, { x: function () { return -dist(); }, ease: "none",
      scrollTrigger: { trigger: "[data-strip]", start: "top 85%", end: "bottom 15%", scrub: .6, invalidateOnRefresh: true } });
  });

  // Internal tools: the pass-rate bars fill, the test lines appear.
  gsap.from("[data-meter] i", { scaleX: 0, duration: 1.4, stagger: .15, ease: "expo.out", scrollTrigger: { trigger: "[data-meter]", start: "top 85%" } });
  gsap.from("[data-term] p", { autoAlpha: 0, x: -12, stagger: .08, duration: .5, scrollTrigger: { trigger: "[data-term]", start: "top 85%" } });

  // About: the collage drifts at two speeds.
  $$("[data-collage] img").forEach(function (img, i) {
    gsap.fromTo(img, { y: i % 2 ? 90 : 30 }, { y: i % 2 ? -10 : -30, ease: "none", scrollTrigger: { trigger: "[data-collage]", start: "top bottom", end: "bottom top", scrub: .6 } });
  });

  // Services: the numbers slide in with their cards.
  gsap.from(".sv__i", { x: -16, autoAlpha: 0, stagger: .08, duration: .6, scrollTrigger: { trigger: ".sv__grid", start: "top 85%" } });

  window.addEventListener("load", function () { ST.refresh(); });
})();

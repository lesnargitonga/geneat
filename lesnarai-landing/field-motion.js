/* Field Record motion (see field-motion.css for what moves and when):
   - adds .is-in to [data-reveal] sections the first time they are a quarter visible;
   - turns [data-odo] numbers into rolling digit columns (the real number stays for assistive tech);
   - gives bars, roads, marks, frames and gazetteer rows their stagger index;
   - plays [data-loop] videos only while on screen, never under reduced motion or Save-Data;
   - counts frames on the phone film roll;
   - runs the two rows of [data-reel] against each other as the band crosses the viewport.
   If anything here fails, every section is revealed, so content is never left hidden. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var saveData = navigator.connection && navigator.connection.saveData;

  function index(scope, sel) {
    var list = scope.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) list[i].style.setProperty("--i", i);
  }

  function odometer(el) {
    var text = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild.nodeValue : "";
    if (!/^[\d.,]+$/.test(text.trim())) return;
    var value = text.trim();
    var sr = document.createElement("span");
    sr.className = "sr";
    sr.textContent = value;
    var odo = document.createElement("span");
    odo.className = "odo";
    odo.setAttribute("aria-hidden", "true");
    for (var k = 0; k < value.length; k++) {
      var ch = value.charAt(k);
      var col = document.createElement("span");
      col.className = "odo__c";
      if (/\d/.test(ch)) {
        col.style.setProperty("--d", ch);
        col.style.setProperty("--k", k);
        for (var n = 0; n <= 9; n++) {
          var s = document.createElement("span");
          s.textContent = n;
          col.appendChild(s);
        }
      } else {
        col.style.setProperty("--d", 0);
        var p = document.createElement("span");
        p.textContent = ch;
        col.appendChild(p);
      }
      odo.appendChild(col);
    }
    el.replaceChild(odo, el.firstChild);
    el.insertBefore(sr, odo);
  }

  function prepare() {
    var sections = document.querySelectorAll("[data-reveal]");
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      index(s, ".bars i");
      index(s, ".map .roads path");
      index(s, ".map .mk");
      index(s, ".strip .frame");
      index(s, ".gaz__row");
      index(s, ".kmtab__bar i");
      index(s, ".sel__i");
      index(s, ".cp-d");
      index(s, ".hm-steps li");
      index(s, ".mm-nai .roads path");
      var paths = s.querySelectorAll(".map .roads path, .mm-nai .roads path, .speed__ok, .speed__bad");
      for (var j = 0; j < paths.length; j++) paths[j].setAttribute("pathLength", "1");
    }
    var odos = document.querySelectorAll("[data-odo]");
    for (var o = 0; o < odos.length; o++) odometer(odos[o]);
  }

  function reveal() {
    var sections = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) { revealAll(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.22 });
    for (var k = 0; k < sections.length; k++) io.observe(sections[k]);
  }

  function loops() {
    var vids = document.querySelectorAll("video[data-loop]");
    if (!vids.length || saveData || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && !reduce.matches) {
          if (!v.dataset.ready) {
            var srcs = v.querySelectorAll("source[data-src]");
            for (var i = 0; i < srcs.length; i++) srcs[i].src = srcs[i].dataset.src;
            v.load();
            v.dataset.ready = "1";
          }
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.35 });
    for (var i = 0; i < vids.length; i++) io.observe(vids[i]);
  }

  // A roll that actually scrolls is a named region you can reach and move with the keyboard.
  function scrollRegions() {
    var els = document.querySelectorAll(".strip--roll, .readings--roll, .reel");
    function check() {
      for (var i = 0; i < els.length; i++) {
        var el = els[i], scrolls = el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "hidden";
        if (scrolls) {
          el.setAttribute("tabindex", "0");
          el.setAttribute("role", "region");
          if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.getAttribute("data-label") || "Frames, swipe or use the arrow keys");
        } else if (el.getAttribute("tabindex") === "0") {
          el.removeAttribute("tabindex");
          if (!el.hasAttribute("data-label-fixed")) el.removeAttribute("role");
        }
      }
    }
    check();
    window.addEventListener("resize", check);
  }

  function rollCount() {
    var rolls = document.querySelectorAll(".strip--roll");
    for (var r = 0; r < rolls.length; r++) (function (roll) {
      var out = document.querySelector('[data-roll-for="' + roll.id + '"] b');
      if (!out) return;
      var frames = roll.querySelectorAll(".frame");
      roll.style.setProperty("--roll-w", roll.scrollWidth + "px");
      var tick = function () {
        var mid = roll.scrollLeft + roll.clientWidth / 2, best = 0, dist = Infinity;
        for (var i = 0; i < frames.length; i++) {
          var c = frames[i].offsetLeft + frames[i].offsetWidth / 2, d = Math.abs(c - mid);
          if (d < dist) { dist = d; best = i; }
        }
        out.textContent = String(best + 1).padStart(2, "0");
      };
      roll.addEventListener("scroll", function () { window.requestAnimationFrame(tick); }, { passive: true });
      tick();
    })(rolls[r]);
  }

  // The reel: each row travels its spare width as the band crosses the viewport, rows opposed.
  function reels() {
    var bands = document.querySelectorAll("[data-reel]");
    if (!bands.length || reduce.matches || !("IntersectionObserver" in window)) return;
    var live = [];
    var ticking = false;
    function frame() {
      ticking = false;
      var vh = window.innerHeight, vw = document.documentElement.clientWidth;
      live.forEach(function (band) {
        var r = band.getBoundingClientRect();
        var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        var rows = band.querySelectorAll(".reel__row");
        for (var i = 0; i < rows.length; i++) {
          var spare = Math.max(0, rows[i].scrollWidth - vw);
          var dir = rows[i].getAttribute("data-dir") === "1" ? 1 : -1;
          var x = dir < 0 ? -spare * p : -spare * (1 - p);
          rows[i].style.setProperty("--x", x.toFixed(1) + "px");
        }
      });
    }
    function request() { if (!ticking) { ticking = true; window.requestAnimationFrame(frame); } }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = live.indexOf(e.target);
        if (e.isIntersecting && i < 0) live.push(e.target);
        if (!e.isIntersecting && i >= 0) live.splice(i, 1);
      });
      request();
    });
    for (var b = 0; b < bands.length; b++) io.observe(bands[b]);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
  }

  function revealAll() {
    var sections = document.querySelectorAll("[data-reveal]");
    for (var i = 0; i < sections.length; i++) sections[i].classList.add("is-in");
  }

  try {
    prepare();
    scrollRegions();
    rollCount();
    reveal();
    loops();
    reels();
    reduce.addEventListener && reduce.addEventListener("change", function () {
      if (!reduce.matches) return;
      var vids = document.querySelectorAll("video[data-loop]");
      for (var i = 0; i < vids.length; i++) vids[i].pause();
    });
  } catch (err) {
    revealAll();
    throw err;
  }
})();

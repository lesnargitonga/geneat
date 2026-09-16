/* ═══ LESNAR AI · PHASE 8 · BEHAVIOUR ══════════════════════════════════════
   Progressive enhancement throughout: every control in here is CREATED by
   this file. If this file does not run, no control exists, nothing is
   focusable that does nothing, and every page still states every fact.

   No dependencies. No build step. ~4KB.                                     */
(function () {
  "use strict";

  /* ── 1 · THE HANDOFF ───────────────────────────────────────────────────
     Model A, discrete. Responsibility is a categorical fact: an actor either
     holds it or does not. There is no 40%-held. Every position this control
     can reach is a stable, nameable state, and the transition between two
     positions is the only thing that is animated.                          */

  function handoff(op) {
    var map;
    try { map = JSON.parse(op.getAttribute("data-map")); } catch (e) { return; }
    if (!map || !map.length) return;

    var steps  = [].slice.call(op.querySelectorAll(".step"));
    var bounds = [].slice.call(op.querySelectorAll(".bound"));
    var ctl    = op.querySelector(".ctl");
    var say    = op.querySelector(".ctl__say");
    if (!ctl || !say || !steps.length) return;

    /* Regions come from the markup's own actor labels, so the ownership model
       and the published sequence cannot drift apart. A region is positional:
       the same actor appearing twice in a sequence is two regions, because
       the second appearance is a different moment, not the same holding. */
    var regions = {};
    steps.forEach(function (s) {
      var r = s.getAttribute("data-region");
      (regions[r] = regions[r] || []).push(s);
    });

    /* One word per region, on its first row. Never one per action. */
    Object.keys(regions).forEach(function (r) {
      var w = document.createElement("i");
      w.className = "own";
      regions[r][0].appendChild(w);
    });

    var at = 0;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    var timers = [];

    function word(own) {
      return own === "held"     ? "Holds it"
           : own === "released" ? "Has released"
           : own === "watch"    ? "Watching" : "";
    }

    function paint(pos) {
      Object.keys(regions).forEach(function (r) {
        var n = Number(r), rows = regions[r];
        var own = !pos ? ""
                : pos.hold  === n ? "held"
                : pos.rel   === n ? "released"
                : pos.watch === n ? "watch" : "";
        rows.forEach(function (s, i) {
          if (own) { s.setAttribute("data-own", own); } else { s.removeAttribute("data-own"); }
          /* WATCHING carries no ownership treatment — only the word. */
          if (own && own !== "watch") {
            s.setAttribute("data-run", rows.length === 1 ? "only"
              : i === 0 ? "first" : i === rows.length - 1 ? "last" : "mid");
          } else { s.removeAttribute("data-run"); }
        });
      });
      bounds.forEach(function (b, i) {
        if (pos && pos.b === i) { b.setAttribute("data-live", ""); }
        else { b.removeAttribute("data-live"); }
      });
    }

    function labels(pos) {
      Object.keys(regions).forEach(function (r) {
        var n = Number(r);
        var own = !pos ? ""
                : pos.hold  === n ? "held"
                : pos.rel   === n ? "released"
                : pos.watch === n ? "watch" : "";
        regions[r][0].querySelector(".own").textContent = word(own);
      });
    }

    function render() {
      var pos = at === 0 ? null : map[at - 1];

      /* Rapid input: a pending label swap from the previous position must not
         land on top of this one. */
      timers.forEach(clearTimeout); timers = [];
      var dur = 0;
      try {
        dur = parseFloat(getComputedStyle(steps[0]).transitionDuration) * 1000 || 0;
      } catch (e) { dur = 0; }
      var quiet = dur < 60 || (calm && calm.matches);

      paint(pos);
      /* The fill starts moving now; the word leaves first and comes back only
         as the fill settles, so the two never disagree in any frame. */
      if (quiet) {
        labels(pos);
      } else {
        op.setAttribute("data-moving", "");
        timers.push(setTimeout(function () { labels(pos); }, dur * 0.35));
        timers.push(setTimeout(function () { op.removeAttribute("data-moving"); }, dur * 0.7));
      }

      op.setAttribute("data-state", String(at));
      say.textContent = pos ? pos.t : overview;
      posEl.textContent = at === 0 ? "Overview" : at + " of " + map.length;
      back.disabled = at === 0;
      fwd.disabled  = at === map.length;
      reset.hidden  = at === 0;
    }

    /* The invitation is added by the same code that creates the controls, so
       the two can never disagree about whether stepping is possible. */
    var overview = say.textContent.trim() +
      " Step through the three holders and the two crossings between them.";

    function mk(label) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      return b;
    }
    var back  = mk("Back");
    var fwd   = mk("Next");
    var reset = mk("Back to overview");
    var posEl = document.createElement("span");
    posEl.className = "ctl__pos";

    function go(n) { at = Math.max(0, Math.min(map.length, n)); render(); }
    back.addEventListener("click",  function () { go(at - 1); });
    fwd.addEventListener("click",   function () { go(at + 1); });
    reset.addEventListener("click", function () { go(0); });

    /* Left/right arrows work when focus is inside the control group. They are
       not bound to the document: a global arrow-key hijack breaks scrolling
       for anyone using the keyboard to read. */
    ctl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); go(at - 1); }
    });

    ctl.appendChild(back);
    ctl.appendChild(fwd);
    ctl.appendChild(reset);
    ctl.appendChild(posEl);
    op.setAttribute("data-js", "");
    say.setAttribute("aria-live", "polite");
    say.setAttribute("aria-atomic", "true");
    render();
  }

  [].forEach.call(document.querySelectorAll(".op[data-map]"), handoff);

  /* ── 2 · MENU ──────────────────────────────────────────────────────────
     The static header ships a link to menu-open.html. With script, that link
     is replaced by a real disclosure button — not decorated with a button
     role, replaced — so the element matches what it actually does.         */

  (function () {
    var link  = document.querySelector(".head-r .menu");
    var panel = document.getElementById("menu-panel");
    if (!link || !panel) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu";
    btn.textContent = "Menu";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "menu-panel");
    link.parentNode.replaceChild(btn, link);

    var body = document.body;
    function shut() {
      body.removeAttribute("data-menu");
      btn.setAttribute("aria-expanded", "false");
      panel.setAttribute("inert", "");
    }
    function open() {
      body.setAttribute("data-menu", "open");
      btn.setAttribute("aria-expanded", "true");
      panel.removeAttribute("inert");
    }
    /* menu-open.html ships the panel already open for the no-script path. If
       script is running when that page loads, the control must agree with the
       document it found rather than silently contradicting it. */
    if (body.getAttribute("data-menu") === "open") { open(); } else { shut(); }

    btn.addEventListener("click", function () {
      if (btn.getAttribute("aria-expanded") === "true") { shut(); }
      else { open(); }
    });

    /* Escape closes and returns the caret to the control that opened it. */
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
        shut(); btn.focus();
      }
    });

    /* The in-panel close link has no page to go to once script is running. */
    var close = panel.querySelector(".close");
    if (close) {
      close.addEventListener("click", function (e) { e.preventDefault(); shut(); btn.focus(); });
    }

    /* Crossing the desktop breakpoint must not leave a half-open surface. */
    if (window.matchMedia) {
      var wide = window.matchMedia("(min-width:821px)");
      var onWide = function (m) { if (m.matches) shut(); };
      if (wide.addEventListener) { wide.addEventListener("change", onWide); }
      else if (wide.addListener) { wide.addListener(onWide); }
    }
  }());

  /* ── 3 · START · REQUIRED-FIELD VALIDATION ─────────────────────────────
     The only genuinely required field is the one that lets us reply. The
     check is real. The outcome is not: there is no server behind this study,
     so a valid message reports exactly that and never shows a success.     */

  (function () {
    var form = document.querySelector(".form");
    if (!form) return;
    var btn   = form.querySelector(".form__act button");
    var state = form.querySelector(".form__state");
    var reply = form.querySelector("#f-reply");
    var fld   = reply && reply.closest(".fld");
    if (!btn || !state || !reply || !fld) return;

    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
    btn.textContent = "Open email";
    state.setAttribute("aria-live", "polite");
    state.setAttribute("aria-atomic", "true");

    function bad() { return reply.value.trim() === ""; }

    function clear() {
      if (fld.hasAttribute("data-err") && !bad()) {
        fld.removeAttribute("data-err");
        reply.removeAttribute("aria-invalid");
        reply.removeAttribute("aria-describedby");
        state.textContent = "";
      }
    }
    reply.addEventListener("input", clear);

    /* Composes the message into the person's own email client. No server, no
       storage, no tracking — and no control that pretends to do more. */
    function compose() {
      var get = function (id) {
        var el = form.querySelector("#" + id);
        return el ? el.value.trim() : "";
      };
      var parts = [
        ["Reach me at", get("f-reply")],
        ["What is going wrong now, and for whom", get("f-wrong")],
        ["The one failure that would matter most", get("f-fail")],
        ["What already exists", get("f-exists")],
        ["How I would know it had worked", get("f-known")]
      ];
      var body = parts.filter(function (p) { return p[1]; })
                      .map(function (p) { return p[0] + ":\n" + p[1]; })
                      .join("\n\n");
      return "mailto:hello@lesnarai.co.ke?subject=" +
             encodeURIComponent("Project enquiry") +
             "&body=" + encodeURIComponent(body);
    }

    btn.addEventListener("click", function () {
      if (bad()) {
        fld.setAttribute("data-err", "");
        reply.setAttribute("aria-invalid", "true");
        reply.setAttribute("aria-describedby", "f-reply-err");
        state.textContent = "";
        reply.focus();
        return;
      }
      fld.removeAttribute("data-err");
      reply.removeAttribute("aria-invalid");
      state.innerHTML = "<b>Opening your email app.</b> If nothing happens, write to " +
        "hello@lesnarai.co.ke directly \u2014 it reaches the same place.";
      window.location.href = compose();
    });
  }());
}());

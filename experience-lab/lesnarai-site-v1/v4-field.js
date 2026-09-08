/* RESOLVE — the live field ───────────────────────────────────────────────────
   The markup ships complete: five systems, their hosts, and a caption that is
   already true before any request is made. Nothing here creates or removes a
   row, and the reading column is reserved at its widest in CSS, so no result
   - fast, slow, failed or absent - can move the page.

   The data is server-side and cached. The caption says so, because it is not
   contacted from the visitor's browser and claiming otherwise would be false.

   Every state has to leave the hero coherent:
     no JavaScript      the resting markup is the answer
     slow / no response  caption says the check is unavailable, rows stay at em-dash
     some systems down   those rows read "no answer", the rest resolve
     every system down   five honest "no answer" rows, which is information
     reduced motion      the same result, applied at once, with no sequence   */
(function () {
  "use strict";
  var field = document.getElementById("sysfield4");
  if (!field || !window.fetch) return;

  var cap = document.getElementById("field-c");
  var rows = {};
  [].forEach.call(field.querySelectorAll(".sysrow"), function (r) {
    rows[r.getAttribute("data-sys")] = r;
  });

  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function say(t) { if (cap) cap.textContent = t; }

  function land(row, sys) {
    if (!row) return;
    var v = row.querySelector(".sysrow__v");
    if (sys.answered) {
      row.setAttribute("data-state", "up");
      if (v) v.textContent = sys.ms + " ms";
    } else {
      row.setAttribute("data-state", "down");
      if (v) v.textContent = "no answer";
    }
  }

  function apply(data) {
    var list = (data && data.systems) || [];
    if (!list.length) { say("check unavailable"); return; }

    /* Fastest first, so the sequence is the real order of arrival rather than
       a decorative stagger. */
    var ordered = list.slice().sort(function (a, b) {
      if (a.answered !== b.answered) return a.answered ? -1 : 1;
      return (a.ms || 0) - (b.ms || 0);
    });

    if (reduced) {
      ordered.forEach(function (sys) { land(rows[sys.id], sys); });
    } else {
      ordered.forEach(function (sys, i) {
        setTimeout(function () { land(rows[sys.id], sys); }, 90 + i * 160);
      });
    }

    var up = list.filter(function (s) { return s.answered; }).length;
    var when = "";
    try {
      when = new Date(data.checked).toLocaleTimeString([],
             { hour: "2-digit", minute: "2-digit" });
    } catch (e) { when = ""; }
    var tail = up + " of " + list.length + " answering";
    setTimeout(function () { say(when ? tail + " · " + when : tail); },
               reduced ? 0 : 90 + ordered.length * 160);
  }

  /* A check that never comes back must not leave the caption claiming a check
     is in progress forever. */
  var settled = false;
  var giveUp = setTimeout(function () {
    if (!settled) { settled = true; say("check unavailable"); }
  }, 6000);

  say("checking…");
  fetch("/api/status", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (settled) return;
      settled = true; clearTimeout(giveUp);
      if (d) apply(d); else say("check unavailable");
    })
    .catch(function () {
      if (settled) return;
      settled = true; clearTimeout(giveUp);
      say("check unavailable");
    });
})();

/* THE LIVE FIELD · DATA ──────────────────────────────────────────────────────
   This file owns one thing: what is true. It does not own the animation.

   DATA STATE and VISUAL CONSTRUCTION STATE are deliberately separate. The
   establishment sequence, and the retract-and-rebuild as you scroll away from
   the hero and come back, are pure CSS driven by --he and --hq. Neither of
   them can reach anything below, so a reachability result that has resolved
   stays resolved. Scrolling back to the top rebuilds the topology using the
   values already known - it does not re-check, and it never puts a system
   back to "checking" for the sake of a second performance.

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
     reduced motion      the same result, and the field is already established */
(function () {
  "use strict";
  var field = document.getElementById("sysfield4");
  if (!field || !window.fetch) return;

  var cap = document.getElementById("field-c");
  var rows = {};
  [].forEach.call(field.querySelectorAll(".fld__r"), function (r) {
    rows[r.getAttribute("data-sys")] = r;
  });

  function say(t) { if (cap) cap.textContent = t; }

  function land(row, sys) {
    if (!row) return;
    var v = row.querySelector(".fld__v");
    if (sys.answered) {
      row.setAttribute("data-state", "up");
      if (v) v.textContent = sys.ms + " ms";
    } else {
      row.setAttribute("data-state", "down");
      if (v) v.textContent = "no answer";
    }
  }

  /* Results are applied the moment they arrive, all at once. The sequence a
     visitor sees belongs to the establishment sweep in CSS, which is why
     there is no stagger here: a timer in this file would be the page
     pretending the network answered slower than it did. */
  function apply(data) {
    var list = (data && data.systems) || [];
    if (!list.length) { say("check unavailable"); return; }

    list.forEach(function (sys) { land(rows[sys.id], sys); });

    var up = list.filter(function (s) { return s.answered; }).length;
    var when = "";
    try {
      when = new Date(data.checked).toLocaleTimeString([],
             { hour: "2-digit", minute: "2-digit" });
    } catch (e) { when = ""; }
    var tail = up + " of " + list.length + " answering";
    say(when ? tail + " · " + when : tail);
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

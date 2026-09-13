/* THE REGISTER READS ONE SAME-ORIGIN STATUS ────────────────────────────────
   What this used to do, and why it was wrong:

   Every live entry fired its own opaque no-cors GET straight from the
   visitor's browser to the product's own origin - bizmtaani.com,
   carepro.co.ke and three more - when the row scrolled into view, and again
   every 30 seconds while it stayed there. Five third-party origins received
   the visitor's IP, User-Agent, Referer and client hints on every visit, for
   nothing but a readout. It also lied: with tracking protection enabled every
   request was blocked, so all five live systems reported "no answer" while all
   five were up, and the page printed that as fact.

   The homepage had already been moved off that pattern. This file now does
   what the homepage does:

       visitor browser -> /api/status (same origin)
                       -> server-side HEAD per system, cached 60s
                       -> presentation

   ONE request per refresh cycle for the whole page, not one per product. The
   browser never touches a product origin. Clicking through to a product is a
   navigation the visitor asked for, and is not this file's business.

   The vocabulary is deliberately narrow, and it is the truth the architecture
   can actually support:

       reachable      the server's HEAD was answered
       no response    the server's HEAD timed out or the connection failed
       not checked    /api/status did not return - we know nothing, and say so
       not yet checked  the resting value in the markup, before any answer

   None of those means uptime, health, transaction success or SLA, and none of
   them implies the visitor's own browser contacted anything - because after
   this change it did not. Latency is measured from our server, so it is not
   published here as though it came from the visitor's device.                */
(function () {
  "use strict";

  var rows = [].slice.call(document.querySelectorAll("[data-probe]"));
  if (!rows.length || !window.fetch) return;

  /* The register's resting line, used when we have no result to report. It
     describes the method, which stays true whether the answer is fresh,
     cached or missing. */
  var scan = document.querySelector("[data-regscan]");
  var scanText = scan && scan.querySelector(".regscan__t > span");

  function setRow(row, state, word) {
    var pv = row.querySelector(".pv");
    if (state) row.setAttribute("data-state", state);
    else row.removeAttribute("data-state");
    if (!pv) return;
    pv.textContent = word;
    /* data-done stops the "being checked" breathing animation. The unknown
       state gets one too: nothing is in flight, so nothing should pulse. */
    pv.setAttribute("data-done", state || "none");
  }

  function unknown(word) {
    rows.forEach(function (r) { setRow(r, null, word || "not checked"); });
  }

  function apply(data) {
    if (!data || !data.systems) { unknown(); tellUnavailable(); return; }
    var byHost = {};
    data.systems.forEach(function (s) { byHost[s.host] = s; });
    rows.forEach(function (row) {
      var s = byHost[row.getAttribute("data-probe")];
      /* A system the endpoint does not carry is not a failure. We simply have
         no reading for it, and must not invent one. */
      if (!s) { setRow(row, null, "not checked"); return; }
      setRow(row, s.answered ? "ok" : "fail",
                  s.answered ? "reachable" : "no response");
    });
  }

  function tellUnavailable() {
    /* The tally script only rewrites this line when a row's state changes.
       With no states arriving it would sit on the resting method line, which
       is true but says nothing about the outcome - so say the outcome. */
    if (scanText) scanText.textContent = "Check unavailable";
  }

  var inFlight = false;
  function load() {
    if (inFlight) return;
    inFlight = true;
    fetch("/api/status", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { inFlight = false; apply(d); })
      .catch(function () { inFlight = false; unknown(); tellUnavailable(); });
  }

  /* One bounded shared timer for the page, matched to the endpoint's own 60s
     cache so a refresh can actually return something new. It does not run
     while the tab is hidden - a reading nobody is looking at is worth no
     request at all - and returning to the tab is exactly when a stale reading
     is most misleading, so coming back refreshes once. */
  var PERIOD = 60000;
  var timer = 0;

  function start() { if (!timer) timer = setInterval(load, PERIOD); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { stop(); }
    else { load(); start(); }
  });

  load();
  if (!document.hidden) start();
})();

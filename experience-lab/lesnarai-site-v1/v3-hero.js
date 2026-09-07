/* ACT 01 — THE HERO LIVING SYSTEM ─────────────────────────────────────────
   Two concepts, deliberately not variations of one idea:

     A  ASSEMBLY     interface fragments and pathways construct themselves
                     around the proposition, then settle. The subject is
                     engineering: things being built.
     B  SIGNAL FIELD five real systems sit at depth in a field, traffic moves
                     between them, and each annotates itself when its own
                     reachability probe returns. The subject is operation:
                     things running.

   Rules both obey: the proposition is readable at frame one, the CTA never
   waits for animation, nothing requires interaction to be understood, and
   reduced motion gets a composed static state rather than an empty box. */
(function () {
  "use strict";
  var host = document.getElementById("sysfield");
  if (!host) return;

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse  = matchMedia("(pointer: coarse)").matches;
  var params  = new URLSearchParams(location.search);
  var concept = (params.get("hero") || "b").toLowerCase() === "a" ? "a" : "b";
  host.setAttribute("data-concept", concept);

  /* The five systems that actually have a public surface. Coordinates are
     composed, not random: they read as a topology, and they stay clear of the
     headline's optical column. */
  var NODES = [
    { id: "bizmtaani",  label: "BizMtaani",   host: "bizmtaani.com",           x: 122, y: 14, z: 1 },
    { id: "hazina",     label: "Hazina",      host: "hazina.lesnarai.co.ke",   x: 140, y: 31, z: 3 },
    { id: "carepro",    label: "CarePro",     host: "carepro.co.ke",           x: 128, y: 50, z: 2 },
    { id: "geneat",     label: "Gen-Eat",     host: "geneat.lesnarai.co.ke",   x: 143, y: 68, z: 3 },
    { id: "jamii",      label: "Jamii",       host: "jamii.lesnarai.co.ke",    x: 125, y: 86, z: 1 }
  ];
  var EDGES = [[0,2],[2,4],[0,1],[1,3],[2,3]];

  /* ── CONCEPT A geometry: not a network at all ───────────────────────────
     Abstracted interface fragments - a bar, a field, rows, a panel - compose
     themselves into a layout. No names, no latencies, no topology. The claim
     is "we build interfaces", where B's claim is "we operate systems". Sharing
     a settled composition between the two would make them one idea with two
     easings, which is the trap. */
  var FRAGS = [
    {x:112,y:12,w:38,h:4.2,d:0},    {x:112,y:19,w:24,h:3.2,d:1},
    {x:138,y:19,w:12,h:3.2,d:1},    {x:112,y:27,w:38,h:14,d:2},
    {x:112,y:44,w:18,h:9,d:3},      {x:132,y:44,w:18,h:9,d:3},
    {x:112,y:56,w:38,h:3.2,d:4},    {x:112,y:62,w:38,h:3.2,d:4},
    {x:112,y:68,w:26,h:3.2,d:5},    {x:112,y:76,w:16,h:5.5,d:6},
    {x:131,y:76,w:19,h:5.5,d:6},    {x:112,y:86,w:38,h:4.2,d:7}
  ];

  var NS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 160 100");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  host.appendChild(svg);

  var gEdge = document.createElementNS(NS, "g"); gEdge.setAttribute("class", "sf-edges");
  var gNode = document.createElementNS(NS, "g"); gNode.setAttribute("class", "sf-nodes");
  svg.appendChild(gEdge); svg.appendChild(gNode);

  var nodeEls = [];

  if (concept === "a") {
    FRAGS.forEach(function (f, i) {
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", f.x); r.setAttribute("y", f.y);
      r.setAttribute("width", f.w); r.setAttribute("height", f.h);
      r.setAttribute("class", "sf-frag");
      r.setAttribute("data-d", f.d);
      r.style.setProperty("--i", i);
      gNode.appendChild(r);
    });
  } else {
    EDGES.forEach(function (e, i) {
      var a = NODES[e[0]], b2 = NODES[e[1]];
      var p = document.createElementNS(NS, "path");
      var mx = (a.x + b2.x) / 2;
      p.setAttribute("d", "M" + a.x + " " + a.y + " L" + mx + " " + a.y + " L" + mx + " " + b2.y + " L" + b2.x + " " + b2.y);
      p.setAttribute("class", "sf-edge");
      p.setAttribute("data-z", Math.max(a.z, b2.z));
      gEdge.appendChild(p);
      p.style.setProperty("--i", i);
      try { p.style.setProperty("--len", p.getTotalLength().toFixed(2)); }
      catch (err) { p.style.setProperty("--len", "60"); }
    });
    nodeEls = NODES.map(function (n, i) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "sf-node");
      g.setAttribute("data-z", n.z);
      g.setAttribute("data-id", n.id);
      g.setAttribute("style", "--i:" + i);
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", n.x - 0.7); r.setAttribute("y", n.y - 0.7);
      r.setAttribute("width", 1.4); r.setAttribute("height", 1.4);
      r.setAttribute("class", "sf-dot");
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", n.x + 2.4); t.setAttribute("y", n.y + 0.6);
      t.setAttribute("class", "sf-label"); t.textContent = n.label;
      g.appendChild(r); g.appendChild(t);
      gNode.appendChild(g);
      return { g: g, node: n };
    });
  }

  /* Reduced motion: the system is shown already established. Nothing moves,
     nothing is missing, and the reachability layer is simply not run. */
  if (reduced) { host.setAttribute("data-settled", "1"); return; }

  /* ── establishment: ~3.5s, staged, then it stops ────────────────────── */
  requestAnimationFrame(function () { host.setAttribute("data-run", "1"); });
  setTimeout(function () { host.setAttribute("data-settled", "1"); }, 3600);

  /* ── the quiet truth layer, now one same-origin request ───────────────
     Was: five opaque no-cors probes fired from every visitor's browser to
     five third-party origins. Now: one request to our own /api/status, which
     checks downstream server-side and caches for 60s. The node carries a mark,
     not a number - the message is "these systems are connected and answering",
     not a latency table. The number is still available, on the node's title,
     for anyone who wants it. */
  function applyStatus(data) {
    if (!data || !data.systems) return;
    var by = {};
    data.systems.forEach(function (x) { by[x.id] = x; });
    nodeEls.forEach(function (e) {
      var st = by[e.node.id];
      if (!st) return;
      e.g.setAttribute("data-state", st.answered ? "ok" : "none");
      var t = e.g.querySelector("title") || document.createElementNS(NS, "title");
      t.textContent = st.answered
        ? e.node.label + " answered in " + st.ms + " ms when last checked"
        : e.node.label + " did not answer when last checked";
      e.g.appendChild(t);
    });
    /* Records on this page share the one cached result rather than each firing
       its own cross-origin probe. /work/ still probes per record from the
       browser, because that page's copy says it does. */
    [].forEach.call(document.querySelectorAll("[data-system]"), function (el) {
      var st = by[el.getAttribute("data-system")];
      if (!st) return;
      el.setAttribute("data-state", st.answered ? "ok" : "fail");
      var pv = el.querySelector(".pv");
      if (pv) pv.textContent = st.answered ? "answered in " + st.ms + " ms" : "no answer";
    });

    var line = document.getElementById("sf-checked");
    if (line) {
      var ok = data.systems.filter(function (x) { return x.answered; }).length;
      line.textContent = ok + " of " + data.systems.length + " answering \u00b7 checked moments ago";
      line.hidden = false;
    }
  }

  if (concept === "b") {
    fetch("/api/status", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(applyStatus)
      /* No endpoint (local static preview) means no claim: the field simply
         carries no state marks rather than asserting five failures. */
      .catch(function () {});
  }

  /* ── pointer depth, desktop only. Touch gets nothing here: a finger has no
        hover position, and faking one is how these things start feeling
        gimmicky. Mobile motion lives in the establishment pass instead. ── */
  if (!coarse) {
    var tx = 0, ty = 0, cx = 0, cy = 0, ticking = false;
    addEventListener("pointermove", function (e) {
      var r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { passive: true });
    function frame() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      host.style.setProperty("--px", cx.toFixed(4));
      host.style.setProperty("--py", cy.toFixed(4));
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) requestAnimationFrame(frame);
      else ticking = false;
    }
  }
})();

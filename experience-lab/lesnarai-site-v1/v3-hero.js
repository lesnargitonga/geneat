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
      var st = document.createElementNS(NS, "text");
      st.setAttribute("x", n.x + 2.4); st.setAttribute("y", n.y + 3.0);
      st.setAttribute("class", "sf-state"); st.textContent = "";
      g.appendChild(r); g.appendChild(t); g.appendChild(st);
      gNode.appendChild(g);
      return { g: g, state: st, node: n };
    });
  }

  /* Reduced motion: the system is shown already established. Nothing moves,
     nothing is missing, and the reachability layer is simply not run. */
  if (reduced) { host.setAttribute("data-settled", "1"); return; }

  /* ── establishment: ~3.5s, staged, then it stops ────────────────────── */
  requestAnimationFrame(function () { host.setAttribute("data-run", "1"); });
  setTimeout(function () { host.setAttribute("data-settled", "1"); }, 3600);

  /* ── the quiet truth layer: each node reports its own reachability ────
     This is the same opaque no-cors probe the register uses. It can prove a
     surface answered; it can never report a status code, so the node says a
     duration or nothing at all. */
  function probe(entry) {
    var t0 = performance.now(), done = false;
    var timer = setTimeout(function () { settle(false); }, 4000);
    function settle(ok) {
      if (done) return; done = true; clearTimeout(timer);
      var ms = Math.round(performance.now() - t0);
      entry.g.setAttribute("data-state", ok ? "ok" : "none");
      entry.state.textContent = ok ? ms + " ms" : "no answer";
    }
    fetch("https://" + entry.node.host + "/?_v=" + Date.now(),
          { mode: "no-cors", cache: "no-store" })
      .then(function () { clearTimeout(timer); settle(true); })
      .catch(function () { clearTimeout(timer); settle(false); });
  }
  if (concept === "b") setTimeout(function () { nodeEls.forEach(function (e, i) { setTimeout(function () { probe(e); }, i * 260); }); }, 1200);

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

/* THE PACING GATE ────────────────────────────────────────────────────────────
   "If I scroll normally, is something meaningful still happening for most of
   the time the scene owns my screen?"

   Two spans, never collapsed into one:

     TOTAL SCROLL HOLD   scroll px during which a scene owns the viewport
                         centre. What the scene costs the reader.
     ACTIVE MOTION BAND  first -> last scroll position at which that scene's
                         own elements visibly changed.

   DEAD TAIL is the difference. It is reported per scene AND per page, because
   a scene's tail is not dead if the next scene is already arriving in it - the
   earlier probe could not tell those apart and blamed scenes for the gap
   between them.

   "Meaningful" is measured as CHANGED PIXEL AREA, not as a count of properties
   that moved. A 1px rule scaling, or a 9px dot growing, cannot reach the
   threshold no matter how many of them there are - which is the point.       */
import { chromium } from "../../study-a-dom-svg/node_modules/playwright/index.mjs";

const HOST = process.env.PACE_HOST || "http://127.0.0.1:4211";
const STEP = 60;        /* px per sample - about half a wheel notch          */
const WIN  = 4;         /* samples per window: 240px, one comfortable glance  */
const RUN  = 2;         /* consecutive dead windows before it is a dead zone  */

/* Threshold, in changed viewport-fractions per 240px of scroll.
   Calibrated against the scene the client named as the rhythm target - the
   CarePro flow - so "meaningful" means "as noticeable as a gate locking",
   not "as noticeable as a whole image moving". Below this, a change is real
   but not something a person scrolling normally registers as an event. */
const THRESH = +(process.env.PACE_THRESH || 0.020);

const VIEWPORTS = [[1440, 900], [390, 844]];
const PAGES = [["/", "homepage"], ["/work/", "register"], ["/work/carepro/", "carepro"]];

/* Everything the browser needs, in one function, so the page is walked with a
   single evaluate per step rather than one per element. */
/* Positions are recorded RELATIVE TO THE SCENE ROOT, not to the document and
   not to the viewport. That is the only frame in which the measurement means
   what a person means:

     ordinary page scroll        the scene root moves too  -> cancels
     a stage held pinned         the stage is the root     -> cancels
     the pin releasing           still the root            -> cancels
     a node arriving inside it   moves against the root    -> counted

   Measuring in document space made a pinned stage read as 240px of motion per
   240px of scroll, which is how a stationary picture scored two viewports of
   change per window. */
const SNAP = `(() => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const roots = [...document.querySelectorAll("[data-stick],[data-scene]")].map(n => {
    const r = n.getBoundingClientRect(); return [r.x, r.y];
  });
  const els = document.querySelectorAll("*");
  for (let i = 0; i < els.length; i++) {
    const n = els[i], r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.bottom < -40 || r.top > vh + 40) continue;          /* off screen  */
    const cs = getComputedStyle(n);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    /* revealed fraction, if this element is masked by an inset clip-path */
    let rev = 1;
    const cp = cs.clipPath;
    if (cp && cp !== "none" && cp.indexOf("inset") === 0) {
      const q = (cp.match(/-?[\\d.]+(?=%)/g) || []).map(Number);
      if (q.length >= 4) rev = Math.max(0, (1 - (q[0] + q[2]) / 100)) * Math.max(0, (1 - (q[1] + q[3]) / 100));
      else if (q.length) rev = Math.max(0, 1 - q[0] / 100);
    }
    const rgb = s => { const m = (s || "").match(/-?[\\d.]+/g); return m ? [+m[0]||0, +m[1]||0, +m[2]||0] : [0,0,0]; };
    const bg = rgb(cs.backgroundColor), fg = rgb(cs.color);
    out.push([i, r.x, r.y + scrollY, r.width, r.height, +cs.opacity, rev,
              bg[0], bg[1], bg[2], fg[0], fg[1], fg[2], r.x, r.y]);
  }
  return { rows: out, roots };
})()`;

/* changed pixel area between two snapshots, split by owning scene */
function delta(A0, B0, owner, frameOf) {
  const a = A0.rows, b = B0.rows, ra = A0.roots, rb = B0.roots;
  const A = new Map(); for (const r of a) A.set(r[0], r);
  const per = new Map(); let total = 0;
  for (const y of b) {
    const x = A.get(y[0]); if (!x) continue;
    const w = y[3], h = y[4], area = w * h;
    /* against the owning scene root where there is one, against the document
       otherwise; either way ordinary scrolling contributes nothing */
    const k = owner.get(y[0]), f = frameOf.get(y[0]);
    let dx, dy;
    if (f != null && ra[f] && rb[f]) {
      dx = Math.abs((y[13] - rb[f][0]) - (x[13] - ra[f][0]));
      dy = Math.abs((y[14] - rb[f][1]) - (x[14] - ra[f][1]));
    } else {
      dx = Math.abs(y[1] - x[1]); dy = Math.abs(y[2] - x[2]);
    }
    const dw = Math.abs(y[3] - x[3]), dh = Math.abs(y[4] - x[4]);
    /* How much of this element reads as having moved. Swept edge area is the
       wrong model for a wide row of text sliding 40px: it counts 3,840px of
       edge and calls a plainly visible move invisible. What a person tracks is
       displacement against the element's own size, so that is what is scored -
       and a 1px rule or a 9px dot still cannot reach the threshold, because
       the term is multiplied by an area that is nearly nothing. */
    const scale = 0.5 * Math.min(w, h) + 24;
    let c = area * Math.min(1, (dx + dy) / scale) + area * Math.min(1, (dw + dh) / scale);
    c += area * Math.abs(y[5] - x[5]);              /* opacity   */
    c += area * Math.abs(y[6] - x[6]);              /* unmasking */
    const cd = (Math.abs(y[7]-x[7]) + Math.abs(y[8]-x[8]) + Math.abs(y[9]-x[9])
              + Math.abs(y[10]-x[10]) + Math.abs(y[11]-x[11]) + Math.abs(y[12]-x[12])) / 765;
    c += area * cd * 0.8;                            /* colour    */
    if (c < 1) continue;
    total += c;
    if (k != null) per.set(k, (per.get(k) || 0) + c);
  }
  return { total, per };
}

const b = await chromium.launch();
const bad = [];

for (const [W, H] of VIEWPORTS) {
  const touch = W < 700;
  const c = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light",
                                 hasTouch: touch, isMobile: touch });
  const p = await c.newPage();
  await p.addInitScript(() => { try { localStorage.setItem("lai-theme", "light"); } catch (e) {} });
  const VA = W * H;

  for (const [path, label] of PAGES) {
    await p.goto(HOST + path, { waitUntil: "load" });
    await p.waitForTimeout(2600);            /* let the one-shot arrival end */

    /* which scene owns each element, and each scene's box in document space */
    const scenes = await p.evaluate(() => {
      const list = [...document.querySelectorAll("[data-scene]")];
      const frames = [...document.querySelectorAll("[data-stick],[data-scene]")];
      const els = [...document.querySelectorAll("*")];
      const ix = new Map(); els.forEach((n, i) => ix.set(n, i));
      const fx = new Map(); frames.forEach((n, i) => fx.set(n, i));
      const own = [], frame = [];
      list.forEach((s, k) => {
        for (const n of s.querySelectorAll("*")) {
          own.push([ix.get(n), k]);
          const f = n.closest("[data-stick]") || s;      /* the pinned stage wins */
          frame.push([ix.get(n), fx.get(f)]);
        }
      });
      return {
        own, frame,
        boxes: list.map((s, k) => {
          const r = s.getBoundingClientRect();
          const st = s.querySelector("[data-stick]");
          return { k, name: (s.className.split(" ").filter(x => x && !x.startsWith("m-"))[1]
                            || s.className.split(" ")[0] || "scene"),
                   mode: s.getAttribute("data-scene"), band: s.getAttribute("data-band") || "0,1",
                   top: r.top + scrollY, h: s.offsetHeight,
                   stickH: st ? st.offsetHeight : 0 };
        })
      };
    });
    const owner = new Map(scenes.own);
    const frameOf = new Map(scenes.frame);
    const docH = await p.evaluate(() => document.documentElement.scrollHeight);
    const last = Math.max(0, docH - H);

    /* walk the page, keeping every sample, then score over a 240px window.
       A change spread smoothly across a long band scores almost nothing per
       60px step but is plainly visible across a glance - scoring per step is
       what made the earlier probe call the benchmark scene motionless. */
    const raw = [], at = [];
    for (let y = 0; y <= last; y += STEP) {
      await p.evaluate(v => scrollTo(0, v), y);
      await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      raw.push(await p.evaluate(SNAP)); at.push(y);
    }
    const ys = [], scores = [], perScene = [];
    for (let i = 0; i + WIN < raw.length; i++) {
      const d = delta(raw[i], raw[i + WIN], owner, frameOf);
      ys.push(at[i] + STEP * WIN / 2);          /* the window's midpoint */
      scores.push(d.total / VA);
      const per = new Map(); for (const [k, v] of d.per) per.set(k, v / VA);
      perScene.push(per);
    }

    console.log(`\n### ${label}  ${W}x${H}   doc ${docH}px`);
    console.log(`  ${"scene".padEnd(14)} ${"mode".padEnd(8)} ${"TOTAL HOLD".padStart(11)} ${"ACTIVE BAND".padStart(12)} ${"DEAD TAIL".padStart(11)}   %`);

    for (const s of scenes.boxes) {
      /* TOTAL SCROLL HOLD - scroll positions at which this scene owns the
         viewport centre. Mode-independent, so pin and through compare. */
      let holdA = Infinity, holdB = -Infinity;
      for (const y of ys) {
        const mid = y + H / 2;
        if (mid >= s.top && mid <= s.top + s.h) { holdA = Math.min(holdA, y); holdB = Math.max(holdB, y); }
      }
      if (!isFinite(holdA)) continue;
      const hold = holdB - holdA + STEP;

      /* ACTIVE MOTION BAND - where this scene's own pixels changed */
      let actA = Infinity, actB = -Infinity;
      for (let i = 0; i < ys.length; i++) {
        if ((perScene[i].get(s.k) || 0) >= THRESH) { actA = Math.min(actA, ys[i]); actB = Math.max(actB, ys[i]); }
      }
      const has = isFinite(actA);
      const active = has ? actB - actA + STEP * WIN : 0;
      const tail = has ? Math.max(0, (holdB + STEP) - (actB + STEP * WIN / 2)) : hold;
      const pct = Math.round(tail / hold * 100);
      const flag = pct > 40 ? "  FAIL" : pct > 30 ? "  justify" : "";
      console.log(`  ${s.name.padEnd(14)} ${s.mode.padEnd(8)} ${String(hold).padStart(9)}px ${String(active).padStart(10)}px ${String(tail).padStart(9)}px ${String(pct).padStart(3)}%${flag}`);
      if (pct > 40) bad.push(`${label} ${W}x${H} ${s.name} ${pct}% (${tail}px)`);
    }

    if (process.env.PACE_CAL) {
      for (const s2 of scenes.boxes) {
        const v = [];
        for (let i = 0; i < ys.length; i++) { const q = perScene[i].get(s2.k) || 0; if (q > 0.0005) v.push(q); }
        if (v.length) { v.sort((a, z) => a - z);
          console.log(`  cal ${s2.name.padEnd(14)} n=${String(v.length).padStart(3)} p10=${v[Math.floor(v.length*.1)].toFixed(4)} med=${v[Math.floor(v.length/2)].toFixed(4)} p90=${v[Math.floor(v.length*.9)].toFixed(4)}`); }
      }
    }

    /* PAGE-LEVEL DEAD ZONES - nothing anywhere in the viewport is changing */
    const zones = [];
    let run0 = null;
    for (let i = 0; i < ys.length; i++) {
      if (scores[i] < THRESH) { if (run0 === null) run0 = i; }
      else { if (run0 !== null && i - run0 >= RUN) zones.push([ys[run0] - STEP * WIN / 2, ys[i - 1] + STEP * WIN / 2]); run0 = null; }
    }
    if (run0 !== null && ys.length - run0 >= RUN) zones.push([ys[run0] - STEP * WIN / 2, ys[ys.length - 1] + STEP * WIN / 2]);
    const shown = zones.filter(z => z[1] - z[0] >= 240);
    console.log(`  page dead zones (nothing changing anywhere, >=240px):`);
    if (!shown.length) console.log(`    none`);
    for (const [a, z] of shown) {
      const mid = (a + z) / 2 + H / 2;
      const who = scenes.boxes.find(s => mid >= s.top && mid <= s.top + s.h);
      console.log(`    ${String(z - a).padStart(5)}px  y ${a}..${z}  under ${who ? who.name : "(between scenes)"}`);
      if (z - a >= 500) bad.push(`${label} ${W}x${H} page dead zone ${z - a}px under ${who ? who.name : "-"}`);
    }
  }
  await c.close();
}
await b.close();
console.log(bad.length ? `\nPACE: ${bad.length} failure(s)\n  ` + bad.join("\n  ") : "\nPACE: all scenes within the dead-tail rule");

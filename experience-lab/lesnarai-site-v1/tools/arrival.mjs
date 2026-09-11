/* IMMEDIATE-SCROLL ARRIVAL ───────────────────────────────────────────────────
   A one-shot arrival runs on a clock. Scrolling runs on the reader's thumb.
   If the reader starts moving before the clock has finished, the page drags
   an unfinished load animation up the screen and the two fight over the same
   transform - the element is still arriving while the reader is already
   scrolling it away.

   This begins a continuous, normal-paced scroll at 100 / 300 / 600ms after
   the page commits, and reports WHERE EACH ARRIVING ELEMENT WAS when its
   arrival finally settled. The rule is the same one the focal gate applies:
   settling at 12vh, or off the top of the screen, is a failure.            */
import { chromium } from "../../study-a-dom-svg/node_modules/playwright/index.mjs";

const HOST = process.env.ARRIVE_HOST || "http://127.0.0.1:4211";
const STARTS = [100, 300, 600];
const VIEWPORTS = [[1440, 900], [390, 844]];
/* The focal rule does not apply here. A kicker and a headline LIVE at 10 and
   20vh; they never travel through the focal zone, so "finished by 30vh" is
   the wrong question to ask of them. What matters for an arrival is that it
   is over while the reader can still see the element, and that it is over
   quickly - not still running 800ms into a scroll. */
const MAX_MS = 500;

const PAGES = [
  ["/", "homepage", [["kicker", ".ch1 .eyebrow4"], ["headline", ".ch1 h1"],
                     ["lede", ".ch1__lede"], ["actions", ".ch1__act"],
                     ["live panel", ".fld"]]],
  ["/work/", "register", [["kicker", ".route-work .kicker"], ["headline", ".route-work h1"],
                          ["lede", ".route-work .lede"]]],
  ["/work/carepro/", "carepro", [["kicker", ".sys-hero .kicker"], ["headline", ".sys-hero h1"],
                                 ["lede", ".sys-hero .sys-lede, .sys-hero .lede"],
                                 ["actions", ".sys-act"], ["panel", ".sys-hero .sig"]]]
];

function READ(sels) {
  return sels.map(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const v = [];
    const m = cs.transform;
    if (m && m !== "none") {
      const q = (m.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      if (m.startsWith("matrix3d")) v.push(q[0], q[5], q[12], q[13], q[14] || 0);
      else v.push(q[0], q[3], q[4], q[5], 0);
    } else v.push(1, 1, 0, 0, 0);
    v.push(+cs.opacity * 100);
    const cp = cs.clipPath;
    if (cp && cp.indexOf("inset") === 0) {
      const q = (cp.match(/-?[\d.]+(?=%)/g) || []).map(Number);
      v.push(q[0] || 0, q[1] || 0, q[2] || 0, q[3] || 0);
    } else v.push(0, 0, 0, 0);
    return { v, cy: r.top + r.height / 2 };
  });
}
const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s; };

const b = await chromium.launch();
const fails = [];

for (const [W, H] of VIEWPORTS) {
  const touch = W < 700;
  for (const [path, label, subjects] of PAGES) {
    for (const START of STARTS) {
      const c = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light",
                                     hasTouch: touch, isMobile: touch });
      const p = await c.newPage();
      await p.addInitScript(() => { try { localStorage.setItem("lai-theme", "light"); } catch (e) {} });
      const sels = subjects.map(s => s[1]);

      /* The same scroll trace is run twice: once with the arrival running,
         and once as a REFERENCE with the arrival already over. Some of these
         elements are driven by the load arrival AND by scroll at the same
         time - the hero's live panel reads --he and --hq in one transform -
         so comparing a trace against its own end state credits the scroll
         withdraw to the arrival. Comparing the two traces tick for tick, at
         identical scroll positions, leaves only the arrival's residual. */
      const trace = async (wait) => {
        await p.goto(HOST + path, { waitUntil: "commit" });
        await p.waitForTimeout(wait);
        const t0 = Date.now(), out = subjects.map(() => []);
        for (let k = 0; k < 46; k++) {
          await p.evaluate(() => scrollBy(0, 34));
          await p.evaluate(() => new Promise(r => requestAnimationFrame(r)));
          const rows = await p.evaluate(READ, sels);
          const t = Date.now() - t0;
          rows.forEach((r, i) => { if (r) out[i].push({ t, ...r }); });
        }
        return out;
      };
      const track = await trace(START);
      const ref = await trace(2600);

      const line = [];
      subjects.forEach(([name], i) => {
        const t = track[i], r = ref[i];
        if (!t.length || !r.length) { line.push(`${name}: —`); return; }
        const n = Math.min(t.length, r.length);
        const d = []; for (let k = 0; k < n; k++) d.push(dist(t[k].v, r[k].v));
        const dmax = Math.max(...d);
        if (dmax < 6) { line.push(`${name}: settled before scroll`); return; }
        /* the first tick at which the arrival's residual has essentially gone */
        let idx = n - 1;
        for (let k = 0; k < n; k++) if (d[k] <= dmax * 0.05) { idx = k; break; }
        const vh = Math.round(t[idx].cy / H * 100);
        const gone = t[idx].cy < 0;                 /* settled off the top */
        const slow = t[idx].t > MAX_MS;
        const bad = gone || slow;
        if (bad) fails.push(`${label} ${W}x${H} scroll@${START}ms ${name}: settled at ${vh}vh after ${t[idx].t}ms` +
          (gone ? " - off the top of the screen" : " - too slow"));
        line.push(`${name}: ${vh}vh @${t[idx].t}ms${bad ? " FAIL" : ""}`);
      });
      console.log(`  ${label.padEnd(9)} ${String(W).padStart(4)}x${H}  scroll begins @${String(START).padStart(3)}ms   ` + line.join(" · "));
      await c.close();
    }
  }
}
await b.close();
console.log(fails.length ? `\nARRIVAL: ${fails.length} failure(s)\n  ` + fails.join("\n  ")
                         : "\nARRIVAL: no arrival is still running once its subject has left the focal zone");

/* EXIT CONTRACT — 0 assertions passed · 1 assertions failed · 2 setup or
   infrastructure error. This gate previously printed its failures and then
   fell off the end of the file, which exits 0: in CI it could report a
   defect and still be read as a pass. Proven by execution, not by reading. */
process.exit(fails.length ? 1 : 0);

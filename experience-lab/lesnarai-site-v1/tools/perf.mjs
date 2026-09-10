/* RUNTIME COST OF FOCAL MODE ─────────────────────────────────────────────────
   data-fp reads one rect per marked element per active frame. Whether that is
   a problem is a measurement, not an opinion, so nothing here is optimised
   ahead of the numbers.

   getBoundingClientRect is wrapped before any page script runs, so every read
   the engine makes is counted, and the count is bucketed per animation frame.
   Frame intervals come from a rAF loop; long tasks from PerformanceObserver.
   Each page is walked twice - a normal continuous scroll and a fast one - at
   1x and at 4x CPU throttling.                                              */
import { chromium } from "../../study-a-dom-svg/node_modules/playwright/index.mjs";

const HOST = process.env.PERF_HOST || "http://127.0.0.1:4211";
const PAGES = [["/", "homepage"], ["/work/", "register"], ["/work/carepro/", "carepro"]];
const VIEWPORTS = [[1440, 900], [390, 844]];
const RUNS = [["normal", 40, 26], ["fast", 130, 16]];   /* px per tick, ms per tick */

const pct = (a, q) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))] : 0;

const b = await chromium.launch();
const rows = [];

for (const [W, H] of VIEWPORTS) {
  const touch = W < 700;
  for (const cpu of [1, 4]) {
    for (const [path, label] of PAGES) {
      for (const [kind, px, ms] of RUNS) {
        const c = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light",
                                       hasTouch: touch, isMobile: touch });
        const p = await c.newPage();
        await p.addInitScript(() => {
          try { localStorage.setItem("lai-theme", "light"); } catch (e) {}
          window.__s = { f: [], g: [], long: [] };
          const orig = Element.prototype.getBoundingClientRect;
          let n = 0;
          Element.prototype.getBoundingClientRect = function () { n++; return orig.call(this); };
          let last = 0, on = false;
          window.__go = () => { on = true; last = performance.now(); };
          (function tick(t) {
            if (on) { window.__s.f.push(t - last); window.__s.g.push(n); }
            last = t; n = 0;
            requestAnimationFrame(tick);
          })(performance.now());
          try {
            new PerformanceObserver(l => { for (const e of l.getEntries()) window.__s.long.push(Math.round(e.duration)); })
              .observe({ entryTypes: ["longtask"] });
          } catch (e) {}
        });
        const cdp = await c.newCDPSession(p);
        if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });

        await p.goto(HOST + path, { waitUntil: "load" });
        await p.waitForTimeout(2200);
        const fp = await p.evaluate(() => document.querySelectorAll("[data-fp]").length);
        const sc = await p.evaluate(() => document.querySelectorAll("[data-scene]").length);
        const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
        await p.mouse.move(W / 2, H / 2);
        await p.evaluate(() => window.__go());

        let y = 0;
        while (y < max) { await p.mouse.wheel(0, px); y += px; await p.waitForTimeout(ms); }

        const s = await p.evaluate(() => window.__s);
        const f = s.f.filter(x => x > 0 && x < 400);
        const g = s.g.filter(x => x > 0);
        rows.push({ W, H, cpu, label, kind, fp, sc,
          p50: pct(f, .5), p95: pct(f, .95), p99: pct(f, .99),
          over16: f.filter(x => x > 16.7).length, over33: f.filter(x => x > 33.3).length,
          n: f.length, gmax: g.length ? Math.max(...g) : 0, gmed: pct(g, .5),
          long: s.long.length, longmax: s.long.length ? Math.max(...s.long) : 0 });
        await c.close();
      }
    }
  }
}
await b.close();

let hdr = "";
for (const r of rows) {
  const key = `${r.W}x${r.H}  CPU ${r.cpu}x`;
  if (key !== hdr) { hdr = key; console.log(`\n### ${key}`);
    console.log(`  ${"page".padEnd(9)} ${"scroll".padEnd(7)} ${"fp".padStart(3)} ${"scenes".padStart(6)} ` +
      `${"p50".padStart(6)} ${"p95".padStart(6)} ${"p99".padStart(6)} ${">16.7".padStart(11)} ${">33.3".padStart(10)} ` +
      `${"gBCR/frame".padStart(15)} ${"long tasks".padStart(11)}`); }
  console.log(`  ${r.label.padEnd(9)} ${r.kind.padEnd(7)} ${String(r.fp).padStart(3)} ${String(r.sc).padStart(6)} ` +
    `${r.p50.toFixed(1).padStart(5)}ms ${r.p95.toFixed(1).padStart(5)}ms ${r.p99.toFixed(1).padStart(5)}ms ` +
    `${(r.over16 + "/" + r.n).padStart(11)} ${(r.over33 + "/" + r.n).padStart(10)} ` +
    `${("med " + r.gmed + " max " + r.gmax).padStart(15)} ${(r.long ? r.long + " (max " + r.longmax + "ms)" : "0").padStart(11)}`);
}
const worst = rows.reduce((a, r) => Math.max(a, r.over33 / Math.max(1, r.n)), 0);
console.log(`\nPERF: worst share of frames over 33.3ms: ${(worst * 100).toFixed(1)}%`);

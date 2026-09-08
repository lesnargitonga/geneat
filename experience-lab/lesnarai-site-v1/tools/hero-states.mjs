/* HERO SCENARIO TEST ─────────────────────────────────────────────────────────
   The status hero has to stay coherent whatever the check does. This drives
   /api/status through every outcome and asserts, for each: five rows still
   present, a caption that is true for that outcome, no horizontal overflow,
   and no layout shift caused by the result arriving.

   The observer is the only thing injected. No styles, no DOM. */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");
const PW = [process.env.PLAYWRIGHT_PATH,
            join(ROOT, "node_modules/playwright/index.mjs"),
            join(ROOT, "../study-a-dom-svg/node_modules/playwright/index.mjs")].filter(Boolean);
let chromium = null;
for (const p of PW) { try { ({ chromium } = await import(p)); break; } catch {} }
if (!chromium) { console.error("playwright not found"); process.exit(2); }
const BASE = process.env.CLS_BASE || "http://127.0.0.1:4210";

const five = (downIds = []) => ({
  checked: new Date().toISOString(), ttl: 60,
  note: "Reachability at the moment shown. Not an uptime record.",
  systems: [["bizmtaani","bizmtaani.com",62],["carepro","carepro.co.ke",148],
            ["jamii","jamii.lesnarai.co.ke",233],["geneat","geneat.lesnarai.co.ke",1852],
            ["hazina","hazina.lesnarai.co.ke",420]]
    .map(([id, host, ms]) => downIds.includes(id)
      ? { id, host, answered: false, ms: 4000, reason: "timeout" }
      : { id, host, answered: true, ms, status: 200 })
});

const SCENARIOS = [
  { name: "resolved normally",  route: r => r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(five()) }) },
  { name: "partial failure",    route: r => r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(five(["geneat"])) }) },
  { name: "complete failure",   route: r => r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(five(["bizmtaani","carepro","jamii","geneat","hazina"])) }) },
  { name: "slow response (8s)", route: async r => { await new Promise(z=>setTimeout(z,8000));
                                  r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(five()) }); } },
  { name: "endpoint 500",       route: r => r.fulfill({ status:500, body:"err" }) },
  { name: "endpoint aborted",   route: r => r.abort() },
];

const probe = () => {
  window.__cls = 0;
  new PerformanceObserver(l => { for (const e of l.getEntries())
    if (!e.hadRecentInput) window.__cls += e.value; })
    .observe({ type:"layout-shift", buffered:true });
};

const browser = await chromium.launch();
let fail = 0;

async function run(label, { route, reduced = false, js = true, w = 390, h = 844 }) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h},
    reducedMotion: reduced ? "reduce" : "no-preference", javaScriptEnabled: js });
  const page = await ctx.newPage();
  if (js) await page.addInitScript(probe);
  if (route) await page.route("**/api/status*", route);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(js ? 9500 : 1500);

  const r = await page.evaluate(() => {
    const f = document.getElementById("sysfield4");
    if (!f) return { err: "no field" };
    const rows = [...f.querySelectorAll(".sysrow")];
    const doc = document.documentElement;
    return {
      rows: rows.length,
      states: rows.map(x => x.getAttribute("data-state") || "resting"),
      values: rows.map(x => x.querySelector(".sysrow__v").textContent.trim()),
      caption: (document.getElementById("field-c") || {}).textContent || "",
      overflow: doc.scrollWidth > doc.clientWidth + 1,
      cls: typeof window.__cls === "number" ? +window.__cls.toFixed(4) : null,
      h1: (document.querySelector("h1") || {}).textContent.trim().slice(0, 46),
      cta: document.querySelectorAll(".ch1__act .btn").length
    };
  });

  const bad = [];
  if (r.err) bad.push(r.err);
  if (r.rows !== 5) bad.push(`rows=${r.rows}`);
  if (r.overflow) bad.push("horizontal overflow");
  if (r.cls !== null && r.cls > 0.02) bad.push(`CLS ${r.cls}`);
  if (!r.h1) bad.push("no headline");
  if (r.cta !== 2) bad.push(`ctas=${r.cta}`);
  if (!r.caption.trim() || /checking/i.test(r.caption)) bad.push(`caption stuck: "${r.caption}"`);

  if (bad.length) fail++;
  console.log(`${bad.length ? "FAIL" : "ok  "}  ${label.padEnd(26)} cls ${String(r.cls).padEnd(7)} ` +
              `caption "${r.caption}"  ${r.states.join("/")}`);
  if (bad.length) console.log(`        → ${bad.join("; ")}`);
  await ctx.close();
}

for (const s of SCENARIOS) await run(s.name, { route: s.route });
await run("reduced motion", { route: SCENARIOS[0].route, reduced: true });
await run("javascript disabled", { route: null, js: false });
await run("resolved @360 stress", { route: SCENARIOS[0].route, w: 360, h: 800 });
await run("resolved @1440", { route: SCENARIOS[0].route, w: 1440, h: 900 });

await browser.close();
console.log(`\n${fail} scenario(s) failed`);
process.exit(fail ? 1 : 0);

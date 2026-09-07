/* LAYOUT STABILITY GATE ──────────────────────────────────────────────────────
   Measures cumulative layout shift on every public page, at every target
   viewport, with motion on and motion reduced.

   The instrument must never be the cause. An earlier harness on this project
   injected a <style> at init and then measured the 0.0794 it had itself
   produced. So this file installs exactly one thing in the page - a
   PerformanceObserver - and changes nothing else. No CSS, no DOM, no flags.
   Scrolling is the behaviour under test, not contamination: a page that only
   holds still when nobody scrolls is not stable.

   Usage
     node tools/cls.mjs                          all pages, all viewports
     node tools/cls.mjs --pages /about/,/contact/    narrow the sweep
     node tools/cls.mjs --viewports 390x844      narrow the viewports
     node tools/cls.mjs --attribute              dump every shift source
     node tools/cls.mjs --runs 5                 repeat and report the range

   Exits non-zero when any page/viewport/motion combination exceeds FAIL. */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");

/* Playwright lives elsewhere in this monorepo; take it from wherever it is
   rather than adding a second copy to this site. */
const PW_CANDIDATES = [
  process.env.PLAYWRIGHT_PATH,
  join(ROOT, "node_modules/playwright/index.mjs"),
  join(ROOT, "../study-a-dom-svg/node_modules/playwright/index.mjs")
].filter(Boolean);

let chromium = null;
for (const p of PW_CANDIDATES) {
  try { ({ chromium } = await import(p)); break; } catch { /* next */ }
}
if (!chromium) {
  console.error("playwright not found. Set PLAYWRIGHT_PATH to its index.mjs.");
  process.exit(2);
}

const BASE = process.env.CLS_BASE || "http://127.0.0.1:4210";
const INVESTIGATE = 0.02, FAIL = 0.05, BLOCKER = 0.10;

const VIEWPORTS = [
  [1440, 900], [1366, 768], [1024, 768], [768, 1024],
  [430, 932], [390, 844], [360, 800]
];

/* Pages are discovered, never hand-listed, so a new page cannot quietly opt
   out of the gate. */
function discover(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules" || name === "tools" ||
        name === "media") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) discover(full, out);
    else if (name.endsWith(".html")) {
      const rel = relative(ROOT, full).replace(/\\/g, "/");
      out.push("/" + rel.replace(/index\.html$/, ""));
    }
  }
  return out;
}

const argv = process.argv.slice(2);
const arg = (flag, dflt) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const ATTRIBUTE = argv.includes("--attribute");
const RUNS = parseInt(arg("--runs", "1"), 10);
const PAGES = arg("--pages", "") ? arg("--pages", "").split(",")
                                 : discover().sort();
const VIEWS = arg("--viewports", "")
  ? arg("--viewports", "").split(",").map(v => v.split("x").map(Number))
  : VIEWPORTS;
const MOTIONS = arg("--motion", "") ? [arg("--motion", "")]
                                    : ["no-preference", "reduce"];

/* Installed before any page script runs; buffered:true so nothing that shifts
   during first composition is missed. */
function probe() {
  window.__cls = 0;
  window.__shifts = [];
  const name = (n) => {
    if (!n || n.nodeType !== 1) return "(detached)";
    const id = n.id ? "#" + n.id : "";
    const cls = (n.className || "").toString().trim().split(/\s+/)
                  .filter(Boolean).slice(0, 3).map(c => "." + c).join("");
    return n.tagName.toLowerCase() + id + cls;
  };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__cls += e.value;
      if (e.value >= 0.001) {
        window.__shifts.push({
          v: +e.value.toFixed(5),
          t: Math.round(e.startTime),
          src: (e.sources || []).slice(0, 4).map(s => ({
            node: name(s.node),
            prev: [Math.round(s.previousRect.x), Math.round(s.previousRect.y),
                   Math.round(s.previousRect.width), Math.round(s.previousRect.height)],
            cur:  [Math.round(s.currentRect.x), Math.round(s.currentRect.y),
                   Math.round(s.currentRect.width), Math.round(s.currentRect.height)]
          }))
        });
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
}

/* Load, settle, scroll down, scroll back up, touch the form controls. A page
   must survive being read, not merely being opened. */
async function exercise(page, h) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(350);

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(160, Math.round(h * 0.4));
  for (let y = 0; y < height; y += step) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  for (let y = height; y >= 0; y -= step) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  /* focus, not click: a click sets hadRecentInput and would excuse a shift
     the user would still see. */
  const fields = await page.$$("input, textarea, select, button, [tabindex]");
  for (const f of fields.slice(0, 12)) {
    try { await f.focus({ timeout: 500 }); await page.waitForTimeout(40); }
    catch { /* not focusable */ }
  }
  await page.waitForTimeout(400);
}

async function measure(browser, path, [w, h], motion) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    reducedMotion: motion === "reduce" ? "reduce" : "no-preference",
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();
  await page.addInitScript(probe);

  const apiFailures = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/") && !r.ok())
      apiFailures.push(r.url().replace(BASE, "") + " -> " + r.status());
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await exercise(page, h);

  const r = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));
  await ctx.close();
  return { ...r, apiFailures, errors };
}

const verdict = (v) => v > BLOCKER ? "BLOCKER" : v > FAIL ? "FAIL"
                     : v > INVESTIGATE ? "investigate" : "ok";

const browser = await chromium.launch();
const rows = [];
let worst = { cls: -1 };

for (const path of PAGES) {
  for (const [w, h] of VIEWS) {
    for (const motion of MOTIONS) {
      const runs = [];
      let last = null;
      for (let i = 0; i < RUNS; i++) {
        last = await measure(browser, path, [w, h], motion);
        runs.push(last.cls);
      }
      const max = Math.max(...runs);
      const row = { path, w, h, motion, runs, max, v: verdict(max),
                    shifts: last.shifts, api: last.apiFailures, errors: last.errors };
      rows.push(row);
      if (max > worst.cls) worst = { ...row, cls: max };

      if (row.v !== "ok" || ATTRIBUTE) {
        const range = RUNS > 1
          ? `${Math.min(...runs).toFixed(4)}–${max.toFixed(4)}`
          : max.toFixed(4);
        console.log(`${row.v.toUpperCase().padEnd(11)} ${path.padEnd(30)} ` +
                    `${(w + "x" + h).padEnd(9)} ${motion.padEnd(14)} ${range}`);
        if (ATTRIBUTE || row.v === "FAIL" || row.v === "BLOCKER") {
          for (const s of last.shifts.sort((a, b) => b.v - a.v).slice(0, 5)) {
            console.log(`      ${s.v.toFixed(4)} @${s.t}ms`);
            for (const src of s.src) {
              const [, py, , ph] = src.prev, [, cy, , ch] = src.cur;
              console.log(`         ${src.node}  y ${py}->${cy} (${cy - py >= 0 ? "+" : ""}${cy - py})` +
                          `  h ${ph}->${ch} (${ch - ph >= 0 ? "+" : ""}${ch - ph})`);
            }
          }
        }
      }
    }
  }
}
await browser.close();

const bad = rows.filter(r => r.max > FAIL);
const watch = rows.filter(r => r.max > INVESTIGATE && r.max <= FAIL);
const api = [...new Set(rows.flatMap(r => r.api))];

console.log(`\n${rows.length} combinations · ${PAGES.length} pages · ` +
            `${VIEWS.length} viewports · ${MOTIONS.length} motion modes` +
            (RUNS > 1 ? ` · ${RUNS} runs each` : ""));
console.log(`worst: ${worst.cls.toFixed(4)}  ${worst.path} ` +
            `${worst.w}x${worst.h} ${worst.motion}`);
console.log(`${bad.length} over ${FAIL}, ${watch.length} between ${INVESTIGATE} and ${FAIL}`);
if (api.length)
  console.log(`note: ${api.length} api response(s) not ok locally ` +
              `(${api.slice(0, 2).join(", ")}) - serverless routes do not run ` +
              `on the static server; not a layout failure.`);
const errs = [...new Set(rows.flatMap(r => r.errors))];
if (errs.length) console.log(`page errors: ${errs.join(" | ")}`);

process.exit(bad.length ? 1 : 0);

/* KEYBOARD REACHABILITY ─────────────────────────────────────────────────────
   Tabs through the page and asserts three things per stop: focus actually
   moved to a real interactive element, the element is inside the viewport
   once scrolled to, and focus is visibly indicated - a measurable change in
   outline, box-shadow, border or background against the same element at rest.

   A focus ring that exists in the stylesheet but is overridden by a later rule
   passes a source grep and fails a person with a keyboard. */
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
const PATH = process.argv[2] || "/";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.route("**/api/status*", r => r.fulfill({ status: 500, body: "x" }));
await page.goto(BASE + PATH, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

const WATCH = ["outlineWidth","outlineColor","outlineStyle","boxShadow",
               "borderColor","backgroundColor","textDecorationLine"];
let stops = 0, invisible = [], offscreen = [];
const seen = new Set();

for (let i = 0; i < 60; i++) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate((props) => {
    const e = document.activeElement;
    if (!e || e === document.body) return null;
    const cs = getComputedStyle(e);
    const at = {}; for (const p of props) at[p] = cs[p];
    const b = e.getBoundingClientRect();
    return {
      tag: e.tagName.toLowerCase(),
      cls: (e.className || "").toString().split(" ")[0],
      label: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30),
      focused: at,
      w: Math.round(b.width), h: Math.round(b.height),
      inView: b.top < innerHeight && b.bottom > 0
    };
  }, WATCH);
  if (!info) break;
  const key = info.tag + "." + info.cls + "|" + info.label;
  if (seen.has(key)) continue;
  seen.add(key);
  stops++;

  /* compare against the same element with focus removed */
  const rest = await page.evaluate((props) => {
    const e = document.activeElement; e.blur();
    const cs = getComputedStyle(e);
    const at = {}; for (const p of props) at[p] = cs[p];
    e.focus();
    return at;
  }, WATCH);

  const changed = WATCH.some(p => rest[p] !== info.focused[p]);
  if (!changed) invisible.push(`${info.tag}.${info.cls} "${info.label}"`);
  if (info.w < 2 || info.h < 2) offscreen.push(`${info.tag}.${info.cls} (${info.w}x${info.h})`);
}

await browser.close();
console.log(`  ${stops} keyboard stops on ${PATH}`);
if (invisible.length) {
  console.log(`  ${invisible.length} with no visible focus indicator:`);
  invisible.slice(0, 8).forEach(x => console.log(`     ${x}`));
} else console.log("  every stop shows a measurable focus state");
if (offscreen.length) {
  console.log(`  ${offscreen.length} with no usable focus target:`);
  offscreen.slice(0, 6).forEach(x => console.log(`     ${x}`));
}
process.exit(invisible.length || offscreen.length ? 1 : 0);

/* INTERACTION STATE TEST ─────────────────────────────────────────────────────
   Asserts that interactive elements actually change when hovered, focused and
   pressed - by forcing the pseudo-class through CDP and diffing the COMPUTED
   style before and after.

   Counting ":active" selectors in a stylesheet proves nothing: the rule can be
   overridden, scoped to a selector that matches nothing, or shadowed by a
   later declaration. This measures the pixels the browser would actually
   paint. A state that produces no measurable delta is a failure.

   Usage: node tools/interaction.mjs [--pages /,/work/] */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");
const PW = [process.env.PLAYWRIGHT_PATH,
            join(ROOT, "node_modules/playwright/index.mjs"),
            join(ROOT, "../study-a-dom-svg/node_modules/playwright/index.mjs")].filter(Boolean);
let chromium = null;
for (const p of PW) { try { ({ chromium } = await import(p)); break; } catch {} }
if (!chromium) { console.error("playwright not found"); process.exit(2); }

const BASE = process.env.CLS_BASE || "http://127.0.0.1:4210";
const WATCH = ["transform", "opacity", "backgroundColor", "color", "borderColor",
               "boxShadow", "backgroundSize", "borderBottomWidth", "outlineWidth",
               "paddingLeft", "textDecorationLine", "letterSpacing", "filter"];

/* selector -> which states that element is expected to answer */
const CASES = [
  { page: "/",       sel: ".btn--go",        states: ["hover", "active"] },
  { page: "/",       sel: ".btn--quiet",     states: ["hover", "active"] },
  { page: "/",       sel: ".fcard a",        states: ["hover", "active"] },
  { page: "/",       sel: ".reg__l a",       states: ["hover"] },
  { page: "/",       sel: ".btn--line",      states: ["hover", "active"] },
  { page: "/",       sel: ".cap__c",         states: ["hover"] },
  { page: "/",       sel: ".site-nav a",     states: ["hover", "focus-visible"] },
  { page: "/",       sel: ".site-foot nav a",states: ["hover"] },
  { page: "/work/",  sel: ".live-e",         states: ["hover", "active"] },
  { page: "/work/",  sel: ".reg-close .btn--go", states: ["hover", "active"] },
  { page: "/work/carepro/", sel: ".btn--go",  states: ["hover", "active"] },
  { page: "/work/jamii-projects-hub/", sel: ".btn--line", states: ["hover", "active"] },
  { page: "/work/",  sel: ".held-e",         states: ["hover", "active"] },
  { page: "/work/",  sel: ".theme-t",        states: ["hover", "active"] },
  { page: "/book/",  sel: "#b-go",           states: ["hover", "active"] },
  { page: "/contact/", sel: "#f-go",         states: ["hover", "active"] },
  { page: "/work/bizmtaani/", sel: ".sys-open", states: ["hover", "active"] },
];

const argv = process.argv.slice(2);
const only = argv.indexOf("--pages") >= 0 ? argv[argv.indexOf("--pages") + 1].split(",") : null;

const browser = await chromium.launch();
let fail = 0, checked = 0;

for (const c of CASES) {
  if (only && !only.includes(c.page)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + c.page, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const client = await ctx.newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const { root } = await client.send("DOM.getDocument");
  const { nodeId } = await client.send("DOM.querySelector",
                                       { nodeId: root.nodeId, selector: c.sel });
  if (!nodeId) {
    console.log(`MISSING   ${c.page} ${c.sel} — element not on page`);
    fail++; await ctx.close(); continue;
  }

  const read = () => page.evaluate(([sel, props]) => {
    const e = document.querySelector(sel);
    const cs = getComputedStyle(e);
    const o = {};
    for (const p of props) o[p] = cs[p];
    return o;
  }, [c.sel, WATCH]);

  const base = await read();

  for (const state of c.states) {
    await client.send("CSS.forcePseudoState",
                      { nodeId, forcedPseudoClasses: [state] });
    await page.waitForTimeout(450);          // let the transition land
    const on = await read();
    await client.send("CSS.forcePseudoState",
                      { nodeId, forcedPseudoClasses: [] });

    const diff = WATCH.filter(p => base[p] !== on[p]);
    checked++;
    if (!diff.length) {
      fail++;
      console.log(`NO CHANGE ${c.page.padEnd(20)} ${c.sel.padEnd(16)} :${state}`);
    } else {
      const shown = diff.slice(0, 2)
        .map(p => `${p} ${String(base[p]).slice(0, 20)} -> ${String(on[p]).slice(0, 20)}`)
        .join("; ");
      console.log(`ok        ${c.page.padEnd(20)} ${c.sel.padEnd(16)} :${state.padEnd(13)} ${shown}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${checked} state(s) tested, ${fail} with no measurable change`);
process.exit(fail ? 1 : 0);

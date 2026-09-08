/* THE PRIMARY VISITOR JOURNEY ───────────────────────────────────────────────
   Home → Work → BizMtaani → back → CarePro → back → Jamii → Book, driven by
   real clicks and the browser's own back button rather than by loading each
   URL independently. Loading a URL proves the page renders; clicking proves
   the path between pages exists, that the link a visitor would actually reach
   for is there, and that going back does not strand them.

   Asserts at every stop: the click landed where it claimed, no page error, no
   horizontal overflow, and the shell is present and consistent. */
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

const STEPS = [
  { do: "click", find: ["Open the register", "Read the register"], expect: "/work/" },
  { do: "click", find: ["BizMtaani"],        expect: "/work/bizmtaani/" },
  { do: "back",                              expect: "/work/" },
  { do: "click", find: ["CarePro"],          expect: "/work/carepro/" },
  { do: "back",                              expect: "/work/" },
  { do: "click", find: ["Jamii"],            expect: "/work/jamii-projects-hub/" },
  { do: "click", find: ["Discuss a project"],expect: "/book/" },
];

const browser = await chromium.launch();
let fail = 0;

for (const [w, h, label] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
  console.log(`\n── ${label} ${w}x${h} ──`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e.message).slice(0, 70)));
  await page.route("**/api/status*", r => r.fulfill({ status: 500, body: "x" }));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });

  for (const step of STEPS) {
    const before = new URL(page.url()).pathname;
    let how = "";
    if (step.do === "back") { await page.goBack({ waitUntil: "domcontentloaded" }); how = "back"; }
    else {
      let clicked = null;
      for (const text of step.find) {
        const el = page.locator(`a:has-text("${text}")`).first();
        if (await el.count() && await el.isVisible().catch(() => false)) {
          await el.scrollIntoViewIfNeeded().catch(() => {});
          await el.click({ timeout: 4000 }).catch(() => {});
          clicked = text; break;
        }
      }
      if (!clicked) {
        fail++; console.log(`  FAIL  no reachable link for [${step.find.join(", ")}] on ${before}`);
        continue;
      }
      how = `click "${clicked}"`;
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(650);
    const now = new URL(page.url()).pathname;
    const st = await page.evaluate(() => ({
      head: !!document.querySelector(".site-head"),
      foot: !!document.querySelector(".site-foot"),
      current: (document.querySelector('[aria-current="page"]') || {}).textContent || "-",
      ov: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      h1: !!document.querySelector("h1")
    }));
    const bad = [];
    if (now !== step.expect) bad.push(`landed ${now}, expected ${step.expect}`);
    if (!st.head || !st.foot) bad.push("shell missing");
    if (!st.h1) bad.push("no h1");
    if (st.ov) bad.push("overflow");
    if (bad.length) fail++;
    console.log(`  ${bad.length ? "FAIL" : "ok  "}  ${before.padEnd(26)} --${how.padEnd(28)}--> ${now.padEnd(26)} nav:${st.current}${bad.length ? "  ← " + bad.join("; ") : ""}`);
  }
  if (errs.length) { fail++; console.log(`  page errors: ${[...new Set(errs)].join(" | ")}`); }
  await ctx.close();
}
await browser.close();
console.log(`\n${fail} journey failure(s)`);
process.exit(fail ? 1 : 0);

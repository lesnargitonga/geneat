/**
 * Wave E visual acceptance captures.
 *
 * Full-page and flagship-detail shots across the required viewport matrix, plus
 * reduced-motion and 200% zoom. Deterministic filenames so a reviewer can diff
 * the same frame between runs.
 *
 * This script only observes. It never navigates to admin paths and never posts.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-e/visual");
const BASE = process.env.STUDY_A_URL ?? "http://127.0.0.1:4190";

/** The viewports Wave E must survive, widest first. */
const VIEWPORTS = [
  ["1440x900", 1440, 900],
  ["1280x800", 1280, 800],
  ["1024x768", 1024, 768],
  ["768x1024", 768, 1024],
  ["430x932", 430, 932],
  ["390x844", 390, 844],
  ["360x800", 360, 800],
  // 320x568 is the narrowest supported viewport and the one where the rail
  // wrap and the hanging indices are tightest. It must appear explicitly in the
  // output rather than being assumed covered by 360.
  ["320x568", 320, 568],
];

async function settle(page) {
  await page
    .waitForFunction(() => document.documentElement.dataset["heroPhase"] === "settled", null, { timeout: 20_000 })
    .catch(() => {});
  await page.locator("[data-flagship-route]").scrollIntoViewIfNeeded();
  await page
    .waitForFunction(() => document.documentElement.dataset["flagshipPhase"] === "complete", null, { timeout: 20_000 })
    .catch(() => {});
  // let lazy proof media finish so screenshots are not mid-load
  await page.waitForTimeout(700);
}

/** Overflow and clipping are the defects screenshots hide; measure them. */
async function audit(page, label) {
  return page.evaluate((viewport) => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    const clipped = [];
    // Was scoped to .flagship and friends, which meant every chapter added
    // after Wave E was invisible to this audit — the work register's links were
    // never checked at all. Scoped to the whole page instead: a clipping or
    // target defect does not care which wave introduced the element.
    for (const el of document.querySelectorAll("main *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > de.clientWidth + 1 || r.left < -1) {
        clipped.push({ sel: el.className || el.tagName, right: Math.round(r.right), left: Math.round(r.left) });
      }
    }
    // touch target check on interactive elements inside the flagship
    const small = [];
    for (const el of document.querySelectorAll("main a[href], main button, main [role='button'], .route-step")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) small.push({ sel: el.className || el.tagName, h: Math.round(r.height) });
    }
    return { viewport, overflow, clipped: clipped.slice(0, 6), smallTargets: small.slice(0, 6) };
  }, label);
}

async function shoot(browser, [label, width, height], opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await settle(page);

  const prefix = opts.reducedMotion === "reduce" ? "reduced-motion" : "default";
  await page.screenshot({ path: resolve(OUT, `${prefix}-full-${label}.png`), fullPage: true });
  const flagship = page.locator(".flagship");
  if (await flagship.count()) {
    await flagship.scrollIntoViewIfNeeded();
    await flagship.screenshot({ path: resolve(OUT, `${prefix}-flagship-${label}.png`) });
  }
  const result = await audit(page, label);
  await ctx.close();
  return { ...result, motion: prefix };
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const findings = [];

for (const vp of VIEWPORTS) findings.push(await shoot(browser, vp));

// reduced motion: desktop + mobile
findings.push(await shoot(browser, VIEWPORTS[0], { reducedMotion: "reduce" }));
findings.push(await shoot(browser, VIEWPORTS[5], { reducedMotion: "reduce" }));

// 200% zoom simulated as a halved CSS viewport at dpr 2
{
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await settle(page);
  await page.screenshot({ path: resolve(OUT, "zoom200-full-1440x900.png"), fullPage: true });
  const f = page.locator(".flagship");
  if (await f.count()) {
    await f.scrollIntoViewIfNeeded();
    await f.screenshot({ path: resolve(OUT, "zoom200-flagship-1440x900.png") });
  }
  findings.push({ ...(await audit(page, "zoom200")), motion: "zoom200" });
  await ctx.close();
}

await browser.close();
await writeFile(resolve(OUT, "audit.json"), JSON.stringify({ capturedAt: new Date().toISOString(), findings }, null, 2));

const bad = findings.filter((f) => f.overflow > 1 || f.clipped.length || f.smallTargets.length);
for (const f of findings) {
  const flag = f.overflow > 1 || f.clipped.length || f.smallTargets.length ? "DEFECT" : "ok";
  console.log(
    `  ${f.motion.padEnd(14)} ${String(f.viewport).padEnd(10)} overflow=${f.overflow}px clipped=${f.clipped.length} smallTargets=${f.smallTargets.length}  ${flag}`,
  );
}
for (const f of bad) {
  if (f.clipped.length) console.log(`    clipped @${f.viewport}: ${JSON.stringify(f.clipped[0])}`);
  if (f.smallTargets.length) console.log(`    small @${f.viewport}: ${JSON.stringify(f.smallTargets[0])}`);
}
console.log(bad.length ? `\n  ${bad.length} viewport(s) with defects` : "\n  no overflow, clipping or small-target defects");

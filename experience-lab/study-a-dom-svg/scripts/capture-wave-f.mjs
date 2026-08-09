/** Wave F capability register — responsive, reduced-motion, no-JS and zoom evidence. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-f");
const BASE = process.env.STUDY_A_URL ?? "http://127.0.0.1:4190";

const VIEWPORTS = [
  ["1440x900", 1440, 900], ["1280x800", 1280, 800], ["1024x768", 1024, 768],
  ["768x1024", 768, 1024], ["430x932", 430, 932], ["390x844", 390, 844], ["360x800", 360, 800], ["320x568", 320, 568],
];

async function audit(page, label) {
  return page.evaluate((viewport) => {
    const de = document.documentElement;
    const clipped = [];
    for (const el of document.querySelectorAll(".capability *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > de.clientWidth + 1 || r.left < -1) clipped.push(el.className || el.tagName);
    }
    const small = [];
    for (const el of document.querySelectorAll(".capability a, .capability button")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) small.push({ sel: String(el.className).slice(0, 30), h: Math.round(r.height) });
    }
    return { viewport, overflow: de.scrollWidth - de.clientWidth, clipped: clipped.slice(0, 4), smallTargets: small.slice(0, 4) };
  }, label);
}

async function shoot(browser, [label, width, height], opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(1800);
  const reg = page.locator("[data-capability-register]");
  await reg.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const tag = opts.javaScriptEnabled === false ? "nojs" : opts.reducedMotion === "reduce" ? "reduced-motion" : "default";
  await reg.screenshot({ path: resolve(OUT, `${tag}-register-${label}.png`) });
  const r = await audit(page, label);
  await ctx.close();
  return { ...r, mode: tag };
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const findings = [];
for (const vp of VIEWPORTS) findings.push(await shoot(browser, vp));
findings.push(await shoot(browser, VIEWPORTS[0], { reducedMotion: "reduce" }));
findings.push(await shoot(browser, VIEWPORTS[5], { reducedMotion: "reduce" }));
findings.push(await shoot(browser, VIEWPORTS[0], { javaScriptEnabled: false }));
findings.push(await shoot(browser, VIEWPORTS[5], { javaScriptEnabled: false }));
{
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(1800);
  await page.locator("[data-capability-register]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator("[data-capability-register]").screenshot({ path: resolve(OUT, "zoom200-register.png") });
  findings.push({ ...(await audit(page, "zoom200")), mode: "zoom200" });
  await ctx.close();
}
await browser.close();
await writeFile(resolve(OUT, "audit.json"), JSON.stringify({ capturedAt: new Date().toISOString(), findings }, null, 2));
for (const f of findings) {
  const bad = f.overflow > 1 || f.clipped.length || f.smallTargets.length;
  console.log(`  ${f.mode.padEnd(14)} ${String(f.viewport).padEnd(10)} overflow=${f.overflow}px clipped=${f.clipped.length} small=${f.smallTargets.length} ${bad ? "DEFECT" : "ok"}`);
  if (f.smallTargets.length) console.log(`      ${JSON.stringify(f.smallTargets[0])}`);
}

/**
 * Wave G performance, measured against the exact final served build.
 *
 * Laboratory measurement: one machine, headless Chromium, CDP-emulated CPU
 * throttling. Not a field measurement and not a p75 claim.
 *
 * ## Why entry costs are measured from a mark, not from the page lifetime
 *
 * "0 long tasks" is meaningless if it is taken over the whole session, because
 * boot tasks and scroll tasks end up in the same bucket and a genuinely
 * expensive chapter entry hides behind an otherwise quiet page. Each entry
 * measurement here stamps a mark *before* the section is brought into view and
 * only counts tasks that start after it.
 *
 * The illustrative control loop is measured separately from the physical
 * chapter for the same reason: they are different sections and one being cheap
 * says nothing about the other.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-g");
const BASE = process.env.STUDY_A_URL ?? "http://127.0.0.1:4190";

const METHOD =
  "Laboratory measurement, headless Chromium, single machine, CDP-emulated CPU throttling. " +
  "Not a field measurement and not a p75 claim.";

/** Installed before any page script so first paint is captured, not reconstructed. */
const INSTRUMENT = () => {
  const m = { cls: 0, lcp: 0, longTasks: [] };
  window.__WG__ = m;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    const es = l.getEntries();
    const last = es[es.length - 1];
    if (last) m.lcp = last.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        m.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // longtask unsupported: recorded as absent rather than faked.
  }
};

async function open(browser, { cpuRate } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  if (cpuRate) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
  }
  await page.goto(BASE, { waitUntil: "load" });
  await page
    .waitForFunction(() => document.documentElement.dataset["heroPhase"] === "settled", null, {
      timeout: 30_000,
    })
    .catch(() => {});
  return { ctx, page };
}

const loadStats = (page) =>
  page.evaluate(() => {
    const m = window.__WG__;
    return {
      lcpMs: Math.round(m.lcp),
      cls: Number(m.cls.toFixed(4)),
      longTaskCount: m.longTasks.length,
      worstLongTaskMs: m.longTasks.reduce((a, t) => Math.max(a, t.dur), 0),
    };
  });

/** Long tasks attributable to bringing one section into view. */
async function entryCost(page, selector) {
  const mark = await page.evaluate(() => performance.now());
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  return page.evaluate((since) => {
    const after = window.__WG__.longTasks.filter((t) => t.start >= since);
    return {
      longTaskCount: after.length,
      worstMs: after.reduce((a, t) => Math.max(a, t.dur), 0),
    };
  }, mark);
}

/** Time from clicking a trace stage to the DOM reflecting it. */
async function traceInteraction(page) {
  const links = page.locator(".trace__link");
  const n = await links.count();
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const t = await page.evaluate(async (index) => {
      const el = document.querySelectorAll(".trace__link")[index];
      const t0 = performance.now();
      el.click();
      // Settle on the frame that paints the change, not on a timer.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - t0;
    }, i);
    samples.push(Number(t.toFixed(1)));
  }
  return {
    samples,
    averageMs: Number((samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1)),
    maxMs: Math.max(...samples),
  };
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

// ── normal ────────────────────────────────────────────────────────────────
const normal = await open(browser);
const normalLoad = await loadStats(normal.page);
const waveGEntry = await entryCost(normal.page, "[data-trace]");
const illustrativeEntry = await entryCost(normal.page, '[data-status="illustrative"]');
const interaction = await traceInteraction(normal.page);
await normal.ctx.close();

// ── 4x CPU ────────────────────────────────────────────────────────────────
const slow = await open(browser, { cpuRate: 4 });
const slowLoad = await loadStats(slow.page);
await slow.ctx.close();

await browser.close();

const report = {
  capturedAt: new Date().toISOString(),
  method: METHOD,
  scenario: "desktop 1440x900, exact final served build",
  normal: normalLoad,
  cpu4x: slowLoad,
  waveGChapterEntry: waveGEntry,
  illustrativeLoopEntry: illustrativeEntry,
  traceInteraction: interaction,
};
await writeFile(resolve(OUT, "performance.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(`  normal   LCP ${normalLoad.lcpMs}ms  CLS ${normalLoad.cls}  longTasks ${normalLoad.longTaskCount} (worst ${normalLoad.worstLongTaskMs}ms)`);
console.log(`  4x CPU   LCP ${slowLoad.lcpMs}ms  CLS ${slowLoad.cls}  longTasks ${slowLoad.longTaskCount} (worst ${slowLoad.worstLongTaskMs}ms)`);
console.log(`  Wave G chapter entry:     ${waveGEntry.longTaskCount} long task(s), worst ${waveGEntry.worstMs}ms`);
console.log(`  illustrative loop entry:  ${illustrativeEntry.longTaskCount} long task(s), worst ${illustrativeEntry.worstMs}ms`);
console.log(`  trace interaction: avg ${interaction.averageMs}ms  max ${interaction.maxMs}ms  (${interaction.samples.length} samples)`);

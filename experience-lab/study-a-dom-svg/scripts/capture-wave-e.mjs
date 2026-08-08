/** Wave E evidence captures and post-media performance measurement. */
import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-e");
const BASE = process.env.STUDY_A_URL ?? "http://127.0.0.1:4184";

const INSTRUMENT = () => {
  const m = { cls: 0, lcp: 0, longTasks: [], phase: {}, transfer: [] };
  window.__WE__ = m;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    const e = l.getEntries().at(-1);
    if (e) m.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        m.longTasks.push({ start: Math.round(e.startTime), end: Math.round(e.startTime + e.duration), dur: Math.round(e.duration) });
    }).observe({ type: "longtask", buffered: true });
  } catch { /* unsupported */ }
  window.__MARK__ = (n) => { m.phase[n] = Math.round(performance.now()); };
};

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  return { ctx, page };
}

async function settle(page) {
  await page.waitForFunction(() => document.documentElement.dataset["heroPhase"] === "settled", null, { timeout: 20_000 }).catch(() => {});
  await page.locator("[data-flagship-route]").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.documentElement.dataset["flagshipPhase"] === "complete", null, { timeout: 20_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
}

async function shot(page, sel, path) {
  const el = page.locator(sel);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await el.screenshot({ path });
}

const browser = await chromium.launch();
for (const d of ["desktop", "mobile", "reduced-motion", "media-failure"]) {
  await mkdir(resolve(OUT, d), { recursive: true });
}

// ---- desktop ----
{
  const { ctx, page } = await open(browser);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(3600);
  await page.screenshot({ path: resolve(OUT, "desktop/flagship-entry-1440.png") });
  await settle(page);
  await shot(page, ".flagship", resolve(OUT, "desktop/flagship-proof-1440.png"));
  await shot(page, "[data-portfolio-cue]", resolve(OUT, "desktop/portfolio-continuity-1440.png"));
  console.log("  desktop ×3");
  await ctx.close();
}

// ---- mobile ----
for (const [file, opts] of [
  ["mobile/flagship-393.png", { ...devices["Pixel 5"] }],
  ["mobile/flagship-320.png", { viewport: { width: 320, height: 568 } }],
]) {
  const { ctx, page } = await open(browser, opts);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await settle(page);
  await shot(page, ".flagship", resolve(OUT, file));
  console.log(`  ${file}`);
  await ctx.close();
}

// ---- reduced motion ----
{
  const { ctx, page } = await open(browser, { reducedMotion: "reduce" });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await settle(page);
  await shot(page, ".flagship", resolve(OUT, "reduced-motion/flagship.png"));
  console.log("  reduced-motion");
  await ctx.close();
}

// ---- media failure ----
{
  const { ctx, page } = await open(browser);
  await page.route("**/proof/*", (r) => r.abort());
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await settle(page);
  await shot(page, ".flagship", resolve(OUT, "media-failure/flagship.png"));
  console.log("  media-failure");
  await ctx.close();
}

// ---- performance after real media ----
const perf = async (label, opts = {}, throttle = null) => {
  const { ctx, page } = await open(browser, opts);
  const transfer = [];
  page.on("response", async (r) => {
    try {
      const h = r.headers();
      transfer.push({ url: r.url().replace(BASE, ""), type: h["content-type"] ?? "", bytes: Number(h["content-length"] ?? 0) });
    } catch { /* ignore */ }
  });
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    if (throttle.cpu) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle.cpu });
  }
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await settle(page);

  // Ordinary-scroll long tasks, attributed to the scroll window only (Wave D.1).
  await page.evaluate(async () => {
    window.__MARK__("scrollStart");
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.__MARK__("scrollEnd");
  });

  const m = await page.evaluate(() => window.__WE__);
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const p = performance.getEntriesByType("paint");
    return {
      fcp: Math.round(p.find((x) => x.name === "first-contentful-paint")?.startTime ?? -1),
      load: Math.round(n?.loadEventEnd ?? -1),
    };
  });
  await ctx.close();

  const s = m.phase.scrollStart ?? 0;
  const e = m.phase.scrollEnd ?? Number.MAX_SAFE_INTEGER;
  const during = m.longTasks.filter((t) => t.end > s && t.start < e);
  const boot = m.longTasks.filter((t) => t.end <= s);
  const max = (l) => l.reduce((x, t) => Math.max(x, t.dur), 0);

  const proofMedia = transfer.filter((t) => t.url.includes("/proof/"));
  return {
    scenario: label,
    firstContentfulPaintMs: nav.fcp,
    largestContentfulPaintMs: Math.round(m.lcp),
    loadMs: nav.load,
    cumulativeLayoutShift: Number(m.cls.toFixed(4)),
    ordinaryScrollLongestTaskMs: max(during),
    ordinaryScrollTasksOverBudget: during.filter((t) => t.dur > 50).length,
    bootLongestTaskMs: max(boot),
    proofMediaRequests: proofMedia.length,
    proofMediaBytes: proofMedia.reduce((a, t) => a + t.bytes, 0),
    largestProofAssetBytes: proofMedia.reduce((a, t) => Math.max(a, t.bytes), 0),
    totalFirstViewBytes: transfer.reduce((a, t) => a + t.bytes, 0),
  };
};

const results = [
  await perf("desktop 1440, unthrottled"),
  await perf("desktop 1440, CPU 4x", {}, { cpu: 4 }),
  await perf("mobile 393 (Pixel 5), CPU 4x", { ...devices["Pixel 5"] }, { cpu: 4 }),
];

await writeFile(
  resolve(OUT, "performance-summary.json"),
  `${JSON.stringify({
    method: "Laboratory measurement, headless Chromium, single machine, CDP-emulated CPU throttling. NOT field p75 data.",
    measuredAfterRealMediaIntegration: true,
    budgets: { lcpMs: 2500, cls: 0.1, ordinaryScrollLongTaskMs: 50 },
    note: "Long tasks attributed to the scroll window by timestamp overlap; boot reported separately (see Wave D.1).",
    results,
  }, null, 2)}\n`,
  "utf8",
);
console.log("  performance-summary.json");
await browser.close();

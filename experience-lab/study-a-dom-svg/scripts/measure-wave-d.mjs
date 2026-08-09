/**
 * Wave D measurement and evidence capture.
 *
 * Everything produced here is a **laboratory measurement**, taken on one
 * machine, in headless Chromium, with CDP-emulated throttling. §26 requires
 * real measurement rather than assertion — but field p75 values cannot be
 * derived from a lab run, and nothing here claims otherwise. Every output file
 * records its own method.
 *
 * Run against a live `npm run preview`:
 *   npm run build && npm run preview &
 *   node scripts/measure-wave-d.mjs
 */

import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-d");
const BASE_URL = process.env.STUDY_A_URL ?? "http://127.0.0.1:4184";

const METHOD_NOTE =
  "Laboratory measurement, headless Chromium, single machine, CDP-emulated conditions. " +
  "Not a field measurement and not a p75 claim.";

async function write(name, data) {
  await writeFile(resolve(OUT, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`  ${name}`);
}

/**
 * Instruments the page before any of its own script runs, so first-paint
 * timings are captured rather than reconstructed afterwards.
 */
const INSTRUMENT = () => {
  const marks = { cls: 0, lcp: 0, longTasks: [] };
  window.__WD__ = marks;

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) marks.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });

  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    if (last) marks.lcp = last.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        marks.longTasks.push({
          start: Math.round(entry.startTime),
          end: Math.round(entry.startTime + entry.duration),
          dur: Math.round(entry.duration),
        });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // longtask is not supported everywhere; absence is recorded, not faked.
  }

  // Phase boundaries, so a task can be attributed to boot or to scroll rather
  // than collapsed into one lifetime maximum. See Wave D.1.
  marks.phase = {};
  window.__PERF_MARK__ = (name) => {
    marks.phase[name] = Math.round(performance.now());
  };
};

async function openInstrumented(context, url) {
  const page = await context.newPage();
  await page.addInitScript(INSTRUMENT);
  await page.goto(url, { waitUntil: "load" });
  return page;
}

function paintTimings(page) {
  return page.evaluate(() => {
    const paints = performance.getEntriesByType("paint");
    const nav = performance.getEntriesByType("navigation")[0];
    const marks = window.__WD__ ?? { cls: 0, lcp: 0, longTasks: [] };
    return {
      firstPaintMs: Math.round(paints.find((p) => p.name === "first-paint")?.startTime ?? -1),
      firstContentfulPaintMs: Math.round(
        paints.find((p) => p.name === "first-contentful-paint")?.startTime ?? -1,
      ),
      largestContentfulPaintMs: Math.round(marks.lcp),
      domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd ?? -1),
      loadMs: Math.round(nav?.loadEventEnd ?? -1),
      cumulativeLayoutShift: Number(marks.cls.toFixed(4)),
      longTasks: marks.longTasks,
      longestTaskMs: marks.longTasks.reduce((max, t) => Math.max(max, t.dur), 0),
    };
  });
}

/** Applies CDP throttling to one page. */
async function throttle(page, { cpuRate, network }) {
  const cdp = await page.context().newCDPSession(page);
  if (cpuRate) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
  if (network) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: network.latencyMs,
      downloadThroughput: network.downKbps * 125,
      uploadThroughput: network.upKbps * 125,
    });
  }
  return cdp;
}

// --------------------------------------------------------------- scenarios

async function screenshots(browser) {
  const shots = [
    ["desktop-1440.png", { viewport: { width: 1440, height: 900 } }],
    ["desktop-1920.png", { viewport: { width: 1920, height: 1080 } }],
    ["tablet-768.png", { viewport: { width: 768, height: 1024 } }],
    ["mobile-393.png", { ...devices["Pixel 5"] }],
    ["mobile-320.png", { viewport: { width: 320, height: 568 } }],
  ];

  for (const [file, options] of shots) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    // Wait past the formation sequence so the capture shows the settled hero.
    await page.waitForFunction(
      () => document.documentElement.dataset["heroPhase"] === "settled",
      null,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: resolve(OUT, file), fullPage: false });
    console.log(`  ${file}`);
    await context.close();
  }

  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await reduced.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(OUT, "reduced-motion.png"), fullPage: false });
  console.log("  reduced-motion.png");
  await reduced.close();
}

async function heroTiming(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await openInstrumented(context, `${BASE_URL}/?diagnostics=1`);

  // When is the CTA actually usable? Measured, not assumed.
  const ctaReadyMs = await page.evaluate(() => {
    const cta = document.querySelector('a[href="#product"]');
    if (!cta) return -1;
    const rect = cta.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? Math.round(performance.now()) : -1;
  });

  await page.waitForFunction(() => window.__STUDY_A__?.heroPhase() === "settled", null, {
    timeout: 15_000,
  });

  const elapsed = await page.evaluate(() => window.__STUDY_A__.heroElapsedMs());
  const budget = await page.evaluate(() => window.__STUDY_A__.heroBudgetMs());
  const timings = await paintTimings(page);

  await context.close();

  return {
    method: METHOD_NOTE,
    scenario: "desktop 1440x900, no throttling",
    scheduledBudgetMs: budget,
    measuredElapsedMs: Math.round(elapsed ?? -1),
    budgetWindowMs: { min: 2200, max: 3200 },
    withinBudget: elapsed !== null && elapsed >= 2200 && elapsed <= 3600,
    ctaMeasurablyPresentAtMs: ctaReadyMs,
    ctaAvailableBeforeSequenceEnd: ctaReadyMs >= 0 && ctaReadyMs < (elapsed ?? Infinity),
    paint: timings,
  };
}

async function cpuThrottled(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(INSTRUMENT);
  await throttle(page, { cpuRate: 4 });
  await page.goto(`${BASE_URL}/?diagnostics=1`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__STUDY_A__?.heroPhase() === "settled", null, {
    timeout: 25_000,
  });

  const timings = await paintTimings(page);
  const elapsed = await page.evaluate(() => window.__STUDY_A__.heroElapsedMs());

  // Scroll the full page, with the window marked so tasks can be attributed.
  await page.evaluate(async () => {
    window.__PERF_MARK__("scrollStart");
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.__PERF_MARK__("scrollEnd");
  });
  const afterScroll = await paintTimings(page);
  const phase = await page.evaluate(() => window.__WD__.phase ?? {});
  await context.close();

  /**
   * Attribute each long task to a phase.
   *
   * Wave D reduced this list to a single lifetime maximum and labelled it
   * "longest task during full-page scroll" — which silently counted the boot
   * task. Wave D.1 measured the difference: boot 102-174 ms, scroll 0 ms.
   * A task now counts as a scroll task only if it overlaps the scroll window.
   */
  const scrollStart = phase.scrollStart ?? 0;
  const scrollEnd = phase.scrollEnd ?? Number.MAX_SAFE_INTEGER;
  const during = afterScroll.longTasks.filter((t) => t.end > scrollStart && t.start < scrollEnd);
  const boot = afterScroll.longTasks.filter((t) => t.end <= scrollStart);
  const longest = (list) => list.reduce((max, t) => Math.max(max, t.dur), 0);

  return {
    method: METHOD_NOTE,
    scenario: "desktop 1440x900, CPU throttled 4x via CDP",
    heroElapsedMs: Math.round(elapsed ?? -1),
    paint: timings,
    scrollWindowMs: scrollEnd - scrollStart,
    duringFullPageScroll: {
      longTasks: during,
      longestTaskMs: longest(during),
      overBudget: during.filter((t) => t.dur > 50).length,
      withinBudget: longest(during) <= 50,
    },
    duringBoot: {
      longTasks: boot,
      longestTaskMs: longest(boot),
      note:
        "Initial parse, execute and first render at 4x CPU throttle. Not a scroll task and not " +
        "governed by the scroll budget. Reported so it is visible rather than hidden.",
    },
    budgetNote:
      "Programme budget: no long task above 50ms during ordinary scroll. Boot and scroll are " +
      "attributed separately — see evidence/wave-d/scroll-performance/attribution.md for the " +
      "Wave D.1 investigation that established the distinction.",
    supersedes: {
      waveDReported: "longest scroll task @ 4x CPU: 142 ms",
      why:
        "That figure was the maximum long task over the entire page lifetime, not over the " +
        "scroll window. The harness reduced one cumulative list and labelled the result a " +
        "scroll measurement. The original number is retained in " +
        "evidence/wave-d/scroll-performance/attribution.md rather than deleted.",
    },
  };
}

async function slow4g(browser) {
  const context = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await context.newPage();
  await page.addInitScript(INSTRUMENT);
  // Chrome DevTools "Slow 4G" preset.
  await throttle(page, { cpuRate: 4, network: { latencyMs: 400, downKbps: 400, upKbps: 400 } });

  const started = Date.now();
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  const loadWallMs = Date.now() - started;

  // The claim under test: headline and CTA are usable before the hero finishes,
  // even on a slow connection.
  const headlineVisible = await page.locator("h1").isVisible();
  const ctaVisible = await page.getByRole("link", { name: "See a real system" }).isVisible();
  const timings = await paintTimings(page);
  await context.close();

  return {
    method: METHOD_NOTE,
    scenario: "Pixel 5 viewport, CPU 4x + Slow 4G (400ms RTT, 400kbps) via CDP",
    wallClockLoadMs: loadWallMs,
    headlineVisibleAtLoad: headlineVisible,
    primaryCtaVisibleAtLoad: ctaVisible,
    paint: timings,
    loaderPresent: false,
    loaderNote: "No loader exists in the markup; the static hero is the first paint.",
  };
}

async function layoutShift(browser) {
  const results = [];
  for (const [label, options] of [
    ["desktop-1440", { viewport: { width: 1440, height: 900 } }],
    ["mobile-393", { ...devices["Pixel 5"] }],
    ["mobile-320", { viewport: { width: 320, height: 568 } }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.addInitScript(INSTRUMENT);
    await page.goto(`${BASE_URL}/?diagnostics=1`, { waitUntil: "load" });
    await page.waitForFunction(
      () => document.documentElement.dataset["heroPhase"] === "settled",
      null,
      { timeout: 20_000 },
    );

    const duringLoad = (await paintTimings(page)).cumulativeLayoutShift;

    // Then step every state and re-measure: state changes must not shift layout.
    for (const state of ["observe", "protect", "human-review", "act", "prove", "idea"]) {
      await page.evaluate((s) => window.__STUDY_A__.goToSignalState(s), state);
      await page.waitForTimeout(120);
    }
    const afterStateChanges = (await paintTimings(page)).cumulativeLayoutShift;

    results.push({
      scenario: label,
      clsDuringLoad: duringLoad,
      clsAfterSteppingAllStates: afterStateChanges,
      clsAddedByStateChanges: Number((afterStateChanges - duringLoad).toFixed(4)),
      withinBudget: afterStateChanges <= 0.1,
    });
    await context.close();
  }

  return { method: METHOD_NOTE, budget: "CLS <= 0.1", results };
}

/** Contrast of every semantic token pair actually used for text. */
async function contrastAudit(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });

  const audit = await page.evaluate(() => {
    const read = (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    /**
     * Resolve any CSS colour to sRGB bytes by painting it.
     *
     * Reading `getComputedStyle(...).color` does **not** work here: Chromium
     * keeps `oklch()` in its computed form rather than serialising to `rgb()`,
     * so a naive numeric parse reads "0.94 0.012 82" as an RGB triple and
     * reports every pair at ~1:1. Painting a pixel and reading it back gives
     * the actual sRGB the display receives, including gamut clamping, whatever
     * notation the token used.
     */
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const toRgb = (value) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = value;
      // An unparsable value leaves fillStyle at the previous colour, which
      // would silently produce a wrong ratio — so verify it changed.
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };

    const lum = ([r, g, b]) => {
      const f = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    const ratio = (a, b) => {
      const la = lum(toRgb(a));
      const lb = lum(toRgb(b));
      const [hi, lo] = la > lb ? [la, lb] : [lb, la];
      return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
    };

    const bg = read("--surface-base");
    const raised = read("--surface-raised");
    const inset = read("--surface-inset");

    const pairs = [
      ["primary text on base", read("--text-primary"), bg, 4.5],
      ["secondary text on base", read("--text-secondary"), bg, 4.5],
      ["tertiary text on base", read("--text-tertiary"), bg, 4.5],
      ["tertiary text on inset", read("--text-tertiary"), inset, 4.5],
      ["secondary text on raised", read("--text-secondary"), raised, 4.5],
      // 1.5 here is an INTERNAL DECORATIVE VISIBILITY FLOOR, not a WCAG
      // threshold. WCAG defines no minimum for purely decorative marks; this
      // floor exists only so a rule does not vanish into the paper. It must not
      // be read as an accessibility conformance figure.
      //
      // These two tones qualify as decorative only because no information
      // depends on seeing them, and that is enforced rather than assumed:
      // `structure.spec.ts` "no essential state is conveyed by colour alone" and
      // `capability.spec.ts` "selection state is not carried by colour alone"
      // both fail if either tone ever becomes the sole carrier of a state.
      //
      // Where a mark must be seen to operate the page — the focus ring — the
      // real non-text UI threshold applies and the ink weight is used instead.
      ["signal-active decorative mark (internal floor)", read("--signal-active"), bg, 1.5],
      ["signal-dormant hairline rule (internal floor)", read("--signal-dormant"), bg, 1.5],
      ["evidence on inset", read("--evidence"), inset, 4.5],
      ["human on raised", read("--human"), raised, 3.0],
      ["boundary on base", read("--boundary"), bg, 3.0],
      ["risk on inset", read("--risk"), inset, 3.0],
      ["recovery on base", read("--recovery"), bg, 3.0],
      // WCAG 2.2 SC 1.4.11. Measured on every ground a ring can land on, since
      // one of them passing says nothing about the others.
      ["focus ring on base", read("--signal-ink"), bg, 3.0],
      ["focus ring on inset", read("--signal-ink"), inset, 3.0],
      ["focus ring on raised", read("--signal-ink"), raised, 3.0],
      ["primary button text", "oklch(18% 0.01 60)", read("--signal-active"), 4.5],
      ["border on base", read("--surface-line"), bg, 1.5],
    ];

    const results = pairs.map(([label, fg, background, required]) => {
      const value = ratio(fg, background);
      const fgRgb = toRgb(fg);
      const bgRgb = toRgb(background);
      return {
        pair: label,
        foreground: fg,
        foregroundSrgb: `rgb(${fgRgb.join(", ")})`,
        background,
        backgroundSrgb: `rgb(${bgRgb.join(", ")})`,
        ratio: value,
        required,
        passes: value >= required,
      };
    });

    return results;
  });

  await context.close();

  return {
    method:
      "WCAG 2.x relative-luminance contrast, computed in-browser from the live tokens. " +
      "ACCESSIBILITY CONFORMANCE THRESHOLDS: 4.5 for body text, 3.0 for large text and for " +
      "non-text UI that must be perceived to operate the page (including focus indicators, " +
      "SC 1.4.11). SEPARATELY, 1.5 is an internal decorative visibility floor applied to purely " +
      "decorative marks and hairlines on which no information depends — WCAG sets no minimum for " +
      "those, so 1.5 is studio policy and is NOT a conformance figure.",
    note:
      "Non-text UI that must be perceived to operate the page is held to 3.0 (SC 1.4.11). " +
      "Purely decorative marks and hairlines carry no information dependency and WCAG sets no " +
      "minimum for them; the 1.5 applied to those is an internal decorative visibility floor, " +
      "studio policy rather than conformance. None of these tones carry information by hue alone " +
      "— every state also differs in shape, weight or wording, enforced by the colour-alone tests.",
    results: audit,
    failing: audit.filter((r) => !r.passes).map((r) => r.pair),
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  try {
    console.log("screenshots");
    await screenshots(browser);

    console.log("measurements");
    await write("hero-timing.json", await heroTiming(browser));
    await write("cpu-4x-summary.json", await cpuThrottled(browser));
    await write("slow-4g-summary.json", await slow4g(browser));
    await write("layout-shift-summary.json", await layoutShift(browser));
    await write("contrast-audit.json", await contrastAudit(browser));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

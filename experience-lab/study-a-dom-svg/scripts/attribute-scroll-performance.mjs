/**
 * Wave D.1 — scroll long-task attribution.
 *
 * Wave D reported "longest scroll task @ 4x CPU: 142 ms" against a 50 ms
 * budget. This script exists to find out where that number actually comes
 * from, rather than to argue it away.
 *
 * Method:
 *
 *  1. Long tasks are recorded with their `startTime`, so each one can be
 *     assigned to a phase — boot, hero sequence, idle, or scroll — instead of
 *     being reduced into a single lifetime maximum.
 *  2. CDP `Performance.getMetrics` is sampled either side of the scroll window.
 *     The deltas separate script execution from style recalculation and layout,
 *     which is the attribution the brief asks for.
 *  3. A CDP trace is captured for one run and aggregated by event name, so any
 *     attribution claim is backed by trace evidence rather than inference.
 *
 * Nothing here changes the application.
 */

import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-d/scroll-performance");
const BASE_URL = process.env.STUDY_A_URL ?? "http://127.0.0.1:4184";

const CPU_RATE = 4;
const LONG_TASK_MS = 50;

/**
 * Records long tasks with timestamps and lets the harness mark phase
 * boundaries. The Wave D version accumulated into one list and reported its
 * maximum, which silently mixed boot tasks into the scroll figure.
 */
const INSTRUMENT = () => {
  const state = { longTasks: [], marks: {} };
  window.__PERF__ = state;

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push({
          start: Number(entry.startTime.toFixed(1)),
          end: Number((entry.startTime + entry.duration).toFixed(1)),
          dur: Number(entry.duration.toFixed(1)),
          name: entry.name,
          attribution: (entry.attribution ?? []).map((a) => ({
            containerType: a.containerType,
            containerName: a.containerName,
            containerSrc: a.containerSrc,
          })),
        });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    state.longTaskUnsupported = true;
  }

  window.__PERF_MARK__ = (name) => {
    state.marks[name] = Number(performance.now().toFixed(1));
  };
};

async function cdpMetrics(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const pick = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
  return {
    TaskDuration: pick("TaskDuration"),
    ScriptDuration: pick("ScriptDuration"),
    LayoutDuration: pick("LayoutDuration"),
    RecalcStyleDuration: pick("RecalcStyleDuration"),
    LayoutCount: pick("LayoutCount"),
    RecalcStyleCount: pick("RecalcStyleCount"),
  };
}

function metricsDelta(before, after) {
  const out = {};
  for (const key of Object.keys(before)) {
    const value = after[key] - before[key];
    out[key] = key.endsWith("Duration") ? Number((value * 1000).toFixed(1)) : value;
  }
  return out;
}

// ------------------------------------------------------------------ scrolls

/** The Wave D harness scroll: a tight programmatic loop. */
async function syntheticScroll(page) {
  await page.evaluate(async () => {
    window.__PERF_MARK__("scrollStart");
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.__PERF_MARK__("scrollEnd");
  });
}

/**
 * A visitor-shaped scroll: real wheel events through the input pipeline, at a
 * human cadence. This is the path that the 50 ms budget is actually about.
 */
async function naturalScroll(page) {
  await page.evaluate(() => window.__PERF_MARK__("scrollStart"));
  const height = await page.evaluate(() => document.body.scrollHeight);
  const viewport = await page.evaluate(() => window.innerHeight);
  const steps = Math.ceil(height / (viewport * 0.6));

  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, viewport * 0.6);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.__PERF_MARK__("scrollEnd"));
}

// ---------------------------------------------------------------- scenarios

async function runScenario(browser, options) {
  const {
    label,
    scroll = syntheticScroll,
    diagnostics = true,
    reducedMotion = false,
    waitForSettle = true,
    device = null,
    cpuRate = CPU_RATE,
  } = options;

  const context = await browser.newContext({
    ...(device ?? { viewport: { width: 1440, height: 900 } }),
    ...(reducedMotion ? { reducedMotion: "reduce" } : {}),
  });
  const page = await context.newPage();
  await page.addInitScript(INSTRUMENT);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (cpuRate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });

  const url = diagnostics ? `${BASE_URL}/?diagnostics=1` : `${BASE_URL}/`;
  await page.goto(url, { waitUntil: "load" });

  if (waitForSettle) {
    await page.waitForFunction(
      () => document.documentElement.dataset["heroPhase"] === "settled",
      null,
      { timeout: 30_000 },
    );
    await page.evaluate(() => window.__PERF_MARK__("settled"));
  }

  const before = await cdpMetrics(cdp);
  await scroll(page);
  const after = await cdpMetrics(cdp);

  const perf = await page.evaluate(() => window.__PERF__);
  await context.close();

  const scrollStart = perf.marks.scrollStart ?? 0;
  const scrollEnd = perf.marks.scrollEnd ?? Number.MAX_SAFE_INTEGER;

  // A task counts as "during scroll" only if it overlaps the scroll window.
  const inScroll = perf.longTasks.filter((t) => t.end > scrollStart && t.start < scrollEnd);
  const beforeScroll = perf.longTasks.filter((t) => t.end <= scrollStart);

  const max = (list) => list.reduce((m, t) => Math.max(m, t.dur), 0);

  return {
    label,
    scrollWindowMs: Number((scrollEnd - scrollStart).toFixed(1)),
    marks: perf.marks,
    allLongTasks: perf.longTasks.length,
    longTasksBeforeScroll: beforeScroll.length,
    longestBeforeScrollMs: max(beforeScroll),
    longTasksDuringScroll: inScroll.length,
    longestDuringScrollMs: max(inScroll),
    overBudgetDuringScroll: inScroll.filter((t) => t.dur > LONG_TASK_MS).length,
    lifetimeLongestMs: max(perf.longTasks),
    duringScrollDetail: inScroll,
    beforeScrollDetail: beforeScroll,
    cdpDeltaDuringScroll: metricsDelta(before, after),
  };
}

// -------------------------------------------------------------------- trace

/**
 * Captures a real trace over the scroll window and aggregates by event name.
 * This is what turns "probably style recalc" into evidence.
 */
async function traceScroll(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(INSTRUMENT);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
  await page.goto(`${BASE_URL}/?diagnostics=1`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.documentElement.dataset["heroPhase"] === "settled",
    null,
    { timeout: 30_000 },
  );

  const events = [];
  cdp.on("Tracing.dataCollected", ({ value }) => events.push(...value));

  await cdp.send("Tracing.start", {
    traceConfig: {
      includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"],
    },
  });

  await syntheticScroll(page);

  const finished = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.end");
  await finished;

  const perf = await page.evaluate(() => window.__PERF__);
  await context.close();

  // Aggregate complete ('X') events by name: total duration and count.
  const byName = new Map();
  for (const e of events) {
    if (e.ph !== "X" || typeof e.dur !== "number") continue;
    const entry = byName.get(e.name) ?? { name: e.name, count: 0, totalMs: 0, maxMs: 0 };
    const ms = e.dur / 1000;
    entry.count += 1;
    entry.totalMs = Number((entry.totalMs + ms).toFixed(2));
    entry.maxMs = Math.max(entry.maxMs, Number(ms.toFixed(2)));
    byName.set(e.name, entry);
  }

  const top = [...byName.values()].sort((a, b) => b.totalMs - a.totalMs).slice(0, 25);
  const longestTasks = [...byName.values()]
    .filter((e) => e.name === "RunTask" || e.name === "EventDispatch")
    .sort((a, b) => b.maxMs - a.maxMs);

  return {
    method:
      "CDP Tracing over the synthetic scroll window only, CPU 4x. Complete ('X') events " +
      "aggregated by name.",
    totalTraceEvents: events.length,
    scrollWindowMs: Number(
      ((perf.marks.scrollEnd ?? 0) - (perf.marks.scrollStart ?? 0)).toFixed(1),
    ),
    topByTotalDuration: top,
    taskLikeEvents: longestTasks,
  };
}

// --------------------------------------------------------------------- main

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  try {
    // --- Step 1: reproduction distribution -------------------------------
    console.log("step 1 — reproducing the Wave D scenario 6x");
    const runs = [];
    for (let i = 1; i <= 6; i += 1) {
      const result = await runScenario(browser, { label: `run-${i}` });
      runs.push(result);
      console.log(
        `  run-${i}  lifetime-max ${result.lifetimeLongestMs}ms  ` +
          `during-scroll-max ${result.longestDuringScrollMs}ms  ` +
          `(${result.longTasksDuringScroll} tasks in window, ` +
          `${result.longTasksBeforeScroll} before)`,
      );
    }

    const lifetime = runs.map((r) => r.lifetimeLongestMs).sort((a, b) => a - b);
    const during = runs.map((r) => r.longestDuringScrollMs).sort((a, b) => a - b);
    const median = (a) =>
      a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;

    // --- Step 3: isolation ------------------------------------------------
    console.log("step 3 — isolating");
    const scenarios = [];
    const add = async (opts) => {
      const r = await runScenario(browser, opts);
      scenarios.push(r);
      console.log(
        `  ${r.label.padEnd(34)} during-scroll-max ${String(r.longestDuringScrollMs).padStart(6)}ms  ` +
          `over-budget ${r.overBudgetDuringScroll}`,
      );
    };

    await add({ label: "synthetic scroll, settled", scroll: syntheticScroll });
    await add({ label: "natural wheel scroll, settled", scroll: naturalScroll });
    await add({ label: "natural wheel, hero playing", scroll: naturalScroll, waitForSettle: false });
    await add({ label: "synthetic, hero playing", scroll: syntheticScroll, waitForSettle: false });
    await add({ label: "reduced motion, natural", scroll: naturalScroll, reducedMotion: true });
    await add({ label: "diagnostics OFF, natural", scroll: naturalScroll, diagnostics: false });
    await add({ label: "diagnostics ON, natural", scroll: naturalScroll, diagnostics: true });
    await add({
      label: "mobile Pixel 5, natural",
      scroll: naturalScroll,
      device: devices["Pixel 5"],
    });
    await add({ label: "no CPU throttle, natural", scroll: naturalScroll, cpuRate: 1 });

    // --- Step 2: trace ----------------------------------------------------
    console.log("step 2 — capturing trace");
    const trace = await traceScroll(browser);
    console.log(`  ${trace.totalTraceEvents} trace events over ${trace.scrollWindowMs}ms`);

    await writeFile(
      resolve(OUT, "run-distribution.json"),
      `${JSON.stringify(
        {
          method:
            `Wave D scenario repeated 6x: desktop 1440x900, CPU ${CPU_RATE}x, diagnostics on, ` +
            "hero settled, synthetic full-page scroll. Long tasks classified by whether they " +
            "overlap the scroll window.",
          budgetMs: LONG_TASK_MS,
          lifetimeLongest: {
            note:
              "What Wave D actually reported: the maximum long task over the whole page " +
              "lifetime, including boot.",
            runs: runs.map((r) => r.lifetimeLongestMs),
            median: median(lifetime),
            max: Math.max(...lifetime),
          },
          duringScrollOnly: {
            note: "Long tasks that overlap the scroll window — what the budget is about.",
            runs: runs.map((r) => r.longestDuringScrollMs),
            median: median(during),
            max: Math.max(...during),
          },
          runs,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeFile(
      resolve(OUT, "before-after.json"),
      `${JSON.stringify({ method: "Isolation scenarios, CPU 4x unless stated.", scenarios }, null, 2)}\n`,
      "utf8",
    );

    await writeFile(resolve(OUT, "trace-summary.json"), `${JSON.stringify(trace, null, 2)}\n`, "utf8");

    console.log("\nwritten to evidence/wave-d/scroll-performance/");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

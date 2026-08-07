/**
 * Wave D.2 — early interaction responsiveness.
 *
 * Wave D reported "CTA available at 64 ms". That figure came from reading
 * `getBoundingClientRect()` — it measured *layout presence*, not the ability
 * to respond. Meanwhile a real boot long task runs 102–174 ms at 4x CPU.
 *
 * This script settles whether a click landing in that window is served or
 * queued, using the Event Timing API rather than inference:
 *
 *   input delay = processingStart - startTime
 *
 * `startTime` is when the browser received the input; `processingStart` is
 * when a handler actually began. The gap is exactly how long the visitor
 * waited, and it is measured by the browser, not by this script.
 *
 * Clicks are dispatched through CDP `Input.dispatchMouseEvent`, so they travel
 * the real input pipeline. A synthetic `element.click()` would bypass it and
 * report a delay of zero no matter how busy the main thread was.
 *
 * All timestamps compared here are page-relative (`performance.now()`), so the
 * Node-side scheduling jitter never enters an arithmetic result. The requested
 * time is reported only as intent.
 */

import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-d/early-interaction");
const BASE_URL = process.env.STUDY_A_URL ?? "http://127.0.0.1:4184";

const TARGETS_MS = [50, 75, 100, 125, 150, 200, 250];
const REPEATS = 5;

/**
 * Installed before any page script runs, so the observers exist before the
 * bundle parses — which is the window under investigation.
 */
const INSTRUMENT = () => {
  const state = {
    firstInput: null,
    events: [],
    longTasks: [],
    handlerAt: null,
    hashChangeAt: null,
    visibleAt: null,
    focusableAt: null,
    scriptBootAt: null,
  };
  window.__EI__ = state;

  // `first-input` reports the first interaction regardless of duration. The
  // `event` type silently drops anything under a 16 ms threshold, so it cannot
  // be relied on to observe a fast click.
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (state.firstInput) continue;
        state.firstInput = {
          name: e.name,
          startTime: Number(e.startTime.toFixed(1)),
          processingStart: Number(e.processingStart.toFixed(1)),
          processingEnd: Number(e.processingEnd.toFixed(1)),
          duration: Number(e.duration.toFixed(1)),
          inputDelayMs: Number((e.processingStart - e.startTime).toFixed(1)),
          processingMs: Number((e.processingEnd - e.processingStart).toFixed(1)),
        };
      }
    }).observe({ type: "first-input", buffered: true });
  } catch {
    state.firstInputUnsupported = true;
  }

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        state.longTasks.push({
          start: Number(e.startTime.toFixed(1)),
          end: Number((e.startTime + e.duration).toFixed(1)),
          dur: Number(e.duration.toFixed(1)),
        });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    state.longTaskUnsupported = true;
  }

  // Capture-phase listener attached at document start: the earliest moment
  // application-independent JavaScript can observe the click.
  document.addEventListener(
    "click",
    () => {
      if (state.handlerAt === null) state.handlerAt = Number(performance.now().toFixed(1));
    },
    { capture: true },
  );

  window.addEventListener("hashchange", () => {
    if (state.hashChangeAt === null) state.hashChangeAt = Number(performance.now().toFixed(1));
  });

  /**
   * Polls for the CTA having layout. rAF cannot run during a long task, so
   * this reports the first *observable* moment rather than the true paint
   * time — which is stated in the evidence rather than glossed over.
   */
  const poll = () => {
    const cta = document.querySelector('a[href="#product"]');
    if (cta) {
      const rect = cta.getBoundingClientRect();
      if (state.visibleAt === null && rect.width > 0 && rect.height > 0) {
        state.visibleAt = Number(performance.now().toFixed(1));
      }
      // An anchor with href is focusable as soon as it is parsed and laid out.
      if (state.focusableAt === null && rect.width > 0 && cta.tabIndex >= 0) {
        state.focusableAt = Number(performance.now().toFixed(1));
      }
    }
    if (state.visibleAt === null || state.focusableAt === null) requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);

  // When the application's own boot finished wiring up.
  const markBoot = () => {
    if (state.scriptBootAt === null && document.documentElement.dataset.js === "true") {
      state.scriptBootAt = Number(performance.now().toFixed(1));
      return;
    }
    if (state.scriptBootAt === null) requestAnimationFrame(markBoot);
  };
  requestAnimationFrame(markBoot);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Warm run: find where the CTA sits, so clicks can be aimed without querying a busy page. */
async function locateCta(browser, contextOptions, url) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  const box = await page.getByRole("link", { name: "See a real system" }).boundingBox();
  await context.close();
  if (!box) throw new Error("CTA not found during warm-up");
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

async function trial(browser, options) {
  const { targetMs, cpuRate, diagnostics, reducedMotion, device, cta } = options;

  const context = await browser.newContext({
    ...(device ?? { viewport: { width: 1440, height: 900 } }),
    ...(reducedMotion ? { reducedMotion: "reduce" } : {}),
  });
  const page = await context.newPage();
  await page.addInitScript(INSTRUMENT);

  const cdp = await context.newCDPSession(page);
  if (cpuRate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });

  const url = diagnostics ? `${BASE_URL}/?diagnostics=1` : `${BASE_URL}/`;

  // `commit` returns as soon as navigation is committed, so the clock starts
  // before the document has finished parsing.
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "commit" });

  const elapsed = Date.now() - t0;
  if (elapsed < targetMs) await sleep(targetMs - elapsed);
  const dispatchedAt = Date.now() - t0;

  /**
   * A real input event through the browser's own pipeline.
   *
   * Touch-emulated contexts need touch events: a raw mouse dispatch is still
   * *received* (first-input records it, so the delay measurement is valid) but
   * it does not activate a link, because Chromium routes activation through
   * the touch path when `hasTouch` is set. Measured directly: a mouse dispatch
   * on Pixel 5 leaves `location.hash` empty while a touch dispatch navigates.
   * Using the wrong one made every mobile trial report "no navigation" and
   * looked like a broken CTA.
   */
  const touch = Boolean(device?.hasTouch);
  if (touch) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cta.x, y: cta.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: cta.x,
      y: cta.y,
      button: "left",
      clickCount: 1,
    });
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: cta.x,
      y: cta.y,
      button: "left",
      clickCount: 1,
    });
  }

  // Let the page finish booting and settle so the observers report.
  await page.waitForLoadState("load").catch(() => {});
  await sleep(1200);

  const state = await page.evaluate(() => window.__EI__);
  const hash = await page.evaluate(() => window.location.hash);
  await context.close();

  const fi = state.firstInput;
  const overlap = fi
    ? state.longTasks.find((t) => fi.startTime >= t.start && fi.startTime <= t.end)
    : undefined;

  return {
    requested_click_time: targetMs,
    node_dispatch_offset_ms: dispatchedAt,
    actual_event_dispatch_time: fi ? fi.startTime : null,
    event_delay_ms: fi ? fi.inputDelayMs : null,
    handler_start_time: state.handlerAt,
    navigation_or_action_time: state.hashChangeAt,
    boot_long_task_overlap: overlap
      ? { start: overlap.start, end: overlap.end, dur: overlap.dur, waitedMs: Number((overlap.end - fi.startTime).toFixed(1)) }
      : null,
    result: fi ? (hash === "#product" ? "navigated" : "click seen, no navigation") : "no input recorded",
    hash,
    ctaVisibleAt: state.visibleAt,
    ctaFocusableAt: state.focusableAt,
    scriptBootAt: state.scriptBootAt,
    longTasks: state.longTasks,
  };
}

const num = (a) => a.filter((v) => typeof v === "number" && Number.isFinite(v));
const median = (a) => {
  const s = num(a).sort((x, y) => x - y);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : Number(((s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(1));
};
const max = (a) => (num(a).length ? Math.max(...num(a)) : null);

async function sweep(browser, scenario) {
  const { label, cpuRate = 4, diagnostics = true, reducedMotion = false, device = null } = scenario;
  const url = diagnostics ? `${BASE_URL}/?diagnostics=1` : `${BASE_URL}/`;
  const contextOptions = {
    ...(device ?? { viewport: { width: 1440, height: 900 } }),
    ...(reducedMotion ? { reducedMotion: "reduce" } : {}),
  };
  const cta = await locateCta(browser, contextOptions, url);

  const points = [];
  for (const targetMs of TARGETS_MS) {
    const trials = [];
    for (let i = 0; i < REPEATS; i += 1) {
      trials.push(
        await trial(browser, { targetMs, cpuRate, diagnostics, reducedMotion, device, cta }),
      );
    }
    const delays = trials.map((t) => t.event_delay_ms);
    const point = {
      requested_click_time: targetMs,
      repetitions: trials.length,
      event_delay_ms: { median: median(delays), max: max(delays), all: delays },
      navigated: trials.filter((t) => t.result === "navigated").length,
      clicksInsideBootTask: trials.filter((t) => t.boot_long_task_overlap !== null).length,
      trials,
    };
    points.push(point);
    console.log(
      `  ${label.padEnd(26)} t=${String(targetMs).padStart(3)}ms  ` +
        `delay median ${String(point.event_delay_ms.median).padStart(6)}ms  ` +
        `max ${String(point.event_delay_ms.max).padStart(6)}ms  ` +
        `in-boot ${point.clicksInsideBootTask}/${trials.length}  ` +
        `navigated ${point.navigated}/${trials.length}`,
    );
  }

  const allDelays = points.flatMap((p) => p.event_delay_ms.all);
  const visible = points.flatMap((p) => p.trials.map((t) => t.ctaVisibleAt));
  const focusable = points.flatMap((p) => p.trials.map((t) => t.ctaFocusableAt));
  const boot = points.flatMap((p) => p.trials.flatMap((t) => t.longTasks.map((l) => l.dur)));

  return {
    label,
    conditions: {
      cpuRate,
      diagnostics,
      reducedMotion,
      viewport: device ? "Pixel 5 (393px)" : "1440x900",
    },
    cta_visible_ms: { median: median(visible), max: max(visible) },
    cta_focusable_ms: { median: median(focusable), max: max(focusable) },
    early_input_delay_ms: {
      median: median(allDelays),
      worst: max(allDelays),
    },
    bootLongTaskMs: { median: median(boot), max: max(boot), count: boot.length },
    points,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const mobileOnly = process.argv.includes("--mobile-only");

  try {
    if (mobileOnly) {
      console.log("mobile 393px, 4x CPU, diagnostics OFF (touch dispatch)");
      const mobile = await sweep(browser, {
        label: "mobile 393 4x",
        diagnostics: false,
        device: devices["Pixel 5"],
      });
      const method =
        "Clicks dispatched through CDP Input.dispatchTouchEvent (touch-emulated context). Input " +
        "delay measured by the browser via PerformanceEventTiming first-input. Laboratory " +
        "measurement, single machine.";
      await writeFile(
        resolve(OUT, "mobile-393.json"),
        `${JSON.stringify({ method, ...mobile }, null, 2)}\n`,
        "utf8",
      );
      console.log("\nmobile-393.json rewritten");
      return;
    }

    console.log("4x CPU, diagnostics ON (the Wave D.1 configuration)");
    const cpu4x = await sweep(browser, { label: "4x CPU diagnostics ON" });

    console.log("\n4x CPU, diagnostics OFF (what a visitor actually loads)");
    const cpu4xNoDiag = await sweep(browser, {
      label: "4x CPU diagnostics OFF",
      diagnostics: false,
    });

    console.log("\n1x CPU, diagnostics OFF");
    const cpu1x = await sweep(browser, {
      label: "1x CPU diagnostics OFF",
      cpuRate: 1,
      diagnostics: false,
    });

    console.log("\nreduced motion, 4x CPU, diagnostics OFF");
    const reduced = await sweep(browser, {
      label: "reduced motion 4x",
      diagnostics: false,
      reducedMotion: true,
    });

    console.log("\nmobile 393px, 4x CPU, diagnostics OFF");
    const mobile = await sweep(browser, {
      label: "mobile 393 4x",
      diagnostics: false,
      device: devices["Pixel 5"],
    });

    const method =
      "Clicks dispatched through CDP Input.dispatchMouseEvent (real input pipeline). Input delay " +
      "measured by the browser via PerformanceEventTiming first-input: processingStart - startTime. " +
      "All arithmetic uses page-relative timestamps. Laboratory measurement, single machine.";

    await writeFile(
      resolve(OUT, "cpu-4x.json"),
      `${JSON.stringify({ method, diagnosticsOn: cpu4x, diagnosticsOff: cpu4xNoDiag, unthrottled: cpu1x }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      resolve(OUT, "reduced-motion.json"),
      `${JSON.stringify({ method, ...reduced }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      resolve(OUT, "mobile-393.json"),
      `${JSON.stringify({ method, ...mobile }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      resolve(OUT, "timing-distribution.json"),
      `${JSON.stringify(
        {
          method,
          targetsMs: TARGETS_MS,
          repetitionsPerPoint: REPEATS,
          scenarios: [cpu4x, cpu4xNoDiag, cpu1x, reduced, mobile].map((s) => ({
            label: s.label,
            conditions: s.conditions,
            cta_visible_ms: s.cta_visible_ms,
            cta_focusable_ms: s.cta_focusable_ms,
            early_input_delay_ms: s.early_input_delay_ms,
            bootLongTaskMs: s.bootLongTaskMs,
            byTarget: s.points.map((p) => ({
              requested_click_time: p.requested_click_time,
              delayMedian: p.event_delay_ms.median,
              delayMax: p.event_delay_ms.max,
              clicksInsideBootTask: p.clicksInsideBootTask,
              navigated: p.navigated,
            })),
          })),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log("\nwritten to evidence/wave-d/early-interaction/");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

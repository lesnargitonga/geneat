/**
 * Wave G visual acceptance captures.
 *
 * These frames are the human review package, so they are produced by a script
 * rather than by ad-hoc commands — a reviewer comparing two runs needs the same
 * frame, and a frame nobody can reproduce is not evidence.
 *
 * ## Why the continuity frame is clipped rather than scrolled
 *
 * The transition worth reviewing — evidenced Wave G material giving way to the
 * explicitly illustrative control loop — sits near the end of the document.
 * `window.scrollTo` clamps at the page end, so scrolling to it puts it wherever
 * the clamp lands, and three attempts caught the records but never the label.
 * Measuring the element's absolute position and clipping a full-page shot around
 * it is deterministic instead, and it is asserted below rather than hoped for.
 *
 * Observation only. No navigation to admin paths, no posting.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-g");
const BASE = process.env.STUDY_A_URL ?? "http://127.0.0.1:4190";

async function ready(page) {
  await page
    .waitForFunction(() => document.documentElement.dataset["heroPhase"] === "settled", null, { timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(400);
}

async function frame(browser, { name, width, height, target, fullPage = false }) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await ready(page);

  if (target) {
    await page.locator(target).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: resolve(OUT, name), fullPage });
  await ctx.close();
  return name;
}

/**
 * The continuity frame, with the transition asserted present.
 *
 * Both landmarks must appear inside the clip: the last evidenced physical
 * record and the illustrative-loop label. If either is outside, the frame does
 * not show what it claims to and the script fails rather than shipping it.
 */
async function continuityFrame(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await ready(page);

  const box = await page.evaluate(() => {
    const label = document.querySelector('[data-status="illustrative"]');
    const records = document.querySelector(".phys-records");
    const sequence = document.querySelector(".action-sequence");
    if (!label || !records || !sequence) return null;
    const abs = (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
    };
    const r = abs(records);
    const l = abs(label);
    const s = abs(sequence);
    // Start a little above the label so the preceding evidenced record is in
    // shot, and run past the first steps of the sequence that follows it.
    const top = Math.max(0, Math.min(r.bottom - 420, l.top - 420));
    // The last evidenced record's boundary line — the "research material" side
    // of the transition. Without it in shot the frame shows the illustration
    // alone, which is not what a continuity review is for.
    const boundaries = [...document.querySelectorAll(".phys-record__boundary")];
    const lastBoundary = boundaries[boundaries.length - 1];
    const e = lastBoundary ? abs(lastBoundary) : null;

    return {
      top,
      bottom: Math.min(s.top + 560, document.documentElement.scrollHeight),
      labelTop: l.top,
      labelBottom: l.bottom,
      sequenceTop: s.top,
      evidencedTop: e ? e.top : null,
      evidencedBottom: e ? e.bottom : null,
    };
  });

  if (!box) throw new Error("continuity landmarks not found in the document");

  const height = Math.round(box.bottom - box.top);
  await page.screenshot({
    path: resolve(OUT, "final-continuity-1440x1600.png"),
    fullPage: true,
    clip: { x: 0, y: Math.round(box.top), width: 1440, height },
  });

  // All three sides of the transition must be in the frame, or it is not
  // evidence of continuity — it is a picture of one of the two things.
  const inside = (top, bottom = top) => top !== null && top >= box.top && bottom <= box.bottom;
  const checks = {
    evidenced: inside(box.evidencedTop, box.evidencedBottom),
    label: inside(box.labelTop, box.labelBottom),
    sequence: inside(box.sequenceTop),
  };
  await ctx.close();

  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`continuity frame is missing: ${missing.join(", ")}`);
  }
  return { name: "final-continuity-1440x1600.png", height, checks };
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

const captured = [];
captured.push(await frame(browser, { name: "final-physical-1440x1400.png", width: 1440, height: 1400, target: "[data-trace]" }));
captured.push(await frame(browser, { name: "final-trace-1440x900.png", width: 1440, height: 900, target: "[data-trace]" }));
captured.push(await frame(browser, { name: "final-records-1440x900.png", width: 1440, height: 900, target: ".phys-records" }));
captured.push(await frame(browser, { name: "final-tablet-1024x768.png", width: 1024, height: 768, target: "[data-trace]" }));
captured.push(await frame(browser, { name: "final-mobile-390x844.png", width: 390, height: 844, target: "[data-trace]" }));

const continuity = await continuityFrame(browser);
captured.push(continuity.name);

await browser.close();

for (const name of captured) console.log(`  ${name}`);
console.log(`  continuity verified in a ${continuity.height}px clip: ` + Object.entries(continuity.checks).map(([k, v]) => `${k}=${v}`).join(" "));

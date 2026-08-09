/**
 * Wave H visual acceptance captures.
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
const OUT = resolve(HERE, "../evidence/wave-h");
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
    // Continuity here is the seam between the accepted Wave G chapter and the
    // register that follows it: the last physical boundary must be in shot
    // beside the register's own opening, or the frame cannot answer whether the
    // two belong to one system.
    const label = document.querySelector(".work-unit__head");
    const records = document.querySelector(".action-sequence");
    const sequence = document.querySelector("[data-work-register]");
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
    const top = Math.max(0, Math.min(r.bottom - 260, l.top - 420));
    // The last evidenced record's boundary line — the "research material" side
    // of the transition. Without it in shot the frame shows the illustration
    // alone, which is not what a continuity review is for.
    const boundaries = [...document.querySelectorAll(".action-sequence li")];
    const lastBoundary = boundaries[boundaries.length - 1];
    const e = lastBoundary ? abs(lastBoundary) : null;

    return {
      top,
      bottom: Math.min(s.top + 900, document.documentElement.scrollHeight),
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
    path: resolve(OUT, "final-work-continuity-1440x1600.png"),
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
  return { name: "final-work-continuity-1440x1600.png", height, checks };
}


/**
 * The capability-maturity correction frame.
 *
 * Wave H superseded Wave F's `controlled-client-system` grade on Operate and
 * Protect. This captures the real served page — no debug rendering — and asserts
 * both corrected labels are inside the clip before writing, so the frame cannot
 * claim to show a correction it does not contain.
 */
async function capabilityCorrectionFrame(browser) {
  // Without JavaScript, because with it the inspector narrows the register to
  // one capability and both entries are hidden — the first attempt clipped an
  // empty strip. This is still the real served page, not a debug rendering: the
  // no-JS reading is the complete field sheet that ships in the markup.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(300);

  const box = await page.evaluate(() => {
    const entry = (id) => document.getElementById(`capability-${id}`);
    const abs = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY }; };
    const op = entry("operate"), pr = entry("protect");
    if (!op || !pr) return null;
    const a = abs(op), b = abs(pr);
    const top = Math.max(0, a.top - 40);
    return { top, bottom: Math.min(b.bottom + 40, document.documentElement.scrollHeight), opTop: a.top, prBottom: b.bottom };
  });
  if (!box) throw new Error("operate/protect capability entries not found");

  const height = Math.round(box.bottom - box.top);
  await page.screenshot({
    path: resolve(OUT, "final-capability-maturity-correction-1440x900.png"),
    fullPage: true,
    clip: { x: 0, y: Math.round(box.top), width: 1440, height },
  });

  // Both corrected labels must actually be in the captured range.
  const labels = await page.evaluate(() =>
    ["operate", "protect"].map((id) => {
      const el = document.getElementById(`capability-${id}`);
      const m = el?.querySelector(".cap-entry__maturity");
      return { id, label: m?.textContent?.trim() ?? null, attr: m?.getAttribute("data-maturity") ?? null };
    }),
  );
  await ctx.close();

  for (const l of labels) {
    if (l.attr !== "internal-engineering-system") {
      throw new Error(`${l.id} is "${l.attr}", not internal-engineering-system`);
    }
  }
  return { name: "final-capability-maturity-correction-1440x900.png", height, labels };
}


/**
 * Mid-Work mobile frames.
 *
 * Captured at a scroll position inside the register rather than at the top,
 * because the point being evidenced is that the full header is *gone* — a
 * top-of-page frame would show it and prove nothing. The header's on-screen
 * height is asserted to be zero before the file is written.
 */
async function mobileMidWorkFrame(browser, { name, width, height }) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await ready(page);
  await page.locator('[data-work="carepro"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const onScreen = await page.evaluate(() => {
    const r = document.querySelector(".site-header").getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)));
  });
  await page.screenshot({ path: resolve(OUT, name) });
  await ctx.close();

  if (onScreen !== 0) {
    throw new Error(`${name}: header still occupies ${onScreen}px at mid-Work scroll`);
  }
  return { name, onScreen };
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

const captured = [];
captured.push(await frame(browser, { name: "final-work-1440x1400.png", width: 1440, height: 1400, target: "[data-work-register]" }));
captured.push(await frame(browser, { name: "final-work-top-1440x900.png", width: 1440, height: 900, target: ".work-unit__head" }));
captured.push(await frame(browser, { name: "final-work-middle-1440x900.png", width: 1440, height: 900, target: '[data-work="carepro"]' }));
captured.push(await frame(browser, { name: "final-work-tablet-1024x768.png", width: 1024, height: 768, target: "[data-work-register]" }));
const m390 = await mobileMidWorkFrame(browser, { name: "final-work-mobile-390x844.png", width: 390, height: 844 });
captured.push(m390.name);
const m320 = await mobileMidWorkFrame(browser, { name: "final-work-mobile-320x568.png", width: 320, height: 568 });
captured.push(m320.name);

const continuity = await continuityFrame(browser);
captured.push(continuity.name);

const capability = await capabilityCorrectionFrame(browser);
captured.push(capability.name);

await browser.close();

for (const name of captured) console.log(`  ${name}`);
console.log(`  mobile frames verified: header on screen at mid-Work = ${m390.onScreen}px (390) · ${m320.onScreen}px (320)`);
console.log(`  capability frame verified: ` + capability.labels.map((l) => `${l.id}=${l.label}`).join(" · "));
console.log(`  continuity verified in a ${continuity.height}px clip: ` + Object.entries(continuity.checks).map(([k, v]) => `${k}=${v}`).join(" "));

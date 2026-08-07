/**
 * Wave C evidence capture.
 *
 * States are selected by URL (`?signal=<id>`) rather than by clicking, so each
 * screenshot is of a deterministically requested state — a capture script that
 * simulates eight clicks records the clicking as much as the states.
 *
 * The grayscale contact sheet exists to prove the eight states are
 * distinguishable without colour. If two states are indistinguishable in
 * greyscale, the composition is relying on hue to carry meaning, which §7.17
 * forbids.
 *
 * Run against a live `npm run preview`:
 *   npm run build && npm run preview &
 *   node scripts/capture-wave-c.mjs
 */

import { chromium, devices } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-c");
const BASE_URL = process.env.STUDY_A_URL ?? "http://127.0.0.1:4184";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE_STATES = ["idea", "human-review", "act", "prove"];
const REDUCED_STATES = ["human-review", "prove"];

function url(stateId, extra = "") {
  return `${BASE_URL}/?diagnostics=1&signal=${stateId}${extra}`;
}

async function open(context, stateId) {
  const page = await context.newPage();
  await page.goto(url(stateId), { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.__STUDY_A__ !== "undefined");
  await page.waitForFunction(
    (id) => window.__STUDY_A__.signalState() === id,
    stateId,
    { timeout: 10_000 },
  );
  // Let the bounded transition finish so the frame is the settled state.
  await page.waitForTimeout(700);
  return page;
}

/** Clips to the hero so the signal fills the frame rather than the whole page. */
async function shotStage(page, path) {
  const stage = page.locator(".chapter--hero");
  await stage.screenshot({ path });
}

/**
 * The ordered state list comes from the running application, not from a copy
 * kept beside this script. A second declaration of the sequence would be free
 * to drift from `signal-states.ts`, which is the exact failure the content
 * model exists to prevent.
 */
async function readStateOrder(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/?diagnostics=1`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.__STUDY_A__ !== "undefined");
  const ids = await page.evaluate(() => window.__STUDY_A__.signalStates());
  await page.close();
  return ids.map((id, index) => ({ id, index }));
}

async function main() {
  for (const dir of ["desktop", "mobile", "reduced-motion", "grayscale"]) {
    await mkdir(resolve(OUT, dir), { recursive: true });
  }

  const browser = await chromium.launch();
  const contract = [];

  try {
    // ---------------------------------------------------------- desktop
    const desktop = await browser.newContext({ viewport: DESKTOP });
    const states = await readStateOrder(desktop);
    if (states.length !== 8) {
      throw new Error(`expected 8 signal states, found ${states.length}`);
    }
    const grayscaleShots = [];

    for (const state of states) {
      const page = await open(desktop, state.id);
      const name = `${String(state.index).padStart(2, "0")}-${state.id}.png`;

      // Label is read from the rendered text equivalent, so the filename and
      // the caption both come from the same place the user sees.
      const label = (
        await page.$eval("#signal-text-title", (node) => node.textContent ?? "")
      )
        .split("·")
        .pop()
        .trim();
      await shotStage(page, resolve(OUT, "desktop", name));

      // Record what the page actually rendered, not what the model claims.
      contract.push({
        id: state.id,
        index: state.index,
        label,
        emphasis: await page.$eval("svg[data-signal]", (node) =>
          node.getAttribute("data-emphasis"),
        ),
        activeLayers: await page.$$eval('[data-layer][data-active="true"]', (nodes) =>
          nodes.map((node) => node.getAttribute("data-layer")),
        ),
        activeNodes: await page.$$eval('[data-node][data-active="true"]', (nodes) =>
          nodes.map((node) => node.getAttribute("data-node")),
        ),
        completedSegments: await page.$$eval('[data-segment][data-state="complete"]', (nodes) =>
          nodes.map((node) => node.getAttribute("data-segment")),
        ),
        currentSegment: await page
          .$eval('[data-segment][data-state="current"]', (node) =>
            node.getAttribute("data-segment"),
          )
          .catch(() => null),
        gate: await page
          .$eval('[data-node="gate"]', (node) => node.getAttribute("data-gate"))
          .catch(() => null),
        action: await page
          .$eval('[data-node="act"]', (node) => node.getAttribute("data-action"))
          .catch(() => null),
        viewBox: await page.$eval("svg[data-signal]", (node) => node.getAttribute("viewBox")),
        geometry: await page.evaluate(() => window.__STUDY_A__.signalGeometry()),
        textEquivalent: await page.$eval("[data-signal-text]", (node) =>
          (node.textContent ?? "").replace(/\s+/g, " ").trim(),
        ),
      });

      // Greyscale frame for the contact sheet.
      await page.addStyleTag({ content: "html { filter: grayscale(1) !important; }" });
      await page.waitForTimeout(120);
      const buffer = await page.locator(".chapter--hero").screenshot();
      grayscaleShots.push({ label: `${String(state.index).padStart(2, "0")} ${label}`, buffer });

      console.log(`  desktop  ${name}`);
      await page.close();
    }

    await buildContactSheet(browser, grayscaleShots);
    await desktop.close();

    // ----------------------------------------------------------- mobile
    const mobile = await browser.newContext({ ...devices["Pixel 5"] });
    for (const id of MOBILE_STATES) {
      const page = await open(mobile, id);
      await shotStage(page, resolve(OUT, "mobile", `${id}.png`));
      console.log(`  mobile   ${id}.png`);
      await page.close();
    }
    await mobile.close();

    // --------------------------------------------------- reduced motion
    const reduced = await browser.newContext({ viewport: DESKTOP, reducedMotion: "reduce" });
    for (const id of REDUCED_STATES) {
      const page = await open(reduced, id);
      await shotStage(page, resolve(OUT, "reduced-motion", `${id}.png`));
      console.log(`  reduced  ${id}.png`);
      await page.close();
    }
    await reduced.close();

    await writeFile(
      resolve(OUT, "signal-state-contract.json"),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), states: contract }, null, 2)}\n`,
      "utf8",
    );
    console.log("  contract signal-state-contract.json");
  } finally {
    await browser.close();
  }
}

/**
 * Composes the eight greyscale frames into one sheet.
 *
 * Built as an HTML page with the images embedded as data URIs and screenshotted
 * — no image library, no new dependency, and the labels come out as real text.
 */
async function buildContactSheet(browser, shots) {
  const cells = shots
    .map(
      (shot) => `
        <figure>
          <img src="data:image/png;base64,${shot.buffer.toString("base64")}" alt="${shot.label}" />
          <figcaption>${shot.label}</figcaption>
        </figure>`,
    )
    .join("");

  const html = `<!doctype html>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; padding: 24px; background: #111; font: 13px ui-monospace, monospace; }
      h1 { color: #eee; font-size: 15px; margin: 0 0 4px; }
      p { color: #999; margin: 0 0 20px; }
      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
      figure { margin: 0; }
      img { width: 100%; display: block; border: 1px solid #333; }
      figcaption { color: #ccc; padding-top: 6px; letter-spacing: 0.08em; text-transform: uppercase; }
    </style>
    <h1>Lesnar Signal — eight states, greyscale</h1>
    <p>If two states are indistinguishable here, the composition is relying on hue to carry meaning.</p>
    <div class="grid">${cells}</div>`;

  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({
    path: resolve(OUT, "grayscale", "all-states-contact-sheet.png"),
    fullPage: true,
  });
  await context.close();
  console.log("  grayscale all-states-contact-sheet.png");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

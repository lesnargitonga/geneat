/**
 * Captures the Study A evidence screenshots.
 *
 * Run against a live `npm run preview`:
 *
 *   npm run build && npm run preview &
 *   node scripts/capture-evidence.mjs
 *
 * Produces:
 *   evidence/desktop-static.png   1440x900, full page, JavaScript enabled
 *   evidence/mobile-static.png    Pixel 5, full page, JavaScript enabled
 *   evidence/no-js.png            1440x900, full page, JavaScript DISABLED
 *
 * The no-JS capture is the one that matters: it is the visual record of the
 * claim that Study A's story is complete without any script.
 */

import { chromium, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../evidence");
const BASE_URL = process.env.STUDY_A_URL ?? "http://127.0.0.1:4184";

async function capture(browser, { file, contextOptions, url }) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "load" });
  // Settle the rail's initial state transition so captures are deterministic.
  await page.waitForTimeout(600);

  const path = resolve(OUT_DIR, file);
  await page.screenshot({ path, fullPage: true });
  await context.close();

  console.log(`  ${file.padEnd(22)} ${contextOptions.javaScriptEnabled === false ? "JS OFF" : "JS on "}  → evidence/${file}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  try {
    await capture(browser, {
      file: "desktop-static.png",
      contextOptions: { viewport: { width: 1440, height: 900 } },
      url: BASE_URL,
    });

    await capture(browser, {
      file: "mobile-static.png",
      contextOptions: { ...devices["Pixel 5"] },
      url: BASE_URL,
    });

    await capture(browser, {
      file: "no-js.png",
      contextOptions: { viewport: { width: 1440, height: 900 }, javaScriptEnabled: false },
      url: BASE_URL,
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

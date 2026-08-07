import { test, expect } from "@playwright/test";
import { gotoAndReady } from "./helpers";

/**
 * Responsive qualification for the signal at the five required viewports.
 *
 * The rule under test: mobile may use different *geometry*, but state ids,
 * node ids, narrative order, meaning and accessible text are identical. So the
 * assertions deliberately check for sameness of everything except layout.
 */

const VIEWPORTS = [
  { name: "1440x900 desktop", width: 1440, height: 900, geometry: "horizontal" },
  { name: "1024x768 laptop", width: 1024, height: 768, geometry: "horizontal" },
  { name: "768x1024 tablet", width: 768, height: 1024, geometry: "horizontal" },
  { name: "393x851 phone", width: 393, height: 851, geometry: "vertical" },
  { name: "320x568 small phone", width: 320, height: 568, geometry: "vertical" },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoAndReady(page);
    });

    test("uses the expected geometry", async ({ page }) => {
      expect(await page.evaluate(() => window.__STUDY_A__!.signalGeometry())).toBe(
        viewport.geometry,
      );
    });

    test("preserves all eight state ids and their order", async ({ page }) => {
      expect(await page.evaluate(() => window.__STUDY_A__!.signalStates())).toEqual([
        "idea",
        "observe",
        "model",
        "engineer",
        "protect",
        "human-review",
        "act",
        "prove",
      ]);
      await expect(page.locator("[data-signal-state]")).toHaveCount(8);
      await expect(page.locator(".signal-legend li")).toHaveCount(8);
    });

    test("preserves all node ids regardless of geometry", async ({ page }) => {
      for (const node of ["ev-1", "ev-2", "ev-3", "ev-4", "bd-1", "bd-2", "gate", "act"]) {
        await expect(page.locator(`[data-node="${node}"]`)).toHaveCount(1);
      }
    });

    test("preserves the accessible text for a given state", async ({ page }) => {
      await page.evaluate(() => window.__STUDY_A__!.goToSignalState("human-review" as never));
      await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "human-review");

      const panel = page.locator("[data-signal-text]");
      await expect(panel).toContainText("The signal reaches the human gate and stops");
      await expect(panel).toContainText("The gate holds");
      expect(await panel.locator("dt").allTextContents()).toEqual([
        "What happens",
        "Input",
        "Boundary",
        "Output",
      ]);
    });

    test("no horizontal overflow", async ({ page }) => {
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });

    test("every stepper control meets the touch target minimum", async ({ page }) => {
      const buttons = page.locator(".stepper__button");
      const count = await buttons.count();
      expect(count).toBe(10); // Previous + 8 states + Next

      for (let i = 0; i < count; i += 1) {
        const box = await buttons.nth(i).boundingBox();
        expect(box, `stepper button ${i} has no box`).not.toBeNull();
        expect(box!.height, `stepper button ${i} is ${box!.height}px tall`).toBeGreaterThanOrEqual(
          44,
        );
      }
    });

    test("the signal stage is visible and reserves its space", async ({ page }) => {
      const stage = page.locator("[data-stage]");
      const box = await stage.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.width).toBeLessThanOrEqual(viewport.width + 1);
    });

    test("state selection does not scroll the page", async ({ page }) => {
      // The button is brought into view *first*, and the baseline is taken
      // after that. Otherwise this measures Playwright's own scroll-into-view
      // before clicking rather than anything the application does.
      const button = page.locator('[data-signal-state="prove"]');
      await button.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const before = await page.evaluate(() => window.scrollY);

      await button.click();
      await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "prove");
      await page.waitForTimeout(250);

      expect(await page.evaluate(() => window.scrollY)).toBe(before);
    });
  });
}

test.describe("geometry switching", () => {
  test("changing breakpoint preserves state, ids and text", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndReady(page);

    await page.evaluate(() => window.__STUDY_A__!.goToSignalState("protect" as never));
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "protect");
    const desktopText = await page.locator("[data-signal-text]").textContent();
    expect(await page.evaluate(() => window.__STUDY_A__!.signalGeometry())).toBe("horizontal");

    await page.setViewportSize({ width: 393, height: 851 });
    await page.waitForFunction(() => window.__STUDY_A__!.signalGeometry() === "vertical");

    // Geometry changed; nothing else did.
    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe("protect");
    expect(await page.locator("[data-signal-text]").textContent()).toBe(desktopText);
    await expect(page.locator("svg[data-signal]")).toHaveAttribute("data-state", "protect");
    for (const node of ["ev-1", "bd-1", "bd-2", "gate", "act"]) {
      await expect(page.locator(`[data-node="${node}"]`)).toHaveCount(1);
    }
  });
});

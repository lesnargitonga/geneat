import { test, expect } from "@playwright/test";
import { gotoAndReady, settleChapterNavigation } from "./helpers";

/**
 * Desktop and mobile responsive behaviour.
 *
 * Runs under both the `desktop` (1440x900) and `mobile` (Pixel 5) projects.
 * The dossier's rejection conditions include "the mobile experience becomes a
 * static afterthought" — for Study A, where everything is static, the
 * equivalent failure is mobile losing content or usability. Both are asserted.
 */

test.describe("responsive behaviour", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("no horizontal overflow", async ({ page }) => {
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // One pixel of tolerance for sub-pixel rounding on fractional DPRs.
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test("the whole story is present at every viewport", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gen-Eat", exact: true })).toBeVisible();
    await expect(page.locator("[data-stage-id]")).toHaveCount(6);
    await expect(page.locator("[data-action-step]")).toHaveCount(7);
    await expect(page.locator(".signal-legend li")).toHaveCount(8);
    await expect(page.locator(".limitations li")).toHaveCount(6);
    await expect(page.locator("svg[data-signal]")).toBeVisible();
  });

  test("primary call to action is visible and large enough to tap", async ({ page }) => {
    const cta = page.getByRole("link", { name: "See a real system" });
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("chapter links meet the minimum touch target", async ({ page }) => {
    const links = page.locator("[data-chapter-link]");
    const count = await links.count();

    for (let i = 0; i < count; i += 1) {
      const box = await links.nth(i).boundingBox();
      expect(box, `chapter link ${i} has no box`).not.toBeNull();
      expect(box!.height, `chapter link ${i} is only ${box!.height}px tall`).toBeGreaterThanOrEqual(
        44,
      );
    }
  });

  test("chapter anchors navigate correctly", async ({ page }) => {
    for (const id of ["product", "system", "action"]) {
      await page.locator(`[data-chapter-link="${id}"]`).click();
      // Same smooth-scroll overlap as the keyboard path: settle before
      // asserting, and before activating the next link.
      await settleChapterNavigation(page, id);
      await expect(page.locator(`section#${id}`)).toBeInViewport();
    }
  });

  test("the signal stage reserves its space and does not shift layout", async ({ page }) => {
    const stage = page.locator("[data-stage]");
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(0);

    // aspect-ratio reserves the box before paint, so the SVG cannot push
    // content down as it renders. Wave C introduced a second geometry, so
    // either ratio is valid — what must hold is that *some* ratio is reserved.
    const ratio = await stage.evaluate((node) => getComputedStyle(node).aspectRatio);
    expect(["880/460", "360/736"]).toContain(ratio.replace(/\s/g, ""));
  });

  test("proof panels stack rather than overflow on narrow viewports", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");

    const panels = page.locator(".proof");
    const count = await panels.count();
    expect(count).toBe(4);

    const viewport = page.viewportSize();
    for (let i = 0; i < count; i += 1) {
      const box = await panels.nth(i).boundingBox();
      expect(box!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    }
  });
});

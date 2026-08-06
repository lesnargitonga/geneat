import { test, expect } from "@playwright/test";
import { gotoAndReady, state } from "./helpers";

/**
 * Keyboard navigation smoke.
 *
 * Not a full audit — a check that the primary paths are operable without a
 * pointer and that focus goes where the visitor asked it to.
 */

test.describe("keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("the skip link is the first stop and reaches main", async ({ page }) => {
    await page.keyboard.press("Tab");

    const skip = page.locator("a.skip-link");
    await expect(skip).toBeFocused();
    // It must become visible on focus, not stay clipped off-screen.
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("every chapter link is reachable and activates by keyboard", async ({ page }) => {
    for (const id of ["product", "system", "action"]) {
      const link = page.locator(`[data-chapter-link="${id}"]`);
      await link.focus();
      await expect(link).toBeFocused();

      await page.keyboard.press("Enter");
      await expect(page.locator(`section#${id}`)).toBeInViewport();

      // Focus follows the navigation rather than staying in the header —
      // otherwise the next Tab resumes from the rail and the link achieved
      // nothing for a keyboard user.
      await expect(page.locator(`section#${id}`)).toBeFocused();
    }
  });

  test("a section never becomes a permanent tab stop", async ({ page }) => {
    const section = page.locator("section#system");
    await page.locator('[data-chapter-link="system"]').focus();
    await page.keyboard.press("Enter");
    await expect(section).toBeFocused();

    // anchor-focus.ts removes tabindex on blur, so the section does not linger
    // in the tab order after the visitor moves on.
    await page.locator("a.skip-link").focus();
    await expect(section).not.toHaveAttribute("tabindex", "-1");
  });

  test("the Effects radio group is operable with arrow keys", async ({ page }) => {
    const auto = page.getByRole("radio", { name: "Auto" });
    const full = page.getByRole("radio", { name: "Full" });

    await auto.focus();
    await expect(auto).toBeFocused();

    // Native radio-group semantics: arrows move and select.
    await page.keyboard.press("ArrowRight");
    await expect(full).toBeFocused();
    await expect(full).toBeChecked();

    await page.waitForFunction(() => window.__STUDY_A__!.state()["motionMode"] === "full");
    expect((await state(page)).resolvedMotion).toBe("full");
  });

  test("choosing Reduced is reflected on the document", async ({ page }) => {
    const reduced = page.getByRole("radio", { name: "Reduced" });
    await reduced.focus();
    await page.locator('.effects__option:has(input[value="reduced"])').click();

    await expect(reduced).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    expect((await state(page)).resolvedMotion).toBe("reduced");
  });

  test("focus is always visible on interactive elements", async ({ page }) => {
    const cta = page.getByRole("link", { name: "See a real system" });
    await cta.focus();

    const outline = await cta.evaluate((node) => {
      const style = getComputedStyle(node);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });

    expect(outline.style).not.toBe("none");
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });
});

import { test, expect } from "@playwright/test";
import { gotoAndReady, headingLevels, integrityIssues } from "./helpers";

/**
 * Heading order, landmarks, skip link, and content-model integrity —
 * with JavaScript enabled, on both desktop and mobile projects.
 *
 * The no-JS suite proves the baseline is complete. This suite proves the
 * enhancement did not damage it.
 */

test.describe("document structure", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("the content model and the markup agree", async ({ page }) => {
    // The in-page integrity check compares content.ts against the DOM: every
    // declared stage, action step, chapter and parity count. If this reports
    // anything, Study A has drifted from its own model — and therefore from
    // the parity baseline shared with Study B.
    const issues = await integrityIssues(page);
    expect(issues, JSON.stringify(issues, null, 2)).toHaveLength(0);
  });

  test("heading order is well formed", async ({ page }) => {
    const levels = await headingLevels(page);
    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);

    for (let i = 1; i < levels.length; i += 1) {
      const previous = levels[i - 1] ?? 1;
      const current = levels[i] ?? 1;
      expect(current - previous, `heading level jumped at index ${i}`).toBeLessThanOrEqual(1);
    }
  });

  test("landmark structure is correct", async ({ page }) => {
    await expect(page.locator("body > header")).toHaveCount(1);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.locator("body > footer")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Chapters" })).toHaveCount(1);
  });

  test("every section is labelled by its heading", async ({ page }) => {
    const sections = page.locator("main > section");
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i += 1) {
      const labelledBy = await sections.nth(i).getAttribute("aria-labelledby");
      expect(labelledBy, `section ${i} has no aria-labelledby`).toBeTruthy();
      await expect(page.locator(`#${labelledBy}`)).toHaveCount(1);
    }
  });

  test("the signal SVG is decorative, with the meaning carried in text", async ({ page }) => {
    // Wave C changed this contract. In Wave B the SVG was a labelled image
    // (`role="img"` + aria-labelledby). It is now `aria-hidden` because the
    // graphic changes with every state, and a static label would go stale the
    // moment the state moved. The per-state text panel replaces it.
    const svg = page.locator("svg[data-signal]");
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg).toHaveAttribute("focusable", "false");
    await expect(svg).not.toHaveAttribute("role", "img");

    // The replacement must actually be there, and must be labelled.
    const panel = page.locator("[data-signal-text]");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("aria-labelledby", "signal-text-title");
    await expect(page.locator("#signal-text-title")).toHaveCount(1);

    // And the full sequence stays available independently of current state.
    await expect(page.locator(".signal-legend li")).toHaveCount(8);
  });

  test("no essential state is conveyed by colour alone", async ({ page }) => {
    // Each status and evidence marker must carry a word, not just a hue.
    await expect(page.locator('[data-status="live"]').first()).toContainText("LIVE");
    await expect(page.locator('[data-status="illustrative"]')).toContainText("ILLUSTRATIVE");
    await expect(page.locator(".note--illustrative")).toContainText("nothing below was measured");
    // The backend status must read as down in words, not only by colour.
    await expect(page.locator('[data-status="down"]')).toContainText("NOT CURRENTLY REACHABLE");
    await expect(page.locator('[data-evidence="verified"]').first()).toContainText("Verified");
    await expect(page.locator('[data-evidence="pending"]').first()).toContainText("EVIDENCE PENDING");

    // The active rail link is marked semantically, not only visually.
    await expect(page.locator('[data-chapter-link][aria-current="true"]')).toHaveCount(1);
  });

  test("the current chapter is tracked as the reader moves", async ({ page }) => {
    await expect(page.locator('[data-chapter-link="idea"]')).toHaveAttribute("aria-current", "true");

    await page.locator("#system").scrollIntoViewIfNeeded();
    await expect(page.locator('[data-chapter-link="system"]')).toHaveAttribute(
      "aria-current",
      "true",
    );
    // Exactly one link is ever current.
    await expect(page.locator('[data-chapter-link][aria-current="true"]')).toHaveCount(1);
  });

  test("no autonomous animation exists at this wave", async ({ page }) => {
    // Study A Waves A and B are explicitly static. What must not exist is
    // *autonomous* motion — keyframe animations, SMIL, anything that loops.
    //
    // Short CSS transitions on interactive state are not that, and asserting
    // against them was wrong: the rail's own 140ms colour transition fires
    // when the controller marks the current chapter at attach, so a bare
    // `getAnimations().length === 0` check races page boot and fails on
    // whichever device happens to be sampled first. The dossier removes
    // decorative motion, not designed hover/focus/active feedback (7.14).
    const autonomous = await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.constructor.name === "CSSAnimation" ||
            animation.effect?.getComputedTiming().iterations === Infinity,
        )
        .map((animation) => animation.constructor.name),
    );
    expect(autonomous, `autonomous animations found: ${autonomous.join(", ")}`).toHaveLength(0);

    // No SMIL animation elements in the signal SVG.
    await expect(page.locator("animate, animateMotion, animateTransform, set")).toHaveCount(0);

    // And nothing settles into a permanently running state.
    await page.waitForTimeout(600);
    const stillRunning = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length,
    );
    expect(stillRunning).toBe(0);
  });
});

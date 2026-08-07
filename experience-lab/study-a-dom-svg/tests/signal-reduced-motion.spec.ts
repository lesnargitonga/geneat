import { test, expect } from "@playwright/test";
import { gotoAndReady } from "./helpers";

/**
 * Reduced-motion behaviour and the absence of forbidden dependencies.
 *
 * Reduced mode is not "the same animation, faster". The head must not travel,
 * nothing may scale, and no motion may run on its own — asserted by reading
 * computed styles rather than by trusting the duration token.
 */

test.describe("reduced motion", () => {
  test("OS preference resolves to reduced without any interaction", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page);

    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator("svg[data-signal]")).toHaveAttribute("data-motion", "reduced");
    await context.close();
  });

  test("the signal head does not travel in reduced mode", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page);

    const transition = await page
      .locator("svg[data-signal] [data-head-marker]")
      .evaluate((node) => getComputedStyle(node).transitionProperty);

    // Structurally none, not merely short.
    expect(transition).toBe("none");
    await context.close();
  });

  test("transition durations stay within the reduced budget", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page);

    const durationMs = await page.locator("svg[data-signal]").evaluate((node) => {
      const value = getComputedStyle(node).getPropertyValue("--signal-transition").trim();
      return value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
    });

    expect(durationMs).toBeLessThanOrEqual(80);
    await context.close();
  });

  test("all eight states remain reachable and legible in reduced mode", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page);

    for (const state of ["idea", "protect", "human-review", "act", "prove"]) {
      await page.evaluate((s) => window.__STUDY_A__!.goToSignalState(s as never), state);
      await page.waitForFunction((s) => window.__STUDY_A__!.signalState() === s, state);

      await expect(page.locator("[data-signal-text]")).toHaveAttribute("data-state", state);
      await expect(page.locator("svg[data-signal]")).toHaveAttribute("data-state", state);
    }

    // Reduced motion removes movement, never content.
    await expect(page.locator(".signal-legend li")).toHaveCount(8);
    await context.close();
  });

  test("choosing Reduced through the control applies immediately", async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.__STUDY_A__!.setEffects("reduced"));

    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator("svg[data-signal]")).toHaveAttribute("data-motion", "reduced");
  });

  test("no autonomous animation runs in either motion mode", async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.__STUDY_A__!.goToSignalState("prove" as never));
    await page.waitForTimeout(900);

    const autonomous = await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.constructor.name === "CSSAnimation" ||
            animation.effect?.getComputedTiming().iterations === Infinity,
        ).length,
    );
    expect(autonomous).toBe(0);

    // No SMIL anywhere in the signal.
    await expect(page.locator("animate, animateMotion, animateTransform, set")).toHaveCount(0);

    // And nothing is still moving once the transition has settled.
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
  });
});

test.describe("forbidden dependencies", () => {
  test("no GSAP, ScrollTrigger, WebGL, canvas or scroll timeline is present", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));

    await gotoAndReady(page);
    await page.evaluate(() => window.__STUDY_A__!.goToSignalState("prove" as never));
    await page.waitForTimeout(500);

    // Nothing fetched may be an animation or 3D library.
    for (const pattern of [/gsap/i, /scrolltrigger/i, /three/i, /lottie/i]) {
      expect(requested.filter((url) => pattern.test(url)), `fetched ${pattern}`).toHaveLength(0);
    }

    const globals = await page.evaluate(() => ({
      gsap: "gsap" in window,
      scrollTrigger: "ScrollTrigger" in window,
      three: "THREE" in window,
      canvasCount: document.querySelectorAll("canvas").length,
      webglContexts: [...document.querySelectorAll("canvas")].filter((canvas) => {
        try {
          return (
            (canvas as HTMLCanvasElement).getContext("webgl2") !== null ||
            (canvas as HTMLCanvasElement).getContext("webgl") !== null
          );
        } catch {
          return false;
        }
      }).length,
      // ScrollTimeline / ViewTimeline would be a scroll-linked animation.
      scrollTimelines: document
        .getAnimations()
        .filter((a) => a.timeline && a.timeline.constructor.name !== "DocumentTimeline").length,
    }));

    expect(globals.gsap).toBe(false);
    expect(globals.scrollTrigger).toBe(false);
    expect(globals.three).toBe(false);
    expect(globals.canvasCount).toBe(0);
    expect(globals.webglContexts).toBe(0);
    expect(globals.scrollTimelines).toBe(0);
  });

  test("state changes are independent of scroll position", async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.__STUDY_A__!.goToSignalState("engineer" as never));
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "engineer");

    // Scrolling the whole page must not move the signal off its state.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe("engineer");

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe("engineer");
  });
});

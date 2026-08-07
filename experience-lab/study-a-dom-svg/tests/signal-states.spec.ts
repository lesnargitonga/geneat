import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoAndReady } from "./helpers";

/**
 * Runtime behaviour of the signal state system: transitions, the stepper,
 * keyboard control, the live region and the text equivalent.
 *
 * Transitions are driven through the exposed controller rather than by
 * simulated clicking wherever the subject under test is the state machine —
 * a failing transition test should point at the machine, not at a missed
 * button. Keyboard and pointer paths are exercised separately, on purpose.
 */

const ALL_STATES = [
  "idea",
  "observe",
  "model",
  "engineer",
  "protect",
  "human-review",
  "act",
  "prove",
] as const;

async function currentState(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__STUDY_A__!.signalState());
}

async function goTo(page: Page, id: string): Promise<void> {
  await page.evaluate((state) => {
    window.__STUDY_A__!.goToSignalState(state as never);
  }, id);
  await page.waitForFunction((state) => window.__STUDY_A__!.signalState() === state, id);
}

test.describe("signal state system", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("boots in the idea state", async ({ page }) => {
    expect(await currentState(page)).toBe("idea");
    await expect(page.locator("svg[data-signal]")).toHaveAttribute("data-state", "idea");
    await expect(page.locator("[data-signal-text]")).toHaveAttribute("data-state", "idea");
  });

  test("all eight named layers exist in the rendered SVG", async ({ page }) => {
    for (const layer of [
      "dormant-path",
      "active-path",
      "signal-head",
      "evidence-nodes",
      "boundary-nodes",
      "human-gate",
      "action-node",
      "residual-trace",
    ]) {
      await expect(page.locator(`[data-layer="${layer}"]`)).toHaveCount(1);
    }
  });

  test("every node and segment referenced by the model is in the DOM", async ({ page }) => {
    for (const node of ["ev-1", "ev-2", "ev-3", "ev-4", "bd-1", "bd-2", "gate", "act"]) {
      await expect(page.locator(`[data-node="${node}"]`)).toHaveCount(1);
    }
    for (let i = 1; i <= 7; i += 1) {
      await expect(page.locator(`[data-segment="seg-${i}"]`)).toHaveCount(1);
    }
  });

  test("forward transitions reach every state in order", async ({ page }) => {
    for (const state of ALL_STATES.slice(1)) {
      await page.evaluate(() => window.__STUDY_A__!.goToSignalState);
      await page.locator('.stepper__button--nav:not([disabled])').last().click();
      await page.waitForFunction((s) => window.__STUDY_A__!.signalState() === s, state);
      expect(await currentState(page)).toBe(state);
    }
    expect(await currentState(page)).toBe("prove");
  });

  test("reverse transitions walk back to the first state", async ({ page }) => {
    await goTo(page, "prove");

    for (const state of [...ALL_STATES].reverse().slice(1)) {
      await page.locator(".stepper__button--nav").first().click();
      await page.waitForFunction((s) => window.__STUDY_A__!.signalState() === s, state);
    }
    expect(await currentState(page)).toBe("idea");
  });

  test("direct jumps land exactly, forwards and backwards", async ({ page }) => {
    await goTo(page, "prove");
    expect(await currentState(page)).toBe("prove");

    await goTo(page, "observe");
    expect(await currentState(page)).toBe("observe");

    await goTo(page, "human-review");
    expect(await currentState(page)).toBe("human-review");
  });

  test("selecting the current state is a no-op", async ({ page }) => {
    await goTo(page, "protect");

    const before = await page.locator("[data-signal-text]").innerHTML();
    const liveBefore = await page.locator("[data-signal-live]").textContent();

    // Re-select the same state through the real button.
    await page.locator('[data-signal-state="protect"]').click();
    await page.waitForTimeout(300);

    expect(await currentState(page)).toBe("protect");
    expect(await page.locator("[data-signal-text]").innerHTML()).toBe(before);
    // The live region must not re-announce a state nobody moved to.
    expect(await page.locator("[data-signal-live]").textContent()).toBe(liveBefore);
  });

  test("rapid selection settles on the final requested state", async ({ page }) => {
    // Three requests inside one frame. The controller coalesces, so exactly
    // one transition applies — to the last one asked for.
    await page.evaluate(() => {
      const bridge = window.__STUDY_A__!;
      bridge.goToSignalState("prove" as never);
      bridge.goToSignalState("idea" as never);
      bridge.goToSignalState("act" as never);
    });

    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "act");
    await page.waitForTimeout(400);

    expect(await currentState(page)).toBe("act");
    await expect(page.locator("svg[data-signal]")).toHaveAttribute("data-state", "act");
    await expect(page.locator("[data-signal-text]")).toHaveAttribute("data-state", "act");
  });

  test("the text equivalent updates with every state", async ({ page }) => {
    for (const state of ALL_STATES) {
      await goTo(page, state);
      const panel = page.locator("[data-signal-text]");
      await expect(panel).toHaveAttribute("data-state", state);

      // All five required fields are present for every state.
      await expect(panel.locator(".signal-text__title")).not.toBeEmpty();
      const terms = await panel.locator("dt").allTextContents();
      expect(terms).toEqual(["What happens", "Input", "Boundary", "Output"]);
      for (const definition of await panel.locator("dd").allTextContents()) {
        expect(definition.trim().length).toBeGreaterThan(10);
      }
    }
  });

  test("the live region announces each state change once", async ({ page }) => {
    const live = page.locator("[data-signal-live]");
    await expect(live).toHaveAttribute("aria-live", "polite");

    await goTo(page, "human-review");
    await expect(live).toHaveText("Signal state 6 of 8: Human review");

    await goTo(page, "prove");
    await expect(live).toHaveText("Signal state 8 of 8: Prove");
  });

  test("the human gate visibly holds and later passes", async ({ page }) => {
    await goTo(page, "human-review");

    const gate = page.locator('[data-node="gate"]');
    await expect(gate).toHaveAttribute("data-gate", "holding");
    // The onward segment must not be drawn while the gate holds.
    await expect(page.locator('[data-segment="seg-6"]')).toHaveAttribute("data-state", "hidden");
    await expect(page.locator('[data-node="act"]')).toHaveAttribute("data-active", "false");

    await goTo(page, "act");
    await expect(gate).toHaveAttribute("data-gate", "passed");
    await expect(page.locator('[data-node="act"]')).toHaveAttribute("data-active", "true");
  });

  test("Act and Prove render differently", async ({ page }) => {
    await goTo(page, "act");
    await expect(page.locator('[data-node="act"]')).toHaveAttribute("data-action", "firing");
    await expect(page.locator('[data-layer="residual-trace"]')).toHaveAttribute(
      "data-active",
      "false",
    );

    await goTo(page, "prove");
    await expect(page.locator('[data-node="act"]')).toHaveAttribute("data-action", "recorded");
    await expect(page.locator('[data-layer="residual-trace"]')).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  test("state rendering is deterministic — same state, same DOM", async ({ page }) => {
    await goTo(page, "protect");
    const first = await page.locator("svg[data-signal]").innerHTML();

    await goTo(page, "idea");
    await goTo(page, "prove");
    await goTo(page, "protect");
    const second = await page.locator("svg[data-signal]").innerHTML();

    // No randomness anywhere: arriving at a state from a different direction
    // must produce an identical picture (§7.18 pass condition).
    expect(second).toBe(first);
  });

  test("the viewBox never changes across states", async ({ page }) => {
    const initial = await page.locator("svg[data-signal]").getAttribute("viewBox");
    for (const state of ALL_STATES) {
      await goTo(page, state);
      expect(await page.locator("svg[data-signal]").getAttribute("viewBox")).toBe(initial);
    }
  });

  test("the SVG stays hidden from assistive technology", async ({ page }) => {
    const svg = page.locator("svg[data-signal]");
    await expect(svg).toHaveAttribute("aria-hidden", "true");
    await expect(svg).toHaveAttribute("focusable", "false");
  });
});

test.describe("signal stepper keyboard control", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("the state strip is a single tab stop with roving tabindex", async ({ page }) => {
    const buttons = page.locator("[data-signal-state]");
    await expect(buttons).toHaveCount(8);

    const tabIndexes = await buttons.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLButtonElement).tabIndex),
    );
    expect(tabIndexes.filter((value) => value === 0)).toHaveLength(1);
    expect(tabIndexes.filter((value) => value === -1)).toHaveLength(7);
  });

  test("arrow keys move through states", async ({ page }) => {
    await page.locator('[data-signal-state="idea"]').focus();

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "observe");

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "model");

    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "observe");
  });

  test("Home and End jump to the ends", async ({ page }) => {
    await page.locator('[data-signal-state="idea"]').focus();

    await page.keyboard.press("End");
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "prove");

    await page.keyboard.press("Home");
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "idea");
  });

  test("focus follows selection so arrows keep working", async ({ page }) => {
    await page.locator('[data-signal-state="idea"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "observe");
    await expect(page.locator('[data-signal-state="observe"]')).toBeFocused();
  });

  test("aria-current marks exactly one state", async ({ page }) => {
    await goTo(page, "engineer");
    const current = page.locator("[data-signal-state][aria-current='true']");
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("data-signal-state", "engineer");
  });

  test("Previous and Next disable at the ends", async ({ page }) => {
    const previous = page.locator(".stepper__button--nav").first();
    const next = page.locator(".stepper__button--nav").last();

    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    await goTo(page, "prove");
    await expect(previous).toBeEnabled();
    await expect(next).toBeDisabled();
  });

  test("selecting a state does not scroll the page", async ({ page }) => {
    // Baseline is taken after the control is already in view, so this measures
    // the application rather than Playwright's scroll-into-view before click.
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

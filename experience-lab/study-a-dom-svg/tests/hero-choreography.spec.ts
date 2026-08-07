import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoAndReady } from "./helpers";
import { HERO_SEQUENCE, HERO_TOTAL_MS, HERO_TIMING_LIMITS } from "../src/signal/hero-choreography";
import { PROJECT_GRAMMARS } from "../src/portfolio/project-grammars";
import { SIGNAL_STATES } from "../src/signal/signal-states";

/**
 * Wave D behaviour: the hero formation sequence, its boundaries, and the
 * portfolio extensibility fixture.
 *
 * The assertions that matter most are the negative ones — that nothing waits
 * for the animation, that scrolling is never blocked, and that no second state
 * machine appeared. Those are the ways an authored hero usually goes wrong.
 */

async function heroPhase(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__STUDY_A__!.heroPhase());
}

test.describe("hero formation sequence", () => {
  test("the budget sits inside the specified window", () => {
    // Checked against the data, not the clock, so it cannot pass by accident
    // on a fast machine.
    expect(HERO_TOTAL_MS).toBeGreaterThanOrEqual(HERO_TIMING_LIMITS.minMs);
    expect(HERO_TOTAL_MS).toBeLessThanOrEqual(HERO_TIMING_LIMITS.maxMs);
  });

  test("the sequence is the canonical eight states, in order", () => {
    // §26.2: the Wave C system is the source of truth. If these ever diverge,
    // a second hero-only sequence has been introduced.
    expect(HERO_SEQUENCE).toEqual(SIGNAL_STATES.map((state) => state.id));
  });

  test("the headline and CTA are usable before the sequence finishes", async ({ page }) => {
    await page.goto("/");

    // Deliberately no wait: assert while the sequence is still running.
    await expect(page.locator("h1")).toBeVisible();
    const cta = page.getByRole("link", { name: "See a real system" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "#product");

    // And it actually works mid-sequence.
    await cta.click();
    await expect(page.locator("section#product")).toBeInViewport();
  });

  test("there is no loader and no blank stage at any point", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });

    // Nothing that looks like a loader may exist, ever.
    await expect(page.locator("[data-loader], .loader, .spinner, [role='progressbar']")).toHaveCount(
      0,
    );

    // The signal is a coherent composition from the first frame — the dormant
    // path is in the served HTML, not drawn by script.
    await expect(page.locator('[data-layer="dormant-path"]')).toBeAttached();
    await expect(page.locator("h1")).toBeVisible();
  });

  test("the sequence settles and then stops", async ({ page }) => {
    await gotoAndReady(page, "/?diagnostics=1");

    await page.waitForFunction(() => window.__STUDY_A__!.heroPhase() === "settled", null, {
      timeout: 8000,
    });

    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe("prove");

    // No ambient loop after settle (§26.3): nothing is animating once it ends.
    await page.waitForTimeout(700);
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
  });

  test("elapsed time is within the budget in a real browser", async ({ page }) => {
    await gotoAndReady(page, "/?diagnostics=1");
    await page.waitForFunction(() => window.__STUDY_A__!.heroPhase() === "settled", null, {
      timeout: 8000,
    });

    const elapsed = await page.evaluate(() => window.__STUDY_A__!.heroElapsedMs());
    expect(elapsed).not.toBeNull();
    // Upper bound only. A slow CI machine may take longer than the schedule;
    // what must never happen is the sequence running long enough to feel like
    // a loader. Generous headroom over the 3.2s target.
    expect(elapsed!).toBeLessThan(6000);
  });

  test("scrolling is never blocked", async ({ page }) => {
    await page.goto("/");

    // Scroll immediately, while the sequence is mid-flight.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    // No scroll lock anywhere.
    const locked = await page.evaluate(() => {
      const html = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return (
        html.overflow === "hidden" ||
        body.overflow === "hidden" ||
        html.position === "fixed" ||
        body.position === "fixed"
      );
    });
    expect(locked).toBe(false);
  });

  test("user interaction cancels the sequence and keeps the current state", async ({ page }) => {
    await gotoAndReady(page, "/?diagnostics=1");
    await page.waitForFunction(() => window.__STUDY_A__!.heroPhase() === "playing");

    await page.evaluate(() => window.__STUDY_A__!.cancelHero());
    expect(await heroPhase(page)).toBe("cancelled");

    const atCancel = await page.evaluate(() => window.__STUDY_A__!.signalState());
    await page.waitForTimeout(700);

    // It must not snap to `prove` behind the user's back.
    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe(atCancel);
  });

  test("a URL-pinned state suppresses the sequence entirely", async ({ page }) => {
    await gotoAndReady(page, "/?diagnostics=1&signal=protect");
    await page.waitForTimeout(900);

    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe("protect");
    expect(await heroPhase(page)).toBe("idle");
  });

  test("the hero is understandable as a still frame", async ({ page }) => {
    await gotoAndReady(page, "/?diagnostics=1&signal=idea");

    // With the sequence suppressed, everything that carries meaning is present:
    // headline, supporting copy, CTA, the state caption, and the full sequence
    // in text. No text requires animation to be understood (§26.10).
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".hero__lede")).toBeVisible();
    await expect(page.getByRole("link", { name: "See a real system" })).toBeVisible();
    await expect(page.locator("[data-signal-caption]")).toContainText("Idea");
    await expect(page.locator(".signal-legend li")).toHaveCount(8);
    await expect(page.locator("[data-signal-text] dd")).toHaveCount(4);
  });

  test("the state caption tracks the signal", async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.__STUDY_A__!.goToSignalState("human-review" as never));
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "human-review");

    const caption = page.locator("[data-signal-caption]");
    await expect(caption).toHaveAttribute("data-state", "human-review");
    await expect(caption).toContainText("Human review");
    await expect(caption).toContainText("05");
  });
});

test.describe("reduced motion", () => {
  test("settles immediately on a complete state, with no travel", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page, "/?diagnostics=1");

    // No sequence runs at all — it is already settled.
    expect(await heroPhase(page)).toBe("settled");
    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe("prove");
    expect(await page.evaluate(() => window.__STUDY_A__!.heroElapsedMs())).toBeLessThanOrEqual(1);

    const transition = await page
      .locator("svg[data-signal] [data-head-marker]")
      .evaluate((node) => getComputedStyle(node).transitionProperty);
    expect(transition).toBe("none");

    await context.close();
  });

  test("loses no information", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page, "/?diagnostics=1");

    // Everything the full experience carries is present.
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".signal-legend li")).toHaveCount(8);
    await expect(page.locator("[data-stage-id]")).toHaveCount(6);
    await expect(page.locator("[data-action-step]")).toHaveCount(7);
    await expect(page.locator(".limitations li")).toHaveCount(6);
    await expect(page.getByRole("link", { name: "See a real system" })).toBeVisible();
    await expect(page.locator('[data-evidence="pending"]')).toContainText("EVIDENCE PENDING");

    // And every state is still reachable.
    for (const state of ["idea", "protect", "act"]) {
      await page.evaluate((s) => window.__STUDY_A__!.goToSignalState(s as never), state);
      await page.waitForFunction((s) => window.__STUDY_A__!.signalState() === s, state);
    }

    await context.close();
  });
});

test.describe("effects preference", () => {
  test("persists across a reload", async ({ page }) => {
    await gotoAndReady(page);
    await page.evaluate(() => window.__STUDY_A__!.setEffects("reduced"));
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");

    await page.reload();
    await page.waitForFunction(() => typeof window.__STUDY_A__ !== "undefined");

    await expect(page.locator("html")).toHaveAttribute("data-effects", "reduced");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await expect(page.getByRole("radio", { name: "Reduced" })).toBeChecked();
  });

  test("Full overrides an OS reduced-motion preference", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page, "/?diagnostics=1");

    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await page.evaluate(() => window.__STUDY_A__!.setEffects("full"));
    // An explicit choice is more specific than an OS default.
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");

    await context.close();
  });
});

test.describe("development controls", () => {
  test("are absent for an ordinary visitor", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(400);

    // §26.4: the stepper must not read as homepage navigation. It is not on the
    // page at all without diagnostics.
    await expect(page.locator("[data-lab-tools]")).toBeHidden();
    await expect(page.locator("[data-signal-stepper]")).toBeHidden();
    await expect(page.locator("[data-portfolio-fixture]")).toBeHidden();
  });

  test("remain fully available under diagnostics", async ({ page }) => {
    await gotoAndReady(page);

    await expect(page.locator("[data-lab-tools]")).toBeVisible();
    await expect(page.locator("[data-signal-state]")).toHaveCount(8);

    await page.locator('[data-signal-state="act"]').click();
    await page.waitForFunction(() => window.__STUDY_A__!.signalState() === "act");
    expect(await page.evaluate(() => window.__STUDY_A__!.signalState())).toBe("act");
  });
});

test.describe("portfolio extensibility", () => {
  test("three grammars of different lengths exist", () => {
    expect(PROJECT_GRAMMARS).toHaveLength(3);
    expect(PROJECT_GRAMMARS.map((g) => g.id)).toEqual([
      "gen-eat-hazina",
      "carepro",
      "sentinelcore-cypher",
    ]);

    // Meaningfully different, not three relabelled copies.
    const lengths = PROJECT_GRAMMARS.map((g) => g.steps.length);
    expect(new Set(lengths).size).toBe(3);
    expect(lengths).toEqual([6, 8, 7]);
  });

  test("grammar vocabularies do not overlap with the canonical states", () => {
    const canonical = new Set(SIGNAL_STATES.map((s) => s.id));
    for (const grammar of PROJECT_GRAMMARS) {
      const ids = grammar.steps.map((s) => s.id);
      expect(new Set(ids).size, `${grammar.id} has duplicate step ids`).toBe(ids.length);
      // A grammar that reused the canonical ids would be the same sequence
      // wearing a different label, which proves nothing about extensibility.
      const shared = ids.filter((id) => canonical.has(id as never));
      expect(shared, `${grammar.id} reuses canonical state ids: ${shared.join(", ")}`).toHaveLength(
        0,
      );
    }
  });

  test("no grammar fabricates status, metrics or adoption", () => {
    const forbidden = [
      /\b\d[\d,.]*\s*(customers|users|orders|clients|patients|merchants)\b/i,
      /\b(KES|USD|\$)\s?\d/i,
      /\b\d+(\.\d+)?%/,
      /\b(live|deployed|in production|launched)\b/i,
    ];

    for (const grammar of PROJECT_GRAMMARS) {
      const text = grammar.steps
        .map((s) => `${s.label} ${s.explanation} ${s.input} ${s.boundary} ${s.output}`)
        .join(" ");
      for (const pattern of forbidden) {
        expect(text, `${grammar.id} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test("every grammar is driven by the one shared engine", async ({ page }) => {
    await gotoAndReady(page);
    const described = await page.evaluate(() => window.__STUDY_A__!.portfolioGrammars());

    expect(described).toHaveLength(3);
    for (const grammar of described) {
      // The proof: same controller class, same view class, as the hero.
      expect(grammar.engine, `${grammar.id} uses a different engine`).toBe("SignalController");
      expect(grammar.viewEngine, `${grammar.id} uses a different view`).toBe("SignalView");
    }
    expect(described.map((g) => g.steps)).toEqual([6, 8, 7]);
  });

  test("each grammar renders and steps in the DOM", async ({ page }) => {
    await gotoAndReady(page);

    for (const grammar of PROJECT_GRAMMARS) {
      const section = page.locator(`[data-grammar="${grammar.id}"]`);
      await expect(section).toBeVisible();
      await expect(section.locator("[data-fixture-step]")).toHaveCount(grammar.steps.length);
      await expect(section.locator(`svg[data-signal-fixture="${grammar.id}"]`)).toBeAttached();

      const first = grammar.steps[0]!;
      await section.locator(`[data-fixture-step="${first.id}"]`).click();
      await expect(section.locator(`[data-fixture-step="${first.id}"]`)).toHaveAttribute(
        "aria-current",
        "true",
      );
      await expect(section.locator("[data-fixture-caption]")).toContainText(first.label);
    }
  });
});

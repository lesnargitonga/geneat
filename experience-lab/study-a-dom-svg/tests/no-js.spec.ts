import { test, expect } from "@playwright/test";
import { headingLevels } from "./helpers";

/**
 * The no-JavaScript baseline.
 *
 * This is the single most important suite in Study A. The study's whole claim
 * is that semantic HTML, CSS and static SVG carry the concept — so if the
 * story is incomplete with the script removed, the claim is false regardless
 * of how the enhanced version looks.
 *
 * Runs under `javaScriptEnabled: false`.
 */

test.describe("no JavaScript", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("the script really did not run", async ({ page }) => {
    // main.ts sets data-js="true"; the served HTML ships data-js="false".
    await expect(page.locator("html")).toHaveAttribute("data-js", "false");
  });

  test("headline, supporting copy and both calls to action are present", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("We make");
    await expect(page.locator("h1")).toContainText("ambitious ideas");
    await expect(page.locator("h1")).toContainText("real");
    await expect(page.locator(".hero__lede")).toContainText("becomes understandable");
    await expect(page.getByRole("link", { name: "See a real system" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a project" }).first()).toBeVisible();
  });

  test("the static signal composition renders in the idea state", async ({ page }) => {
    const svg = page.locator(".stage svg[data-signal]");
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute("data-state", "idea");

    // Without JavaScript the page shows the dormant path — possible structure,
    // nothing resolved — which is precisely what `idea` means. The remaining
    // layers exist but are inactive, asserted by the named-layer test below.
    await expect(page.locator('[data-layer="dormant-path"]')).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(page.locator('[data-role="dormant"]')).toBeAttached();
    await expect(page.locator("svg[data-signal] [data-head-marker]")).toHaveAttribute("data-dormant", "true");
  });

  test("the signal has a structured text equivalent", async ({ page }) => {
    const legend = page.locator(".signal-legend li");
    await expect(legend).toHaveCount(8);
    await expect(legend.first()).toContainText("Idea");
    await expect(legend.nth(5)).toContainText("Human review");
    await expect(legend.last()).toContainText("Prove");
  });

  test("the SVG is decorative and the text carries the meaning", async ({ page }) => {
    // aria-hidden is only defensible because the panel and legend below say
    // everything the graphic does.
    await expect(page.locator("svg[data-signal]")).toHaveAttribute("aria-hidden", "true");

    const panel = page.locator("[data-signal-text]");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-state", "idea");
    expect(await panel.locator("dt").allTextContents()).toEqual([
      "What happens",
      "Input",
      "Boundary",
      "Output",
    ]);
    for (const definition of await panel.locator("dd").allTextContents()) {
      expect(definition.trim().length).toBeGreaterThan(10);
    }
  });

  test("the eight named signal layers exist in the static markup", async ({ page }) => {
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
      await expect(page.locator(`svg[data-signal] [data-layer="${layer}"]`)).toHaveCount(1);
    }
  });

  test("the stepper is hidden without JavaScript", async ({ page }) => {
    // A control that cannot do anything must not be offered. The legend
    // carries all eight states instead.
    await expect(page.locator("[data-signal-stepper]")).toBeHidden();
  });

  test("all six system stages are readable in full", async ({ page }) => {
    const stages = page.locator("[data-stage-id]");
    await expect(stages).toHaveCount(6);

    for (const id of ["request", "context", "decision", "payment", "routing", "recovery"]) {
      const stage = page.locator(`[data-stage-id="${id}"]`);
      await expect(stage).toBeVisible();
      // Each stage answers all four questions without any scripting.
      await expect(stage.locator("dt")).toHaveCount(4);
    }
  });

  test("the seven-step action sequence is complete", async ({ page }) => {
    const steps = page.locator("[data-action-step]");
    await expect(steps).toHaveCount(7);

    const labels = ["Observe", "Detect", "Verify", "Approve", "Command", "Act", "Record"];
    for (const [index, label] of labels.entries()) {
      await expect(steps.nth(index)).toContainText(label);
    }
  });

  test("truth labels and evidence states survive", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Gen-Eat", exact: true })).toBeVisible();
    await expect(page.locator('[data-status="live"]')).toContainText("LIVE");
    await expect(page.locator('[data-status="prototype"]')).toContainText("PROTOTYPE");

    await expect(page.locator('[data-evidence="verified"]')).toHaveCount(3);
    await expect(page.locator('[data-evidence="pending"]')).toHaveCount(1);
    await expect(page.locator('[data-evidence="pending"]')).toContainText("EVIDENCE PENDING");
  });

  test("no fabricated metric appears anywhere on the page", async ({ page }) => {
    const body = (await page.locator("body").textContent()) ?? "";

    // Guards against the failure mode the dossier calls out directly: numbers
    // that look like proof but were never measured.
    const fabricationPatterns = [
      /\b\d[\d,.]*\s*(orders|customers|users|merchants|transactions)\b/i,
      /\b(KES|USD|\$)\s?\d/i,
      /\b\d+(\.\d+)?%\s*(uptime|conversion|accuracy|growth)\b/i,
      /\b\d+(\.\d+)?\s*(ms|seconds)\s*(average|median|latency)\b/i,
    ];

    for (const pattern of fabricationPatterns) {
      expect(body, `unmeasured figure matched ${pattern}`).not.toMatch(pattern);
    }
  });

  test("current limitations are visible on the page", async ({ page }) => {
    const limitations = page.locator(".limitations");
    await expect(limitations).toBeVisible();
    await expect(limitations.locator("li")).toHaveCount(6);
    await expect(limitations).toContainText("No measured outcomes");
    await expect(limitations).toContainText("Live status is inferred");
  });

  test("chapter navigation is real anchors to real sections", async ({ page }) => {
    const links = page.locator("[data-chapter-link]");
    await expect(links).toHaveCount(4);

    for (const id of ["idea", "product", "system", "action"]) {
      await expect(page.locator(`[data-chapter-link="${id}"]`)).toHaveAttribute("href", `#${id}`);
      await expect(page.locator(`section[data-chapter="${id}"]`)).toBeVisible();
    }
  });

  test("heading order is well formed with a single h1", async ({ page }) => {
    const levels = await headingLevels(page);

    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);

    for (let i = 1; i < levels.length; i += 1) {
      const previous = levels[i - 1] ?? 1;
      const current = levels[i] ?? 1;
      expect(current - previous, `heading level jumped at index ${i}`).toBeLessThanOrEqual(1);
    }
  });

  test("landmarks and skip link exist", async ({ page }) => {
    await expect(page.locator("body > header")).toHaveCount(1);
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.locator("body > footer")).toHaveCount(1);

    const skip = page.locator("a.skip-link");
    await expect(skip).toHaveAttribute("href", "#main");
    await expect(skip).toHaveText("Skip to content");
  });
});

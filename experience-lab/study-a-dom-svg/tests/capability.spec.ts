import { test, expect } from "@playwright/test";
import { gotoAndReady, DIAGNOSTIC_URL } from "./helpers";
import { CAPABILITIES } from "../src/capability/capability-model";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Wave F — the capability register.
 *
 * The assertions that matter are the ones about honesty and reach: that every
 * capability names what it is *not* claiming, that nothing is reachable only by
 * pointer or only with script, and that no fabricated metric appears.
 */

test.describe("capability register — content", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("all six capabilities are present in the register", async ({ page }) => {
    await expect(page.locator("[data-capability-link]")).toHaveCount(6);
    await expect(page.locator("[data-capability]")).toHaveCount(6);
    for (const c of CAPABILITIES) {
      await expect(page.locator(`[data-capability-link="${c.id}"]`)).toBeVisible();
    }
  });

  test("every capability states what is NOT claimed", async ({ page }) => {
    // A capability list without a boundary is a brochure.
    const boundaries = page.locator(".cap-entry__boundary");
    await expect(boundaries).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) {
      const text = (await boundaries.nth(i).textContent()) ?? "";
      expect(text).toContain("Not claimed");
      expect(text.replace("Not claimed", "").trim().length).toBeGreaterThan(30);
    }
  });

  test("every capability carries behaviours and at least one proof", async ({ page }) => {
    for (const c of CAPABILITIES) {
      const entry = page.locator(`[data-capability="${c.id}"]`);
      expect(c.behaviours.length).toBeGreaterThan(0);
      expect(c.proofs.length).toBeGreaterThan(0);
      await expect(entry.locator(".cap-proof")).toHaveCount(c.proofs.length);
    }
  });

  /**
   * Wave F graded Operate and Protect `controlled-client-system` — "operated for
   * a real client system". Their evidence is entirely the studio's own
   * infrastructure, and once CarePro was established as the founders' own
   * product no client relationship stood behind either grade. Wave H superseded
   * both forward; the historical checkpoint is untouched.
   *
   * Asserted as an explicit expected map rather than a permanent ban on the
   * vocabulary: a genuinely evidenced client capability can be added later by
   * updating this table deliberately, which is exactly the review moment such a
   * claim should get.
   */
  test("current capability maturities are the evidenced ones", () => {
    const expected: Record<string, string> = {
      build: "live-product",
      operate: "internal-engineering-system",
      protect: "internal-engineering-system",
      intelligence: "validated-prototype",
      prove: "internal-engineering-system",
      physical: "active-research",
    };
    for (const c of CAPABILITIES) {
      expect(c.maturity, `${c.id} maturity drifted`).toBe(expected[c.id]);
    }
    for (const id of ["operate", "protect"] as const) {
      const c = CAPABILITIES.find((x) => x.id === id)!;
      expect(c.maturity).toBe("internal-engineering-system");
      expect(c.maturity, `${id} must not reclaim a client grade`).not.toBe(
        "controlled-client-system",
      );
    }
    // No current capability may claim an external client without evidence.
    expect(
      CAPABILITIES.filter((c) => c.maturity === "controlled-client-system").map((c) => c.id),
      "a capability claims an external client relationship",
    ).toEqual([]);
  });

  test("no capability label reaches the visitor as a client system", async ({ page }) => {
    await gotoAndReady(page);
    const text = (await page.locator("#system").textContent()) ?? "";
    expect(/controlled client system/i.test(text)).toBe(false);
  });

  test("maturity is a word, never colour alone", async ({ page }) => {
    const chips = page.locator(".cap-entry__maturity");
    await expect(chips).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) {
      expect(((await chips.nth(i).textContent()) ?? "").trim().length).toBeGreaterThan(3);
    }
  });

  test("physical intelligence is not promoted beyond research", async ({ page }) => {
    const physical = page.locator('[data-capability="physical"]');
    await expect(physical.locator(".cap-entry__maturity")).toHaveText(/active research/i);
    const text = (await physical.textContent()) ?? "";
    // Explicitly disclaims the things it would be easiest to overclaim.
    expect(text).toMatch(/no deployed robotics/i);
  });

  test("no fabricated metric appears anywhere in the register", async ({ page }) => {
    const body = (await page.locator("[data-capability-register]").textContent()) ?? "";
    for (const pattern of [
      /\b\d[\d,.]*\s*\+?\s*(clients|customers|users|projects|APIs|deployments)\b/i,
      /\b\d+(\.\d+)?%\s*(uptime|satisfaction|accuracy|growth)\b/i,
      /\b\d+\+?\s*years\b/i,
      /\b(KES|USD|\$)\s?\d/i,
    ]) {
      expect(body, `register matched ${pattern}`).not.toMatch(pattern);
    }
  });

  test("intelligence does not claim working conversation", async ({ page }) => {
    // The runtime has no model credential; the register must say so.
    const text = (await page.locator('[data-capability="intelligence"]').textContent()) ?? "";
    expect(text).toMatch(/not currently operational|no provider credential/i);
  });
});

test.describe("capability register — inspection", () => {
  test("selecting a capability shows exactly one specimen", async ({ page }) => {
    await gotoAndReady(page);
    const entries = page.locator("[data-capability]");
    await expect(entries).toHaveCount(6);

    await page.locator('[data-capability-link="protect"]').click();
    await expect(page.locator('[data-capability="protect"]')).toBeVisible();
    await expect(page.locator('[data-capability="build"]')).toBeHidden();
    await expect(page.locator('[data-capability-link="protect"]')).toHaveAttribute("aria-current", "true");
    await expect(page.locator('[data-capability-link][aria-current="true"]')).toHaveCount(1);
  });

  test("selection state is not carried by colour alone", async ({ page }) => {
    await gotoAndReady(page);
    await page.locator('[data-capability-link="prove"]').click();
    // aria-current is the non-visual carrier; the seam and weight are the visual ones.
    const link = page.locator('[data-capability-link="prove"]');
    await expect(link).toHaveAttribute("aria-current", "true");
    const weight = await link.locator(".cap-index__name").evaluate((el) => getComputedStyle(el).fontWeight);
    expect(Number(weight)).toBeGreaterThanOrEqual(600);
  });

  test("the register is keyboard operable with arrow keys", async ({ page }) => {
    await gotoAndReady(page);
    const first = page.locator('[data-capability-link="build"]');
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[data-capability-link="operate"]')).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("End");
    await expect(page.locator('[data-capability-link="physical"]')).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Home");
    await expect(page.locator('[data-capability-link="build"]')).toHaveAttribute("aria-current", "true");
  });

  test("a capability is linkable by fragment", async ({ page }) => {
    // The diagnostics bridge only exists with ?diagnostics=1, so the fragment
    // has to ride along with the query rather than replace it.
    await gotoAndReady(page, `${DIAGNOSTIC_URL}#capability-intelligence`);
    await expect(page.locator('[data-capability="intelligence"]')).toBeVisible();
    await expect(page.locator('[data-capability-link="intelligence"]')).toHaveAttribute("aria-current", "true");
  });

  test("the document-level marker does not collide with entry markers", async ({ page }) => {
    await gotoAndReady(page);
    // Writing data-capability to <html> would make the document match the entry
    // selector — the same defect class as the Wave C data-chapter collision.
    await expect(page.locator("[data-capability]")).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-capability"))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.dataset["capabilityCurrent"])).toBeTruthy();
  });
});

test.describe("capability register — no pointer, no script", () => {
  test("nothing is revealed only on hover", async ({ page }) => {
    await gotoAndReady(page);
    // Every proof statement belongs to the DOM regardless of pointer state.
    const proofs = await page.locator(".cap-proof__statement").count();
    expect(proofs).toBeGreaterThanOrEqual(6);
  });

  test("only safe public paths are linked from the register", async ({ page }) => {
    await gotoAndReady(page);
    for (const bad of ["/admin", "/docs", "/redoc", "openapi.json", "/mock/"]) {
      await expect(page.locator(`[data-capability-register] a[href*="${bad}"]`)).toHaveCount(0);
    }
  });
});

test.describe("model ↔ HTML parity", () => {
  test("the parity checker fails when the model drifts from the served HTML", () => {
    // Generation and validation are separate operations. If someone edits
    // capability-model.ts and forgets to regenerate, the served page silently
    // stops matching the model — this proves the checker catches that.
    const script = resolve(process.cwd(), "scripts/check-capability-parity.mjs");
    const model = resolve(process.cwd(), "src/capability/capability-model.ts");
    const original = readFileSync(model, "utf8");

    const clean = spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });
    expect(clean.status, "parity must pass before the drift is introduced").toBe(0);
    expect(clean.stdout).toContain("capability parity: PASS");

    try {
      writeFileSync(
        model,
        original.replace(
          "An ambition becomes a system people can actually use.",
          "An ambition becomes a system people can actually use. DRIFT.",
        ),
      );
      const drifted = spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });
      expect(drifted.status, "parity must FAIL once the model and HTML disagree").not.toBe(0);
      expect(drifted.stderr).toContain("capability parity: FAIL");
      expect(drifted.stderr).toContain("build.changes");
    } finally {
      writeFileSync(model, original);
    }

    const restored = spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });
    expect(restored.status, "parity must pass again once restored").toBe(0);
  });
});

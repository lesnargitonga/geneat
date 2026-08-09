import { test, expect } from "@playwright/test";
import { gotoAndReady } from "./helpers";
import { DIAGNOSTIC_PATH, PHYSICAL_RECORDS } from "../src/physical/physical-model";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Wave G — physical intelligence.
 *
 * The assertions that matter are about maturity honesty. It would be very easy
 * to make this chapter imply deployed robotics; these tests make that fail.
 */

test.describe("physical chapter — truth", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("every record states what is NOT claimed", async ({ page }) => {
    const boundaries = page.locator(".phys-record__boundary");
    await expect(boundaries).toHaveCount(PHYSICAL_RECORDS.length);
    for (let i = 0; i < PHYSICAL_RECORDS.length; i += 1) {
      const text = (await boundaries.nth(i).textContent()) ?? "";
      expect(text).toContain("Not claimed");
      expect(text.replace("Not claimed", "").trim().length).toBeGreaterThan(40);
    }
  });

  test("robotics is not promoted beyond research", async ({ page }) => {
    const aerial = page.locator('[data-physical="aerial"]');
    await expect(aerial.locator(".phys-record__maturity")).toHaveText(/active research/i);
    const text = (await aerial.textContent()) ?? "";
    expect(text).toMatch(/nothing has been flown, built or deployed/i);
    expect(text).toMatch(/no autonomous navigation/i);
  });

  test("radar remains a direction, not a build", async ({ page }) => {
    const sensing = page.locator('[data-physical="sensing"]');
    await expect(sensing.locator(".phys-record__maturity")).toHaveText(/research direction/i);
    expect((await sensing.textContent()) ?? "").toMatch(/no radar has been constructed/i);
  });

  test("the embedded prototype is marked owner-attested, not repository evidence", async ({ page }) => {
    // Its source is on the drive that failed; nothing here is read from a repo.
    const embedded = page.locator('[data-physical="embedded"]');
    await expect(embedded.locator(".phys-record__evidence")).toHaveText(/owner-attested/i);
    expect((await embedded.textContent()) ?? "").toMatch(/source artifact not currently accessible/i);
    // Validated-prototype must not be readable as repository-verified.
    expect((await embedded.textContent()) ?? "").toMatch(/nothing here is read from a repository or independently reproduced/i);
  });

  test("the anchor record is the directly verified one", async ({ page }) => {
    const diagnosis = page.locator('[data-physical="diagnosis"]');
    await expect(diagnosis.locator(".phys-record__evidence")).toHaveText(/directly verified/i);
    await expect(diagnosis.locator(".phys-record__verified")).toContainText("2026-08-08");
  });

  test("no forbidden capability is CLAIMED anywhere in the chapter", async ({ page }) => {
    const body = (await page.locator("[data-physical-chapter]").textContent()) ?? "";
    // A disclaimer must not trip this. "No autonomous navigation" is exactly the
    // sentence that prevents the claim, so negated occurrences are removed
    // before matching and only assertions can fail.
    // Split into clauses and drop any that carries a negation. A fixed-width
    // window fails on chained disclaimers ("not X, not Y, not Z") because the
    // first negation swallows the window and leaves the last clause exposed.
    const strip = (s: string): string =>
      s
        .split(/[.;,]/)
        .filter((clause) => !/\b(no|not|never|without|neither|nor)\b/i.test(clause))
        .join(" . ");
    const asserted = strip(body);
    for (const pattern of [
      /\bSLAM\b/i, /\bROS\b/, /\bPX4\b/i, /\bArduPilot\b/i,
      /autonomous (navigation|systems? deployed|drone)/i,
      /computer[- ]vision (robotics|navigation)/i,
      /industrial automation/i, /IoT fleet/i, /edge AI/i,
      /production (drone|robotics)/i, /flight[- ]controller development/i,
    ]) {
      expect(asserted, `physical chapter ASSERTS ${pattern}`).not.toMatch(pattern);
    }
    // And prove the guard still bites on an unnegated claim.
    expect(strip("we operate an autonomous navigation stack")).toMatch(/autonomous navigation/i);
    expect(strip("no autonomous navigation is claimed")).not.toMatch(/autonomous navigation/i);
  });

  test("no fabricated metric appears", async ({ page }) => {
    const body = (await page.locator("[data-physical-chapter]").textContent()) ?? "";
    for (const p of [/\b\d+(\.\d+)?%\s*(uptime|accuracy|success)\b/i, /\b\d+\s*(devices|units|deployments|flights)\b/i]) {
      expect(body).not.toMatch(p);
    }
  });
});

test.describe("physical chapter — the diagnostic trace", () => {
  test("all six stages are present and ordered", async ({ page }) => {
    await gotoAndReady(page);
    await expect(page.locator("[data-trace-stage]")).toHaveCount(DIAGNOSTIC_PATH.length);
    for (const s of DIAGNOSTIC_PATH) {
      await expect(page.locator(`[data-trace-link="${s.id}"]`)).toBeVisible();
    }
  });

  test("the trace carries its measured evidence, not a summary", async ({ page }) => {
    await gotoAndReady(page);
    await page.locator('[data-trace-link="measure"]').click();
    // The actual kernel line is the proof; paraphrasing it would weaken the claim.
    await expect(page.locator('[data-trace-stage="measure"]')).toContainText(
      "Buffer I/O error on dev sdb1, logical block 0",
    );
  });

  test("stepping shows one stage and marks it non-visually", async ({ page }) => {
    await gotoAndReady(page);
    await page.locator('[data-trace-link="contain"]').click();
    await expect(page.locator('[data-trace-stage="contain"]')).toBeVisible();
    await expect(page.locator('[data-trace-stage="symptom"]')).toBeHidden();
    await expect(page.locator('[data-trace-link="contain"]')).toHaveAttribute("aria-current", "true");
    await expect(page.locator('[data-trace-link][aria-current="true"]')).toHaveCount(1);
  });

  test("the trace is keyboard operable along the causal path", async ({ page }) => {
    await gotoAndReady(page);
    await page.locator('[data-trace-link="symptom"]').focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[data-trace-link="isolate"]')).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("End");
    await expect(page.locator('[data-trace-link="recover"]')).toHaveAttribute("aria-current", "true");
  });

  test("the document marker does not collide with stage markers", async ({ page }) => {
    await gotoAndReady(page);
    await expect(page.locator("[data-trace-stage]")).toHaveCount(DIAGNOSTIC_PATH.length);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-trace-stage"))).toBe(false);
  });
});

test.describe("physical chapter — model parity", () => {
  test("the parity checker fails when the model drifts from the served HTML", () => {
    const script = resolve(process.cwd(), "scripts/check-physical-parity.mjs");
    const model = resolve(process.cwd(), "src/physical/physical-model.ts");
    const original = readFileSync(model, "utf8");

    const clean = spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });
    expect(clean.status, "parity must pass before drift").toBe(0);

    try {
      writeFileSync(model, original.replace("Hardware fault isolation", "Hardware fault isolation DRIFT"));
      const drifted = spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });
      expect(drifted.status, "parity must FAIL once model and HTML disagree").not.toBe(0);
      expect(drifted.stderr).toContain("physical parity: FAIL");
    } finally {
      writeFileSync(model, original);
    }

    const restored = spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });
    expect(restored.status).toBe(0);
  });

  test("parity covers the fields most likely to drift silently", () => {
    // A name change is obvious in review. An index or a verification date is
    // not — those are exactly the fields that rot unnoticed.
    const script = resolve(process.cwd(), "scripts/check-physical-parity.mjs");
    const model = resolve(process.cwd(), "src/physical/physical-model.ts");
    const original = readFileSync(model, "utf8");
    const run = () => spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });

    for (const [label, from, to, expected] of [
      ["record index", 'index: "03",\n    name: "Aerial platform research"', 'index: "07",\n    name: "Aerial platform research"', "index differs"],
      ["lastVerified", 'lastVerified: "2026-08-08"', 'lastVerified: "2026-01-01"', "lastVerified differs"],
      ["lastVerified removed", '    lastVerified: "2026-08-08",\n', "", "lastVerified differs"],
    ] as const) {
      try {
        const mutated = original.replace(from, to);
        expect(mutated, `${label}: mutation anchor did not match`).not.toBe(original);
        writeFileSync(model, mutated);
        const r = run();
        expect(r.status, `${label} drift must FAIL parity`).not.toBe(0);
        expect(r.stderr, `${label} must be named in the failure`).toContain(expected);
      } finally {
        writeFileSync(model, original);
      }
    }
    expect(run().status, "restored model must pass").toBe(0);
  });
});

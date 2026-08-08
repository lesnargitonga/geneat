import { test, expect } from "@playwright/test";
import { gotoAndReady } from "./helpers";
import { FLAGSHIP_PROOF, PORTFOLIO_CLASSES } from "../src/proof/proof-model";

/**
 * Wave E: the flagship proof chapter.
 *
 * The assertions that matter most are the ones about *absence* — that no
 * unmeasured figure appears, that sensitive projects carry no imagery or
 * claims, and that removing every image still leaves the argument intact.
 * Those are the ways a proof section usually goes wrong.
 */

test.describe("hero to proof transformation", () => {
  test("the flagship route settles deterministically", async ({ page }) => {
    await gotoAndReady(page);
    await page.locator("[data-flagship-route]").scrollIntoViewIfNeeded();

    await page.waitForFunction(
      () => document.documentElement.dataset["flagshipPhase"] === "complete",
      null,
      { timeout: 10_000 },
    );

    // Settles on the final step of the operational route.
    await expect(page.locator('[data-route-step="recovery"]')).toHaveAttribute(
      "aria-current",
      "true",
    );

    // And then stops — no ambient loop.
    await page.waitForTimeout(700);
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
  });

  test("uses one shared signal engine, not a project-specific one", async ({ page }) => {
    await gotoAndReady(page);
    const described = await page.evaluate(() => window.__STUDY_A__!.flagshipEngine());

    expect(described).not.toBeNull();
    // Read through the instance's own constructor — see portfolio-fixture.
    expect(described!.engine).toBe("SignalController");
    expect(described!.viewEngine).toBe("SignalView");
    expect(described!.steps).toBe(6);
    expect(described!.grammar).toBe("gen-eat-hazina");
  });

  test("the route is complete without any animation", async ({ page }) => {
    // No diagnostics, no waiting: the served markup must already carry it.
    await page.goto("/");

    const steps = page.locator(".route-text li");
    await expect(steps).toHaveCount(6);
    await expect(steps.first()).toContainText("Conversation");
    await expect(steps.last()).toContainText("Recovery");
  });
});

test.describe("flagship proof content", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page);
  });

  test("answers the six required questions", async ({ page }) => {
    const flagship = page.locator(".flagship");
    // problem, what exists, what is hard, evidence, what is unproven, where to look
    await expect(flagship.locator(".flagship__claim")).toContainText("multi-tenant");
    await expect(flagship.locator(".status-set .status")).toHaveCount(4);
    await expect(flagship).toContainText("The difficult part");
    await expect(flagship.locator("[data-proof]")).toHaveCount(4);
    await expect(flagship).toContainText("What is not proven here");
    await expect(flagship.locator(".flagship__links a")).toHaveCount(2);
  });

  test("every proof object states claim, source, verification and limit", async ({ page }) => {
    const objects = page.locator("[data-proof]");
    const count = await objects.count();
    expect(count).toBe(FLAGSHIP_PROOF.length);

    for (let i = 0; i < count; i += 1) {
      const object = objects.nth(i);
      await expect(object.locator(".proof-object__claim")).not.toBeEmpty();
      const terms = await object.locator("dt").allTextContents();
      expect(terms).toEqual(["Type", "Source", "Verified", "Limit"]);
    }
  });

  test("proof images declare intrinsic dimensions and lazy loading", async ({ page }) => {
    const images = page.locator(".proof-object__media img");
    const count = await images.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i += 1) {
      const image = images.nth(i);
      // Dimensions are what prevent layout shift when the image arrives.
      expect(Number(await image.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(await image.getAttribute("height"))).toBeGreaterThan(0);
      await expect(image).toHaveAttribute("loading", "lazy");
      const alt = await image.getAttribute("alt");
      expect(alt, "proof media must carry meaningful alt text").toBeTruthy();
      expect(alt!.length).toBeGreaterThan(30);
    }
  });

  test("status is readable without colour", async ({ page }) => {
    await expect(page.locator('[data-status="live"]').first()).toContainText("LIVE");
    await expect(page.locator('[data-status="down"]')).toContainText("NOT CURRENTLY REACHABLE");
    // Each status also carries what it refers to and when it was checked.
    await expect(page.locator('[data-status="down"] .status__verified')).toContainText("2026-08-09");
  });

  test("the live product APIs are named, not merely asserted", async ({ page }) => {
    // A status that says LIVE without saying *what* is live is unfalsifiable.
    const apis = page.locator('[data-project="apis"]');
    await expect(apis).toContainText("LIVE");
    await expect(apis).toContainText("geneat-api");
    await expect(apis).toContainText("hazina-api");
  });

  test("conversation is declared unavailable, not quietly omitted", async ({ page }) => {
    // The half that does not work has to be as visible as the half that does.
    const conv = page.locator('[data-project="conversation"]');
    await expect(conv).toContainText("NOT CURRENTLY REACHABLE");
    await expect(conv).toContainText("Model-backed conversation");
  });

  test("the backend being down is stated, not hidden", async ({ page }) => {
    // The honest half of the story must be as visible as the good half.
    await expect(page.locator('[data-proof="backend-reachability"]')).toContainText(
      "not currently running",
    );
  });

  test("no unmeasured figure is presented as proof", async ({ page }) => {
    const body = (await page.locator(".flagship").textContent()) ?? "";
    for (const pattern of [
      /\b\d[\d,.]*\s*(orders|customers|users|merchants|transactions|cafés|cafes)\b/i,
      /\b(KES|USD|\$)\s?\d/i,
      /\b\d+(\.\d+)?%\s*(uptime|conversion|accuracy|growth)\b/i,
    ]) {
      expect(body, `flagship matched ${pattern}`).not.toMatch(pattern);
    }
  });
});

test.describe("media failure", () => {
  test("the flagship still makes its case when every image fails", async ({ page }) => {
    // Abort all image requests before navigating.
    await page.route("**/proof/*", (route) => route.abort());
    await gotoAndReady(page);

    // Claims, sources, verification dates and the route all survive.
    await expect(page.locator("[data-proof]")).toHaveCount(4);
    await expect(page.locator(".route-text li")).toHaveCount(6);
    await expect(page.locator('[data-proof="geneat-storefront"] .proof-object__claim')).toContainText(
      "publicly reachable",
    );
    await expect(page.locator(".proof-object__fallback").first()).toContainText("unavailable");
    await expect(page.locator(".flagship__links a")).toHaveCount(2);

    // No spinner is left behind.
    await expect(page.locator(".spinner, [role='progressbar']")).toHaveCount(0);
  });
});

test.describe("portfolio range cue", () => {
  test("names four further problem classes", async ({ page }) => {
    await gotoAndReady(page);
    const items = page.locator("[data-portfolio-class]");
    await expect(items).toHaveCount(4);

    for (const id of ["care", "public-trust", "governance", "physical"]) {
      await expect(page.locator(`[data-portfolio-class="${id}"]`)).toBeVisible();
    }
  });

  test("claims nothing about the sensitive programmes", async ({ page }) => {
    await gotoAndReady(page);
    const cue = page.locator("[data-portfolio-cue]");

    // Every entry is explicitly pending.
    await expect(cue.locator('[data-evidence="pending"]')).toHaveCount(4);

    // No status label, no imagery, no metric.
    await expect(cue.locator("img")).toHaveCount(0);
    const text = (await cue.textContent()) ?? "";
    for (const forbidden of [/\bLIVE\b/, /\bdeployed\b/i, /\bpatients?\b/i, /\bdonors?\b/i,
      /\bchildren\b/i, /\bnurses?\b/i, /\b\d+\s*(users|clients|records)\b/i]) {
      expect(text, `portfolio cue matched ${forbidden}`).not.toMatch(forbidden);
    }
  });

  test("is a list, not a grid of equal project cards", async ({ page }) => {
    await gotoAndReady(page);
    // §25.4 rejects equal cards. A semantic list keeps these subordinate.
    await expect(page.locator("ul[data-portfolio-list]")).toHaveCount(1);
    expect(PORTFOLIO_CLASSES.every((c) => c.evidence === "pending")).toBe(true);
  });
});

test.describe("outbound links", () => {
  test("only verified project links are published", async ({ page }) => {
    await gotoAndReady(page);
    const links = page.locator(".flagship__links a");
    await expect(links).toHaveCount(2);

    const verified = ["https://geneat.lesnarai.co.ke", "https://hazina.lesnarai.co.ke"];
    for (let i = 0; i < 2; i += 1) {
      const href = await links.nth(i).getAttribute("href");
      expect(verified, `unverified link published: ${href}`).toContain(href);
      // New tab, and safely.
      await expect(links.nth(i)).toHaveAttribute("target", "_blank");
      await expect(links.nth(i)).toHaveAttribute("rel", /noopener/);
      // The name says where it goes.
      expect((await links.nth(i).textContent()) ?? "").toMatch(/Gen-Eat|Hazina/);
    }
  });

  test("the suspended backend is not published as a link", async ({ page }) => {
    await gotoAndReady(page);
    // A dead endpoint must never be offered as something to click.
    // Match the legacy host exactly. A substring test would also catch the
    // live geneat-api./hazina-api. hostnames, which are legitimately linked.
    await expect(page.locator('a[href*="//api.lesnarai.co.ke"]')).toHaveCount(0);
    await expect(page.locator('a[href*="onrender.com"]')).toHaveCount(0);
  });
});

test.describe("endpoint proof links", () => {
  test("both live API health checks are inspectable and open safely", async ({ page }) => {
    await gotoAndReady(page);
    const links = page.locator(".endpoint-link");
    await expect(links).toHaveCount(2);
    for (const product of ["geneat", "hazina"]) {
      const link = page.locator(`[data-endpoint="${product}"]`);
      // Only the health path is published — never admin, docs or openapi.
      await expect(link).toHaveAttribute("href", new RegExp(`^https://${product}-api\\.lesnarai\\.co\\.ke/healthz$`));
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAttribute("target", "_blank");
      // Accessible name says where it goes and that it leaves the page.
      expect((await link.textContent()) ?? "").toMatch(/health check/i);
    }
  });

  test("no admin, docs or introspection path is ever linked", async ({ page }) => {
    await gotoAndReady(page);
    for (const bad of ["/admin", "/docs", "/redoc", "openapi.json", "/mock/"]) {
      await expect(page.locator(`a[href*="${bad}"]`)).toHaveCount(0);
    }
  });
});

test.describe("reduced motion", () => {
  test("reaches the equivalent complete proof", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await gotoAndReady(page, "/?diagnostics=1");
    await page.locator("[data-flagship-route]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Direct semantic swap — complete immediately, no reveal.
    expect(await page.evaluate(() => document.documentElement.dataset["flagshipPhase"])).toBe(
      "complete",
    );
    await expect(page.locator('[data-route-step="recovery"]')).toHaveAttribute(
      "aria-current",
      "true",
    );

    // Same proof, same status, same links.
    await expect(page.locator("[data-proof]")).toHaveCount(4);
    await expect(page.locator(".status-set .status")).toHaveCount(4);
    await expect(page.locator(".route-text li")).toHaveCount(6);
    await context.close();
  });
});

test.describe("320px composition", () => {
  test("the flagship is usable at the narrowest viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoAndReady(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    await expect(page.locator("[data-proof]")).toHaveCount(4);
    await expect(page.locator(".route-text li")).toHaveCount(6);

    // Route steps stay tappable rather than collapsing into a carousel.
    const steps = page.locator("[data-route-step]");
    await expect(steps).toHaveCount(6);
    const box = await steps.first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

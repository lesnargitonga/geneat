import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gotoAndReady } from "./helpers";
import {
  WORK_RECORDS,
  WORK_MATURITY_LABEL,
  PROOF_STATE_LABEL,
} from "../src/work/work-model";

test.describe("work register — structure", () => {
  test("every record is served in full", async ({ page }) => {
    await gotoAndReady(page);
    await expect(page.locator("[data-work]")).toHaveCount(WORK_RECORDS.length);
    for (const r of WORK_RECORDS) {
      const entry = page.locator(`[data-work="${r.id}"]`);
      await expect(entry).toBeVisible();
      await expect(entry).toContainText(r.name);
      await expect(entry).toContainText(WORK_MATURITY_LABEL[r.maturity]);
      await expect(entry).toContainText(PROOF_STATE_LABEL[r.proofState]);
    }
  });

  test("every record states what it does not claim", async ({ page }) => {
    await gotoAndReady(page);
    for (const r of WORK_RECORDS) {
      expect(r.notClaimed.trim().length, `${r.id} has an empty boundary`).toBeGreaterThan(20);
      await expect(page.locator(`[data-work="${r.id}"] .work-record__boundary`)).toContainText(
        r.notClaimed.slice(0, 40),
      );
    }
  });

  test("maturity and proof state are words, never colour alone", async ({ page }) => {
    await gotoAndReady(page);
    for (const r of WORK_RECORDS) {
      // The attribute drives the styling; the text has to carry the same fact.
      await expect(page.locator(`[data-work="${r.id}"] .work-record__maturity`)).toHaveText(
        WORK_MATURITY_LABEL[r.maturity],
      );
      await expect(page.locator(`[data-work="${r.id}"] .work-record__proof-state`)).toHaveText(
        PROOF_STATE_LABEL[r.proofState],
      );
    }
  });

  test("the register heading outranks its own lede", async ({ page }) => {
    await gotoAndReady(page);
    const sizes = await page.evaluate(() => {
      const px = (s: string) => parseFloat(getComputedStyle(document.querySelector(s)!).fontSize);
      return {
        heading: px(".work-unit__head .section-heading--sub"),
        // The chapter lede, since the unit no longer carries a duplicate one.
        lede: px("#work > .section-lede"),
      };
    });
    expect(sizes.heading, "a heading the size of its lede is not a hierarchy").toBeGreaterThan(
      sizes.lede,
    );
  });
});

test.describe("work register — truth and safety", () => {
  /**
   * The register aggregates work, which is exactly when leakage happens: a
   * hostname or path that was fine inside a private research note becomes
   * public the moment it is quoted in visitor copy.
   */
  test("no private infrastructure detail reaches visitor-facing copy", async ({ page }) => {
    await gotoAndReady(page);
    const text = (await page.locator("#work").textContent()) ?? "";
    const html = (await page.locator("#work").innerHTML()) ?? "";

    const forbidden: [RegExp, string][] = [
      [/\b\d{1,3}(?:\.\d{1,3}){3}\b/, "an IP address"],
      [/localhost|127\.0\.0\.1/i, "a loopback address"],
      [/\/home\/[a-z]/i, "a private filesystem path"],
      [/\/opt\/apps\//i, "a host deployment path"],
      [/\b\w+_prod\b/i, "a database name"],
      [/github\.com/i, "a repository link"],
      [/\/admin\b/i, "an admin path"],
      [/\bBearer\b|api[_-]?key/i, "credential material"],
      [/\+254\s*\d|\b07\d{8}\b/, "a phone number"],
    ];
    for (const [re, what] of forbidden) {
      expect(re.test(text) || re.test(html), `work register exposes ${what}`).toBe(false);
    }
  });

  test("no regulatory or clinical claim is made for care work", async ({ page }) => {
    await gotoAndReady(page);
    const carepro = (await page.locator('[data-work="carepro"]').textContent()) ?? "";
    // Split on clause boundaries and drop negated clauses, so the record's own
    // disclaimer ("no regulatory approval") does not trip the guard that exists
    // to catch the positive claim.
    const asserted = carepro
      .split(/[.;,]/)
      .filter((clause) => !/\b(no|not|never|without|neither|nor)\b/i.test(clause))
      .join(" . ");
    for (const claim of [
      /regulatory approv/i,
      /medical device/i,
      /clinical decision/i,
      /certified/i,
      /HIPAA|compliance certified/i,
      /diagnos/i,
    ]) {
      expect(claim.test(asserted), `CarePro asserts "${claim}"`).toBe(false);
    }
    // And prove the guard bites: an unnegated claim must trip it.
    expect(/regulatory approv/i.test("The platform has regulatory approval")).toBe(true);
  });

  test("no stale regression total appears in visitor copy", async ({ page }) => {
    await gotoAndReady(page);
    const text = (await page.locator("#work").textContent()) ?? "";
    expect(/\b\d{2,4}\s+tests?\b/i.test(text), "a raw test count ages immediately").toBe(false);
  });

  test("external proof links are real, safe destinations", async ({ page }) => {
    await gotoAndReady(page);
    const links = await page.locator("#work a[href^='http']").evaluateAll((els) =>
      els.map((e) => ({
        href: (e as HTMLAnchorElement).href,
        rel: e.getAttribute("rel") ?? "",
        target: e.getAttribute("target") ?? "",
      })),
    );
    expect(links.length, "the register should link its public proof").toBeGreaterThan(0);
    for (const l of links) {
      expect(l.href.startsWith("https://"), `${l.href} is not https`).toBe(true);
      expect(l.rel, `${l.href} missing noopener`).toContain("noopener");
      expect(l.target).toBe("_blank");
      expect(/localhost|127\.|\/admin|\/docs|openapi/i.test(l.href), `${l.href} is not a public surface`).toBe(
        false,
      );
    }
  });

  test("unlinked proof is never rendered as a link", async ({ page }) => {
    await gotoAndReady(page);
    for (const r of WORK_RECORDS) {
      for (const [i, p] of r.proofs.entries()) {
        if (p.kind !== "unlinked") continue;
        const item = page.locator(`[data-work="${r.id}"] .work-proof__item`).nth(i);
        await expect(item).toHaveClass(/work-proof__item--unlinked/);
        await expect(item.locator("a")).toHaveCount(0);
      }
    }
  });

  test("proof link targets are at least 44x44", async ({ page }) => {
    await gotoAndReady(page);
    const small = await page.locator("#work .work-proof__link").evaluateAll((els) =>
      els
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.height < 44)
        .map((r) => Math.round(r.height)),
    );
    expect(small, "proof links must meet the 44px target minimum").toEqual([]);
  });
});

test.describe("work register — model parity", () => {
  const script = resolve(process.cwd(), "scripts/check-work-parity.mjs");
  const model = resolve(process.cwd(), "src/work/work-model.ts");
  const run = () => spawnSync("node", ["--experimental-strip-types", script], { encoding: "utf8" });

  /**
   * Wave G graded the physical work at four different evidence levels. The
   * register carries the frontier, so promoting it to the maturity of its
   * strongest single specimen would quietly overstate the whole body of work —
   * the exact drift that looks like an improvement in review.
   */
  /**
   * CarePro is the founders' own product, not an external client system.
   * Repository evidence alone could not establish the relationship — that gap
   * was real and correctly reported — and the owner context resolved it. The
   * label must not drift back to a client classification nothing evidences.
   */
  test("carepro is a live product, never a client system", () => {
    const carepro = WORK_RECORDS.find((r) => r.id === "carepro");
    expect(carepro, "the carepro record must exist").toBeDefined();
    expect(carepro!.maturity).toBe("live-product");
    expect(carepro!.maturity).not.toBe("controlled-client-system");
    // No record may claim a client relationship without evidence of one.
    for (const r of WORK_RECORDS) {
      expect(r.maturity, `${r.id} claims a client system`).not.toBe("controlled-client-system");
    }
  });

  test("no record describes its work as a client system", async ({ page }) => {
    await gotoAndReady(page);
    const text = (await page.locator("#work").textContent()) ?? "";
    expect(/client system|client platform|client decision/i.test(text)).toBe(false);
  });

  test("physical intelligence cannot be promoted to a prototype maturity", () => {
    const physical = WORK_RECORDS.find((r) => r.id === "physical");
    expect(physical, "the physical record must exist").toBeDefined();
    expect(
      physical!.maturity,
      "the physical FRONTIER is active research; validated-prototype belongs to one embedded specimen",
    ).toBe("active-research");
    expect(physical!.maturity).not.toBe("validated-prototype");
    // The boundary must keep the levels distinct rather than flattening them.
    expect(physical!.notClaimed).toMatch(/four different evidence levels|not one prototype/i);
  });

  test("the parity checker fails on drift in every public field", () => {
    const original = readFileSync(model, "utf8");
    expect(run().status, "parity must pass before drift").toBe(0);

    // Each mutation is a different class of silent rot. A name change is
    // obvious in review; a maturity promoted one step, or a verification date
    // left behind, is exactly what nobody notices.
    const drifts: readonly [string, string, string, string][] = [
      ["name", 'name: "Hazina Nomads"', 'name: "Hazina Nomads DRIFT"', "name differs"],
      ["index", 'index: "03",\n    name: "CarePro"', 'index: "09",\n    name: "CarePro"', "index differs"],
      [
        "maturity",
        '    maturity: "live-product",\n    proofState: "public-proof",\n    proofs: [\n      { label: "CarePro product"',
        '    maturity: "controlled-client-system",\n    proofState: "public-proof",\n    proofs: [\n      { label: "CarePro product"',
        "maturity attribute differs",
      ],
      ["proofState", 'proofState: "research-record"', 'proofState: "public-proof"', "proofState attribute differs"],
      ["lastVerified", 'lastVerified: "2026-08-08"', 'lastVerified: "2020-01-01"', "lastVerified differs"],
      // A published external proof link must be parity-covered: silently
      // repointing one would send visitors somewhere unverified.
      [
        "proof href",
        'href: "https://carepro.co.ke"',
        'href: "https://example.invalid"',
        "href differs",
      ],
      [
        "proof link state",
        '{ label: "CarePro product", href: "https://carepro.co.ke", kind: "external" }',
        '{ label: "CarePro product", kind: "unlinked" }',
        "link state differs",
      ],
      ["lastVerified removed", '    lastVerified: "2026-08-08",\n', "", "lastVerified differs"],
      [
        "boundary",
        "No regulatory approval, no medical-device status",
        "Fully approved for clinical use",
        "notClaimed differs",
      ],
      // A silent promotion of the physical frontier must fail parity too, not
      // only the unit assertion above.
      [
        "physical promotion",
        '    maturity: "active-research",\n    proofState: "sanitized-proof"',
        '    maturity: "validated-prototype",\n    proofState: "sanitized-proof"',
        "maturity attribute differs",
      ],
    ];

    for (const [label, from, to, expected] of drifts) {
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

  test("the checker never writes to the served markup", () => {
    const html = resolve(process.cwd(), "index.html");
    const before = readFileSync(html, "utf8");
    run();
    expect(readFileSync(html, "utf8"), "a checker that repairs drift cannot fail").toBe(before);
  });
});

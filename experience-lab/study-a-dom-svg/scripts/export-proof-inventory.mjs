/**
 * Exports the ProofArtifact inventory from the live page.
 *
 * Read from the running application rather than re-declared here, so the
 * evidence file cannot drift from what the page actually renders.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-e");
const BASE_URL = process.env.STUDY_A_URL ?? "http://127.0.0.1:4184";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE_URL}/?diagnostics=1`, { waitUntil: "load" });

const rendered = await page.$$eval("[data-proof]", (nodes) =>
  nodes.map((node) => {
    const text = (sel) => node.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    const meta = {};
    const terms = [...node.querySelectorAll("dt")];
    const defs = [...node.querySelectorAll("dd")];
    terms.forEach((t, i) => {
      meta[(t.textContent ?? "").trim().toLowerCase()] =
        (defs[i]?.textContent ?? "").replace(/\s+/g, " ").trim();
    });
    const img = node.querySelector("img");
    return {
      id: node.getAttribute("data-proof"),
      evidenceState: node.getAttribute("data-evidence"),
      claimSupported: text(".proof-object__claim"),
      artifactType: meta["type"] ?? null,
      sourceLocation: meta["source"] ?? null,
      verifiedAt: meta["verified"] ?? null,
      limitations: meta["limit"] ?? null,
      media: img
        ? {
            src: img.getAttribute("src"),
            intrinsicWidth: Number(img.getAttribute("width")),
            intrinsicHeight: Number(img.getAttribute("height")),
            loading: img.getAttribute("loading"),
            altLength: (img.getAttribute("alt") ?? "").length,
          }
        : null,
    };
  }),
);

const portfolio = await page.$$eval("[data-portfolio-class]", (nodes) =>
  nodes.map((node) => ({
    id: node.getAttribute("data-portfolio-class"),
    problemClass: node.querySelector(".portfolio__class")?.textContent?.trim() ?? null,
    programme: node.querySelector(".portfolio__programme")?.textContent?.trim() ?? null,
    evidence: node.querySelector(".portfolio__evidence")?.textContent?.trim() ?? null,
    hasImagery: node.querySelectorAll("img").length > 0,
  })),
);

await browser.close();
await mkdir(OUT, { recursive: true });
await writeFile(
  resolve(OUT, "proof-inventory.json"),
  `${JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      source: "read from the rendered page, not re-declared",
      model: "ProofArtifact (guide 28.6)",
      probeDate: "2026-08-07T07:49:04Z",
      flagshipArtifacts: rendered,
      portfolioClasses: portfolio,
      summary: {
        artifacts: rendered.length,
        verified: rendered.filter((r) => r.evidenceState === "verified").length,
        pending: rendered.filter((r) => r.evidenceState === "pending").length,
        withMedia: rendered.filter((r) => r.media).length,
        portfolioClasses: portfolio.length,
        portfolioWithImagery: portfolio.filter((p) => p.hasImagery).length,
        portfolioAllPending: portfolio.every((p) => p.evidence === "EVIDENCE PENDING"),
      },
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`proof-inventory.json — ${rendered.length} artifacts, ${portfolio.length} portfolio classes`);

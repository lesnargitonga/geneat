/**
 * Capability parity — the generated register must match what index.html serves.
 *
 * Generation and validation are separate operations on purpose. This script
 * never writes: it regenerates the expected markup from the model and compares
 * it to the region between the markers in `index.html`. If someone edits
 * `capability-model.ts` and forgets to regenerate, this fails.
 *
 * Run:   node --experimental-strip-types scripts/check-capability-parity.mjs
 * Regen: node --experimental-strip-types scripts/generate-capability-register.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAPABILITIES, MATURITY_LABEL } from "../src/capability/capability-model.ts";
import { glyphMarkup } from "../src/capability/capability-glyph.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(HERE, "../index.html");

/** Stable markers, so the region is located explicitly rather than by guesswork. */
export const START_MARKER = "<div class=\"capability\" data-capability-register>";
export const END_MARKER = "</div>\n          </div>";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The comparable shape of the register.
 *
 * Rather than diff raw HTML — which would fail on indentation a formatter could
 * legitimately change — this extracts the semantic content each side asserts:
 * ids, names, indices, glyph geometry, maturity, behaviours, proofs and
 * boundaries. Any real drift in what the page *claims* is caught; pure
 * whitespace is not.
 */
function expectedShape() {
  return CAPABILITIES.map((c) => ({
    id: c.id,
    index: c.index,
    name: c.name,
    maturity: c.maturity,
    maturityLabel: MATURITY_LABEL[c.maturity],
    changes: c.changes,
    behaviours: [...c.behaviours],
    proofs: c.proofs.map((p) => ({ statement: p.statement, source: p.source, verified: p.verified ?? null })),
    boundary: c.boundary,
    glyph: glyphMarkup(c.glyph),
  }));
}

function actualShape(region) {
  const out = [];
  const entryRe = /<article\s+class="cap-entry"[\s\S]*?<\/article>/g;
  for (const block of region.match(entryRe) ?? []) {
    const pick = (re) => (block.match(re)?.[1] ?? "").trim();
    const all = (re) => [...block.matchAll(re)].map((m) => m[1].trim());
    out.push({
      id: pick(/data-capability="([^"]+)"/),
      index: pick(/class="cap-entry__index"[^>]*>([^<]*)</),
      name: pick(/class="cap-entry__name"[^>]*>([^<]*)</),
      maturity: pick(/class="cap-entry__maturity" data-maturity="([^"]+)"/),
      maturityLabel: pick(/class="cap-entry__maturity" data-maturity="[^"]+">([^<]*)</),
      changes: pick(/class="cap-entry__changes">([\s\S]*?)<\/p>/),
      behaviours: all(/<li>([^<]*)<\/li>/g),
      proofs: [...block.matchAll(/<li class="cap-proof">([\s\S]*?)<\/li>/g)].map((m) => {
        const frag = m[1];
        const verified = frag.match(/class="cap-proof__verified">verified ([^<]*)</)?.[1]?.trim() ?? null;
        return {
          statement: (frag.match(/class="cap-proof__statement">([\s\S]*?)<\/p>/)?.[1] ?? "").trim(),
          source: (frag.match(/class="cap-proof__source">([^<]*)</)?.[1] ?? "").trim(),
          verified,
        };
      }),
      boundary: pick(/class="cap-entry__boundary-label">[^<]*<\/span>\s*([\s\S]*?)<\/p>/),
      glyph: (block.match(/<svg class="cap-glyph"[\s\S]*?<\/svg>/) ?? [""])[0],
    });
  }
  return out;
}

const html = await readFile(INDEX, "utf8");
const start = html.indexOf(START_MARKER);
if (start === -1) {
  console.error("capability parity: FAIL — start marker not found in index.html");
  process.exit(1);
}
const region = html.slice(start);

const expected = expectedShape();
const actual = actualShape(region);

const problems = [];
if (actual.length !== expected.length) {
  problems.push(`entry count: expected ${expected.length}, found ${actual.length}`);
}

for (const want of expected) {
  const got = actual.find((a) => a.id === want.id);
  if (!got) {
    problems.push(`${want.id}: missing from index.html`);
    continue;
  }
  for (const key of ["index", "name", "maturity", "maturityLabel", "changes", "boundary", "glyph"]) {
    const w = key === "glyph" ? want[key] : esc(want[key]);
    if (got[key] !== w) {
      problems.push(`${want.id}.${key}: model and HTML disagree\n    model: ${String(w).slice(0, 90)}\n    html : ${String(got[key]).slice(0, 90)}`);
    }
  }
  const wantB = want.behaviours.map(esc);
  if (JSON.stringify(got.behaviours) !== JSON.stringify(wantB)) {
    problems.push(`${want.id}.behaviours: ${wantB.length} in model, ${got.behaviours.length} in HTML — content differs`);
  }
  const wantP = want.proofs.map((p) => ({ statement: esc(p.statement), source: esc(p.source), verified: p.verified }));
  if (JSON.stringify(got.proofs) !== JSON.stringify(wantP)) {
    problems.push(`${want.id}.proofs: model and HTML disagree (${wantP.length} vs ${got.proofs.length})`);
  }
}

if (problems.length) {
  console.error("capability parity: FAIL");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\n  Regenerate with:");
  console.error("    node --experimental-strip-types scripts/generate-capability-register.mjs");
  process.exit(1);
}

console.log(`capability parity: PASS — ${expected.length} capabilities, ${expected.reduce((n, c) => n + c.behaviours.length, 0)} behaviours, ${expected.reduce((n, c) => n + c.proofs.length, 0)} proofs match index.html`);

/**
 * Physical parity — the served chapter must match the model.
 *
 * Same contract as the capability gate: this never writes. It regenerates the
 * expected shape from `physical-model.ts` and compares semantic content — not
 * raw HTML — against `index.html`, so reindentation cannot cause a false
 * failure while real drift still fails.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DIAGNOSTIC_PATH, PHYSICAL_RECORDS, MATURITY_LABEL, EVIDENCE_LABEL } from "../src/physical/physical-model.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const html = await readFile(resolve(HERE, "../index.html"), "utf8");
const start = html.indexOf('<div class="physical" data-physical-chapter>');
if (start === -1) { console.error("physical parity: FAIL — chapter marker not found"); process.exit(1); }
const region = html.slice(start);

const problems = [];

// stages
const stageBlocks = region.match(/<li class="trace__stage"[\s\S]*?<\/li>\s*(?=<li class="trace__stage"|<\/ol>)/g) ?? [];
if (stageBlocks.length !== DIAGNOSTIC_PATH.length) {
  problems.push(`stage count: model ${DIAGNOSTIC_PATH.length}, html ${stageBlocks.length}`);
}
for (const s of DIAGNOSTIC_PATH) {
  const block = stageBlocks.find((b) => b.includes(`data-trace-stage="${s.id}"`));
  if (!block) { problems.push(`${s.id}: stage missing from index.html`); continue; }
  const pick = (re) => (block.match(re)?.[1] ?? "").trim();
  const dds = [...block.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => m[1].trim());
  const want = [esc(s.input), esc(s.acts), esc(s.output), esc(s.grounding)];
  if (pick(/class="trace__name">([^<]*)</) !== esc(s.name)) problems.push(`${s.id}.name differs`);
  if (pick(/class="trace__index" aria-hidden="true">([^<]*)</) !== esc(s.index)) problems.push(`${s.id}.index differs`);
  if (JSON.stringify(dds) !== JSON.stringify(want)) problems.push(`${s.id}: stage detail differs from the model`);
}

// records
const recBlocks = region.match(/<article class="phys-record"[\s\S]*?<\/article>/g) ?? [];
if (recBlocks.length !== PHYSICAL_RECORDS.length) {
  problems.push(`record count: model ${PHYSICAL_RECORDS.length}, html ${recBlocks.length}`);
}
for (const r of PHYSICAL_RECORDS) {
  const block = recBlocks.find((b) => b.includes(`data-physical="${r.id}"`));
  if (!block) { problems.push(`${r.id}: record missing from index.html`); continue; }
  const pick = (re) => (block.match(re)?.[1] ?? "").trim();
  const items = [...block.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim());
  if (pick(/class="phys-record__index" aria-hidden="true">([^<]*)</) !== esc(r.index)) problems.push(`${r.id}.index differs`);
  if (pick(/class="phys-record__name">([^<]*)</) !== esc(r.name)) problems.push(`${r.id}.name differs`);
  // An absent lastVerified in the model must not appear in the HTML, and vice versa.
  const htmlVerified = block.match(/class="phys-record__verified">Verified ([^<]*)</)?.[1]?.trim() ?? null;
  const wantVerified = r.lastVerified ?? null;
  if (htmlVerified !== wantVerified) {
    problems.push(`${r.id}.lastVerified differs — model ${wantVerified ?? "(absent)"}, html ${htmlVerified ?? "(absent)"}`);
  }
  if (pick(/class="phys-record__demonstrates">([\s\S]*?)<\/p>/) !== esc(r.demonstrates)) problems.push(`${r.id}.demonstrates differs`);
  if (pick(/data-maturity="([^"]+)"/) !== r.maturity) problems.push(`${r.id}.maturity differs`);
  if (pick(/data-maturity="[^"]+">([^<]*)</) !== esc(MATURITY_LABEL[r.maturity])) problems.push(`${r.id}.maturityLabel differs`);
  if (pick(/data-evidence="([^"]+)"/) !== r.evidenceStrength) problems.push(`${r.id}.evidenceStrength differs`);
  if (pick(/data-evidence="[^"]+">([^<]*)</) !== esc(EVIDENCE_LABEL[r.evidenceStrength])) problems.push(`${r.id}.evidenceLabel differs`);
  if (pick(/class="phys-record__boundary-label">[^<]*<\/span>\s*([\s\S]*?)<\/p>/) !== esc(r.notClaimed)) problems.push(`${r.id}.notClaimed differs`);
  if (JSON.stringify(items) !== JSON.stringify(r.evidence.map(esc))) problems.push(`${r.id}: evidence list differs (${r.evidence.length} vs ${items.length})`);
}

if (problems.length) {
  console.error("physical parity: FAIL");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\n  Regenerate with:\n    node --experimental-strip-types scripts/generate-physical-record.mjs");
  process.exit(1);
}
console.log(`physical parity: PASS — ${DIAGNOSTIC_PATH.length} trace stages, ${PHYSICAL_RECORDS.length} records, ${PHYSICAL_RECORDS.reduce((n,r)=>n+r.evidence.length,0)} evidence lines match index.html`);

/**
 * Validates that the served work register matches the model.
 *
 * Generation and validation are separate operations. `generate-work-register.mjs`
 * writes markup; this only reads. It never repairs index.html, because a checker
 * that fixes drift silently converts a real failure into a no-op — the gate has
 * to be able to fail.
 *
 * Every public field is compared, including the ones that rot quietly. A name
 * change is obvious in review; a stale verification date or a maturity that
 * drifted upward is not, and those are exactly the fields where an overclaim
 * would hide.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORK_RECORDS,
  WORK_MATURITY_LABEL,
  PROOF_STATE_LABEL,
} from "../src/work/work-model.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(resolve(HERE, "../index.html"), "utf8");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

const problems = [];

for (const r of WORK_RECORDS) {
  // Each record's own markup block, so one record's fields cannot satisfy
  // another record's assertion.
  const block = HTML.match(
    new RegExp(`<article class="work-record" id="work-${r.id}" data-work="${r.id}">([\\s\\S]*?)</article>`, "i"),
  )?.[1];

  if (!block) {
    problems.push(`${r.id}: no served markup for this record`);
    continue;
  }

  const pick = (re) => norm(block.match(re)?.[1] ?? "");
  const want = (label, got, expected) => {
    if (got !== norm(esc(expected))) {
      problems.push(`${r.id}.${label} differs — model "${norm(expected)}", html "${got}"`);
    }
  };

  want("index", pick(/class="work-record__index" aria-hidden="true">([\s\S]*?)</), r.index);
  want("name", pick(/class="work-record__name">([\s\S]*?)</), r.name);
  want("category", pick(/class="work-record__category">([\s\S]*?)</), r.category);
  want("summary", pick(/class="work-record__summary">([\s\S]*?)</), r.summary);
  want("whatChanged", pick(/class="work-record__changed-text">([\s\S]*?)</), r.whatChanged);
  want("notClaimed", pick(/class="work-record__boundary-label">[\s\S]*?<\/span>([\s\S]*?)<\/p>/), r.notClaimed);

  // Maturity and proof state are checked as attribute AND label, so a hand
  // edit that changes the visible word while leaving the data attribute — the
  // exact shape an overclaim would take — is caught.
  const matAttr = block.match(/class="work-record__maturity" data-maturity="([a-z-]+)"/)?.[1] ?? "";
  if (matAttr !== r.maturity) {
    problems.push(`${r.id}.maturity attribute differs — model "${r.maturity}", html "${matAttr}"`);
  }
  want("maturityLabel", pick(/class="work-record__maturity"[^>]*>([\s\S]*?)</), WORK_MATURITY_LABEL[r.maturity]);

  const proofAttr = block.match(/class="work-record__proof-state" data-proof-state="([a-z-]+)"/)?.[1] ?? "";
  if (proofAttr !== r.proofState) {
    problems.push(`${r.id}.proofState attribute differs — model "${r.proofState}", html "${proofAttr}"`);
  }
  want("proofStateLabel", pick(/class="work-record__proof-state"[^>]*>([\s\S]*?)</), PROOF_STATE_LABEL[r.proofState]);

  // Presence as well as value: a removed date must fail, not silently pass.
  const htmlVerified = block.match(/class="work-record__verified">([\s\S]*?)</)?.[1]?.trim() ?? null;
  const wantVerified = r.lastVerified ?? null;
  if (htmlVerified !== wantVerified) {
    problems.push(
      `${r.id}.lastVerified differs — model ${wantVerified ?? "(absent)"}, html ${htmlVerified ?? "(absent)"}`,
    );
  }

  // Proof references: count, label, and — critically — that an unlinked proof
  // never acquired an href, which would turn "we cannot show you this" into a
  // link that claims we can.
  const items = [...block.matchAll(/<li class="work-proof__item([^"]*)">([\s\S]*?)<\/li>/g)];
  if (items.length !== r.proofs.length) {
    problems.push(`${r.id}.proofs count differs — model ${r.proofs.length}, html ${items.length}`);
  } else {
    r.proofs.forEach((p, i) => {
      const [, modifier, inner] = items[i];
      const isUnlinked = modifier.includes("--unlinked");
      const shouldBeUnlinked = p.kind === "unlinked" || !p.href;
      if (isUnlinked !== shouldBeUnlinked) {
        problems.push(
          `${r.id}.proofs[${i}] link state differs — model ${shouldBeUnlinked ? "unlinked" : "linked"}, html ${isUnlinked ? "unlinked" : "linked"}`,
        );
      }
      if (!shouldBeUnlinked) {
        const href = inner.match(/href="([^"]*)"/)?.[1] ?? "";
        if (href !== p.href) {
          problems.push(`${r.id}.proofs[${i}] href differs — model "${p.href}", html "${href}"`);
        }
      }
      const text = norm(inner.replace(/<[^>]*>/g, " "));
      if (!text.startsWith(norm(esc(p.label)))) {
        problems.push(`${r.id}.proofs[${i}] label differs — model "${p.label}", html "${text}"`);
      }
    });
  }
}

// Order is meaning here: the register is ranked by evidence strength, so a
// reordered index would misrepresent the ranking without changing any field.
const servedIds = [...HTML.matchAll(/<article class="work-record" id="work-([a-z-]+)"/g)].map((m) => m[1]);
const modelIds = WORK_RECORDS.map((r) => r.id);
if (servedIds.join(",") !== modelIds.join(",")) {
  problems.push(`register order differs — model [${modelIds.join(", ")}], html [${servedIds.join(", ")}]`);
}

const proofCount = WORK_RECORDS.reduce((n, r) => n + r.proofs.length, 0);

if (problems.length) {
  console.error(`work parity: FAIL — ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `work parity: PASS — ${WORK_RECORDS.length} records, ${proofCount} proof references match index.html`,
);

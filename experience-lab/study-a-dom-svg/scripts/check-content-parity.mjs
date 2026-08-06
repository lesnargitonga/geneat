/**
 * Content parity between Study A and Study B.
 *
 * The rule this enforces: *Study A and Study B must not use different content
 * to make one prototype appear stronger.* The two studies differ in how the
 * signal is rendered. They must not differ in what is claimed, what is proven,
 * what is labelled pending, or how honest the status wording is.
 *
 * Study B is read from its **frozen commit** via `git show`, never from the
 * working tree. Two reasons:
 *
 *   1. Determinism — the comparison is against the reviewed artefact, not
 *      whatever happens to be checked out.
 *   2. It doubles as an integrity check. If Study B's committed bytes ever
 *      stop matching what was reviewed, this fails.
 *
 * Differences are not automatically failures. A difference declared in
 * INTENTIONAL_DIFFERENCES with a reason passes and is reported as intentional.
 * An undeclared difference fails the run. Silence is never treated as parity.
 *
 * Usage:  node scripts/check-content-parity.mjs [--json <path>]
 */

import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDY_A_HTML = resolve(HERE, "../index.html");
const REPO_ROOT = resolve(HERE, "../../..");

const STUDY_B_COMMIT = "7dc29a231f442ee3d09fb908658e16ecd654dc3d";
const STUDY_B_PATH = "experience-lab/study-b-webgl/index.html";

/**
 * Every declared difference needs a reason. "It looked better" is not one.
 */
const INTENTIONAL_DIFFERENCES = {
  "physical-action.steps": {
    reason:
      "Study A's seven step labels (Observe/Detect/Verify/Approve/Command/Act/Record) are " +
      "specified in the Study A brief and follow dossier 13.13 more literally than Study B's " +
      "committed labels (Observe/Model/Evidence/Boundary/Approve/Act/Prove). Same process, same " +
      "truth label, different granularity: Study A merges Evidence+Boundary into Verify and adds " +
      "an explicit Command step. Study B is frozen at 7dc29a2 and may not be edited to match; " +
      "aligning the two is a follow-up that needs authorisation.",
    impact: "none on claims — no capability is asserted in one study and withheld in the other",
  },
  "limitations.visible": {
    reason:
      "Study A renders a visible 'Current limitations' block on the page, required by the Study A " +
      "brief. Study B carries the equivalent content in research/limitations.md and in its " +
      "pending-evidence panel, but not as a page section.",
    impact:
      "favours Study A on honesty, not on capability. Study B should gain the same block before " +
      "any comparative scoring, or the difference must be neutralised in the score.",
  },
  "lab-banner.text": {
    reason: "Each banner names its own study. Structural, not substantive.",
    impact: "none",
  },
  "document.title": {
    reason: "Each page names its own study and rendering approach.",
    impact: "none",
  },
  "stage.canvas": {
    reason:
      "Study B has a <canvas> element behind the SVG poster; Study A has no canvas at all. This " +
      "is the entire subject of the comparison.",
    impact: "none on content",
  },
  "evidence-pending.wording": {
    reason:
      "Study A uses the literal token 'EVIDENCE PENDING' required by the Study A brief; Study B " +
      "committed 'Evidence pending'. Same meaning, same panel, same absence of any figure.",
    impact: "none — neither study states a measured outcome",
  },
};

// --------------------------------------------------------------- extraction

function readStudyB() {
  try {
    return execFileSync("git", ["show", `${STUDY_B_COMMIT}:${STUDY_B_PATH}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `cannot read Study B at ${STUDY_B_COMMIT}:${STUDY_B_PATH} — ${error.message}`,
    );
  }
}

const stripTags = (html) => html.replace(/<[^>]+>/g, " ");
const normalise = (text) =>
  stripTags(text)
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function matchAll(html, pattern) {
  return [...html.matchAll(pattern)];
}

/** Text content of the first element carrying an attribute or class. */
function firstText(html, pattern) {
  const match = html.match(pattern);
  return match?.[1] !== undefined ? normalise(match[1]) : null;
}

function extract(html) {
  const headline = firstText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const lede = firstText(html, /class="hero__lede"[^>]*>([\s\S]*?)<\/p>/i);

  const chapters = matchAll(html, /data-chapter-link="([a-z]+)"[^>]*>([\s\S]*?)<\/a>/gi).map(
    ([, id, label]) => `${id}:${normalise(label)}`,
  );

  const systemStages = matchAll(html, /data-stage-id="([a-z]+)"/gi).map(([, id]) => id);

  const actionSteps = matchAll(
    html,
    /<li[^>]*>\s*(?:<[^>]+>\s*)*<strong>([^<]+?)\.?<\/strong>/gi,
  );

  // The action sequence is the <ol class="action-sequence"> block only.
  const actionBlock = html.match(/class="action-sequence"[^>]*>([\s\S]*?)<\/ol>/i)?.[1] ?? "";
  const actionLabels = matchAll(actionBlock, /<strong>([^<]+?)\.?<\/strong>/gi).map(([, label]) =>
    normalise(label),
  );

  const proofVerified = matchAll(html, /data-evidence="verified"/gi).length;
  const proofPending = matchAll(html, /data-evidence="pending"/gi).length;
  const pendingWording = firstText(
    html,
    /data-evidence="pending"[^>]*>([\s\S]*?)<\/p>/i,
  );

  const projectStatus = firstText(html, /data-status="live"[^>]*>([\s\S]*?)<\/p>/i);
  const physicalStatus = firstText(html, /data-status="prototype"[^>]*>([\s\S]*?)<\/p>/i);

  const ctas = matchAll(html, /class="button button--(?:primary|secondary)"[^>]*>([\s\S]*?)<\/a>/gi)
    .map(([, label]) => normalise(label))
    .filter(Boolean);

  // Gen-Eat architecture claims: the <dt>/<dd> pairs in the architecture panel.
  const architectureBlock =
    html.match(/id="proof-architecture"[\s\S]*?<dl class="proof__list">([\s\S]*?)<\/dl>/i)?.[1] ??
    "";
  const architectureClaims = matchAll(
    architectureBlock,
    /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi,
  ).map(([, term, value]) => `${normalise(term)}: ${normalise(value)}`);

  const hasVisibleLimitations = /class="limitations"/i.test(html);
  const hasCanvas = /<canvas/i.test(html);
  const projectName = firstText(html, /class="project__name"[^>]*>([\s\S]*?)<\/h3>/i);

  return {
    headline,
    supportingCopy: lede,
    chapters,
    projectName,
    architectureClaims,
    proofVerifiedCount: proofVerified,
    proofPendingCount: proofPending,
    pendingWording,
    projectStatus,
    physicalActionStatus: physicalStatus,
    actionSteps: actionLabels,
    ctas,
    hasVisibleLimitations,
    hasCanvas,
    actionStepCount: actionSteps.length,
  };
}

// ---------------------------------------------------------------- comparison

/** field key → parity id used by INTENTIONAL_DIFFERENCES */
const FIELD_TO_DIFFERENCE = {
  actionSteps: "physical-action.steps",
  hasVisibleLimitations: "limitations.visible",
  hasCanvas: "stage.canvas",
  pendingWording: "evidence-pending.wording",
};

const COMPARED_FIELDS = [
  "headline",
  "supportingCopy",
  "chapters",
  "projectName",
  "architectureClaims",
  "proofVerifiedCount",
  "proofPendingCount",
  "pendingWording",
  "projectStatus",
  "physicalActionStatus",
  "actionSteps",
  "ctas",
  "hasVisibleLimitations",
  "hasCanvas",
];

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function compare(a, b) {
  const fields = [];

  for (const field of COMPARED_FIELDS) {
    const studyA = a[field];
    const studyB = b[field];
    const match = equal(studyA, studyB);
    const differenceId = FIELD_TO_DIFFERENCE[field];
    const declared = differenceId ? INTENTIONAL_DIFFERENCES[differenceId] : undefined;

    fields.push({
      field,
      match,
      studyA,
      studyB,
      intentional: match ? false : Boolean(declared),
      differenceId: match ? null : (differenceId ?? null),
      reason: match ? null : (declared?.reason ?? null),
      impact: match ? null : (declared?.impact ?? null),
      status: match ? "MATCH" : declared ? "INTENTIONAL" : "UNDECLARED",
    });
  }

  return fields;
}

// --------------------------------------------------------------------- main

function main() {
  const argv = process.argv.slice(2);
  const jsonIndex = argv.indexOf("--json");
  const jsonPath =
    jsonIndex >= 0 && argv[jsonIndex + 1]
      ? resolve(process.cwd(), argv[jsonIndex + 1])
      : resolve(HERE, "../evidence/content-parity.json");

  const studyAHtml = readFileSync(STUDY_A_HTML, "utf8");
  const studyBHtml = readStudyB();

  const a = extract(studyAHtml);
  const b = extract(studyBHtml);
  const fields = compare(a, b);

  const matched = fields.filter((f) => f.status === "MATCH");
  const intentional = fields.filter((f) => f.status === "INTENTIONAL");
  const undeclared = fields.filter((f) => f.status === "UNDECLARED");

  const report = {
    checkedAt: new Date().toISOString(),
    studyA: { path: "experience-lab/study-a-dom-svg/index.html", source: "working tree" },
    studyB: { path: STUDY_B_PATH, source: `git ${STUDY_B_COMMIT}` },
    summary: {
      comparedFields: fields.length,
      matched: matched.length,
      intentionalDifferences: intentional.length,
      undeclaredDifferences: undeclared.length,
      verdict: undeclared.length === 0 ? "PASS" : "FAIL",
    },
    declaredDifferences: INTENTIONAL_DIFFERENCES,
    fields,
  };

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  for (const field of fields) {
    const mark =
      field.status === "MATCH" ? "  match       " : field.status === "INTENTIONAL" ? "  intentional " : "  UNDECLARED  ";
    console.log(`${mark}${field.field}`);
  }

  console.log("");
  console.log(
    `content parity: ${matched.length} match, ${intentional.length} intentional, ` +
      `${undeclared.length} undeclared → ${report.summary.verdict}`,
  );
  console.log(`report: ${jsonPath}`);

  if (undeclared.length > 0) {
    console.error("\nUndeclared differences (each must be justified or removed):");
    for (const field of undeclared) {
      console.error(`  ${field.field}`);
      console.error(`    Study A: ${JSON.stringify(field.studyA)}`);
      console.error(`    Study B: ${JSON.stringify(field.studyB)}`);
    }
    process.exitCode = 1;
  }
}

main();

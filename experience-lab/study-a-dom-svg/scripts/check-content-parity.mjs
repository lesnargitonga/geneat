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
  "wave-g.illustrative-label": [
    "Study A relabels the physical-action sequence from 'PROTOTYPE — engineering",
    "demonstration' to 'ILLUSTRATIVE CONTROL LOOP — not a built system'.",
    "",
    "The Wave G audit found no research, evidence or test backing that sequence as",
    "a built system; it entered at the Wave A/B baseline (e6a537c) purely as a",
    "narrative device for the seven-step discipline. Once Wave G placed genuinely",
    "measured work directly above it, 'PROTOTYPE' read as a second real physical",
    "system. The sequence is retained — only the claim about it changed.",
    "",
    "Study B carries the same original wording and is deliberately not modified;",
    "the divergence is the point, not an oversight.",
  ].join(" "),
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
  "signal-legend.human-review": {
    reason:
      "Study A's sixth legend entry is 'Human review'; Study B committed 'Approve'. The canonical " +
      "company-level state in dossier 3.3 is Human review, and Wave C makes it a real state id " +
      "('human-review'), so the legend was corrected to match the state model. 'Approve' remains " +
      "correct in the physical-action sequence, which is a separate seven-step system and is " +
      "unchanged in both studies.",
    impact:
      "none on claims — same position, same meaning. Study B's legend should be corrected to " +
      "match when it is next authorised for edit.",
  },
  "wave-c.stepper": {
    reason:
      "Study A has completed Wave C (signal state system); Study B is frozen at Waves A and B. " +
      "The state stepper and the per-state text panel are Wave C deliverables that Study B has " +
      "not reached yet.",
    impact:
      "SCORING HAZARD. The two studies are no longer at the same wave. No comparative score is " +
      "valid until Study B completes an equivalent Wave C, or the comparison is explicitly " +
      "restricted to the waves both have finished.",
  },
  "wave-c.state-text": {
    reason: "Per-state accessible text panel — a Wave C deliverable, as above.",
    impact: "SCORING HAZARD — see wave-c.stepper.",
  },
  "wave-e.flagship-restructure": {
    reason:
      "Wave E replaced Study A's single Gen-Eat proof panel set with a Gen-Eat + Hazina " +
      "flagship composition: a project *family* identity, three dated status rows, an " +
      "operational route driven by the shared signal engine, and four ProofArtifact objects " +
      "each carrying claim / type / source / verified / limit. Study B is frozen at Waves A " +
      "and B and has none of this. Affects projectName, architectureClaims, projectStatus, " +
      "proofVerifiedCount, proofPendingCount and ctas together — they are one change, not six.",
    impact:
      "SCORING HAZARD, and the largest one yet. Study A is now three waves ahead of Study B " +
      "(C, D, E). No comparative score under the section 8 framework is valid until Study B " +
      "reaches an equivalent wave, or the comparison is explicitly restricted to Waves A and B.",
  },
  "wave-e.status-truth": {
    reason:
      "Study B renders a single unqualified 'LIVE' for Gen-Eat, inherited from Waves A and B " +
      "where public availability was explicitly recorded as unverified. Wave E probed the " +
      "public URLs on 2026-08-07 and found both storefronts reachable but the shared backend " +
      "suspended, so Study A now renders three dated status rows instead of one badge.",
    impact:
      "Study A is strictly more truthful here. Study B's label is not wrong, it is " +
      "under-evidenced — and it should be corrected when Study B is next authorised for edit.",
  },
  "svg.aria": {
    reason:
      "Study A's signal SVG is now aria-hidden with a per-state text equivalent, because the " +
      "graphic changes with state and a static label would go stale. Study B's static poster is " +
      "still a labelled image, which is correct for a composition that does not change.",
    impact:
      "none on content — both studies expose the same information, through the mechanism " +
      "appropriate to whether their graphic is static or stateful.",
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
  // Matches either attribute on purpose. Study A migrated this loop to
  // `illustrative` in Wave G; Study B deliberately still carries `prototype`,
  // and the extractor has to read whatever each study actually serves so the
  // divergence surfaces as a value difference rather than a silent null.
  const physicalStatus = firstText(
    html,
    /data-status="(?:prototype|illustrative)"[^>]*>([\s\S]*?)<\/p>/i,
  );

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

  // The eight company-level signal states as the page presents them. Compared
  // because this is narrative content and it is now diverging — leaving it
  // uncompared would let the divergence pass silently.
  const legendBlock = html.match(/class="signal-legend"[^>]*>([\s\S]*?)<\/ol>/i)?.[1] ?? "";
  const signalLegend = matchAll(legendBlock, /<strong>([^<]+?)\.?<\/strong>/gi).map(([, label]) =>
    normalise(label),
  );

  // Wave C deliverables. Their presence in one study and not the other is the
  // clearest signal that the two are no longer at the same wave.
  const hasSignalStepper = /data-signal-stepper/i.test(html);
  const hasStateTextPanel = /data-signal-text/i.test(html);
  const svgAriaHidden = /<svg[^>]*data-signal[^>]*aria-hidden="true"/i.test(html);

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
    signalLegend,
    hasSignalStepper,
    hasStateTextPanel,
    svgAriaHidden,
  };
}

// ---------------------------------------------------------------- comparison

/** field key → parity id used by INTENTIONAL_DIFFERENCES */
const FIELD_TO_DIFFERENCE = {
  actionSteps: "physical-action.steps",
  hasVisibleLimitations: "limitations.visible",
  hasCanvas: "stage.canvas",
  pendingWording: "evidence-pending.wording",
  signalLegend: "signal-legend.human-review",
  projectName: "wave-e.flagship-restructure",
  architectureClaims: "wave-e.flagship-restructure",
  proofVerifiedCount: "wave-e.flagship-restructure",
  proofPendingCount: "wave-e.flagship-restructure",
  ctas: "wave-e.flagship-restructure",
  projectStatus: "wave-e.status-truth",
  physicalActionStatus: "wave-g.illustrative-label",
  hasSignalStepper: "wave-c.stepper",
  hasStateTextPanel: "wave-c.state-text",
  svgAriaHidden: "svg.aria",
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
  "signalLegend",
  "hasSignalStepper",
  "hasStateTextPanel",
  "svgAriaHidden",
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

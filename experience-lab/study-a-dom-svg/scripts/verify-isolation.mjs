/**
 * Isolation validation for Study A.
 *
 * Covers two of the required checks — production-diff validation and Study B
 * integrity validation — as a repeatable script rather than commands typed
 * once and quoted in a report.
 *
 * Everything here is read-only. It runs `git` in query mode and never stages,
 * commits, checks out or cleans anything.
 *
 * Usage:  node scripts/verify-isolation.mjs
 * Exit:   0 = isolated, 1 = a protected path moved
 */

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");

const BASELINE = "5479845ca8615cee3fc785c7ddd069e1f5f7671b";
const STUDY_B_COMMIT = "7dc29a231f442ee3d09fb908658e16ecd654dc3d";
const STUDY_B_BRANCH = "experience/lesnarai-v2-study-b";
const STUDY_A_BRANCH = "experience/lesnarai-v2-study-a";
const STUDY_A_PATH = "experience-lab/study-a-dom-svg/";

/** Paths the Study A brief forbids touching. */
const PROTECTED_PATHS = [
  "lesnarai-landing/",
  "experience-lab/study-b-webgl/",
  "hazina-portal/",
  "gen-eat-portal/",
  "app/",
  "alembic/",
  "deploy/",
  "render.yaml",
  "docker-compose.yml",
  "Dockerfile",
];

const git = (...args) =>
  execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }).trim();

const results = [];
let failed = false;

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  if (!passed) failed = true;
  console.log(`  ${passed ? "pass" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("Study A isolation validation\n");

// --- branch and baseline ----------------------------------------------------
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
check("on the Study A branch", branch === STUDY_A_BRANCH, `branch is ${branch}`);

/**
 * HEAD moves as Study A's waves are committed, so pinning it to the baseline
 * was only correct before the first commit. What must remain true is that HEAD
 * *descends* from the accepted baseline — that is the actual isolation
 * property, and it keeps holding as more waves land.
 */
const head = git("rev-parse", "HEAD");
let descendsFromBaseline = false;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", BASELINE, "HEAD"], { cwd: REPO_ROOT });
  descendsFromBaseline = true;
} catch {
  descendsFromBaseline = false;
}
check(
  "HEAD descends from the accepted baseline",
  descendsFromBaseline,
  head === BASELINE ? `${head} (at baseline)` : head,
);

// Everything committed since the baseline must be Study A and nothing else.
const committedSinceBaseline = git("diff", "--name-only", BASELINE, "HEAD")
  .split("\n")
  .filter(Boolean)
  .filter((path) => !path.startsWith(STUDY_A_PATH));
check(
  "commits since baseline touch only Study A",
  committedSinceBaseline.length === 0,
  committedSinceBaseline.join("; "),
);

// --- Study B was not used as the branch point -------------------------------
let branchedFromStudyB = false;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", STUDY_B_COMMIT, "HEAD"], { cwd: REPO_ROOT });
  branchedFromStudyB = true;
} catch {
  branchedFromStudyB = false;
}
check("Study B is not an ancestor of Study A", !branchedFromStudyB, "branched independently");

// --- protected paths --------------------------------------------------------
for (const path of PROTECTED_PATHS) {
  const diff = git("diff", BASELINE, "--", path);
  check(`unchanged vs baseline: ${path}`, diff.length === 0, diff.length ? "HAS DIFF" : "");
}

// --- Study B integrity ------------------------------------------------------
const studyBTip = git("rev-parse", STUDY_B_BRANCH);
check(`${STUDY_B_BRANCH} still at 7dc29a2`, studyBTip === STUDY_B_COMMIT, studyBTip);

const studyBFiles = git("ls-tree", "-r", "--name-only", STUDY_B_COMMIT, "--", "experience-lab/study-b-webgl/")
  .split("\n")
  .filter(Boolean);
check("Study B commit still holds 55 files", studyBFiles.length === 55, `${studyBFiles.length} files`);

// --- nothing tracked changed outside Study A --------------------------------
/**
 * Uncommitted work inside Study A is expected mid-wave; work outside it is the
 * failure. `git diff --name-only` is used rather than parsing `--porcelain`,
 * whose status columns are position-sensitive and whose first line loses its
 * leading space to the helper's `.trim()`.
 */
const workingChanges = [
  ...git("diff", "--name-only", "HEAD").split("\n"),
  ...git("diff", "--name-only", "--cached").split("\n"),
]
  .filter(Boolean)
  .filter((path) => !path.startsWith(STUDY_A_PATH));

check(
  "no tracked file outside Study A is modified",
  workingChanges.length === 0,
  workingChanges.join("; "),
);

// --- staging-hazard guard ---------------------------------------------------
/**
 * Study B's build residue (node_modules, dist, test-results) is still on disk
 * from the previous branch, and its .gitignore is not present on this branch.
 * A broad `git add experience-lab/` would therefore stage Study B artefacts.
 * This is a warning, not a failure — nothing is being committed — but it must
 * be visible before any future commit.
 */
const wouldStage = git("add", "--dry-run", "--", "experience-lab/")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.replace(/^add '(.*)'$/, "$1"));

const strayFromStudyB = wouldStage.filter((path) => !path.startsWith(STUDY_A_PATH));

if (strayFromStudyB.length > 0) {
  console.log("");
  console.log(`  WARN  a broad 'git add experience-lab/' would stage ${strayFromStudyB.length} file(s)`);
  console.log("        outside Study A — leftover Study B build residue on disk.");
  console.log(`        Scope any future add to '${STUDY_A_PATH}' instead.`);
  for (const path of strayFromStudyB.slice(0, 5)) console.log(`          ${path}`);
  if (strayFromStudyB.length > 5) console.log(`          … ${strayFromStudyB.length - 5} more`);
}

console.log("");
console.log(failed ? "ISOLATION VALIDATION FAILED" : "isolation validation passed");
console.log(
  `${results.filter((r) => r.passed).length}/${results.length} checks passed` +
    (strayFromStudyB.length ? `, ${strayFromStudyB.length} staging hazard(s) warned` : ""),
);

process.exitCode = failed ? 1 : 0;

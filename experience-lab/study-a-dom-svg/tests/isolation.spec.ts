import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Protected-path and Study B integrity, asserted inside the test suite.
 *
 * `scripts/verify-isolation.mjs` already checks this and is run separately,
 * but a check that only runs when someone remembers to run it is weaker than
 * one the suite enforces. `npm test` now fails if Wave C has touched anything
 * it must not.
 *
 * Read-only: every command below is a git query.
 */

const REPO_ROOT = resolve(process.cwd(), "../..");
const BASELINE = "5479845ca8615cee3fc785c7ddd069e1f5f7671b";
const STUDY_A_COMMIT = "e6a537c77adbf14ea4968ebb4280d99bd64f6f39";
const STUDY_B_COMMIT = "7dc29a231f442ee3d09fb908658e16ecd654dc3d";

const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }).trim();

const PROTECTED_PATHS = [
  "lesnarai-landing/",
  "hazina-portal/",
  "gen-eat-portal/",
  "app/",
  "alembic/",
  "deploy/",
  "render.yaml",
  "docker-compose.yml",
  "Dockerfile",
];

test.describe("isolation", () => {
  test("every protected production path is unchanged", () => {
    for (const path of PROTECTED_PATHS) {
      const diff = git("diff", BASELINE, "--", path);
      expect(diff, `${path} has diverged from the baseline`).toBe("");
    }
  });

  test("Study B remains at its committed checkpoint", () => {
    expect(git("rev-parse", "experience/lesnarai-v2-study-b")).toBe(STUDY_B_COMMIT);

    // Both the working tree and the commit graph must agree Study B is untouched.
    expect(git("diff", BASELINE, "--", "experience-lab/study-b-webgl/")).toBe("");

    const files = git(
      "ls-tree",
      "-r",
      "--name-only",
      STUDY_B_COMMIT,
      "--",
      "experience-lab/study-b-webgl/",
    )
      .split("\n")
      .filter(Boolean);
    expect(files).toHaveLength(55);
  });

  test("Study B was not used as the Study A branch point", () => {
    let isAncestor = false;
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", STUDY_B_COMMIT, "HEAD"], {
        cwd: REPO_ROOT,
      });
      isAncestor = true;
    } catch {
      isAncestor = false;
    }
    expect(isAncestor, "Study A must branch from the baseline, not from Study B").toBe(false);
  });

  test("Wave C changes are confined to Study A", () => {
    // Working-tree changes since the Study A commit.
    const changed = git("diff", "--name-only", STUDY_A_COMMIT)
      .split("\n")
      .filter(Boolean);

    for (const path of changed) {
      expect(path.startsWith("experience-lab/study-a-dom-svg/"), `${path} is outside Study A`).toBe(
        true,
      );
    }
  });

  test("no tracked file outside Study A has been modified", () => {
    // `git diff --name-only` rather than parsing `--porcelain`: porcelain's
    // status columns are position-sensitive, and the helper's `.trim()` eats
    // the leading space of the first line, which silently shifts every path by
    // one character. Asking git for names directly removes the parsing step.
    const modified = [
      ...git("diff", "--name-only", "HEAD").split("\n"),
      ...git("diff", "--name-only", "--cached").split("\n"),
    ].filter(Boolean);

    for (const path of modified) {
      expect(path.startsWith("experience-lab/study-a-dom-svg/"), `${path} is outside Study A`).toBe(
        true,
      );
    }
  });
});

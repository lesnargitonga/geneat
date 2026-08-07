import { CHAPTERS, SYSTEM_STAGES, ACTION_SEQUENCE, PARITY_CLAIMS } from "../content";
import { SIGNAL_STATES } from "../signal/signal-states";

/**
 * Development-time guard against drift between the markup and the content
 * model — and, by extension, against drift away from Study B.
 *
 * Study A and Study B must not use different content to make one prototype
 * look stronger. The parity script enforces that across the two studies; this
 * check enforces the smaller precondition inside Study A: that what
 * `content.ts` declares is actually what the page says.
 *
 * Runs in dev or with `?diagnostics=1`. It reports, it never repairs — a check
 * that silently fixes the page would hide the very drift it exists to catch.
 */

export interface IntegrityIssue {
  readonly kind:
    | "missing-in-dom"
    | "missing-in-model"
    | "count-mismatch"
    | "label-mismatch";
  readonly id: string;
  readonly detail: string;
}

function collectDataset(root: ParentNode, attribute: string): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    const value = element.getAttribute(attribute);
    if (value) found.set(value, element);
  }
  return found;
}

export function checkContentIntegrity(root: ParentNode = document): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  // --- chapters -----------------------------------------------------------
  for (const chapter of CHAPTERS) {
    if (!root.querySelector(`[data-chapter="${chapter.id}"]`)) {
      issues.push({
        kind: "missing-in-dom",
        id: chapter.id,
        detail: `CHAPTERS declares "${chapter.id}" but no section carries data-chapter="${chapter.id}"`,
      });
    }
    if (!root.querySelector(`[data-chapter-link="${chapter.id}"]`)) {
      issues.push({
        kind: "missing-in-dom",
        id: chapter.id,
        detail: `no rail link for chapter "${chapter.id}"`,
      });
    }
  }

  // --- system stages ------------------------------------------------------
  const domStages = collectDataset(root, "data-stage-id");
  const modelStageIds = new Set(SYSTEM_STAGES.map((stage) => stage.id));

  for (const stage of SYSTEM_STAGES) {
    const element = domStages.get(stage.id);
    if (!element) {
      issues.push({
        kind: "missing-in-dom",
        id: stage.id,
        detail: `SYSTEM_STAGES declares "${stage.id}" but no [data-stage-id="${stage.id}"] exists`,
      });
      continue;
    }
    const heading = element.querySelector("h3")?.textContent ?? "";
    if (!heading.includes(stage.label)) {
      issues.push({
        kind: "label-mismatch",
        id: stage.id,
        detail: `stage "${stage.id}" heading "${heading.trim()}" does not contain "${stage.label}"`,
      });
    }
  }

  for (const id of domStages.keys()) {
    if (!modelStageIds.has(id)) {
      issues.push({
        kind: "missing-in-model",
        id,
        detail: `markup declares stage "${id}" but SYSTEM_STAGES does not`,
      });
    }
  }

  // --- physical action sequence -------------------------------------------
  const domSteps = collectDataset(root, "data-action-step");
  for (const step of ACTION_SEQUENCE) {
    const element = domSteps.get(step.id);
    if (!element) {
      issues.push({
        kind: "missing-in-dom",
        id: step.id,
        detail: `ACTION_SEQUENCE declares "${step.id}" but no [data-action-step="${step.id}"] exists`,
      });
      continue;
    }
    if (!(element.textContent ?? "").includes(step.label)) {
      issues.push({
        kind: "label-mismatch",
        id: step.id,
        detail: `action step "${step.id}" does not render the label "${step.label}"`,
      });
    }
  }

  // --- signal states ------------------------------------------------------
  // The legend is the permanent, always-present list of the eight canonical
  // states. It must agree with the state model exactly — a legend that names
  // a state the controller cannot reach, or omits one it can, is the same
  // class of drift as a missing inspector stage.
  const legendItems = collectDataset(root, "data-signal-legend-state");

  for (const state of SIGNAL_STATES) {
    const element = legendItems.get(state.id);
    if (!element) {
      issues.push({
        kind: "missing-in-dom",
        id: state.id,
        detail: `SIGNAL_STATES declares "${state.id}" but no legend entry carries data-signal-legend-state="${state.id}"`,
      });
      continue;
    }
    if (!(element.textContent ?? "").includes(state.label)) {
      issues.push({
        kind: "label-mismatch",
        id: state.id,
        detail: `legend entry "${state.id}" does not render the label "${state.label}"`,
      });
    }
  }

  const modelStateIds = new Set(SIGNAL_STATES.map((state) => state.id));
  for (const id of legendItems.keys()) {
    if (!modelStateIds.has(id as (typeof SIGNAL_STATES)[number]["id"])) {
      issues.push({
        kind: "missing-in-model",
        id,
        detail: `legend declares signal state "${id}" but SIGNAL_STATES does not`,
      });
    }
  }

  // --- parity-critical counts ---------------------------------------------
  const counts: readonly [string, number, number][] = [
    ["system stages", domStages.size, PARITY_CLAIMS.systemStageCount],
    [
      "verified proof panels",
      root.querySelectorAll('[data-evidence="verified"]').length,
      PARITY_CLAIMS.verifiedProofPanels,
    ],
    [
      "pending proof panels",
      root.querySelectorAll('[data-evidence="pending"]').length,
      PARITY_CLAIMS.pendingProofPanels,
    ],
    // Scoped to sections deliberately: only an element that *is* a chapter
    // should be counted as one, whatever else on the page may carry a
    // similarly named attribute.
    ["chapters", root.querySelectorAll("section[data-chapter]").length, PARITY_CLAIMS.chapterCount],
    ["signal states", legendItems.size, SIGNAL_STATES.length],
  ];

  for (const [name, actual, expected] of counts) {
    if (actual !== expected) {
      issues.push({
        kind: "count-mismatch",
        id: name,
        detail: `${name}: markup has ${actual}, PARITY_CLAIMS expects ${expected}`,
      });
    }
  }

  return issues;
}

export function reportContentIntegrity(root: ParentNode = document): IntegrityIssue[] {
  const issues = checkContentIntegrity(root);
  for (const issue of issues) {
    console.error(`[study-a] content integrity — ${issue.detail}`);
  }
  return issues;
}

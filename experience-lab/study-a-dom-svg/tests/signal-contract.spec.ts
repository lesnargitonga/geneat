import { test, expect } from "@playwright/test";
import { SIGNAL_STATES } from "../src/signal/signal-states";
import { ACTION_SEQUENCE } from "../src/content";
import { SIGNAL_LAYER_IDS } from "../src/signal/signal-types";
import {
  HORIZONTAL_GEOMETRY,
  SEGMENT_IDS,
  VERTICAL_GEOMETRY,
} from "../src/signal/signal-geometry";
import { FULL_MOTION, MOTION_LIMITS, REDUCED_MOTION } from "../src/signal/signal-motion";

/**
 * The signal-state contract validator.
 *
 * Runs against the data model directly, with no browser involved. Everything
 * asserted here is a structural invariant — if one of these breaks, no amount
 * of visual polish in a later wave makes the system correct.
 *
 * The most important assertion in this file is the last one: the eight
 * company-level signal states and the seven-step physical-action sequence are
 * separate systems and must never be merged or renamed into each other.
 */

test.describe("signal state contract", () => {
  test("there are exactly eight canonical states in the required order", () => {
    expect(SIGNAL_STATES).toHaveLength(8);
    expect(SIGNAL_STATES.map((state) => state.id)).toEqual([
      "idea",
      "observe",
      "model",
      "engineer",
      "protect",
      "human-review",
      "act",
      "prove",
    ]);
  });

  test("state ids and indexes are unique and contiguous", () => {
    const ids = new Set(SIGNAL_STATES.map((state) => state.id));
    expect(ids.size).toBe(SIGNAL_STATES.length);

    const indexes = SIGNAL_STATES.map((state) => state.index);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("every state carries complete text for the accessible equivalent", () => {
    for (const state of SIGNAL_STATES) {
      expect(state.label.length, `${state.id} label`).toBeGreaterThan(0);
      // 40 chars is a low bar deliberately — it catches placeholders like
      // "TODO" or a duplicated label, not thin-but-real prose.
      expect(state.explanation.length, `${state.id} explanation`).toBeGreaterThan(40);
      expect(state.input.length, `${state.id} input`).toBeGreaterThan(10);
      expect(state.boundary.length, `${state.id} boundary`).toBeGreaterThan(10);
      expect(state.output.length, `${state.id} output`).toBeGreaterThan(10);
    }
  });

  test("explanations are distinct — no state is a copy of another", () => {
    const explanations = new Set(SIGNAL_STATES.map((state) => state.explanation));
    expect(explanations.size).toBe(SIGNAL_STATES.length);
  });

  test("every referenced layer exists in the layer contract", () => {
    const known = new Set<string>(SIGNAL_LAYER_IDS);
    expect(known.size).toBe(8);

    for (const state of SIGNAL_STATES) {
      for (const layer of state.activeLayers) {
        expect(known.has(layer), `${state.id} references unknown layer ${layer}`).toBe(true);
      }
    }
  });

  test("every referenced node exists in both geometries", () => {
    const horizontal = new Set(HORIZONTAL_GEOMETRY.nodes.map((node) => node.id));
    const vertical = new Set(VERTICAL_GEOMETRY.nodes.map((node) => node.id));

    for (const state of SIGNAL_STATES) {
      for (const node of state.activeNodes) {
        expect(horizontal.has(node), `${state.id}: ${node} missing from horizontal`).toBe(true);
        expect(vertical.has(node), `${state.id}: ${node} missing from vertical`).toBe(true);
      }
    }
  });

  test("every referenced segment exists", () => {
    const known = new Set(SEGMENT_IDS);
    expect(known.size).toBe(7);

    for (const state of SIGNAL_STATES) {
      for (const segment of state.completedSegments) {
        expect(known.has(segment), `${state.id}: unknown completed segment ${segment}`).toBe(true);
      }
      if (state.currentSegment) {
        expect(
          known.has(state.currentSegment),
          `${state.id}: unknown current segment ${state.currentSegment}`,
        ).toBe(true);
      }
    }
  });

  test("segment progression is monotonic and never overlaps the current segment", () => {
    for (const state of SIGNAL_STATES) {
      // Reaching state N means segments 1..N are drawn.
      expect(state.completedSegments).toHaveLength(Math.max(0, state.index - 1));

      if (state.currentSegment) {
        expect(
          state.completedSegments,
          `${state.id}: current segment is also marked complete`,
        ).not.toContain(state.currentSegment);
      }
    }
  });

  test("the human gate holds — no onward route past human review", () => {
    const humanReview = SIGNAL_STATES.find((state) => state.id === "human-review");
    expect(humanReview).toBeDefined();

    // seg-6 leaves the gate toward the action node. It must not be drawn while
    // the signal is under review, and the action node must not be active.
    expect(humanReview!.completedSegments).not.toContain("seg-6");
    expect(humanReview!.currentSegment).not.toBe("seg-6");
    expect(humanReview!.activeNodes).not.toContain("act");
    expect(humanReview!.activeLayers).not.toContain("action-node");
  });

  test("Act and Prove are meaningfully different states", () => {
    const act = SIGNAL_STATES.find((state) => state.id === "act")!;
    const prove = SIGNAL_STATES.find((state) => state.id === "prove")!;

    expect(act.emphasis).not.toBe(prove.emphasis);
    expect(act.completedSegments.length).toBeLessThan(prove.completedSegments.length);
    // The residual trace is what makes Prove read as a record rather than a
    // repeat of the action.
    expect(act.activeLayers).not.toContain("residual-trace");
    expect(prove.activeLayers).toContain("residual-trace");
  });

  test("layer activation only grows through the sequence", () => {
    // The signal accumulates structure; it never loses a layer it has gained.
    // A state that dropped a layer would read as the system forgetting.
    let previous = new Set<string>();
    for (const state of SIGNAL_STATES.slice(1)) {
      const current = new Set<string>(state.activeLayers);
      for (const layer of previous) {
        expect(current.has(layer), `${state.id} dropped layer ${layer}`).toBe(true);
      }
      previous = current;
    }
  });

  test("both geometries agree on state count, node ids and segment ids", () => {
    expect(HORIZONTAL_GEOMETRY.waypoints).toHaveLength(SIGNAL_STATES.length);
    expect(VERTICAL_GEOMETRY.waypoints).toHaveLength(SIGNAL_STATES.length);

    const horizontalNodes = HORIZONTAL_GEOMETRY.nodes.map((n) => n.id).sort();
    const verticalNodes = VERTICAL_GEOMETRY.nodes.map((n) => n.id).sort();
    expect(verticalNodes).toEqual(horizontalNodes);

    expect(HORIZONTAL_GEOMETRY.segments).toEqual(SEGMENT_IDS);
    expect(VERTICAL_GEOMETRY.segments).toEqual(SEGMENT_IDS);

    // One fewer segment than waypoints, by definition.
    expect(SEGMENT_IDS).toHaveLength(SIGNAL_STATES.length - 1);
  });

  test("motion budgets sit under the specified ceilings", () => {
    expect(FULL_MOTION.transitionMs).toBeLessThanOrEqual(MOTION_LIMITS.maxTransitionMs);
    expect(FULL_MOTION.headTravelMs).toBeLessThanOrEqual(MOTION_LIMITS.maxHeadTravelMs);
    expect(REDUCED_MOTION.transitionMs).toBeLessThanOrEqual(MOTION_LIMITS.maxReducedMs);
    expect(REDUCED_MOTION.headTravelMs).toBeLessThanOrEqual(MOTION_LIMITS.maxReducedMs);
  });

  test("the signal states and the physical-action sequence remain separate systems", () => {
    // Explicitly forbidden to merge or rename. Different lengths, different
    // ids, and — critically — the physical sequence must not acquire
    // "human-review" nor the signal acquire "detect"/"verify"/"command".
    expect(SIGNAL_STATES).toHaveLength(8);
    expect(ACTION_SEQUENCE).toHaveLength(7);

    const signalIds = new Set(SIGNAL_STATES.map((state) => state.id));
    const actionIds = new Set(ACTION_SEQUENCE.map((step) => step.id));

    for (const id of ["detect", "verify", "command", "record"]) {
      expect(actionIds.has(id), `action sequence lost "${id}"`).toBe(true);
      expect(signalIds.has(id as never), `signal states absorbed "${id}"`).toBe(false);
    }

    for (const id of ["idea", "model", "engineer", "protect", "human-review", "prove"]) {
      expect(signalIds.has(id as never), `signal states lost "${id}"`).toBe(true);
      expect(actionIds.has(id), `action sequence absorbed "${id}"`).toBe(false);
    }

    // "observe" and "act" appear in both by design and are not a merge.
    expect(signalIds.has("observe")).toBe(true);
    expect(actionIds.has("observe")).toBe(true);
    expect(signalIds.has("act")).toBe(true);
    expect(actionIds.has("act")).toBe(true);
  });
});

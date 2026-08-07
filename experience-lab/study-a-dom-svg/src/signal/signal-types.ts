/**
 * Type contract for the Lesnar Signal state system.
 *
 * Two sequences exist in this programme and they are **not** the same thing:
 *
 *   - The *company-level signal states* defined here — Idea → Observe → Model
 *     → Engineer → Protect → Human review → Act → Prove (dossier 3.3).
 *   - The *physical-action sequence* in `content.ts` — Observe → Detect →
 *     Verify → Approve → Command → Act → Record (dossier 7.11).
 *
 * They share two words (Observe, Act) and nothing else. Merging or renaming
 * either one is explicitly forbidden, so they live in separate modules with
 * separate types and are asserted separately in the contract test.
 */

export type SignalStateId =
  | "idea"
  | "observe"
  | "model"
  | "engineer"
  | "protect"
  | "human-review"
  | "act"
  | "prove";

/** The eight named SVG layers required by dossier 7.6. */
export type SignalLayerId =
  | "dormant-path"
  | "active-path"
  | "signal-head"
  | "evidence-nodes"
  | "boundary-nodes"
  | "human-gate"
  | "action-node"
  | "residual-trace";

export const SIGNAL_LAYER_IDS: readonly SignalLayerId[] = [
  "dormant-path",
  "active-path",
  "signal-head",
  "evidence-nodes",
  "boundary-nodes",
  "human-gate",
  "action-node",
  "residual-trace",
];

/**
 * What the composition is *about* in a given state. Drives colour role and
 * node treatment, so that a state reads differently without the palette
 * turning into decoration (dossier 7.5: colour communicates state).
 */
export type SignalEmphasis =
  | "uncertain"
  | "evidence"
  | "structure"
  | "boundary"
  | "human"
  | "action"
  | "proof";

export interface SignalState {
  readonly id: SignalStateId;
  readonly index: number;
  readonly label: string;
  readonly explanation: string;

  /**
   * The three fields below are an extension of the recommended contract.
   * The accessibility requirement asks the text equivalent to carry state
   * title, explanation, **input, boundary/control condition and output** —
   * which the base contract has nowhere to put. Extending the type keeps the
   * text equivalent generated from data rather than hand-written per state
   * and left to drift.
   */
  readonly input: string;
  readonly boundary: string;
  readonly output: string;

  readonly activeLayers: readonly SignalLayerId[];
  readonly activeNodes: readonly string[];
  readonly completedSegments: readonly string[];
  readonly currentSegment: string | null;
  readonly emphasis: SignalEmphasis;
}

// ------------------------------------------------------------------ geometry

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SignalNode extends Point {
  readonly id: string;
  /** Which layer group the node belongs to. */
  readonly layer: Extract<
    SignalLayerId,
    "evidence-nodes" | "boundary-nodes" | "human-gate" | "action-node"
  >;
  /** Evidence connectors need a second point; boundaries need an extent. */
  readonly anchor?: Point;
  readonly extent?: number;
}

export interface SignalGeometry {
  readonly id: "horizontal" | "vertical";
  readonly viewBox: string;
  /** One waypoint per state, in state order. */
  readonly waypoints: readonly Point[];
  readonly nodes: readonly SignalNode[];
  /** Segment ids in order; `segments[i]` joins waypoint i to i+1. */
  readonly segments: readonly string[];
}

// -------------------------------------------------------------------- motion

export type MotionBudget = {
  /** Normal state transition. Dossier cap: 450 ms. */
  readonly transitionMs: number;
  /** Signal-head travel across one segment. Cap: 650 ms. */
  readonly headTravelMs: number;
};

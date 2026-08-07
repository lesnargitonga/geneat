import type { SignalState, SignalStateId } from "./signal-types";

/**
 * The eight canonical company-level signal states (dossier 3.3).
 *
 * Model for `completedSegments` / `currentSegment`:
 *
 *   `currentSegment` is the segment the head has just travelled to *arrive* at
 *   this state; `completedSegments` are the ones already drawn behind it. So
 *   reaching state N means segments 1..N are drawn, with segment N being the
 *   one that moves.
 *
 * The exception is `idea`, where nothing has been traversed, and
 * `human-review`, where arrival happens but **no onward segment is drawn** —
 * that absence is what makes the pause visible rather than merely stated
 * (dossier 7.6: "the human gate must visibly pause the signal until
 * approval").
 */
export const SIGNAL_STATES: readonly SignalState[] = [
  {
    id: "idea",
    index: 0,
    label: "Idea",
    explanation:
      "An ambitious idea arrives as incomplete fragments. Possible structure is visible, but no route through the system has been established yet.",
    input: "An unstructured ambition, with no agreed shape.",
    boundary: "Nothing is committed to. No route is treated as valid yet.",
    output: "A set of open possibilities and an unresolved question.",
    activeLayers: ["dormant-path"],
    activeNodes: [],
    completedSegments: [],
    currentSegment: null,
    emphasis: "uncertain",
  },
  {
    id: "observe",
    index: 1,
    label: "Observe",
    explanation:
      "Evidence enters from separate sources — people, data, constraints. The signal begins at the idea source. Fragments that are not relevant stay quiet rather than being deleted.",
    input: "Field evidence, operational data, and stated constraints.",
    boundary: "Evidence is gathered before conclusions; nothing is inferred yet.",
    output: "A body of observations attached to the question.",
    activeLayers: ["dormant-path", "evidence-nodes", "signal-head", "active-path"],
    activeNodes: ["ev-1", "ev-2", "ev-3", "ev-4"],
    completedSegments: [],
    currentSegment: "seg-1",
    emphasis: "evidence",
  },
  {
    id: "model",
    index: 2,
    label: "Model",
    explanation:
      "Relationships between the observations appear and a candidate route becomes visible. Uncertainty is still shown rather than hidden — the dormant structure remains under the active path.",
    input: "Observations and the relationships between them.",
    boundary: "A candidate route only. Alternatives are not yet discarded.",
    output: "A proposed route with its uncertainty still visible.",
    activeLayers: ["dormant-path", "evidence-nodes", "active-path", "signal-head"],
    activeNodes: ["ev-1", "ev-2", "ev-3", "ev-4"],
    completedSegments: ["seg-1"],
    currentSegment: "seg-2",
    emphasis: "structure",
  },
  {
    id: "engineer",
    index: 3,
    label: "Engineer",
    explanation:
      "One route becomes structurally complete and its supporting nodes align. Invalid alternatives stay faint rather than disappearing, so the choice that was made remains legible.",
    input: "The proposed route and the constraints it must satisfy.",
    boundary: "One route is built. Rejected alternatives remain visible but inactive.",
    output: "An operational system with a defined path through it.",
    activeLayers: ["dormant-path", "evidence-nodes", "active-path", "signal-head"],
    activeNodes: ["ev-1", "ev-2", "ev-3", "ev-4"],
    completedSegments: ["seg-1", "seg-2"],
    currentSegment: "seg-3",
    emphasis: "structure",
  },
  {
    id: "protect",
    index: 4,
    label: "Protect",
    explanation:
      "Trust and safety boundaries become explicit. Unsafe routes are blocked or redirected. The boundaries are structural constraints, not alarms.",
    input: "The engineered route and its failure modes.",
    boundary: "Trust boundaries are enforced. Unsafe routes cannot proceed.",
    output: "A constrained system with defined recovery behaviour.",
    activeLayers: [
      "dormant-path",
      "evidence-nodes",
      "active-path",
      "signal-head",
      "boundary-nodes",
    ],
    activeNodes: ["ev-1", "ev-2", "ev-3", "ev-4", "bd-1", "bd-2"],
    completedSegments: ["seg-1", "seg-2", "seg-3"],
    currentSegment: "seg-4",
    emphasis: "boundary",
  },
  {
    id: "human-review",
    index: 5,
    label: "Human review",
    explanation:
      "The signal reaches the human gate and stops. No onward route is drawn and the action node cannot activate. A person decides whether this proceeds.",
    input: "A validated route awaiting a decision.",
    boundary: "The gate holds. Nothing downstream can act without approval.",
    output: "A held decision — nothing has executed.",
    activeLayers: [
      "dormant-path",
      "evidence-nodes",
      "active-path",
      "signal-head",
      "boundary-nodes",
      "human-gate",
    ],
    activeNodes: ["ev-1", "ev-2", "ev-3", "ev-4", "bd-1", "bd-2", "gate"],
    completedSegments: ["seg-1", "seg-2", "seg-3", "seg-4"],
    currentSegment: "seg-5",
    emphasis: "human",
  },
  {
    id: "act",
    index: 6,
    label: "Act",
    explanation:
      "Approval is given and the route continues past the gate to the action node. The system crosses from decision into execution and the composition becomes more solid.",
    input: "An approved decision.",
    boundary: "Only the approved route executes. The gate records that it passed.",
    output: "A real change in the world — an order, a device, a customer outcome.",
    activeLayers: [
      "dormant-path",
      "evidence-nodes",
      "active-path",
      "signal-head",
      "boundary-nodes",
      "human-gate",
      "action-node",
    ],
    activeNodes: ["ev-1", "ev-2", "ev-3", "ev-4", "bd-1", "bd-2", "gate", "act"],
    completedSegments: ["seg-1", "seg-2", "seg-3", "seg-4", "seg-5"],
    currentSegment: "seg-6",
    emphasis: "action",
  },
  {
    id: "prove",
    index: 7,
    label: "Prove",
    explanation:
      "What happened remains recorded. A residual trace shows the system that now exists, the evidence that supported it stays visible, and the outcome can be inspected after the fact.",
    input: "The executed action and everything that led to it.",
    boundary: "The record is durable. Outcomes and failures are both retained.",
    output: "A system that exists, with its decisions still accountable.",
    activeLayers: [
      "dormant-path",
      "evidence-nodes",
      "active-path",
      "signal-head",
      "boundary-nodes",
      "human-gate",
      "action-node",
      "residual-trace",
    ],
    activeNodes: ["ev-1", "ev-2", "ev-3", "ev-4", "bd-1", "bd-2", "gate", "act"],
    completedSegments: ["seg-1", "seg-2", "seg-3", "seg-4", "seg-5", "seg-6"],
    currentSegment: "seg-7",
    emphasis: "proof",
  },
];

export const SIGNAL_STATE_IDS: readonly SignalStateId[] = SIGNAL_STATES.map((state) => state.id);

const STATE_BY_ID = new Map<SignalStateId, SignalState>(
  SIGNAL_STATES.map((state) => [state.id, state]),
);

export function getSignalState(id: SignalStateId): SignalState {
  const state = STATE_BY_ID.get(id);
  if (!state) throw new Error(`unknown signal state: ${id}`);
  return state;
}

export function isSignalStateId(value: unknown): value is SignalStateId {
  return typeof value === "string" && STATE_BY_ID.has(value as SignalStateId);
}

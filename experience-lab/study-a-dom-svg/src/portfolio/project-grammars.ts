import type { SequenceState, SignalEmphasis, SignalLayerId } from "../signal/signal-types";

/**
 * Project proof grammars — a **development-only extensibility fixture**.
 *
 * §25.1: "The prototype is not the portfolio." Study A uses Gen-Eat as its first
 * detailed proof scene, and the risk that creates is architectural: a signal
 * system that silently assumes Gen-Eat is the only serious project.
 *
 * This module exists to prove that assumption was not made. Each grammar below
 * is a different *operational structure* — different step count, different
 * vocabulary, different shape — and every one is driven by the same
 * `SignalController` and rendered by the same `SignalView`. There is no
 * project-specific state machine anywhere, and a test asserts it.
 *
 * ## What this is not
 *
 * These are **not** published case studies. They carry no status label, no
 * metric, no adoption figure, no customer count and no claim about deployment.
 * Each step names an operational stage that a system of that kind must handle —
 * the sort of thing visible in any competent architecture — and nothing more.
 * §25.2 keeps publication status provisional until reverified immediately
 * before publication, so nothing here is presented as public.
 *
 * No client data, no private identifiers, no internal endpoints.
 */

export type GrammarId = "gen-eat-hazina" | "carepro" | "sentinelcore-cypher";

export interface ProjectGrammar {
  readonly id: GrammarId;
  /** Working name for the lab only, not a published project title. */
  readonly label: string;
  /** Why this grammar differs structurally from the others. */
  readonly shape: string;
  readonly steps: readonly SequenceState[];
}

/**
 * Builds the sequence-state objects for a grammar.
 *
 * Layer and segment activation follow exactly the canonical rule: reaching step
 * N means segments 1..N are drawn, with N being the one that moved. Keeping the
 * rule identical is the point — the grammars differ in *content*, not in how
 * the engine advances.
 */
function buildSteps(
  steps: readonly {
    id: string;
    label: string;
    explanation: string;
    input: string;
    boundary: string;
    output: string;
    emphasis: SignalEmphasis;
    layers: readonly SignalLayerId[];
  }[],
): readonly SequenceState[] {
  return steps.map((step, index) => ({
    id: step.id,
    index,
    label: step.label,
    explanation: step.explanation,
    input: step.input,
    boundary: step.boundary,
    output: step.output,
    activeLayers: step.layers,
    activeNodes: Array.from({ length: index + 1 }, (_, i) => `step-${i}`),
    completedSegments: Array.from({ length: Math.max(0, index - 1) }, (_, i) => `seg-${i + 1}`),
    currentSegment: index === 0 ? null : `seg-${index}`,
    emphasis: step.emphasis,
  }));
}

const BASE: readonly SignalLayerId[] = ["dormant-path", "active-path", "signal-head"];
const WITH_BOUNDARY: readonly SignalLayerId[] = [...BASE, "boundary-nodes"];
const WITH_GATE: readonly SignalLayerId[] = [...WITH_BOUNDARY, "human-gate"];
const WITH_ACTION: readonly SignalLayerId[] = [...WITH_GATE, "action-node"];
const COMPLETE: readonly SignalLayerId[] = [...WITH_ACTION, "residual-trace"];

/**
 * Conversational commerce. Six steps, no explicit human gate — the customer is
 * the decision-maker, so approval is not a separate operational stage.
 */
const GEN_EAT_HAZINA: ProjectGrammar = {
  id: "gen-eat-hazina",
  label: "Gen-Eat / Hazina",
  shape: "Six steps, customer-driven. Recovery is a first-class stage, not an error branch.",
  steps: buildSteps([
    {
      id: "conversation",
      label: "Conversation",
      explanation: "A customer states intent in the channel they already use.",
      input: "An inbound message on a customer channel.",
      boundary: "The channel adapter isolates provider behaviour from business logic.",
      output: "A parsed intent attached to a session.",
      emphasis: "uncertain",
      layers: BASE,
    },
    {
      id: "catalog",
      label: "Catalog",
      explanation: "Intent is matched against what can actually be sold right now.",
      input: "Intent plus current availability.",
      boundary: "Nothing unavailable can be ordered.",
      output: "A priced, valid basket.",
      emphasis: "evidence",
      layers: BASE,
    },
    {
      id: "payment",
      label: "Payment",
      explanation: "Settlement runs through a provider-agnostic interface.",
      input: "A validated order awaiting settlement.",
      boundary: "Provider failure is a known state, not an unhandled branch.",
      output: "A confirmed or explicitly pending payment.",
      emphasis: "boundary",
      layers: WITH_BOUNDARY,
    },
    {
      id: "routing",
      label: "Routing",
      explanation: "The order reaches the person or merchant who must fulfil it.",
      input: "A paid order.",
      boundary: "Delivery survives a restart; work is not fire-and-forget.",
      output: "A dispatched order with an owner.",
      emphasis: "structure",
      layers: WITH_BOUNDARY,
    },
    {
      id: "fulfilment",
      label: "Fulfilment",
      explanation: "The physical outcome happens and status becomes observable.",
      input: "A dispatched order.",
      boundary: "Status is reported, not assumed.",
      output: "A fulfilled order with a trackable state.",
      emphasis: "action",
      layers: WITH_ACTION,
    },
    {
      id: "recovery",
      label: "Recovery",
      explanation: "Anything that did not go to plan is escalated to a person.",
      input: "A failed, stalled or disputed order.",
      boundary: "Silent failure is not an accepted outcome.",
      output: "A resolved case with a record of what happened.",
      emphasis: "proof",
      layers: COMPLETE,
    },
  ]),
};

/**
 * Regulated care operations. Eight steps, and the longest — identity and audit
 * bracket the whole flow, which is what distinguishes a care system from a
 * commerce one.
 */
const CAREPRO: ProjectGrammar = {
  id: "carepro",
  label: "CarePro",
  shape:
    "Eight steps, identity-first and audit-last. Assignment and incident have no commerce equivalent.",
  steps: buildSteps([
    {
      id: "identity",
      label: "Identity",
      explanation: "Who is asking, and on whose behalf.",
      input: "An actor presenting a claim about themselves.",
      boundary: "No care action proceeds on an unestablished identity.",
      output: "An established, scoped identity.",
      emphasis: "uncertain",
      layers: BASE,
    },
    {
      id: "verification",
      label: "Verification",
      explanation: "Credentials and eligibility are checked before any request is honoured.",
      input: "An identity plus supporting credentials.",
      boundary: "Unverified actors cannot request care.",
      output: "A verified, entitled participant.",
      emphasis: "evidence",
      layers: BASE,
    },
    {
      id: "request",
      label: "Request",
      explanation: "A specific care need is captured with its context.",
      input: "A stated need from a verified participant.",
      boundary: "Scope is bounded by entitlement.",
      output: "A structured, reviewable request.",
      emphasis: "structure",
      layers: BASE,
    },
    {
      id: "assignment",
      label: "Assignment",
      explanation: "A qualified person is matched to the request.",
      input: "A request plus available qualified capacity.",
      boundary: "Only appropriately qualified people can be assigned.",
      output: "An assignment with an accountable owner.",
      emphasis: "structure",
      layers: WITH_BOUNDARY,
    },
    {
      id: "workflow",
      label: "Care workflow",
      explanation: "The care itself proceeds through defined, recordable stages.",
      input: "An accepted assignment.",
      boundary: "Each stage is recorded as it happens.",
      output: "A progressing episode of care.",
      emphasis: "boundary",
      layers: WITH_BOUNDARY,
    },
    {
      id: "incident",
      label: "Incident",
      explanation: "Deviations are raised as first-class events requiring human judgement.",
      input: "An observed deviation or adverse event.",
      boundary: "Incidents interrupt the workflow; they do not queue behind it.",
      output: "A reviewed incident with a decision attached.",
      emphasis: "human",
      layers: WITH_GATE,
    },
    {
      id: "payout",
      label: "Payout",
      explanation: "Settlement follows verified delivery of care, not intent to deliver.",
      input: "Completed, evidenced care.",
      boundary: "Payment follows evidence.",
      output: "A settled obligation.",
      emphasis: "action",
      layers: WITH_ACTION,
    },
    {
      id: "audit",
      label: "Audit",
      explanation: "The episode remains reconstructable after the fact.",
      input: "The full record of the episode.",
      boundary: "The record is durable and access-controlled.",
      output: "An auditable history.",
      emphasis: "proof",
      layers: COMPLETE,
    },
  ]),
};

/**
 * Controlled execution. Seven steps built around an explicit execution boundary
 * — the stage that has no analogue in either of the grammars above.
 */
const SENTINELCORE_CYPHER: ProjectGrammar = {
  id: "sentinelcore-cypher",
  label: "SentinelCore / Cypher",
  shape:
    "Seven steps around an explicit execution boundary. Approval precedes execution, never follows it.",
  steps: buildSteps([
    {
      id: "input",
      label: "Input",
      explanation: "An instruction or signal arrives from an untrusted surface.",
      input: "An external instruction.",
      boundary: "All input is untrusted until qualified.",
      output: "A captured, attributed instruction.",
      emphasis: "uncertain",
      layers: BASE,
    },
    {
      id: "qualification",
      label: "Qualification",
      explanation: "The instruction is checked against what is permitted and plausible.",
      input: "A captured instruction.",
      boundary: "Unqualified instructions stop here.",
      output: "A qualified candidate action.",
      emphasis: "evidence",
      layers: BASE,
    },
    {
      id: "control",
      label: "Control",
      explanation: "Applicable policy and constraints are resolved explicitly.",
      input: "A qualified candidate action.",
      boundary: "Policy is evaluated before, not during, execution.",
      output: "A constrained, policy-resolved action.",
      emphasis: "structure",
      layers: WITH_BOUNDARY,
    },
    {
      id: "approval",
      label: "Approval",
      explanation: "A person authorises the action where policy requires it.",
      input: "A constrained action awaiting authority.",
      boundary: "The gate holds. Nothing downstream proceeds without it.",
      output: "An authorised action.",
      emphasis: "human",
      layers: WITH_GATE,
    },
    {
      id: "execution-boundary",
      label: "Execution boundary",
      explanation: "The action crosses from decision into effect, once and observably.",
      input: "An authorised action.",
      boundary: "Crossing is single-shot and recorded at the moment it happens.",
      output: "An executed effect.",
      emphasis: "action",
      layers: WITH_ACTION,
    },
    {
      id: "evidence",
      label: "Evidence",
      explanation: "What was done, by whom, under which policy, is captured.",
      input: "An executed effect.",
      boundary: "Evidence is written even when the outcome is a failure.",
      output: "A complete evidence record.",
      emphasis: "proof",
      layers: WITH_ACTION,
    },
    {
      id: "audit",
      label: "Audit",
      explanation: "The decision remains accountable long after execution.",
      input: "The evidence record.",
      boundary: "Retention and access are controlled.",
      output: "An accountable, reviewable decision.",
      emphasis: "proof",
      layers: COMPLETE,
    },
  ]),
};

export const PROJECT_GRAMMARS: readonly ProjectGrammar[] = [
  GEN_EAT_HAZINA,
  CAREPRO,
  SENTINELCORE_CYPHER,
];

export function getGrammar(id: GrammarId): ProjectGrammar {
  const grammar = PROJECT_GRAMMARS.find((candidate) => candidate.id === id);
  if (!grammar) throw new Error(`unknown project grammar: ${id}`);
  return grammar;
}

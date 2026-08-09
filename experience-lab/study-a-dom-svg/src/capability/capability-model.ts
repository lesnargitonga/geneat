/**
 * The capability register (Wave F).
 *
 * Six ways the studio moves an idea toward reality — not six services. Each
 * entry has to survive the same discipline as the flagship proof: a claim, the
 * behaviours behind it, evidence that actually demonstrates it, an honest
 * maturity, and an explicit boundary naming what is *not* being claimed.
 *
 * The boundary field is the important one. A capability list without it is a
 * brochure.
 */

/**
 * Capability maturity — a different axis from `MaturityLevel` in the proof
 * model, which grades how strongly a single artifact is evidenced. This grades
 * how far a *capability* has actually been taken. A capability can be backed by
 * verified evidence and still only be active research.
 */
export type CapabilityMaturity =
  /** Running, customer-facing, reachable today. */
  | "live-product"
  /**
   * Operated for a real client system, not publicly browsable.
   *
   * Requires evidence of an external client relationship, and is currently
   * unused. Wave F applied it to Operate and Protect; Wave H established that
   * no such relationship stood behind either — their evidence is entirely the
   * studio's own infrastructure, and CarePro, the only remaining candidate, is
   * the founders' own product. Do not reapply it without evidence of an actual
   * external client.
   *
   * Distinct from the identically-spelled `WorkMaturity` member, which grades a
   * system rather than a capability. The two taxonomies are not interchangeable.
   */
  | "controlled-client-system"
  /** Real and in use, but on our own systems. */
  | "internal-engineering-system"
  /** Built and qualified, not yet carrying production load. */
  | "validated-prototype"
  /** Genuine work in progress. Deliberately not promoted. */
  | "active-research"
  /** Superseded; kept for honesty about history. */
  | "archive";

export type CapabilityId = "build" | "operate" | "protect" | "intelligence" | "prove" | "physical";

/**
 * Glyph vocabulary. Derived from the signal system's own geometry — NODE,
 * TRACE, BOUNDARY, GATE — so the marks read as native rather than as icons
 * borrowed from a library. Each is drawn in a 24×24 box in `capability-glyph.ts`.
 */
export type GlyphId =
  | "nodes-join" //  BUILD        — separate nodes resolve into one trace
  | "trace-sustained" // OPERATE  — a trace held steady across repeated marks
  | "boundary-closed" // PROTECT  — a boundary enclosing what it protects
  | "trace-inferred" // INTELLIGENCE — a trace branching, then converging
  | "node-witnessed" // PROVE     — a node with the residual trace it left
  | "gate-crossed"; // PHYSICAL   — a trace crossing a gate into open space

export interface CapabilityProof {
  /** What was actually done. Written as a fact, not a capability boast. */
  readonly statement: string;
  /** Where it was demonstrated. A project name, or a system. */
  readonly source: string;
  /** Present only where the claim is time-sensitive and was verified. */
  readonly verified?: string;
  /** Set when the proof lives elsewhere on this page. */
  readonly seeAlso?: string;
}

export interface Capability {
  readonly id: CapabilityId;
  /** Register index — the field-sheet numbering. */
  readonly index: string;
  readonly name: string;
  readonly glyph: GlyphId;
  /** One line: what this capability changes for the person reading. */
  readonly changes: string;
  /** What we actually do. Concrete verbs, no tooling inventory. */
  readonly behaviours: readonly string[];
  readonly proofs: readonly CapabilityProof[];
  readonly maturity: CapabilityMaturity;
  /** What we are explicitly NOT claiming. Never empty. */
  readonly boundary: string;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "build",
    index: "01",
    name: "Build",
    glyph: "nodes-join",
    changes: "An ambition becomes a system people can actually use.",
    behaviours: [
      "Product and full-stack engineering, front to back",
      "API and data modelling, including multi-tenant boundaries",
      "Payment integration behind provider-agnostic interfaces, so a provider can be swapped without touching business logic",
      "Conversational interfaces on the channels customers already use",
    ],
    proofs: [
      {
        statement:
          "Two customer-facing commerce products built on one tenant model — campus food ordering and private luxury sourcing — each with catalog, payment and fulfilment paths implemented end to end in code.",
        source: "Gen-Eat · Hazina Nomads",
      },
      {
        statement:
          "A home-care and nursing coordination platform — credential verification, nurse assignment, visit progress and payment recording — running in production on its own infrastructure.",
        source: "CarePro",
      },
    ],
    maturity: "live-product",
    boundary:
      "Two commerce products and one coordination platform. Payment paths are implemented and integrated, not qualified end to end against live settlement. Not a claim of experience across every industry.",
  },
  {
    id: "operate",
    index: "02",
    name: "Operate",
    glyph: "trace-sustained",
    changes: "The system keeps running after the launch week.",
    behaviours: [
      "Linux hosts, process supervision, service persistence across reboots",
      "Nginx routing, DNS and TLS, public ingress design",
      "Production migrations applied deliberately, not on deploy",
      "Deployment sized to the hardware actually available",
    ],
    proofs: [
      {
        statement:
          "Three applications, PostgreSQL, Redis, Nginx and a tunnel connector coexisting within measured capacity on a single 1 vCPU / 2 GB host. CPU and memory protections are configured to reduce cross-service contention on the constrained host.",
        source: "Shared VPS runtime",
        verified: "2026-08-09",
      },
      {
        statement:
          "A reboot qualification confirmed the supervised services returned automatically — both product APIs, both data engines, the web tier and the process supervisor — with no manual intervention.",
        source: "Production host",
        verified: "2026-08-08",
      },
    ],
    maturity: "internal-engineering-system",
    boundary:
      "Single-host operations within measured capacity. Resource protections are configured, not load-qualified — no stress testing, no orchestration platform, no autoscaling, no multi-region claim.",
  },
  {
    id: "protect",
    index: "03",
    name: "Protect",
    glyph: "boundary-closed",
    changes: "A failure or a breach in one place stays in that place.",
    behaviours: [
      "Database and credential isolation proved by attempting the access that must fail",
      "Fail-closed configuration — production refuses to start on a placeholder secret",
      "Public surface reduced to what the product genuinely needs",
      "Secret hygiene: nothing committed, nothing printed, nothing shared between products",
    ],
    proofs: [
      {
        statement:
          "Two previously shared product runtimes separated into isolated databases, credentials, cache namespaces and independently failing public services.",
        source: "Gen-Eat / Hazina separation",
        verified: "2026-08-09",
        seeAlso: "#product",
      },
      {
        statement:
          "Cross-database access denied in both directions and re-proved after reboot; administrative and introspection surfaces return 404 from the public edge by design.",
        source: "Runtime qualification",
        verified: "2026-08-09",
      },
    ],
    maturity: "internal-engineering-system",
    boundary:
      "Isolation and configuration hardening that was measured. Not penetration testing, not a compliance certification, not a security audit practice.",
  },
  {
    id: "intelligence",
    index: "04",
    name: "Intelligence",
    glyph: "trace-inferred",
    changes: "Software handles the conversation and the judgement, not just the form.",
    behaviours: [
      "Provider-agnostic model gateways with declared fallback order",
      "Retrieval and knowledge systems with embedding dimensions pinned to the schema",
      "Deterministic gates in front of generative output, so failure is a known state",
      "Conversation routed to the person who must decide when the system should not",
    ],
    proofs: [
      {
        statement:
          "A conversational commerce backend with a deterministic gate ahead of the model, escalation to a human desk, and output sanitisation between the model and the customer.",
        source: "Hazina Nomads",
      },
      {
        statement:
          "Model provider selection, fallback ordering and embedding dimensions treated as validated configuration that refuses to start when inconsistent.",
        source: "Shared backend architecture",
      },
    ],
    maturity: "validated-prototype",
    boundary:
      "Application architecture around models. Not model training, not fine-tuning claims, and conversation is not currently operational on the separated runtimes — no provider credential is configured.",
  },
  {
    id: "prove",
    index: "05",
    name: "Prove",
    glyph: "node-witnessed",
    changes: "You can check the claim instead of trusting it.",
    behaviours: [
      "Failure injection — stop a dependency and record what survives",
      "Accessibility, responsive and reduced-motion qualification at fixed viewports",
      "Performance attribution that finds the real cause instead of blaming the harness",
      "Evidence packages: what was verified, when, and what it does not prove",
    ],
    proofs: [
      {
        statement:
          "Independent regression suites qualify the two separated product backends and this experience prototype, each passing without the others.",
        source: "Study A · Gen-Eat · Hazina",
        verified: "2026-08-09",
      },
      {
        statement:
          "A performance regression traced to a measurement defect in the harness rather than the page, and a contrast failure found by pixel measurement after a computed-style check reported false confidence.",
        source: "Wave D · Wave E qualification",
        seeAlso: "#product",
      },
    ],
    maturity: "internal-engineering-system",
    boundary:
      "Qualification of systems built here. Not an independent QA service, and not a formal certification.",
  },
  {
    id: "physical",
    index: "06",
    name: "Physical",
    glyph: "gate-crossed",
    changes: "The decision leaves the screen and happens in the world.",
    behaviours: [
      "Embedded and electronics work at the sensor and actuator boundary",
      "Hardware fault isolation — separating a failing component from a failing signal path",
      "Research toward autonomous physical action under human authority",
    ],
    proofs: [
      {
        statement:
          "Storage fault isolated to a read failure at the first block of a device, distinguishing media, cable, power and controller as candidate causes rather than condemning the drive.",
        source: "Workstation hardware incident",
        verified: "2026-08-08",
      },
      {
        statement:
          "Greenhouse and embedded control experiments at the sensing and actuation boundary.",
        source: "Internal research",
      },
    ],
    maturity: "active-research",
    boundary:
      "Active research. No deployed robotics, no autonomous field system, no physical product in customer hands.",
  },
];

/** Human-facing maturity labels. Colour never carries this meaning alone. */
export const MATURITY_LABEL: Record<CapabilityMaturity, string> = {
  "live-product": "Live product",
  "controlled-client-system": "Controlled client system",
  "internal-engineering-system": "Internal engineering system",
  "validated-prototype": "Validated prototype",
  "active-research": "Active research",
  "archive": "Archive",
};

export function getCapability(id: CapabilityId): Capability {
  const found = CAPABILITIES.find((c) => c.id === id);
  if (!found) throw new Error(`unknown capability: ${id}`);
  return found;
}

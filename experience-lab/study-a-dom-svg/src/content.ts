/**
 * Structured content model for Study A.
 *
 * As in Study B, the *prose* lives in `index.html` — the story has to work
 * with JavaScript disabled, and the Phase 2 audit faults the current
 * production site for burying capability content inside JavaScript.
 *
 * What lives here is structure: identifiers, ordering, and the truth labels
 * that both studies must agree on. `accessibility/content-integrity.ts` uses
 * it to fail loudly when the markup and this model drift apart, and
 * `scripts/check-content-parity.mjs` uses the same identifiers when comparing
 * against Study B's frozen commit.
 */

export type ChapterId = "idea" | "product" | "system" | "action";

/** The five honesty labels required by dossier 7.9. */
export type TruthLabel =
  | "LIVE"
  | "CLIENT SYSTEM"
  | "INTERNAL SYSTEM"
  | "PROTOTYPE"
  | "ACTIVE RESEARCH";

/** Whether a claim is backed by something readable in this repository. */
export type EvidenceState = "verified" | "pending";

export const CHAPTERS: readonly { id: ChapterId; index: string; label: string }[] = [
  { id: "idea", index: "00", label: "Idea" },
  { id: "product", index: "01", label: "Product" },
  { id: "system", index: "02", label: "System" },
  { id: "action", index: "03", label: "Action" },
];

/**
 * The six system stages (dossier 7.10), each mapped to the modules that
 * actually implement it in this repository.
 *
 * Identical to Study B's `SYSTEM_STAGES` by design: the two prototypes differ
 * in how the signal is *rendered*, never in what is claimed. Parity on this
 * list is asserted automatically.
 */
export interface SystemStage {
  readonly id: string;
  readonly index: string;
  readonly label: string;
  readonly sourceModules: readonly string[];
}

export const SYSTEM_STAGES: readonly SystemStage[] = [
  {
    id: "request",
    index: "01",
    label: "Request",
    sourceModules: ["app/api/whatsapp.py", "app/api/voice.py", "app/channels/base.py"],
  },
  {
    id: "context",
    index: "02",
    label: "Context",
    sourceModules: [
      "app/services/conversation_context.py",
      "app/services/session_manager.py",
      "app/services/language.py",
    ],
  },
  {
    id: "decision",
    index: "03",
    label: "Decision",
    sourceModules: [
      "app/services/conversation_service.py",
      "app/services/hazina_deterministic_gate.py",
      "app/services/output_sanitizer.py",
    ],
  },
  {
    id: "payment",
    index: "04",
    label: "Payment",
    sourceModules: [
      "app/integrations/payments/factory.py",
      "app/integrations/payments/daraja.py",
      "app/integrations/payments/intasend.py",
    ],
  },
  {
    id: "routing",
    index: "05",
    label: "Routing",
    sourceModules: [
      "app/services/staff_dispatch.py",
      "app/services/outbox.py",
      "app/services/webhook_dispatcher.py",
    ],
  },
  {
    id: "recovery",
    index: "06",
    label: "Recovery",
    sourceModules: [
      "app/services/hazina_escalation.py",
      "app/services/hazina_customer_fallbacks.py",
      "app/services/order_tracking.py",
    ],
  },
];

/**
 * The software-to-physical-action sequence (dossier 7.11).
 *
 * These seven step names are specified for Study A and differ from the seven
 * used in Study B's committed markup. The underlying process is the same and
 * the truth label is the same; only the labelling granularity differs.
 * `research/content-parity.md` carries the full mapping and the reason.
 */
export interface ActionStep {
  readonly id: string;
  readonly label: string;
}

export const ACTION_SEQUENCE: readonly ActionStep[] = [
  { id: "observe", label: "Observe" },
  { id: "detect", label: "Detect" },
  { id: "verify", label: "Verify" },
  { id: "approve", label: "Approve" },
  { id: "command", label: "Command" },
  { id: "act", label: "Act" },
  { id: "record", label: "Record" },
];

/** The eight signal states (dossier 3.3), shown as the text legend. */
export const SIGNAL_STATES = [
  "Idea",
  "Observe",
  "Model",
  "Engineer",
  "Protect",
  "Approve",
  "Act",
  "Prove",
] as const;

/**
 * Claims both studies must state identically. Used by the parity check as the
 * authoritative list of what "same content" means — a field absent here is not
 * compared, and a difference in a field present here must be declared
 * intentional or the check fails.
 */
export const PARITY_CLAIMS = {
  headline: "We make ambitious ideas real.",
  firstProject: "Gen-Eat",
  projectStatus: "LIVE" satisfies TruthLabel,
  physicalActionStatus: "PROTOTYPE" satisfies TruthLabel,
  verifiedProofPanels: 3,
  pendingProofPanels: 1,
  systemStageCount: 6,
  chapterCount: 4,
} as const;

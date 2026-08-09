/**
 * The work register (Wave H).
 *
 * The question this chapter answers is "what has actually been built, and what
 * evidence exists for each system" — so the boundary on each record matters as
 * much as the achievement, and inclusion is decided by evidence rather than by
 * what would make the register look fuller.
 *
 * ## Two axes again, and a third
 *
 * `WorkMaturity` — how far a system has been taken.
 * `ProofState` — what a visitor can actually be shown.
 *
 * They are separate because a system can be genuinely live while its proof is
 * necessarily private, and a truthful INTERNAL EVIDENCE marker is stronger than
 * a fabricated public artifact. Collapsing them would push every honest record
 * toward either overclaiming maturity or understating it.
 *
 * ## What was excluded, and why
 *
 * Recorded here because an omission decided on evidence is part of the record.
 *
 * - **Sarepta.** The only artifact anywhere in the accepted evidence is a
 *   private repository name and the note that it also lived on the failed disk.
 *   No reachability, no description beyond a problem class, nothing sanitised
 *   that could be shown. The work involves children and donors, so a near-empty
 *   public entry carries real risk and no informational value. Omitted rather
 *   than padded.
 *
 * - **A generic "AI capability" entry.** Already covered by the Wave F
 *   capability register; repeating it here would be duplication, not evidence.
 *
 * `proof-model.ts` still records CarePro, Sarepta and SentinelCore/Cypher as
 * named problem classes with "no artifact in this repository". That remains
 * true of *this repository*. CarePro is included here because separate,
 * first-hand host evidence exists — recorded in `detanglement-outcome.md` — and
 * the register is explicit that this is what the evidence covers.
 */

/**
 * How far the system has been taken.
 *
 * "Live product" means a product with a publicly reachable product surface and a
 * qualified, independently deployable runtime — not merely a process answering a
 * health check.
 *
 * It deliberately does NOT establish adoption or commercial outcomes. The
 * accepted evidence proves a reachable storefront, a healthy API and an
 * independent runtime; it does not prove customers, traffic, orders, revenue,
 * adoption or uptime over any period, and this label must never be read as
 * standing in for them. Each record's own boundary states that again.
 */
export type WorkMaturity =
  | "live-product"
  /**
   * Retained in the vocabulary but currently unused. It was applied to CarePro
   * on the assumption of a client relationship that no repository evidence
   * supported; the owner context established CarePro is the founders' own
   * product. Nothing should carry this label without evidence of an external
   * client.
   */
  | "controlled-client-system"
  | "internal-engineering-system"
  | "validated-prototype"
  | "active-research";

/**
 * What can actually be shown, which is a different question from how mature the
 * system is.
 *
 * `internal-evidence` is not a weaker form of proof — it is an honest statement
 * that the evidence exists and cannot be published. Inventing a public artifact
 * to avoid using it would be the actual failure.
 */
export type ProofState =
  /** A visitor can open something and see it work right now. */
  | "public-proof"
  /** Real evidence, published only with identifying detail removed. */
  | "sanitized-proof"
  /** Evidence exists and was verified first-hand; it cannot be published. */
  | "internal-evidence"
  /** A written record of investigation. No running system is claimed. */
  | "research-record";

export const WORK_MATURITY_LABEL: Record<WorkMaturity, string> = {
  "live-product": "Live product",
  "controlled-client-system": "Controlled client system",
  "internal-engineering-system": "Internal engineering system",
  "validated-prototype": "Validated prototype",
  "active-research": "Active research",
};

export const PROOF_STATE_LABEL: Record<ProofState, string> = {
  "public-proof": "Public proof",
  "sanitized-proof": "Sanitized proof",
  "internal-evidence": "Internal evidence",
  "research-record": "Research record",
};

/**
 * A reference to proof that already exists.
 *
 * `href` is optional on purpose. An entry with no link is the normal case for
 * work whose evidence is private, and the register must be able to say so
 * without inventing a destination — no dead routes, no placeholder case pages.
 */
export interface ProofRef {
  readonly label: string;
  /** Absent when the proof cannot be linked. Never a placeholder. */
  readonly href?: string;
  /** `external` opens a real public system; `anchor` points inside Study A. */
  readonly kind: "external" | "anchor" | "unlinked";
}

export interface WorkRecord {
  readonly id: string;
  readonly index: string;
  readonly name: string;
  /** The problem class, not a tagline. */
  readonly category: string;
  /** One line: what the system is. */
  readonly summary: string;
  /** What measurably changed because the work happened. */
  readonly whatChanged: string;
  readonly maturity: WorkMaturity;
  readonly proofState: ProofState;
  readonly proofs: readonly ProofRef[];
  readonly lastVerified?: string;
  /** Never empty. The boundary is part of the claim. */
  readonly notClaimed: string;
}

/**
 * Ordered by evidence strength, not by preference.
 *
 * The two systems a visitor can open and use come first; the system whose
 * independence was measured first-hand follows; the internal engineering system
 * that produced most of this evidence comes next; research is last and is
 * deliberately shorter, because a research record should not occupy the same
 * visual weight as a running product.
 */
export const WORK_RECORDS: readonly WorkRecord[] = [
  {
    id: "gen-eat",
    index: "01",
    name: "Gen-Eat",
    category: "Commerce and operations",
    summary: "A food commerce storefront with its own backend, database and deployment.",
    whatChanged:
      "It stopped sharing a runtime with another product. Gen-Eat now owns its own service, its own database and its own cache namespace, and in the measured failure test stopping the neighbouring product service left Gen-Eat answering.",
    maturity: "live-product",
    proofState: "public-proof",
    proofs: [
      { label: "Storefront", href: "https://geneat.lesnarai.co.ke", kind: "external" },
      { label: "API health", href: "https://geneat-api.lesnarai.co.ke/healthz", kind: "external" },
      { label: "Separation proof", href: "#product", kind: "anchor" },
    ],
    lastVerified: "2026-08-09",
    notClaimed:
      "A reachable storefront and a healthy API. Not a claim about orders, payments settled end to end, customers, traffic or uptime over any period. Model-backed conversation is not currently reachable. No historical operational data was migrated.",
  },
  {
    id: "hazina",
    index: "02",
    name: "Hazina Nomads",
    category: "Commerce and operations",
    summary: "A gifting and catalogue product, separated from Gen-Eat into its own runtime.",
    whatChanged:
      "The product logic that had been threaded through shared code was extracted, so Hazina is deployable, testable and restartable on its own. In the same measured test, stopping either product service left the other answering.",
    maturity: "live-product",
    proofState: "public-proof",
    proofs: [
      { label: "Storefront", href: "https://hazina.lesnarai.co.ke", kind: "external" },
      { label: "API health", href: "https://hazina-api.lesnarai.co.ke/healthz", kind: "external" },
      { label: "Separation proof", href: "#product", kind: "anchor" },
    ],
    lastVerified: "2026-08-09",
    notClaimed:
      "The same boundary as Gen-Eat: reachability and health, not commercial outcomes. Shared history with Gen-Eat is a fact about the past, not a shared runtime today.",
  },
  {
    id: "carepro",
    index: "03",
    name: "CarePro",
    category: "Care coordination",
    summary: "A home-care and nursing coordination platform, running on its own production runtime.",
    whatChanged:
      "CarePro runs independently on its own production runtime, with its own public hostname and TLS. During the measured product-service failure tests it remained available while each neighbouring product service was stopped in turn.",
    // Not a client system. The repository evidence alone could not establish the
    // relationship — correctly flagged as a gap — and the owner context resolved
    // it: CarePro is the founders' own product, which its public homepage states
    // independently. `LIVE PRODUCT` under the bounded definition above: a
    // publicly reachable product surface and a qualified independent runtime,
    // establishing nothing about adoption or commercial outcomes.
    maturity: "live-product",
    proofState: "public-proof",
    proofs: [
      { label: "CarePro product", href: "https://carepro.co.ke", kind: "external" },
      { label: "Isolation measured on the host", kind: "unlinked" },
      { label: "Operational record is private", kind: "unlinked" },
    ],
    lastVerified: "2026-08-09",
    notClaimed:
      "Coordination software. No regulatory approval, no medical-device status, no clinical decision-making, no HIPAA certification and no certified healthcare compliance is claimed or implied. Nothing here establishes patient outcomes, active nurse numbers, booking volume, customers, revenue, adoption or uptime. No patient, nurse, scheduling or private operational data is shown, described or linked.",
  },
  {
    id: "experience-lab",
    index: "04",
    name: "Experience Lab",
    category: "Internal engineering",
    summary: "The environment this page is built in: two isolated studies, qualified against each other.",
    whatChanged:
      "Claims stopped being editable prose. The register, the physical record and this work index are generated from typed models, and separate checkers compare the model against the served markup and fail on drift without ever writing to it.",
    maturity: "internal-engineering-system",
    proofState: "public-proof",
    proofs: [
      { label: "Capability register", href: "#system", kind: "anchor" },
      { label: "Physical record", href: "#action", kind: "anchor" },
    ],
    lastVerified: "2026-08-09",
    notClaimed:
      "An internal engineering environment, not a product and not for sale. Qualified in headless Chromium on one machine — laboratory measurement, not field data.",
  },
  {
    id: "physical",
    index: "05",
    name: "Physical intelligence",
    category: "Hardware and sensing",
    summary: "Work where the system has to leave the screen, at four different stages of evidence.",
    whatChanged:
      "A failing storage device was read to a bounded conclusion without a single write being issued — the repair tools that would have destroyed recoverability were refused, and what the evidence could not separate was recorded rather than guessed. That fault isolation is verified practice; the embedded greenhouse is an owner-attested prototype; aerial work is active research; radar is a stated direction with no build.",
    // The FRONTIER, not its strongest specimen. Wave G graded four separate
    // records — verified practice, owner-attested prototype, active research and
    // research direction — and the register must not flatten them into the best
    // one. `validated-prototype` here would promote the whole body of work to the
    // maturity of a single embedded specimen. See the regression test that
    // forbids exactly that.
    maturity: "active-research",
    proofState: "sanitized-proof",
    proofs: [{ label: "Physical record", href: "#action", kind: "anchor" }],
    lastVerified: "2026-08-08",
    notClaimed:
      "Four entries at four different evidence levels, not one prototype. One storage fault diagnosed to a bounded conclusion; an embedded prototype attested by the person who built it, with no artifact currently accessible; aerial and radar work with nothing built. Nothing has been flown, built as a robot or deployed. The drive was never proven dead.",
  },
  {
    id: "control-boundary",
    index: "06",
    name: "Control boundary research",
    category: "Security and controlled intelligence",
    summary: "How an automated system should be stopped before it acts, not after.",
    whatChanged:
      "Nothing has been built. The investigation produced a seven-step shape in which approval precedes execution and every input is untrusted until qualified — the grammar the studio designs against.",
    maturity: "active-research",
    proofState: "research-record",
    proofs: [{ label: "Not linked — no system exists to show", kind: "unlinked" }],
    notClaimed:
      "A design discipline, not a product, not a deployment and not a security service. No autonomous operation, no outreach capability, no target, host or telemetry of any kind.",
  },
];

export function getWorkRecord(id: string): WorkRecord {
  const found = WORK_RECORDS.find((r) => r.id === id);
  if (!found) throw new Error(`unknown work record: ${id}`);
  return found;
}

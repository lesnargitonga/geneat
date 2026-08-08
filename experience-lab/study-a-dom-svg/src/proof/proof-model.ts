/**
 * The canonical ProofArtifact model (guide §28.6).
 *
 * Every public claim on the page either points at one of these or is explicitly
 * marked pending. The fields exist so that a reader — or a later wave — can ask
 * "how do you know that?" and get an answer with a date on it.
 *
 * Nothing here is generated or inferred. Each artifact records where it came
 * from and when it was last checked.
 */

export type MaturityLevel =
  /** Verified by direct observation, with a date. */
  | "verified"
  /** Read from this repository; true of the code, not of production. */
  | "repository-evidence"
  /** Declared in deployment configuration — NOT proof of a running service. */
  | "declared-config"
  /** Named, with no artifact available. */
  | "pending";

export type SourceVisibility = "public" | "repository" | "private";

export type SanitisationStatus =
  | "not-applicable"
  | "reviewed-safe"
  | "cropped-to-remove-identifiers";

export type PublicationStatus = "published" | "withheld" | "pending";

export type ArtifactType =
  | "public-screenshot"
  | "reachability-probe"
  | "repository-architecture"
  | "deployment-config"
  | "operational-route";

export interface ProofArtifact {
  readonly id: string;
  readonly project: string;
  /** The single claim this artifact supports. One claim per artifact. */
  readonly claimSupported: string;
  readonly artifactType: ArtifactType;
  /** Where it came from: a URL, or a repository path. */
  readonly sourceLocation: string;
  readonly capturedAt: string | null;
  readonly verifiedAt: string | null;
  readonly verificationMethod: string;
  readonly maturityLevel: MaturityLevel;
  readonly sourceVisibility: SourceVisibility;
  readonly sanitisationStatus: SanitisationStatus;
  readonly publicationStatus: PublicationStatus;
  readonly limitations: string;
}

const PROBED_AT = "2026-08-07T07:49:04Z";

/**
 * The flagship proof set.
 *
 * Four artifacts, chosen because each supports a *different* kind of claim —
 * that the product exists publicly, that the systems share a foundation, that
 * the foundation is deployed, and that it is not currently running. Piling on
 * more artifacts of the same kind would add audit metadata without adding
 * credibility.
 */
export const FLAGSHIP_PROOF: readonly ProofArtifact[] = [
  {
    id: "geneat-storefront",
    project: "Gen-Eat",
    claimSupported: "The Gen-Eat storefront is publicly reachable and serves real product content.",
    artifactType: "public-screenshot",
    sourceLocation: "https://geneat.lesnarai.co.ke",
    capturedAt: PROBED_AT,
    verifiedAt: PROBED_AT,
    verificationMethod: "Unauthenticated HTTPS GET → 200, 50 170 B. Screenshot of the public page.",
    maturityLevel: "verified",
    sourceVisibility: "public",
    sanitisationStatus: "cropped-to-remove-identifiers",
    publicationStatus: "published",
    limitations:
      "Reachability only. No order placed, no chat sent, no payment initiated. The figures " +
      "printed on that page are the product's own claims and are not republished here.",
  },
  {
    id: "hazina-storefront",
    project: "Hazina Nomads",
    claimSupported:
      "The Hazina Nomads storefront is publicly reachable and serves real product content.",
    artifactType: "public-screenshot",
    sourceLocation: "https://hazina.lesnarai.co.ke",
    capturedAt: PROBED_AT,
    verifiedAt: PROBED_AT,
    verificationMethod: "Unauthenticated HTTPS GET → 200, 65 197 B. Screenshot of the public page.",
    maturityLevel: "verified",
    sourceVisibility: "public",
    sanitisationStatus: "reviewed-safe",
    publicationStatus: "published",
    limitations:
      "Reachability only. Partner and admin areas were deliberately not probed.",
  },
  {
    id: "shared-foundation",
    project: "Gen-Eat + Hazina",
    claimSupported:
      "Both products are customer surfaces on one multi-tenant backend, not two separate systems.",
    artifactType: "repository-architecture",
    sourceLocation:
      "app/db/models.py (Business tenant model) · app/services/business_config.py · " +
      "app/channels/base.py · app/integrations/payments/factory.py · both portals' backend.ts",
    capturedAt: null,
    verifiedAt: PROBED_AT,
    verificationMethod:
      "Read from this repository. The Business model is documented as \"A tenant — each SME " +
      "using the platform\"; per-business config lives in Business.profile. Both portals " +
      "resolve the same BACKEND_URL and call the same API surface.",
    maturityLevel: "repository-evidence",
    sourceVisibility: "repository",
    sanitisationStatus: "not-applicable",
    publicationStatus: "published",
    limitations:
      "True of the code as committed. Says nothing about what is running in production.",
  },
  {
    id: "backend-reachability",
    project: "Shared backend",
    claimSupported: "The shared backend is declared for deployment but is not currently running.",
    artifactType: "reachability-probe",
    sourceLocation: "https://api.lesnarai.co.ke/health · https://hazina-api.onrender.com/health",
    capturedAt: PROBED_AT,
    verifiedAt: PROBED_AT,
    verificationMethod:
      "Unauthenticated GET on /health only. api.lesnarai.co.ke → 403 Cloudflare " +
      "\"DNS points to prohibited IP\". hazina-api.onrender.com → 503 \"Service Suspended\".",
    maturityLevel: "verified",
    sourceVisibility: "public",
    sanitisationStatus: "not-applicable",
    publicationStatus: "published",
    limitations:
      "Proves the hostnames do not serve the application today. Does not prove the " +
      "application is broken — a suspended service and a DNS misconfiguration are " +
      "deployment states, not application defects.",
  },
];

/** Problem classes the company works across. Named only — nothing is claimed. */
export interface PortfolioClass {
  readonly id: string;
  readonly problemClass: string;
  readonly programme: string;
  readonly evidence: "pending";
  readonly note: string;
}

/**
 * §28.10 range cue. These are named because the programme dossier names them —
 * the owner's own statement of their portfolio. No capability, status,
 * deployment or outcome is asserted for any of them, because this repository
 * contains no artifact for any of them.
 *
 * §28.11: for CarePro and Sarepta the absence of imagery is deliberate.
 */
export const PORTFOLIO_CLASSES: readonly PortfolioClass[] = [
  {
    id: "commerce",
    problemClass: "Commerce and operations",
    programme: "Gen-Eat · Hazina Nomads",
    evidence: "pending",
    note: "The flagship above. Verified storefronts; shared backend currently suspended.",
  },
  {
    id: "care",
    problemClass: "Trust and care delivery",
    programme: "CarePro",
    evidence: "pending",
    note: "Named as a problem class. No artifact in this repository; nothing claimed. No imagery, by policy.",
  },
  {
    id: "public-trust",
    problemClass: "Public trust and controlled administration",
    programme: "Sarepta",
    evidence: "pending",
    note: "Named as a problem class. No artifact in this repository; nothing claimed. No imagery, by policy.",
  },
  {
    id: "governance",
    problemClass: "Security, governance and controlled intelligence",
    programme: "SentinelCore / Cypher",
    evidence: "pending",
    note: "Named as a problem class. No artifact in this repository; nothing claimed.",
  },
  {
    id: "physical",
    problemClass: "Physical intelligence research",
    programme: "Robotics and computer-vision research",
    evidence: "pending",
    note: "Named as a problem class. Engineering demonstration only — see the Action chapter.",
  },
];

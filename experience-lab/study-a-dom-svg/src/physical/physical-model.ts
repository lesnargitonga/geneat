/**
 * The physical intelligence record (Wave G).
 *
 * The same discipline as the capability register, applied where the system has
 * to leave the screen. Every entry carries what it demonstrates, the evidence
 * behind it, how far it has been taken, and what is explicitly not claimed.
 *
 * ## Why the anchor is a disk failure and not the greenhouse
 *
 * The greenhouse embedded system is real work, but no source artifact for it was
 * located in the storage and repositories searched. That is a statement about
 * the search, not a proof of absence: the authenticated GitHub code search that
 * returned no match has provably incomplete coverage — control terms certain to
 * exist in `geneat` and `carepro` also returned nothing.
 *
 * The inaccessible project disk holds a project tree that cannot currently be
 * enumerated, so whether it contains greenhouse source is unknown. It is not
 * claimed as the cause of the gap.
 *
 * Its architecture here is therefore owner-attested — described by the person
 * who built it — a weaker evidence class than something read from a repository,
 * and labelled as such rather than dressed up.
 *
 * The hardware fault isolation is the opposite: performed first-hand during
 * this programme, recorded with kernel output in
 * `research/incident-2026-08-08-local-disk.md`. Diagnosing a failing physical
 * system — separating media from cable from controller, and refusing a
 * destructive repair — is physical intelligence too, and it is the strongest
 * evidence available. So it anchors the chapter.
 */

/** How far the capability has been taken. Mirrors `CapabilityMaturity`. */
export type PhysicalMaturity =
  | "validated-prototype"
  | "verified-practice"
  | "active-research"
  | "research-direction";

/**
 * How strongly the *statement* is evidenced — a separate axis from maturity.
 * A directly-verified practice and an owner-attested prototype can sit at very
 * different points on this axis while both being real.
 */
export type EvidenceStrength =
  /** Performed and recorded in this programme, with machine output. */
  | "directly-verified"
  /**
   * Described by the person who built it; no artifact currently accessible.
   * A `validated-prototype` maturity paired with this strength means the
   * prototype is reported to have worked — it does NOT mean the claim is
   * repository-verified, independently reproduced, or currently re-runnable.
   */
  | "owner-attested"
  /** A stated direction with hardware inspected but nothing built. */
  | "declared-direction";

export const MATURITY_LABEL: Record<PhysicalMaturity, string> = {
  "validated-prototype": "Validated prototype",
  "verified-practice": "Verified practice",
  "active-research": "Active research",
  "research-direction": "Research direction",
};

export const EVIDENCE_LABEL: Record<EvidenceStrength, string> = {
  "directly-verified": "Directly verified",
  "owner-attested": "Owner-attested",
  "declared-direction": "Declared direction",
};

export interface PhysicalRecord {
  readonly id: string;
  readonly index: string;
  readonly name: string;
  /** One line: what this shows about working past the screen. */
  readonly demonstrates: string;
  /** What was actually done. Facts, not capability language. */
  readonly evidence: readonly string[];
  readonly maturity: PhysicalMaturity;
  readonly evidenceStrength: EvidenceStrength;
  readonly lastVerified?: string;
  /** Never empty. */
  readonly notClaimed: string;
}

/**
 * The control path, as a sequence. Used by the bench diagram and its semantic
 * equivalent, so the drawing and the text cannot disagree.
 */
export interface PathStage {
  readonly id: string;
  readonly index: string;
  readonly name: string;
  /** What crosses into this stage. */
  readonly input: string;
  /** What happens here. */
  readonly acts: string;
  /** What leaves it. */
  readonly output: string;
  /** How this stage is known to be real. */
  readonly grounding: string;
}

/**
 * The diagnostic trace of the 2026-08-08 storage fault.
 *
 * Every stage below happened and is recorded. This is the chapter's anchor
 * because it is the only physical work with machine evidence attached.
 */
export const DIAGNOSTIC_PATH: readonly PathStage[] = [
  {
    id: "symptom",
    index: "01",
    name: "Symptom",
    input: "A path that should exist does not.",
    acts: "The editor reported a missing directory; the mount point existed but was empty.",
    output: "A fault that could be filesystem, device, or nothing at all.",
    grounding: "Observed directly.",
  },
  {
    id: "isolate",
    index: "02",
    name: "Isolate",
    input: "An empty mount point and a boot that succeeded anyway.",
    acts:
      "Compared the fstab entry against attached block devices. The UUID was absent from every device, and `nofail` explained why the machine still booted.",
    output: "The block device is enumerated, but no readable filesystem signature is identified.",
    grounding: "`lsblk`, `blkid`, `/etc/fstab`.",
  },
  {
    id: "measure",
    index: "03",
    name: "Measure",
    input: "A 500 GB device the kernel enumerates but cannot identify.",
    acts:
      "Read the journal for the mount attempt. A 90-second gap between attempt and failure, then a read error at the first block of the partition.",
    output: "kernel: Buffer I/O error on dev sdb1, logical block 0",
    grounding: "`journalctl`, kernel ring buffer.",
  },
  {
    id: "classify",
    index: "04",
    name: "Classify",
    input:
      "A read failure at the start of the partition, where critical filesystem metadata would ordinarily need to be read.",
    acts:
      "Named what the evidence does and does not separate. This read failure does not distinguish media from the SATA data path, power or controller; enumeration proves the device is seen, not that the media is intact.",
    output: "A bounded conclusion, with the causes it cannot yet separate stated.",
    grounding: "Recorded in the incident file, including the withdrawal of an earlier overclaim.",
  },
  {
    id: "contain",
    index: "05",
    name: "Contain",
    input: "A device that may be failing and may be recoverable.",
    acts:
      "Refused every write. No fsck, no ntfsfix, no chkdsk, no partition repair — writing to a device whose first block will not read is how recoverable data becomes unrecoverable.",
    output: "The device left exactly as found, and an imaging-first recovery order recorded.",
    grounding: "No write operation was issued at any point.",
  },
  {
    id: "recover",
    index: "06",
    name: "Recover",
    input: "Source that may exist in only one place.",
    acts:
      "Established what survived elsewhere before spending effort on the platter, and restored the reachable copy to healthy storage.",
    output: "A working clone, and a stated time window whose contents remain unknown.",
    grounding: "Restored, dependencies installed, tests and production build run.",
  },
];

export const PHYSICAL_RECORDS: readonly PhysicalRecord[] = [
  {
    id: "diagnosis",
    index: "01",
    name: "Hardware fault isolation",
    demonstrates: "Reading a failing physical system without making it worse.",
    evidence: [
      "A storage fault traced to a read failure at the start of a partition, with the kernel output that records it",
      "Media, SATA data path, power and controller named as causes the evidence does not separate, rather than condemning the drive",
      "Every write refused — the repair tools that would have destroyed recoverability were not run",
      "An imaging-first recovery order recorded, and the surviving copy restored and re-qualified",
    ],
    maturity: "verified-practice",
    evidenceStrength: "directly-verified",
    lastVerified: "2026-08-08",
    notClaimed:
      "One storage fault, diagnosed to a bounded conclusion. Not a data-recovery service, not board-level electronics repair, and the drive itself was never proven dead.",
  },
  {
    id: "embedded",
    index: "02",
    name: "Embedded sensing and control",
    demonstrates: "A measurement becoming a decision becoming a physical action.",
    evidence: [
      "A two-controller arrangement: one reads the environment, the other drives the outputs",
      "Temperature and soil moisture sensing, a local display, and a wireless serial link",
      "Fan and pump actuation driven from the sensed state",
      "Serial communication brought up and debugged across the two boards",
    ],
    maturity: "validated-prototype",
    evidenceStrength: "owner-attested",
    notClaimed:
      "Owner-attested prototype; source artifact not currently accessible, so nothing here is read from a repository or independently reproduced. Not a deployed installation, not precision agriculture, not an IoT fleet.",
  },
  {
    id: "aerial",
    index: "03",
    name: "Aerial platform research",
    demonstrates: "Taking an existing flight platform apart to understand where its limits are.",
    evidence: [
      "An existing drone board inspected at the hardware level",
      "Motors, board and the boundaries of what its firmware permits examined",
      "The decision recorded: build up from parts rather than modify a closed platform",
    ],
    maturity: "active-research",
    evidenceStrength: "declared-direction",
    notClaimed:
      "Nothing has been flown, built or deployed. No autonomous navigation, no vision-guided flight, no flight-controller development, and no experience claimed with any specific autopilot stack.",
  },
  {
    id: "sensing",
    index: "04",
    name: "Radar and sensing research",
    demonstrates: "Choosing where the next physical capability should come from.",
    evidence: [
      "FMCW radar investigated as a sensing direction",
      "Starter hardware identified and evaluated against what it would actually teach",
    ],
    maturity: "research-direction",
    evidenceStrength: "declared-direction",
    notClaimed:
      "A direction, not a build. No radar has been constructed, no signal processing implemented, and no measurement produced.",
  },
];

export function getRecord(id: string): PhysicalRecord {
  const found = PHYSICAL_RECORDS.find((r) => r.id === id);
  if (!found) throw new Error(`unknown physical record: ${id}`);
  return found;
}

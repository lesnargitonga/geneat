# Wave H — the work register

Study A only. No production change, no deploy, no Study B change, no commit.

## What decided the register

Inclusion was decided by evidence, not by what would make the index look
fuller. The starting point was the accepted record, and the accepted record is
blunt: `src/proof/proof-model.ts` classifies CarePro, Sarepta and
SentinelCore/Cypher as *named problem classes* with **"no artifact in this
repository; nothing claimed"**, and `research/limitations.md` records that the
portfolio grammars are "a fixture, not case studies … publication remains
provisional".

That is still true of *this repository*. What changed is that the detanglement
work produced separate, first-hand host evidence for one of them.

| Candidate | Evidence found | Decision |
|---|---|---|
| Gen-Eat | Storefront 200, `/healthz` 200, own service, own database, own Redis namespace, failure isolation measured | **Included — live product** |
| Hazina Nomads | Same class of evidence, own runtime and history | **Included — live product** |
| CarePro | Own public host with its own TLS; stayed answering while each product service was stopped in turn; never modified; founders' own product | **Included — live product** |
| Experience Lab | This environment: typed models, four parity gates, negative probes, the whole qualification record | **Included — internal engineering system** |
| Physical intelligence | Wave G, accepted: four records at four evidence levels | **Included — active research (the frontier, not its best specimen)** |
| SentinelCore / Cypher | A seven-step control-boundary vocabulary in `project-grammars.ts`, explicitly dev-only with no status, metrics or client detail | **Included as research only, merged into one record** |
| Sarepta | A private repository name and a note that it also lived on the failed disk. Nothing else. | **Excluded** |

### Why Sarepta is excluded

There is no artifact, no reachability, no sanitised material and no description
beyond a problem class. An entry would have published a name and nothing else,
and the work involves children and donors — so a near-empty record carries real
risk in exchange for no information. §4 permits omission where proof is
inadequate; this is that case. The omission is recorded here rather than left
as a silent gap.

### Why SentinelCore and Cypher became one record

Listing both would have implied two systems. There is one investigation and one
artifact — a control-boundary grammar — so it is one record, named for what it
actually is rather than for two product names. It carries `RESEARCH RECORD` and
its proof reference is explicitly *"Not linked — no system exists to show"*.

## Maturity was derived, not assumed

Each label was checked against the specific failure modes §5 warns about.

- **A running API is not a live product.** Gen-Eat and Hazina qualify because
  they serve their own storefronts at their own hostnames, not because
  `/healthz` answers. The boundary on both records says exactly that: reachable
  and healthy, not orders, payments, customers, traffic or uptime.
- **An internal system is not a product.** The Experience Lab is labelled
  `INTERNAL ENGINEERING SYSTEM` and its boundary states it is not a product and
  not for sale.
- **Owner-attested is not direct verification.** The physical record inherits
  Wave G's classification unchanged. Visual quality does not raise maturity: the
  aerial and radar work stays where Wave G left it.
- **Research is not a prototype because code exists.** The control-boundary
  record is `ACTIVE RESEARCH` and says plainly that nothing has been built.

### CarePro — resolved

The §7 audit asked for the accepted source establishing CarePro's **client**
status. Within this repository there was none, and that gap was real: the
repository is `lesnargitonga/carepro` — the same owner account as every other
system — and `SECURITY_PRIVACY_UX_MATRIX.md` records "no status, metrics or
client detail. Publication remains provisional and unreverified." Reporting the
gap rather than reclassifying on a guess was the correct call, and it is kept in
this record rather than tidied away.

**The owner context resolved it.** CarePro is not an external client system: it
is a product built and run by the founders — Lesnar leading technology and
platform engineering, Vinnie contributing nursing and care-workflow domain
context. The public homepage states this independently: *"Founded by Lesnar &
Vinnie"*.

So `CONTROLLED CLIENT SYSTEM` was rejected — there is no client — and CarePro
carries `LIVE PRODUCT` under the bounded Wave H definition: a publicly reachable
product surface and a qualified, independently deployable runtime. That label
establishes nothing about customers, traffic, bookings, revenue, adoption or
uptime, and the record's boundary says so explicitly.

`controlled-client-system` remains in the type union but is now used by nothing,
with a comment recording why. A test asserts no record may carry it.

The technical evidence was never the problem — it already established a
home-care and nursing coordination platform running in production on its own
infrastructure, with its own hostname, TLS and PM2 runtime, and operational
independence measured during the product-service failure tests. Only the
*relationship* was unevidenced, and only the relationship changed.

### CarePro public-surface safety audit

Performed before publishing the link. Ordinary public homepage only — no login,
no admin area, no personal data submitted, no sensitive route crawled.

| Check | Result |
|---|---|
| HTTPS, valid certificate | 200, `ssl_verify_result=0` |
| Patient data | none |
| Nurse private data | none |
| Personal schedules | none |
| Private documents | none |
| Admin interface | none |
| Credential material | none |
| Internal host / IP / port | none |
| Database endpoint | none |
| Personal phone numbers | none |

The surface is an ordinary product homepage: services, indicative starting
prices, a vetting process, and a stated emergency disclaimer with Terms and
Privacy linked. **Safe to publish**, so the proof state is `PUBLIC PROOF` and
`https://carepro.co.ke` is linked as external public proof. The operational
record remains separately described as internal and private.

## Proof states

`PUBLIC PROOF` / `SANITIZED PROOF` / `INTERNAL EVIDENCE` / `RESEARCH RECORD`.

The axis exists because maturity and showability are different questions. A
system can be genuinely live while its evidence is necessarily private, and
collapsing the two would force every honest record to either overclaim or
understate. **A truthful `INTERNAL EVIDENCE` marker is stronger than a
fabricated public artifact**, so CarePro's proof references are rendered as
plain text — "Isolation measured on the host", "Operational record is private" —
never as links, and a test asserts an unlinked proof never acquires an `href`.

## Link audit

Every link was fetched, not assumed.

| Target | Result | Published |
|---|---|---|
| `geneat.lesnarai.co.ke` | 200 | yes |
| `hazina.lesnarai.co.ke` | 200 | yes |
| `geneat-api…/healthz` | 200 `{"status":"ok"}` | yes |
| `hazina-api…/healthz` | 200 `{"status":"ok"}` | yes |
| `carepro.co.ke` | 200, valid TLS, safety-audited | **yes** |
| `geneat-api…/docs` | 404 | n/a, policy holds |
| `hazina-api…/openapi.json` | 404 | n/a, policy holds |

CarePro is now linked. The earlier rationale — that publishing the front door
was the client's decision — was void once the relationship was established:
there is no client. It is published only after the public-surface safety audit
above, not merely to satisfy a proof state.

No private repository, admin path, localhost URL, VPS address or dashboard is
linked. Internal anchors point only at sections that exist (`#product`,
`#system`, `#action`) — no case-study routes were invented, so there are no dead
links to fill the architecture out.

## Privacy audit

The final served HTML was scanned for IP addresses, loopback addresses, private
filesystem paths, host deployment paths, database names, private hostnames,
emails, phone numbers, credential material, repository links, admin paths and
child/donor/patient identifiers.

**The Wave H region is clean on all eleven patterns.**

Page-wide, one genuine finding and three false positives:

- **`geneat_prod` / `hazina_prod` were in visitor copy** (index.html:249, :387)
  from the Wave D/E separation proof. **Now removed** and replaced with semantic
  descriptions — "a separate product database each", "its own database and
  database user" — on instruction. The architectural claim is unchanged: each
  product owns an isolated database and credential boundary. The exact
  identifiers remain in private research and evidence where they are needed.
- "secret" matched the *word* in "refuses to start on a placeholder secret" and
  "Secret hygiene" — security claims, not secret values.
- "VPS" matched a proof-source label, not a hostname.
- `hello@lesnarai.co.ke` is the intended publication contact.

## Claim audit

Every record was read back against the question "would a reasonable visitor read
this more strongly than the evidence supports".

Three rewrites resulted:

- Gen-Eat and Hazina do not claim commercial outcomes, and both carry Wave E's
  verified negatives explicitly — model-backed conversation is **not** currently
  reachable, and **no** historical operational data was migrated.
- CarePro asserts no regulatory approval, medical-device status, clinical
  decision-making or certified compliance, and states that no patient, nurse or
  scheduling data is shown, described or linked. A clause-aware test enforces
  this and self-tests that an unnegated claim still trips it.
- The Experience Lab record states that its qualification is laboratory
  measurement on one machine, not field data.

No raw regression total appears in visitor copy; a test fails if one does,
because those numbers age the moment they are written.

## Parity

`check-work-parity.mjs` compares model → served HTML and never writes. It
validates index, name, category, summary, whatChanged, maturity (attribute *and*
label), proof state (attribute *and* label), lastVerified presence and value,
boundary, every proof reference's label, link state and href, and the order of
the register itself — because the register is ranked by evidence strength, so a
reordering would misrepresent the ranking without altering a single field.

Drift tests prove the gate bites on name, index, maturity, proof state,
lastVerified changed, lastVerified removed, and boundary. A separate test proves
the checker does not modify `index.html`.

## Two defects this wave introduced and caught

**The attribute collision, a fourth time.** `data-proof="<state>"` on the work
register collided with the flagship's established `[data-proof]` proof-object
selector, taking that count from 4 to 10 and breaking four Wave E tests. Renamed
to `data-proof-state`. This is the same class as `data-chapter`,
`data-capability` and `data-trace-stage` — an attribute chosen for readability
inside a new component, without checking what already answers to it.

**A hard-coded chapter list.** `isChapterId()` in `chapter-controller.ts`
enumerated the four chapter ids by hand, so the new Work chapter would have been
silently rejected and the rail would never have highlighted it — a defect that
raises no error and simply never works. It now derives from `CHAPTERS`, and the
no-JS test derives its count the same way instead of asserting a literal 4.

**A checker that was not looking.** `capture-visual-matrix.mjs` audited only
`.flagship *`, `.status`, `.proof-object` and `.route-step`, so every chapter
added after Wave E was invisible to it and the register's links were never
checked for target size at all. Widened to the whole document.

## Composition

Register rows, not cards. Folio number in the margin, the project name as the
largest object on the row, category set right, metadata hung off its own
hairline in a narrow column, proof references on a rule, boundary last. No logo,
no mockup frame, no dashboard table, no pricing grid.

Evidence depth is visible in the composition: the research record's name steps
down to `--text-h3` so it does not carry the same weight as a running product.

The chapter originally stated its purpose twice — chapter heading and lede, then
a near-identical unit heading and lede, with a void between them wide enough to
read as a missing element. The unit's lede became a single qualifying note.

No interaction was added. §17 makes one optional, and the register is complete
as static editorial composition — every field is in the served markup, so there
is nothing an interaction would reveal that reading does not.

## Case-study architecture

Deliberately not built. `ProofRef.href` is optional and `kind: "unlinked"` is a
first-class state, which is the semantic architecture a later case page would
need — a record can gain a link without any structural change. No
`/case/<name>` route exists, because §16 forbids dead routes and an empty page
would be worse than no page.

## Truth boundaries

- Reachability and health are not commercial outcomes for either storefront
- Model-backed conversation is not currently reachable
- No historical operational data was migrated
- CarePro is coordination software with no regulatory, clinical, device or compliance claim, and no outcome, volume, adoption or uptime claim
- The Experience Lab is not a product
- The physical frontier is exactly where Wave G left it
- The control boundary is a discipline, not a system
- Sarepta is absent because the evidence does not support an entry

---

# Wave H — final truth and privacy corrections

Applied before visual review.

## 1. Physical intelligence maturity — corrected

`VALIDATED PROTOTYPE` → **`ACTIVE RESEARCH`**.

That label described the strongest single specimen — the owner-attested embedded
greenhouse — and applying it to the record promoted the entire frontier to the
maturity of one entry. Wave G graded four things separately and the register was
flattening them.

The public copy now preserves the distinction explicitly: fault isolation is
verified practice, the greenhouse is an owner-attested prototype, aerial work is
active research, radar is a stated direction with no build. The boundary opens
"Four entries at four different evidence levels, not one prototype."

Two guards prevent silent re-promotion: a unit test asserting the maturity is
`active-research` and never `validated-prototype`, and a parity drift case
proving a promotion fails `check-work-parity.mjs`.

**Visual consequence, corrected too.** The composition rule that steps a record's
name down was keyed on `active-research`, so the regrade shrank Physical
intelligence to the size of the research record — despite it carrying sanitized
proof and a verification date. It is now keyed on `proofState: research-record`,
which is the actual depth signal: only the record whose own proof reads "no
system exists to show" steps down.

## 2. Gen-Eat isolation claim — bounded

"so a fault in the neighbouring product cannot reach it" claimed universal fault
immunity from a single measured test. Now: "and in the measured failure test
stopping the neighbouring product service left Gen-Eat answering."

Hazina carried the equivalent absolute and is bounded the same way — "In the same
measured test, stopping either product service left the other answering." The
database, credential and namespace separation claims are unchanged; those were
directly measured.

## 3. LIVE PRODUCT definition — no invented user activity

Was: "a system serving its own users at its own public hostname". The accepted
evidence proves no user activity at all.

Now: "a product with a publicly reachable product surface and a qualified,
independently deployable runtime", followed by an explicit statement that the
label does **not** establish adoption or commercial outcomes, and does not stand
in for customers, traffic, orders, revenue or uptime. Every record's boundary
still says so again in visitor-facing copy.

## 4. Database identifiers — removed from served copy

See the privacy audit above. Page-wide re-scan after the change: **0 production
database identifiers in visitor copy**, 0 real leaks across all eleven patterns,
Wave H region clean.

## 5. Superseding the stale Wave F client maturity

Resolving CarePro's ownership made a second defect conclusive.

Wave F graded two capabilities `CONTROLLED CLIENT SYSTEM`, defined in its own
taxonomy as *"Operated for a real client system, not publicly browsable"*:

| Capability | Proof sources | Boundary describes |
|---|---|---|
| Operate | Shared VPS runtime · Production host | single-host operations within measured capacity; configured, not load-qualified |
| Protect | Gen-Eat / Hazina separation · Runtime qualification | measured isolation and configuration hardening |

Every one of those is the studio's own infrastructure. The grade only held while
some client system existed somewhere in the portfolio to justify it, and CarePro
was the last candidate. Once CarePro was established as the founders' own
product, **no evidenced client relationship remained anywhere**, and both labels
were simply false.

The discovery order matters and is recorded honestly: the repository-only audit
flagged CarePro's missing client evidence, the owner context resolved it, and
only then did the same absence become conclusive for these two capabilities.

**Corrected forward, not rewritten.** Same discipline as the stale Wave F
contrast artifact:

- Wave F used `CONTROLLED CLIENT SYSTEM` for Operate and Protect.
- Wave H established that no client relationship supported either grade.
- The historical checkpoints `6638d276…` and `fa4de639…` are **not** amended.
- The current served classification **supersedes** those two maturity labels
  and nothing else about Wave F.

Operate → `INTERNAL ENGINEERING SYSTEM`. Protect → `INTERNAL ENGINEERING SYSTEM`.
Both match the taxonomy's existing definition — *"Real and in use, but on our own
systems"* — and neither boundary was touched: Operate still states single-host
operations within measured capacity with configured, not load-qualified,
protections and no orchestration or autoscaling claim; Protect still states
measured isolation and configuration hardening, explicitly not penetration
testing, not compliance certification, not a security-audit practice. Neither was
inflated toward a security service or consultancy.

The markup was regenerated through the existing Wave F mechanism
(`generate-capability-register.mjs`), not hand-patched, and capability parity was
verified to **fail** when either label is drifted back — confirmed by drifting
each in turn and restoring.

`controlled-client-system` stays in the capability vocabulary as a legitimate
future grade, commented as requiring evidence of an external client relationship
and currently unused. It is a different taxonomy from `WorkMaturity` despite the
identical string, and the comment says so. The regression guard asserts the six
current maturities as an explicit table rather than banning the vocabulary
outright, so a genuinely evidenced client capability can be added later by
deliberately updating that table — which is exactly the review moment such a
claim deserves.

**Visitor-facing occurrences of "Controlled client system": 0.**

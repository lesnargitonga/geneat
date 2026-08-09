/**
 * Generates the Wave H work register markup from the model.
 *
 * Same discipline as Waves F and G: the served HTML carries every record in
 * full so the register reads without script, and the model is the only source
 * of truth. Regenerate, paste, then validate with check-work-parity.mjs — which
 * never writes.
 */
import { WORK_RECORDS, WORK_MATURITY_LABEL, PROOF_STATE_LABEL } from "../src/work/work-model.ts";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A proof reference.
 *
 * An unlinked proof renders as text, never as a disabled-looking link — there
 * is nothing to go to, and dressing it as a control would be a lie about what
 * the visitor can do. External links carry rel="noopener" and are marked so the
 * destination is not a surprise.
 */
const proof = (p) => {
  if (p.kind === "unlinked" || !p.href) {
    return `                <li class="work-proof__item work-proof__item--unlinked">${esc(p.label)}</li>`;
  }
  const external = p.kind === "external";
  const attrs = external ? ` target="_blank" rel="noopener noreferrer"` : "";
  const marker = external
    ? `<span class="work-proof__external" aria-hidden="true">&#8599;</span><span class="visually-hidden"> (opens in a new tab)</span>`
    : "";
  return `                <li class="work-proof__item"><a class="work-proof__link" href="${esc(p.href)}"${attrs}>${esc(p.label)}${marker}</a></li>`;
};

const records = WORK_RECORDS.map(
  (r) => `            <article class="work-record" id="work-${r.id}" data-work="${r.id}">
              <header class="work-record__head">
                <p class="work-record__index" aria-hidden="true">${esc(r.index)}</p>
                <h4 class="work-record__name">${esc(r.name)}</h4>
                <p class="work-record__category">${esc(r.category)}</p>
              </header>
              <p class="work-record__summary">${esc(r.summary)}</p>
              <div class="work-record__body">
                <div class="work-record__changed">
                  <p class="work-record__label">What changed</p>
                  <p class="work-record__changed-text">${esc(r.whatChanged)}</p>
                </div>
                <dl class="work-record__meta">
                  <dt>Maturity</dt>
                  <dd class="work-record__maturity" data-maturity="${r.maturity}">${esc(WORK_MATURITY_LABEL[r.maturity])}</dd>
                  <dt>Proof</dt>
                  <dd class="work-record__proof-state" data-proof-state="${r.proofState}">${esc(PROOF_STATE_LABEL[r.proofState])}</dd>
${r.lastVerified ? `                  <dt>Verified</dt>\n                  <dd class="work-record__verified">${esc(r.lastVerified)}</dd>\n` : ""}                </dl>
              </div>
              <ul class="work-proof">
${r.proofs.map(proof).join("\n")}
              </ul>
              <p class="work-record__boundary">
                <span class="work-record__boundary-label">Not claimed</span>
                ${esc(r.notClaimed)}
              </p>
            </article>`,
).join("\n\n");

process.stdout.write(`        <!--
          Wave H — the work register.

          Generated from src/work/work-model.ts by scripts/generate-work-register.mjs.
          Do not hand-edit: check-work-parity.mjs compares this markup against the
          model and fails on drift.
        -->
        <div class="work-unit" aria-labelledby="work-heading">
          <header class="work-unit__head">
            <p class="eyebrow">The work register</p>
            <h3 class="section-heading section-heading--sub" id="work-heading">
              Systems that left a record
            </h3>
            <p class="work-unit__note">
              Where the evidence is private this says so, rather than manufacturing a public
              artifact to fill the space.
            </p>
          </header>

          <div class="work-register" data-work-register>
${records}
          </div>
        </div>
`);

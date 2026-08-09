/**
 * Generates the Wave G physical chapter markup from the model.
 *
 * Same discipline as Wave F: the served HTML must contain every stage and
 * record in full so the chapter reads without script, and the model is the only
 * source of truth. Regenerate, then validate with check-physical-parity.mjs.
 */
import { DIAGNOSTIC_PATH, PHYSICAL_RECORDS, MATURITY_LABEL, EVIDENCE_LABEL } from "../src/physical/physical-model.ts";

const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const stages = DIAGNOSTIC_PATH.map((s) => `              <li class="trace__stage" id="trace-${s.id}" data-trace-stage="${s.id}">
                <p class="trace__head">
                  <span class="trace__index" aria-hidden="true">${esc(s.index)}</span>
                  <span class="trace__name">${esc(s.name)}</span>
                </p>
                <dl class="trace__detail">
                  <dt>Enters</dt><dd>${esc(s.input)}</dd>
                  <dt>Acts</dt><dd>${esc(s.acts)}</dd>
                  <dt>Leaves</dt><dd class="trace__output">${esc(s.output)}</dd>
                  <dt>Known by</dt><dd>${esc(s.grounding)}</dd>
                </dl>
              </li>`).join("\n");

const records = PHYSICAL_RECORDS.map((r) => `            <article class="phys-record" id="physical-${r.id}" data-physical="${r.id}">
              <header class="phys-record__head">
                <span class="phys-record__index" aria-hidden="true">${esc(r.index)}</span>
                <h4 class="phys-record__name">${esc(r.name)}</h4>
                <p class="phys-record__grades">
                  <span class="phys-record__maturity" data-maturity="${r.maturity}">${esc(MATURITY_LABEL[r.maturity])}</span>
                  <span class="phys-record__evidence" data-evidence="${r.evidenceStrength}">${esc(EVIDENCE_LABEL[r.evidenceStrength])}</span>
                </p>
              </header>
              <p class="phys-record__demonstrates">${esc(r.demonstrates)}</p>
              <ul class="phys-record__evidence-list">
${r.evidence.map((e) => `                <li>${esc(e)}</li>`).join("\n")}
              </ul>
              <p class="phys-record__boundary">
                <span class="phys-record__boundary-label">Not claimed</span>
                ${esc(r.notClaimed)}
              </p>${r.lastVerified ? `\n              <p class="phys-record__verified">Verified ${esc(r.lastVerified)}</p>` : ""}
            </article>`).join("\n\n");

process.stdout.write(`        <!--
          Wave G — the physical record.

          Generated from src/physical/physical-model.ts. Every stage and record
          is complete in this markup, so the chapter reads without script; the
          stepper below only narrows the trace to one stage at a time.
        -->
        <div class="physical" data-physical-chapter>
          <div class="trace" data-trace>
            <ol class="trace__index" data-trace-index aria-label="Diagnostic trace">
${DIAGNOSTIC_PATH.map((s) => `              <li><a class="trace__link" href="#trace-${s.id}" data-trace-link="${s.id}"><span class="trace__link-index" aria-hidden="true">${esc(s.index)}</span><span class="trace__link-name">${esc(s.name)}</span></a></li>`).join("\n")}
            </ol>
            <ol class="trace__stages" data-trace-stages>
${stages}
            </ol>
          </div>

          <div class="phys-records" data-physical-records>
${records}
          </div>
        </div>
`);

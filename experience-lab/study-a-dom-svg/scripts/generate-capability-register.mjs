/**
 * Generates the static capability register markup from the TypeScript model.
 *
 * The register must be complete in the served HTML — every capability, every
 * behaviour, every proof — so the section is fully readable with JavaScript
 * disabled. Hand-transcribing that from `capability-model.ts` would guarantee
 * drift, so it is generated and the output pasted into `index.html`.
 *
 * Run: node --experimental-strip-types scripts/generate-capability-register.mjs
 */
import { CAPABILITIES, MATURITY_LABEL } from "../src/capability/capability-model.ts";
import { glyphMarkup } from "../src/capability/capability-glyph.ts";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function capabilityEntry(c) {
  const behaviours = c.behaviours.map((b) => `                  <li>${esc(b)}</li>`).join("\n");
  const proofs = c.proofs
    .map((p) => {
      const verified = p.verified
        ? `\n                      <span class="cap-proof__verified">verified ${esc(p.verified)}</span>`
        : "";
      const seeAlso = p.seeAlso
        ? `\n                      <a class="cap-proof__link" href="${esc(p.seeAlso)}">See the full proof</a>`
        : "";
      return `                  <li class="cap-proof">
                    <p class="cap-proof__statement">${esc(p.statement)}</p>
                    <p class="cap-proof__meta">
                      <span class="cap-proof__source">${esc(p.source)}</span>${verified}${seeAlso}
                    </p>
                  </li>`;
    })
    .join("\n");

  return `          <article
            class="cap-entry"
            id="capability-${c.id}"
            data-capability="${c.id}"
            aria-labelledby="capability-${c.id}-name"
          >
            <header class="cap-entry__head">
              <span class="cap-entry__index" aria-hidden="true">${esc(c.index)}</span>
              ${glyphMarkup(c.glyph)}
              <h4 class="cap-entry__name" id="capability-${c.id}-name">${esc(c.name)}</h4>
              <p class="cap-entry__maturity" data-maturity="${c.maturity}">${esc(MATURITY_LABEL[c.maturity])}</p>
            </header>

            <p class="cap-entry__changes">${esc(c.changes)}</p>

            <div class="cap-entry__body">
              <section class="cap-block" aria-labelledby="capability-${c.id}-behaviours">
                <h5 class="cap-block__title" id="capability-${c.id}-behaviours">What we do</h5>
                <ul class="cap-block__list">
${behaviours}
                </ul>
              </section>

              <section class="cap-block" aria-labelledby="capability-${c.id}-proof">
                <h5 class="cap-block__title" id="capability-${c.id}-proof">Where it is demonstrated</h5>
                <ul class="cap-block__list cap-block__list--proof">
${proofs}
                </ul>
              </section>
            </div>

            <p class="cap-entry__boundary">
              <span class="cap-entry__boundary-label">Not claimed</span>
              ${esc(c.boundary)}
            </p>
          </article>`;
}

const index = CAPABILITIES.map(
  (c) => `            <li class="cap-index__item">
              <a class="cap-index__link" href="#capability-${c.id}" data-capability-link="${c.id}">
                <span class="cap-index__num" aria-hidden="true">${esc(c.index)}</span>
                ${glyphMarkup(c.glyph)}
                <span class="cap-index__name">${esc(c.name)}</span>
                <span class="cap-index__maturity" data-maturity="${c.maturity}">${esc(MATURITY_LABEL[c.maturity])}</span>
              </a>
            </li>`,
).join("\n");

const entries = CAPABILITIES.map(capabilityEntry).join("\n\n");

process.stdout.write(`        <!--
          The capability register.

          Every entry is complete in this markup: behaviours, proofs, maturity
          and the boundary that names what is NOT being claimed. With JavaScript
          the register becomes an inspector that shows one capability at a time;
          without it, the whole field sheet reads top to bottom. Nothing here
          depends on script, hover or a pointer.
        -->
        <div class="capability" data-capability-register>
          <ol class="cap-index" data-capability-index aria-label="Capability register">
${index}
          </ol>

          <div class="cap-field" data-capability-field>
${entries}
          </div>
        </div>
`);

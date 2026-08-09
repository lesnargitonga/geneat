/**
 * Rendered-text contrast sweep.
 *
 * ## Why this exists separately from the Wave D pair audit
 *
 * `measure-wave-d.mjs` checks a hand-maintained list of *token pairs* — "is
 * --text-tertiary legible on --surface-inset". That is a useful policy check and
 * it stays. But it cannot see a token being used somewhere it was never meant to
 * go, because nothing in it looks at the document.
 *
 * That gap was not theoretical. `--signal-dormant` is declared a non-text rule
 * tone and the pair audit correctly holds it to 3.0 as a UI colour — while five
 * separate rules applied it to text a visitor actually reads, at ~2.1:1. The
 * pair audit passed 18/18 the whole time. It was answering a different question.
 *
 * So this walks the rendered document instead: every element carrying its own
 * text, measured as painted, against the background actually behind it.
 *
 * ## Two things it refuses to assume
 *
 * 1. **Colour notation.** Chromium keeps `oklch()` unresolved in computed
 *    styles, so parsing the string numerically reads "0.94 0.012 82" as an RGB
 *    triple and reports ~1:1 for everything. Every colour here is painted to a
 *    canvas and read back as sRGB.
 * 2. **The background.** `background-color` is `transparent` on most elements,
 *    so the contrast partner is whichever ancestor actually paints. This climbs
 *    until it finds one rather than assuming the body colour.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../evidence/wave-g");
const BASE = process.env.STUDY_A_URL ?? "http://127.0.0.1:4190";

/**
 * The full responsive matrix, not a sample.
 *
 * Three viewports would have been the same mistake as fifteen token pairs:
 * `.cap-entry__index` failed only between 381px and 1023px, so a desktop plus
 * mobile check reports clean while a real tablet does not. Breakpoint bands are
 * exactly where restyled text hides, so every band gets a viewport, including
 * one either side of each boundary.
 */
const VIEWPORTS = [
  ["w320", 320, 800],
  ["w360", 360, 800],
  ["w380", 380, 800],
  ["w390", 390, 844],
  ["w430", 430, 932],
  ["w640", 640, 900],
  ["w641", 641, 900],
  ["w768", 768, 1024],
  ["w820", 820, 1180],
  ["w1023", 1023, 800],
  ["w1024", 1024, 768],
  ["w1280", 1280, 800],
  ["w1440", 1440, 900],
  ["w1920", 1920, 1080],
];

async function sweep(page, label) {
  return page.evaluate((viewport) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    /** Paint a colour and read back the sRGB the display receives. */
    const toRgb = (value) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };

    const lum = ([r, g, b]) => {
      const f = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    const ratio = (fg, bg) => {
      const la = lum(fg);
      const lb = lum(bg);
      const [hi, lo] = la > lb ? [la, lb] : [lb, la];
      return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
    };

    /**
     * The colour actually behind this element.
     *
     * Climbs past every transparent ancestor. If nothing paints all the way up,
     * that is reported rather than defaulted — a text run over an unpainted
     * root is a real finding, not something to paper over with an assumption.
     */
    const paintedBackdrop = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        const rgba = toRgb(bg);
        // toRgb drops alpha, so read it from the string to detect transparency.
        const alpha = /rgba?\([^)]*,\s*([\d.]+)\s*\)/.exec(bg)?.[1];
        const isTransparent = bg === "transparent" || alpha === "0";
        if (!isTransparent) return { rgb: rgba, source: node.tagName.toLowerCase(), raw: bg };
      }
      return null;
    };

    /** Text a sighted visitor cannot see is not a contrast finding. */
    const isVisuallyHidden = (el, rect) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return true;
      if (Number(cs.opacity) === 0) return true;
      // The .sr-only pattern: clipped to a 1px box.
      if (rect.width <= 1 || rect.height <= 1) return true;
      return false;
    };

    /**
     * Does this pseudo-element actually put text on the page?
     *
     * `content` is the deciding property, and three values mean "nothing to
     * read": `none` and `normal` (no box generated) and an empty string literal
     * (a box generated purely to be drawn with borders or a background — the
     * seams and rules this design is full of). Those are skipped so decorative
     * pseudo-elements are not counted as text.
     *
     * A counter is deliberately kept without being resolved. Chromium reports
     * `counter(step, decimal-leading-zero)` rather than "01", and that is
     * enough: the question here is what colour the generated glyphs are painted
     * in and on what, not which digits they spell.
     */
    const pseudoText = (el, which) => {
      const cs = getComputedStyle(el, which);
      if (!cs) return null;
      const content = cs.content;
      if (!content || content === "none" || content === "normal") return null;
      if (cs.display === "none" || cs.visibility === "hidden") return null;
      if (Number(cs.opacity) === 0) return null;
      // Image-only generated content carries no text.
      if (/^url\(/.test(content) && !/counter|attr|"/.test(content)) return null;
      // Strip string literals; if what remains has no counter/attr and the
      // literals were all empty, there is no glyph to read.
      const literals = [...content.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      const hasGenerator = /counter\(|counters\(|attr\(/.test(content);
      const literalText = literals.join("").trim();
      if (!hasGenerator && literalText === "") return null;
      return { cs, label: hasGenerator ? content : literalText };
    };

    /**
     * A label a human can act on.
     *
     * A bare tag name is not one: the action-sequence steps are unclassed `li`
     * elements, so reporting them as "li" identifies nothing and — as this
     * script found the hard way — makes a probe unable to recognise its own
     * injected defect. When the element has no class, the nearest classed
     * ancestor is prepended.
     */
    const describe = (el) => {
      const own = typeof el.className === "string" ? el.className.trim() : "";
      if (own) return own;
      const tag = el.tagName.toLowerCase();
      for (let node = el.parentElement; node; node = node.parentElement) {
        const cls = typeof node.className === "string" ? node.className.trim() : "";
        if (cls) return `${cls.split(/\s+/)[0]} > ${tag}`;
      }
      return tag;
    };

    const findings = [];
    const seen = [];

    /** One measurement, whatever produced the glyphs. */
    const measure = ({ el, cs, text, source, decorative }) => {
      const fg = toRgb(cs.color);
      const backdrop = paintedBackdrop(el);
      const selector = describe(el);

      if (!backdrop) {
        findings.push({
          source,
          selector,
          text: String(text).slice(0, 60),
          problem: "no painted ancestor background — contrast is undefined",
        });
        return;
      }

      const px = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      // WCAG large text: 24px, or 18.66px when bold.
      const isLarge = px >= 24 || (px >= 18.66 && weight >= 700);
      const required = decorative || isLarge ? 3.0 : 4.5;

      const value = ratio(fg, backdrop.rgb);
      const record = {
        source,
        selector,
        text: String(text).slice(0, 60),
        color: cs.color,
        colorSrgb: `rgb(${fg.join(", ")})`,
        backdrop: backdrop.raw,
        fontPx: Number(px.toFixed(1)),
        weight,
        ratio: value,
        required,
        passes: value >= required,
      };
      seen.push(record);
      if (!record.passes) findings.push(record);
    };

    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("[hidden]")) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (isVisuallyHidden(el, rect)) continue;

      const cs = getComputedStyle(el);

      // ── the element's own text ──────────────────────────────────────────
      // Only its own text nodes; otherwise every wrapper is reported for the
      // text of its children.
      const ownText = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent.trim())
        .join(" ")
        .trim();

      if (ownText) {
        measure({
          el,
          cs,
          text: ownText,
          source: "DOM_TEXT",
          // A short glyph hidden from assistive tech is a UI mark, not prose.
          decorative: el.getAttribute("aria-hidden") === "true" && ownText.length <= 2,
        });
      }

      // ── generated text ──────────────────────────────────────────────────
      // Pseudo-element text is invisible to a childNodes walk, which is how
      // `.action-sequence li::before` — the step numbers a visitor reads —
      // went unmeasured while the sweep reported full coverage.
      for (const [which, source] of [
        ["::before", "BEFORE"],
        ["::after", "AFTER"],
      ]) {
        const pseudo = pseudoText(el, which);
        if (!pseudo) continue;
        measure({
          el,
          cs: pseudo.cs,
          text: pseudo.label,
          source,
          // Generated content is never exposed to assistive tech here, so a
          // short mark is decorative; a counter or longer run is read.
          decorative:
            !/counter\(|counters\(/.test(pseudo.label) && pseudo.label.length <= 2,
        });
      }
    }

    const bySource = (s) => seen.filter((r) => r.source === s).length;

    return {
      viewport,
      checked: seen.length,
      domText: bySource("DOM_TEXT"),
      pseudoText: bySource("BEFORE") + bySource("AFTER"),
      findings,
      lowest: seen.length ? Math.min(...seen.map((s) => s.ratio)) : null,
    };
  }, label);
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const all = [];

for (const [label, width, height] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await page
    .waitForFunction(() => document.documentElement.dataset["heroPhase"] === "settled", null, { timeout: 15_000 })
    .catch(() => {});
  all.push(await sweep(page, label));
  await ctx.close();
}

/**
 * Prove the sweep still bites — once per source of text.
 *
 * A checker reporting "0 failures" is indistinguishable from a checker that has
 * quietly stopped looking, which is exactly how the pair audit sat at 18/18
 * while five rules carried text at 2.1:1. Worse, a DOM-text probe passing says
 * nothing about pseudo-element coverage: the sweep walked `childNodes` for a
 * full wave and never saw a single `::before`, and its probe was green
 * throughout.
 *
 * So each source gets its own negative probe. Injection happens in the browser
 * page only — `addStyleTag` — and never touches a repository file, so the
 * checker stays observation-only against source.
 */
async function probe({ label, css, expectSelector, expectSource }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await page.addStyleTag({ content: css });
  const result = await sweep(page, `probe-${label}`);
  await ctx.close();

  const caught = result.findings.filter(
    (f) => String(f.selector).includes(expectSelector) && f.source === expectSource,
  );
  return { caught: caught.length, total: result.findings.length };
}

// Paper-on-paper: unreadable by construction, and not a colour any token uses.
const domProbe = await probe({
  label: "dom",
  css: ".section-lede { color: oklch(92% 0.02 87) !important; }",
  expectSelector: "section-lede",
  expectSource: "DOM_TEXT",
});

// The generated step numbers, painted into the paper they sit on.
const pseudoProbe = await probe({
  label: "pseudo",
  css: ".action-sequence li::before { color: oklch(92% 0.02 87) !important; }",
  expectSelector: "action-sequence",
  expectSource: "BEFORE",
});

await browser.close();

const probesOk = domProbe.caught > 0 && pseudoProbe.caught > 0;
console.log(
  `  DOM probe      ${domProbe.caught > 0 ? "detected" : "NOT DETECTED"} ` +
    `(${domProbe.caught} matching finding(s))`,
);
console.log(
  `  PSEUDO probe   ${pseudoProbe.caught > 0 ? "detected" : "NOT DETECTED"} ` +
    `(${pseudoProbe.caught} matching finding(s))`,
);
if (!probesOk) {
  console.error(
    "\n  GATE BROKEN: an injected unreadable rule was not detected. " +
      "The sweep is no longer measuring what it claims to measure.",
  );
  process.exit(2);
}

const totalFindings = all.reduce((n, r) => n + r.findings.length, 0);
const domTotal = all.reduce((n, r) => n + r.domText, 0);
const pseudoTotal = all.reduce((n, r) => n + r.pseudoText, 0);
const lowest = Math.min(...all.map((r) => r.lowest).filter((v) => typeof v === "number"));

await writeFile(
  resolve(OUT, "text-contrast-sweep.json"),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      method:
        "Every element carrying visible text — its own DOM text nodes and any ::before / ::after " +
        "generated text — measured as painted sRGB against its first painted ancestor background. " +
        "Each measurement records source: DOM_TEXT, BEFORE or AFTER. Pseudo-elements whose content " +
        "is none, normal, an empty string literal or image-only are skipped as decorative rather " +
        "than counted as text. CSS counters are measured without being resolved: the question is " +
        "what colour the glyphs are painted in, not which digits they spell.",
      thresholds:
        "4.5 body text; 3.0 large text (>=24px, or >=18.66px bold) and short aria-hidden or " +
        "generated decorative marks. These are accessibility conformance thresholds.",
      probes: { dom: domProbe, pseudo: pseudoProbe },
      totals: {
        domTextMeasurements: domTotal,
        pseudoTextMeasurements: pseudoTotal,
        totalMeasurements: domTotal + pseudoTotal,
        lowestRatio: lowest,
        failures: totalFindings,
      },
      results: all,
    },
    null,
    2,
  ),
);

for (const r of all) {
  console.log(
    `  ${r.viewport.padEnd(8)} dom=${String(r.domText).padStart(4)} pseudo=${String(r.pseudoText).padStart(3)}` +
      ` total=${String(r.checked).padStart(4)}  lowest=${r.lowest}  failures=${r.findings.length}  ${r.findings.length ? "DEFECT" : "ok"}`,
  );
  for (const f of r.findings.slice(0, 12)) {
    console.log(
      `      ${String(f.ratio ?? "—").padStart(5)} / ${f.required ?? "—"}  ${String(f.source).padEnd(9)} ${String(f.selector).slice(0, 38).padEnd(38)} "${f.text.slice(0, 30)}"`,
    );
  }
}

console.log(
  `\n  DOM text measurements:    ${domTotal}` +
    `\n  pseudo text measurements: ${pseudoTotal}` +
    `\n  total measurements:       ${domTotal + pseudoTotal}` +
    `\n  lowest real text contrast: ${lowest}`,
);
console.log(
  totalFindings
    ? `  real document: ${totalFindings} text contrast defect(s)`
    : "  real document: 0 failures",
);
process.exit(totalFindings ? 1 : 0);

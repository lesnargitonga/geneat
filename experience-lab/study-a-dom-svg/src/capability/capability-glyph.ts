import type { GlyphId } from "./capability-model";

/**
 * Capability marks.
 *
 * Every glyph is assembled from the four primitives the signal system already
 * uses — NODE (a filled point), TRACE (a drawn path), BOUNDARY (an enclosing
 * edge) and GATE (a deliberate gap) — so the register reads as part of the same
 * drawing system rather than as an icon set dropped in beside it.
 *
 * Deliberately absent: shields, magnifiers, brains, bolts, gears, robots,
 * targets, clouds, cylinders and code brackets. None of those describe what the
 * studio does; they describe what stock icon libraries contain.
 *
 * 24×24 box, stroke-based, `currentColor` throughout so a glyph inherits the
 * state colour of the row it sits in.
 */

interface GlyphSpec {
  /** Stroked path data, drawn first. */
  readonly traces: readonly string[];
  /** Filled points, drawn over the traces. */
  readonly nodes: readonly { cx: number; cy: number; r: number }[];
  /** Longhand description, used as the accessible text when a glyph stands alone. */
  readonly reading: string;
}

const GLYPHS: Record<GlyphId, GlyphSpec> = {
  /** BUILD — three separate points resolve into a single trace. */
  "nodes-join": {
    traces: ["M4 6 C 10 6, 12 12, 20 12", "M4 12 H 12", "M4 18 C 10 18, 12 12, 20 12"],
    nodes: [
      { cx: 4, cy: 6, r: 1.6 },
      { cx: 4, cy: 12, r: 1.6 },
      { cx: 4, cy: 18, r: 1.6 },
      { cx: 20, cy: 12, r: 2.4 },
    ],
    reading: "Three separate points resolving into one path",
  },

  /** OPERATE — a trace held steady, marked at regular intervals. */
  "trace-sustained": {
    traces: ["M3 12 H 21", "M7 8.5 V 15.5", "M12 8.5 V 15.5", "M17 8.5 V 15.5"],
    nodes: [{ cx: 21, cy: 12, r: 1.8 }],
    reading: "A path held steady across repeated marks",
  },

  /** PROTECT — a boundary closed around the node it contains. */
  "boundary-closed": {
    traces: ["M7 4 H 4 V 20 H 7", "M17 4 H 20 V 20 H 17", "M12 7 V 17"],
    nodes: [{ cx: 12, cy: 12, r: 2.6 }],
    reading: "A boundary closed around what it contains",
  },

  /** INTELLIGENCE — a trace branches, is weighed, and reconverges. */
  "trace-inferred": {
    traces: ["M3 12 H 8", "M8 12 C 11 12, 11 6, 14 6", "M8 12 C 11 12, 11 18, 14 18", "M14 6 C 17 6, 18 12, 21 12", "M14 18 C 17 18, 18 12, 21 12"],
    nodes: [
      { cx: 8, cy: 12, r: 1.5 },
      { cx: 14, cy: 6, r: 1.5 },
      { cx: 14, cy: 18, r: 1.5 },
      { cx: 21, cy: 12, r: 2.2 },
    ],
    reading: "A path branching, weighed, then converging again",
  },

  /** PROVE — a node and the residual trace proving it passed. */
  "node-witnessed": {
    traces: ["M3 12 H 9", "M15 12 H 21", "M12 5 V 8", "M12 16 V 19"],
    nodes: [
      { cx: 12, cy: 12, r: 3 },
      { cx: 12, cy: 12, r: 1 },
    ],
    reading: "A point with the trace it left behind on every side",
  },

  /** PHYSICAL — a trace crossing a gate into open space. */
  "gate-crossed": {
    traces: ["M3 12 H 10", "M13 4 V 9", "M13 15 V 20", "M14 12 H 21", "M18 9 L 21 12 L 18 15"],
    nodes: [{ cx: 3, cy: 12, r: 1.6 }],
    reading: "A path crossing a gate into open space",
  },
};

/**
 * Renders a glyph as inline SVG markup.
 *
 * `aria-hidden` by default: in the register each glyph sits beside its own
 * visible label, so announcing it again would be noise. Pass `labelled` when a
 * glyph appears without adjacent text.
 */
export function glyphMarkup(id: GlyphId, options: { labelled?: boolean } = {}): string {
  const spec = GLYPHS[id];
  const traces = spec.traces
    .map((d) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />`)
    .join("");
  const nodes = spec.nodes.map((n) => `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="currentColor" />`).join("");
  const a11y = options.labelled
    ? `role="img" aria-label="${spec.reading}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg class="cap-glyph" data-glyph="${id}" viewBox="0 0 24 24" ${a11y}>${traces}${nodes}</svg>`;
}

export function glyphReading(id: GlyphId): string {
  return GLYPHS[id].reading;
}

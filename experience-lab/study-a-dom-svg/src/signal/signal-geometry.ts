import type { Point, SignalGeometry, SignalNode } from "./signal-types";

/**
 * Signal geometry, generated rather than hand-drawn.
 *
 * §7.20 rejects Study A outright if "the SVG becomes an unmaintainable
 * illustration with hundreds of hand-coded coordinates". So the path is not
 * authored: eight waypoints are declared, and the curve through them is
 * computed. Changing the shape means moving a point, not rewriting a `d`
 * attribute by hand.
 *
 * Two geometries exist. They differ in layout only — identical state count,
 * identical node ids, identical segment ids, identical narrative order. The
 * meaning and the accessible text are the same in both; only the drawing
 * changes.
 */

/** Segment ids, in order. `SEGMENT_IDS[i]` joins waypoint i to waypoint i+1. */
export const SEGMENT_IDS: readonly string[] = [
  "seg-1",
  "seg-2",
  "seg-3",
  "seg-4",
  "seg-5",
  "seg-6",
  "seg-7",
];

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Catmull-Rom through the waypoints, converted to a cubic Bézier.
 *
 * Chosen because it passes *through* every control point — the waypoints are
 * the states, so the path must actually touch them. A plain smoothing spline
 * would place the signal head slightly off its own state.
 */
function segmentPath(points: readonly Point[], index: number): string {
  const p1 = points[index];
  const p2 = points[index + 1];
  if (!p1 || !p2) throw new Error(`segment ${index} is out of range`);

  const p0 = points[index - 1] ?? p1;
  const p3 = points[index + 2] ?? p2;

  // Tension 1/6 is the standard Catmull-Rom → Bézier conversion factor.
  const t = 1 / 6;
  const c1: Point = { x: p1.x + (p2.x - p0.x) * t, y: p1.y + (p2.y - p0.y) * t };
  const c2: Point = { x: p2.x - (p3.x - p1.x) * t, y: p2.y - (p3.y - p1.y) * t };

  return (
    `M ${round(p1.x)} ${round(p1.y)} ` +
    `C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ` +
    `${round(p2.x)} ${round(p2.y)}`
  );
}

/** The whole route as one path — used by the dormant and residual layers. */
export function fullPath(points: readonly Point[]): string {
  let d = "";
  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = segmentPath(points, i);
    d += i === 0 ? segment : ` ${segment.slice(segment.indexOf("C"))}`;
  }
  return d;
}

export function segmentPaths(points: readonly Point[]): Map<string, string> {
  const paths = new Map<string, string>();
  // Ids are derived from position rather than read from the fixed canonical
  // list, so a grammar with more or fewer than eight steps still gets a
  // complete set of segments.
  for (let i = 0; i < points.length - 1; i += 1) {
    paths.set(`seg-${i + 1}`, segmentPath(points, i));
  }
  return paths;
}

// ------------------------------------------------------------- horizontal

const HORIZONTAL_WAYPOINTS: readonly Point[] = [
  { x: 52, y: 322 }, // idea
  { x: 190, y: 300 }, // observe
  { x: 300, y: 240 }, // model
  { x: 410, y: 205 }, // engineer
  { x: 520, y: 200 }, // protect
  { x: 640, y: 214 }, // human review
  { x: 760, y: 250 }, // act
  { x: 838, y: 268 }, // prove
];

const HORIZONTAL_NODES: readonly SignalNode[] = [
  { id: "ev-1", layer: "evidence-nodes", x: 150, y: 392, anchor: { x: 178, y: 306 } },
  { id: "ev-2", layer: "evidence-nodes", x: 214, y: 118, anchor: { x: 246, y: 274 } },
  { id: "ev-3", layer: "evidence-nodes", x: 332, y: 386, anchor: { x: 348, y: 232 } },
  { id: "ev-4", layer: "evidence-nodes", x: 386, y: 104, anchor: { x: 404, y: 207 } },
  { id: "bd-1", layer: "boundary-nodes", x: 452, y: 86, extent: 288 },
  { id: "bd-2", layer: "boundary-nodes", x: 586, y: 112, extent: 236 },
  { id: "gate", layer: "human-gate", x: 640, y: 214, extent: 62 },
  { id: "act", layer: "action-node", x: 760, y: 250, extent: 14 },
];

export const HORIZONTAL_GEOMETRY: SignalGeometry = {
  id: "horizontal",
  viewBox: "0 0 880 460",
  waypoints: HORIZONTAL_WAYPOINTS,
  nodes: HORIZONTAL_NODES,
  segments: SEGMENT_IDS,
};

// --------------------------------------------------------------- vertical

/**
 * Mobile geometry. The same eight states read top to bottom, because a
 * 393px-wide horizontal route compresses the interesting parts — the
 * boundaries and the gate — into a few pixels each.
 */
const VERTICAL_WAYPOINTS: readonly Point[] = [
  { x: 64, y: 44 }, // idea
  { x: 112, y: 132 }, // observe
  { x: 152, y: 228 }, // model
  { x: 180, y: 326 }, // engineer
  { x: 186, y: 424 }, // protect
  { x: 162, y: 524 }, // human review
  { x: 122, y: 620 }, // act
  { x: 96, y: 692 }, // prove
];

const VERTICAL_NODES: readonly SignalNode[] = [
  { id: "ev-1", layer: "evidence-nodes", x: 292, y: 104, anchor: { x: 128, y: 148 } },
  { id: "ev-2", layer: "evidence-nodes", x: 42, y: 196, anchor: { x: 144, y: 210 } },
  { id: "ev-3", layer: "evidence-nodes", x: 300, y: 296, anchor: { x: 172, y: 306 } },
  { id: "ev-4", layer: "evidence-nodes", x: 46, y: 372, anchor: { x: 182, y: 372 } },
  { id: "bd-1", layer: "boundary-nodes", x: 56, y: 400, extent: 250 },
  { id: "bd-2", layer: "boundary-nodes", x: 70, y: 478, extent: 210 },
  { id: "gate", layer: "human-gate", x: 162, y: 524, extent: 58 },
  { id: "act", layer: "action-node", x: 122, y: 620, extent: 14 },
];

export const VERTICAL_GEOMETRY: SignalGeometry = {
  id: "vertical",
  viewBox: "0 0 360 736",
  waypoints: VERTICAL_WAYPOINTS,
  nodes: VERTICAL_NODES,
  segments: SEGMENT_IDS,
};

/**
 * Builds a geometry for an arbitrary step count.
 *
 * Needed because project grammars have different lengths — six steps for
 * conversational commerce, seven for controlled execution, eight for regulated
 * care. If geometry only existed for eight waypoints, the signal system would
 * be structurally hard-wired to the canonical sequence, which is exactly the
 * assumption §25.1 warns against.
 *
 * The curve is the same generated Catmull-Rom used by the authored geometries;
 * only the waypoint count changes.
 */
export function createSequenceGeometry(
  id: "horizontal" | "vertical",
  stepCount: number,
  options: { width?: number; height?: number; stepMarkers?: boolean } = {},
): SignalGeometry {
  if (stepCount < 2) throw new Error(`geometry needs at least 2 steps, got ${stepCount}`);

  const width = options.width ?? 880;
  const height = options.height ?? 240;
  const marginX = 48;
  const usable = width - marginX * 2;

  const waypoints: Point[] = Array.from({ length: stepCount }, (_, index) => {
    const t = index / (stepCount - 1);
    // A shallow arc: high enough to read as a path, flat enough that a long
    // grammar does not run off the top of a short viewBox.
    const arc = Math.sin(t * Math.PI) * (height * 0.22);
    return { x: round(marginX + usable * t), y: round(height * 0.62 - arc) };
  });

  const segments = Array.from({ length: stepCount - 1 }, (_, i) => `seg-${i + 1}`);

  /**
   * One marker per waypoint.
   *
   * Without these the generated route is a bare curve — legible as a line, but
   * not as a *route with stages*. The markers are what let a reader see six
   * operational steps rather than one arc.
   */
  const nodes: SignalNode[] = options.stepMarkers
    ? waypoints.map((point, index) => ({
        id: `step-${index}`,
        layer: "evidence-nodes" as const,
        x: point.x,
        y: point.y,
      }))
    : [];

  return {
    id,
    viewBox: `0 0 ${width} ${height}`,
    waypoints,
    nodes,
    segments,
  };
}

/** Below this width the vertical geometry is used. */
export const VERTICAL_BREAKPOINT_PX = 720;

export function geometryForViewport(width: number): SignalGeometry {
  return width < VERTICAL_BREAKPOINT_PX ? VERTICAL_GEOMETRY : HORIZONTAL_GEOMETRY;
}

/**
 * Boundary nodes are drawn perpendicular to the flow, so the two geometries
 * orient them differently: vertical bars across a horizontal route, horizontal
 * bars across a vertical one.
 */
export function boundaryIsVerticalBar(geometry: SignalGeometry): boolean {
  return geometry.id === "horizontal";
}

import {
  SEGMENT_IDS,
  boundaryIsVerticalBar,
  fullPath,
  geometryForViewport,
  segmentPaths,
} from "./signal-geometry";
import { applyMotionBudget } from "./signal-motion";
import { SIGNAL_LAYER_IDS } from "./signal-types";
import type { SignalGeometry, SignalLayerId, SignalState } from "./signal-types";
import type { ResolvedMotion } from "../state/experience-state";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Renders signal state into the SVG.
 *
 * The view owns no state of its own. It is given a `SignalState` and makes the
 * DOM match it — so the same state always produces the same picture, which is
 * the "no random nondeterministic behaviour" pass condition in §7.18.
 *
 * Geometry is rebuilt only on breakpoint change, never per state. The viewBox
 * is written once per geometry, so stepping through all eight states never
 * moves the frame.
 */
export class SignalView {
  readonly #svg: SVGSVGElement;
  readonly #layers = new Map<SignalLayerId, SVGGElement>();
  readonly #segments = new Map<string, SVGPathElement>();
  readonly #nodes = new Map<string, SVGGElement>();
  #head: SVGGElement | null = null;
  #dormant: SVGPathElement | null = null;
  #residual: SVGPathElement | null = null;
  #geometry: SignalGeometry;
  #motion: ResolvedMotion = "full";

  constructor(svg: SVGSVGElement, viewportWidth: number) {
    this.#svg = svg;
    this.#geometry = geometryForViewport(viewportWidth);
    this.#build();
  }

  get geometryId(): string {
    return this.#geometry.id;
  }

  get svg(): SVGSVGElement {
    return this.#svg;
  }

  // ------------------------------------------------------------------ build

  /**
   * Constructs the layer tree from geometry data.
   *
   * The static SVG in `index.html` is replaced wholesale here rather than
   * patched. That keeps one source of truth for the shape — the geometry
   * module — instead of markup and code both claiming to know where a node
   * sits. The static markup exists so the no-JavaScript view has something to
   * show, not as a second definition.
   */
  #build(): void {
    const geometry = this.#geometry;
    this.#svg.setAttribute("viewBox", geometry.viewBox);
    this.#svg.dataset["geometry"] = geometry.id;
    this.#svg.replaceChildren();
    this.#layers.clear();
    this.#segments.clear();
    this.#nodes.clear();

    for (const id of SIGNAL_LAYER_IDS) {
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("id", `signal-layer-${id}`);
      group.dataset["layer"] = id;
      group.dataset["active"] = "false";
      this.#svg.append(group);
      this.#layers.set(id, group);
    }

    const points = geometry.waypoints;

    // Dormant path — possible structure, not the answer (7.6).
    this.#dormant = document.createElementNS(SVG_NS, "path");
    this.#dormant.setAttribute("d", fullPath(points));
    this.#dormant.setAttribute("fill", "none");
    this.#dormant.dataset["role"] = "dormant";
    this.#layers.get("dormant-path")?.append(this.#dormant);

    // Residual trace — what remains after the signal has passed.
    this.#residual = document.createElementNS(SVG_NS, "path");
    this.#residual.setAttribute("d", fullPath(points));
    this.#residual.setAttribute("fill", "none");
    this.#residual.dataset["role"] = "residual";
    this.#layers.get("residual-trace")?.append(this.#residual);

    // Active path, one element per segment so reveal is per-segment and
    // deterministic — no path-length arithmetic, no dash-offset guessing.
    const active = this.#layers.get("active-path");
    const paths = segmentPaths(points);
    for (const id of SEGMENT_IDS) {
      const d = paths.get(id);
      if (!d) continue;
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("id", `signal-${id}`);
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.dataset["segment"] = id;
      path.dataset["state"] = "hidden";
      active?.append(path);
      this.#segments.set(id, path);
    }

    for (const node of geometry.nodes) {
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("id", `signal-node-${node.id}`);
      group.dataset["node"] = node.id;
      group.dataset["active"] = "false";

      if (node.layer === "evidence-nodes") {
        if (node.anchor) {
          const connector = document.createElementNS(SVG_NS, "path");
          connector.setAttribute(
            "d",
            `M ${node.x} ${node.y} L ${node.anchor.x} ${node.anchor.y}`,
          );
          connector.setAttribute("fill", "none");
          connector.dataset["role"] = "connector";
          group.append(connector);
        }
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", String(node.x));
        dot.setAttribute("cy", String(node.y));
        dot.setAttribute("r", "5");
        group.append(dot);
      } else if (node.layer === "boundary-nodes") {
        const bar = document.createElementNS(SVG_NS, "rect");
        const thickness = 4;
        const extent = node.extent ?? 200;
        if (boundaryIsVerticalBar(geometry)) {
          bar.setAttribute("x", String(node.x));
          bar.setAttribute("y", String(node.y));
          bar.setAttribute("width", String(thickness));
          bar.setAttribute("height", String(extent));
        } else {
          bar.setAttribute("x", String(node.x));
          bar.setAttribute("y", String(node.y));
          bar.setAttribute("width", String(extent));
          bar.setAttribute("height", String(thickness));
        }
        bar.setAttribute("rx", "2");
        group.append(bar);
      } else if (node.layer === "human-gate") {
        const extent = node.extent ?? 60;
        const half = extent / 2;
        const bracketA = document.createElementNS(SVG_NS, "path");
        const bracketB = document.createElementNS(SVG_NS, "path");
        if (boundaryIsVerticalBar(geometry)) {
          bracketA.setAttribute("d", `M ${node.x - 18} ${node.y - half} L ${node.x - 36} ${node.y - half} L ${node.x - 36} ${node.y - half - 34}`);
          bracketB.setAttribute("d", `M ${node.x - 18} ${node.y + half} L ${node.x - 36} ${node.y + half} L ${node.x - 36} ${node.y + half + 34}`);
        } else {
          bracketA.setAttribute("d", `M ${node.x - half} ${node.y - 18} L ${node.x - half} ${node.y - 36} L ${node.x - half - 34} ${node.y - 36}`);
          bracketB.setAttribute("d", `M ${node.x + half} ${node.y - 18} L ${node.x + half} ${node.y - 36} L ${node.x + half + 34} ${node.y - 36}`);
        }
        bracketA.setAttribute("fill", "none");
        bracketB.setAttribute("fill", "none");
        const ring = document.createElementNS(SVG_NS, "circle");
        ring.setAttribute("cx", String(node.x));
        ring.setAttribute("cy", String(node.y));
        ring.setAttribute("r", "11");
        ring.setAttribute("fill", "none");
        group.append(bracketA, bracketB, ring);
      } else {
        const disc = document.createElementNS(SVG_NS, "circle");
        disc.setAttribute("cx", String(node.x));
        disc.setAttribute("cy", String(node.y));
        disc.setAttribute("r", String(node.extent ?? 14));
        group.append(disc);
      }

      this.#layers.get(node.layer)?.append(group);
      this.#nodes.set(node.id, group);
    }

    // Signal head, translated to a waypoint. A wrapping <g> at the origin is
    // used so the transform is a plain translate — animating cx/cy directly is
    // less consistently transitionable across engines.
    const head = document.createElementNS(SVG_NS, "g");
    head.setAttribute("id", "signal-head-marker");
    const halo = document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("r", "13");
    halo.dataset["role"] = "halo";
    const core = document.createElementNS(SVG_NS, "circle");
    core.setAttribute("r", "7");
    core.dataset["role"] = "core";
    head.append(halo, core);
    this.#layers.get("signal-head")?.append(head);
    this.#head = head;
  }

  /** Rebuilds for a new breakpoint. Ids and meaning are preserved. */
  setViewportWidth(width: number, state: SignalState): void {
    const next = geometryForViewport(width);
    if (next.id === this.#geometry.id) return;
    this.#geometry = next;
    this.#build();
    this.applyMotion(this.#motion);
    this.render(state, { animate: false });
  }

  applyMotion(motion: ResolvedMotion): void {
    this.#motion = motion;
    applyMotionBudget(this.#svg, motion);
  }

  // ----------------------------------------------------------------- render

  render(state: SignalState, options: { animate?: boolean } = {}): void {
    // Reduced motion never travels the head along a segment, regardless of
    // what the caller asks for. The budget is a ceiling, not the mechanism.
    const animate = options.animate !== false && this.#motion !== "reduced";

    this.#svg.dataset["state"] = state.id;
    this.#svg.dataset["emphasis"] = state.emphasis;
    this.#svg.dataset["animate"] = animate ? "true" : "false";

    const activeLayers = new Set<string>(state.activeLayers);
    for (const [id, group] of this.#layers) {
      group.dataset["active"] = activeLayers.has(id) ? "true" : "false";
    }

    const completed = new Set(state.completedSegments);
    for (const [id, path] of this.#segments) {
      const isCurrent = state.currentSegment === id;
      path.dataset["state"] = completed.has(id) ? "complete" : isCurrent ? "current" : "hidden";
    }

    const activeNodes = new Set(state.activeNodes);
    for (const [id, group] of this.#nodes) {
      group.dataset["active"] = activeNodes.has(id) ? "true" : "false";
    }

    // The gate holds while the signal is under review and passes afterwards.
    // This is what makes the pause visible rather than merely described.
    const gate = this.#nodes.get("gate");
    if (gate) {
      gate.dataset["gate"] =
        state.id === "human-review" ? "holding" : state.index > 5 ? "passed" : "idle";
    }

    const action = this.#nodes.get("act");
    if (action) {
      action.dataset["action"] =
        state.id === "act" ? "firing" : state.id === "prove" ? "recorded" : "idle";
    }

    this.#positionHead(state);
  }

  #positionHead(state: SignalState): void {
    const head = this.#head;
    if (!head) return;

    const waypoint = this.#geometry.waypoints[state.index];
    if (!waypoint) return;

    head.style.transform = `translate(${waypoint.x}px, ${waypoint.y}px)`;
    head.dataset["dormant"] = state.id === "idea" ? "true" : "false";
  }

  // ------------------------------------------------------------ test access

  hasLayer(id: SignalLayerId): boolean {
    return this.#layers.has(id);
  }

  hasNode(id: string): boolean {
    return this.#nodes.has(id);
  }

  hasSegment(id: string): boolean {
    return this.#segments.has(id);
  }

  dispose(): void {
    this.#layers.clear();
    this.#segments.clear();
    this.#nodes.clear();
    this.#head = null;
    this.#dormant = null;
    this.#residual = null;
  }
}

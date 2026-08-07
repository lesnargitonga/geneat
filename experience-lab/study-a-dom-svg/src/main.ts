import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/signal.css";
import "./styles/stepper.css";
import "./styles/scenes.css";
import "./styles/controls.css";
import "./styles/accessibility.css";

import { ExperienceStore } from "./state/experience-state";
import { MotionPreference } from "./state/motion-preference";
import { ChapterController } from "./navigation/chapter-controller";
import { AnchorFocus } from "./navigation/anchor-focus";
import { reportContentIntegrity } from "./accessibility/content-integrity";
import { SignalController } from "./signal/signal-controller";
import { SignalView } from "./signal/signal-view";
import { SignalStepper } from "./signal/signal-stepper";
import { SignalAccessibility } from "./signal/signal-accessibility";
import { isSignalStateId, SIGNAL_STATES } from "./signal/signal-states";
import { VERTICAL_BREAKPOINT_PX } from "./signal/signal-geometry";
import type { SignalStateId } from "./signal/signal-types";

/**
 * Boot for Study A.
 *
 * Everything below is progressive enhancement over a page that is already
 * complete. If this file never runs — script blocked, parse error, JavaScript
 * disabled — the visitor still gets the headline, both calls to action, the
 * Gen-Eat proof, all six system stages, the seven-step action sequence, the
 * static signal composition and working chapter navigation.
 *
 * Wave A/B adds exactly three things on top: current-chapter state on the
 * rail, focus correction for in-page anchors, and the Effects preference.
 * No animation is started here, because none exists yet.
 */

function shouldReportDiagnostics(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).get("diagnostics") === "1";
  } catch {
    return false;
  }
}

/**
 * Wires the signal state system.
 *
 * Returns null when the signal markup is absent, so a page that does not carry
 * a stage is not a boot failure. Everything the signal needs is queried once,
 * here — no module below reaches into the document on its own.
 */
function mountSignal(): SignalSystem | null {
  const svg = document.querySelector<SVGSVGElement>("svg[data-signal]");
  const stepperRoot = document.querySelector<HTMLElement>("[data-signal-stepper]");
  const textPanel = document.querySelector<HTMLElement>("[data-signal-text]");
  const liveRegion = document.querySelector<HTMLElement>("[data-signal-live]");

  if (!svg || !stepperRoot || !textPanel || !liveRegion) return null;

  const controller = new SignalController();
  const view = new SignalView(svg, window.innerWidth);
  const stepper = new SignalStepper({ root: stepperRoot, controller });
  const text = new SignalAccessibility({ panel: textPanel, liveRegion });

  controller.subscribe((change) => {
    view.render(change.state, { animate: !change.noop });
    stepper.sync(change.state);
    // A no-op request must not announce. Re-selecting the current state is a
    // deliberate no-change, and announcing it would make the live region chatter.
    text.render(change.state, { announce: !change.noop });
  });

  stepper.mount();

  // Initial paint goes through the same path as every transition, with
  // animation and announcement suppressed.
  const initial = readInitialState();
  controller.goToNow(initial);
  view.render(controller.current, { animate: false });
  text.render(controller.current, { announce: false });

  // Breakpoint changes swap geometry. State, ids and text are untouched.
  const media = window.matchMedia(`(max-width: ${VERTICAL_BREAKPOINT_PX - 1}px)`);
  const onBreakpoint = (): void => view.setViewportWidth(window.innerWidth, controller.current);
  media.addEventListener("change", onBreakpoint);

  return { controller, view, stepper, text, media, onBreakpoint };
}

/**
 * Allows a state to be selected by URL, e.g. `?signal=human-review`.
 * Used by the evidence capture script so screenshots are deterministic rather
 * than the product of simulated clicking.
 */
function readInitialState(): SignalStateId {
  try {
    const requested = new URLSearchParams(window.location.search).get("signal");
    if (isSignalStateId(requested)) return requested;
  } catch {
    // Malformed URL is not a boot failure.
  }
  const first = SIGNAL_STATES[0];
  if (!first) throw new Error("signal states are empty");
  return first.id;
}

interface SignalSystem {
  readonly controller: SignalController;
  readonly view: SignalView;
  readonly stepper: SignalStepper;
  readonly text: SignalAccessibility;
  readonly media: MediaQueryList;
  readonly onBreakpoint: () => void;
}

function boot(): void {
  document.documentElement.dataset["js"] = "true";

  const store = new ExperienceStore();
  const signal = mountSignal();

  const motion = new MotionPreference({
    onChange: (motionMode, resolvedMotion) => {
      store.update({ motionMode, resolvedMotion });
      // Reduced mode is a structural rule in the view — no head travel, no
      // scale pulse — not merely a shorter duration.
      signal?.view.applyMotion(resolvedMotion);
      signal?.view.render(signal.controller.current, { animate: false });
    },
  });
  motion.attach(document);

  const chapters = new ChapterController({
    sections: [...document.querySelectorAll<HTMLElement>("[data-chapter]")],
    links: [...document.querySelectorAll<HTMLAnchorElement>("[data-chapter-link]")],
    onChange: (chapter) => store.update({ chapter }),
  });
  chapters.attach();

  new AnchorFocus(document).attach();

  if (shouldReportDiagnostics()) {
    const issues = reportContentIntegrity(document);
    // Exposed for the qualification suite: state control without simulated
    // clicking, so a failing transition test points at the state machine
    // rather than at a missed button.
    window.__STUDY_A__ = {
      version: 1,
      state: () => ({ ...store.state }),
      integrityIssues: () => issues,
      setEffects: (mode) => motion.set(mode),
      signalState: () => signal?.controller.current.id ?? null,
      signalIndex: () => signal?.controller.index ?? -1,
      goToSignalState: (id) => signal?.controller.goTo(id),
      signalGeometry: () => signal?.view.geometryId ?? null,
      signalStates: () => SIGNAL_STATES.map((state) => state.id),
    };
  }
}

declare global {
  interface Window {
    __STUDY_A__?: {
      version: 1;
      state: () => Record<string, unknown>;
      integrityIssues: () => { kind: string; id: string; detail: string }[];
      setEffects: (mode: "auto" | "full" | "reduced") => void;
      signalState: () => string | null;
      signalIndex: () => number;
      goToSignalState: (id: SignalStateId) => void;
      signalGeometry: () => string | null;
      signalStates: () => string[];
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

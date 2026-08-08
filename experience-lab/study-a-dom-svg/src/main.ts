import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/signal.css";
import "./styles/stepper.css";
import "./styles/flagship.css";
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
import { HeroChoreography, HERO_TOTAL_MS } from "./signal/hero-choreography";
import { PortfolioFixture } from "./portfolio/portfolio-fixture";
import { FlagshipSignal } from "./proof/flagship-signal";
import type { SignalState, SignalStateId } from "./signal/signal-types";

/**
 * Boot for Study A.
 *
 * Everything below is progressive enhancement over a page that is already
 * complete. If this file never runs — script blocked, parse error, JavaScript
 * disabled — the visitor still gets the headline, both calls to action, the
 * Gen-Eat proof, all six system stages, the seven-step action sequence, the
 * static signal composition and working chapter navigation.
 *
 * On top of that it adds: current-chapter state on the rail, focus correction
 * for in-page anchors, the Effects preference, the signal state system, and the
 * hero formation sequence.
 *
 * The formation sequence is the only thing here that moves, it is bounded, and
 * nothing waits for it (§26.3).
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

  const caption = document.querySelector<HTMLElement>("[data-signal-caption]");

  const controller = new SignalController();
  const view = new SignalView(svg, window.innerWidth);
  const stepper = new SignalStepper({ root: stepperRoot, controller });
  const text = new SignalAccessibility({ panel: textPanel, liveRegion });

  /**
   * The authored caption. Written from state data rather than hand-maintained
   * in markup, so it cannot drift from the sequence it names.
   */
  const renderCaption = (state: SignalState): void => {
    if (!caption) return;
    const index = caption.querySelector<HTMLElement>(".signal-caption__index");
    const label = caption.querySelector<HTMLElement>(".signal-caption__label");
    const meta = caption.querySelector<HTMLElement>(".signal-caption__meta");
    if (index) index.textContent = String(state.index).padStart(2, "0");
    if (label) label.textContent = state.label;
    if (meta) meta.textContent = `Lesnar Signal · state ${state.index + 1} of 8`;
    caption.dataset["state"] = state.id;
  };

  controller.subscribe((change) => {
    view.render(change.state, { animate: !change.noop });
    stepper.sync(change.state);
    renderCaption(change.state);
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
  renderCaption(controller.current);

  const hero = new HeroChoreography({ controller });

  // Breakpoint changes swap geometry. State, ids and text are untouched.
  const media = window.matchMedia(`(max-width: ${VERTICAL_BREAKPOINT_PX - 1}px)`);
  const onBreakpoint = (): void => view.setViewportWidth(window.innerWidth, controller.current);
  media.addEventListener("change", onBreakpoint);

  return { controller, view, stepper, text, hero, media, onBreakpoint };
}

/** True when a specific state was requested by URL, e.g. `?signal=act`. */
function hasPinnedState(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("signal");
  } catch {
    return false;
  }
}

/**
 * Allows a state to be selected by URL. Used by the capture scripts so
 * screenshots are of a deterministically requested state rather than the
 * product of simulated clicking.
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
  readonly hero: HeroChoreography;
  readonly media: MediaQueryList;
  readonly onBreakpoint: () => void;
}

function boot(): void {
  document.documentElement.dataset["js"] = "true";

  const store = new ExperienceStore();
  const signal = mountSignal();
  // Late-bound: the flagship is constructed after the motion preference, but the
  // preference's change callback must be able to reach it.
  let flagshipRef: FlagshipSignal | null = null;

  const motion = new MotionPreference({
    onChange: (motionMode, resolvedMotion) => {
      store.update({ motionMode, resolvedMotion });
      // Reduced mode is a structural rule in the view — no head travel, no
      // scale pulse — not merely a shorter duration.
      signal?.view.applyMotion(resolvedMotion);
      signal?.view.render(signal.controller.current, { animate: false });
      flagshipRef?.setMotion(resolvedMotion);
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

  /**
   * The flagship transformation: the same signal engine, driven by the
   * Gen-Eat/Hazina operational grammar. Mounted after the hero so the abstract
   * signal is established first — but it paints its complete route immediately,
   * so nothing about the proof depends on the reveal running.
   */
  const flagshipSvg = document.querySelector<SVGSVGElement>("svg[data-flagship-signal]");
  const flagshipRoute = document.querySelector<HTMLElement>("[data-flagship-route]");
  let flagship: FlagshipSignal | null = null;

  if (flagshipSvg && flagshipRoute) {
    flagship = new FlagshipSignal({
      svg: flagshipSvg,
      stepList: document.querySelector<HTMLElement>("[data-flagship-steps]"),
      caption: document.querySelector<HTMLElement>("[data-flagship-caption]"),
      motion: motion.resolved,
    });
    flagship.mount(flagshipRoute);
    flagshipRef = flagship;
  }

  /**
   * The formation sequence starts *after* every other system is attached, so
   * nothing the visitor can already use is waiting on it. If it never ran, the
   * page would simply stay on `idea` — a coherent still composition, not an
   * empty stage. There is no loader and nothing to fail open from.
   *
   * A URL-pinned state (`?signal=…`) suppresses it: the capture scripts and
   * diagnostics need a specific state to stay put.
   */
  if (signal && !hasPinnedState()) {
    signal.hero.start(motion.resolved);
  }

  if (shouldReportDiagnostics()) {
    const issues = reportContentIntegrity(document);
    // Exposed for the qualification suite: state control without simulated
    // clicking, so a failing transition test points at the state machine
    // rather than at a missed button.
    const labTools = document.querySelector<HTMLElement>("[data-lab-tools]");
    const fixtureRoot = document.querySelector<HTMLElement>("[data-portfolio-fixture]");
    let fixture: PortfolioFixture | null = null;

    if (labTools) labTools.hidden = false;
    if (fixtureRoot) {
      fixture = new PortfolioFixture(fixtureRoot);
      fixture.mount(motion.resolved);
    }

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
      heroPhase: () => signal?.hero.phase ?? null,
      heroElapsedMs: () => signal?.hero.elapsedMs ?? null,
      heroBudgetMs: () => HERO_TOTAL_MS,
      cancelHero: () => signal?.hero.cancel(),
      portfolioGrammars: () => fixture?.describe() ?? [],
      flagshipPhase: () => flagship?.phase ?? null,
      flagshipEngine: () => flagship?.describe() ?? null,
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
      heroPhase: () => string | null;
      heroElapsedMs: () => number | null;
      heroBudgetMs: () => number;
      cancelHero: () => void;
      portfolioGrammars: () => {
        id: string;
        steps: number;
        engine: string;
        viewEngine: string;
      }[];
      flagshipPhase: () => string | null;
      flagshipEngine: () => {
        engine: string;
        viewEngine: string;
        steps: number;
        grammar: string;
      } | null;
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

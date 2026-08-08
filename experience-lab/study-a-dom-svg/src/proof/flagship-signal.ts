import { SignalController } from "../signal/signal-controller";
import { SignalView } from "../signal/signal-view";
import { createSequenceGeometry } from "../signal/signal-geometry";
import { getGrammar } from "../portfolio/project-grammars";
import type { SequenceState } from "../signal/signal-types";
import type { ResolvedMotion } from "../state/experience-state";

/**
 * The hero-to-proof transformation (§28.8).
 *
 * The signal does not fade out and hand over to a card grid. It reorganises
 * into the Gen-Eat / Hazina operational route and the proof artifacts attach to
 * it.
 *
 * Critically this is **the same engine**: `SignalController` and `SignalView`,
 * the classes the hero uses, handed a different state list. There is no second
 * signal engine and no project-specific renderer — the difference between the
 * abstract signal and the flagship route is the array passed to a constructor.
 *
 * The reveal below is a *scheduler*, not a state machine. It asks the
 * controller for one state after another and owns none itself.
 *
 * Deliberately not scroll-linked: entering the viewport once starts a short
 * bounded reveal, and that is all. No pinning, no scrub, no replay. The route
 * is fully legible as a still frame before the reveal runs and after it ends —
 * which is what makes it safe for the composition to not depend on animation.
 */

const STEP_MS = 260;
/** Total for the 6-step Gen-Eat/Hazina grammar: 5 transitions. */
export const FLAGSHIP_REVEAL_MS = STEP_MS * 5;

export type FlagshipPhase = "idle" | "revealing" | "complete";

export interface FlagshipSignalOptions {
  readonly svg: SVGSVGElement;
  readonly stepList: HTMLElement | null;
  readonly caption: HTMLElement | null;
  readonly motion: ResolvedMotion;
  readonly onPhase?: (phase: FlagshipPhase) => void;
}

export class FlagshipSignal {
  readonly #controller: SignalController<SequenceState>;
  readonly #view: SignalView;
  readonly #steps: readonly SequenceState[];
  readonly #stepButtons = new Map<string, HTMLButtonElement>();
  readonly #caption: HTMLElement | null;
  readonly #onPhase: ((phase: FlagshipPhase) => void) | undefined;

  #phase: FlagshipPhase = "idle";
  #timer: number | null = null;
  #index = 0;
  #observer: IntersectionObserver | null = null;
  #motion: ResolvedMotion;

  constructor(options: FlagshipSignalOptions) {
    const grammar = getGrammar("gen-eat-hazina");
    this.#steps = grammar.steps;
    this.#caption = options.caption;
    this.#onPhase = options.onPhase;
    this.#motion = options.motion;

    const geometry = createSequenceGeometry("horizontal", this.#steps.length, {
      width: 880,
      height: 200,
      stepMarkers: true,
    });

    this.#controller = new SignalController<SequenceState>({ states: this.#steps });
    this.#view = new SignalView(options.svg, window.innerWidth, geometry, "flagship");
    this.#view.applyMotion(options.motion);

    this.#controller.subscribe((change) => {
      this.#view.render(change.state, { animate: !change.noop });
      this.#syncSteps(change.state.id);
      if (this.#caption) {
        this.#caption.textContent = `${change.state.label} — ${change.state.explanation}`;
        this.#caption.dataset["step"] = change.state.id;
      }
    });

    if (options.stepList) this.#buildSteps(options.stepList);
  }

  get phase(): FlagshipPhase {
    return this.#phase;
  }

  get stepCount(): number {
    return this.#steps.length;
  }

  /** Test access: proves this uses the shared engine, read through the instance. */
  describe(): { engine: string; viewEngine: string; steps: number; grammar: string } {
    return {
      engine: (this.#controller.constructor as typeof SignalController).engineId,
      viewEngine: (this.#view.constructor as typeof SignalView).engineId,
      steps: this.#steps.length,
      grammar: "gen-eat-hazina",
    };
  }

  #buildSteps(list: HTMLElement): void {
    list.replaceChildren();
    for (const step of this.#steps) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "route-step";
      button.dataset["routeStep"] = step.id;
      button.textContent = step.label;
      button.addEventListener("click", () => {
        this.#stop();
        this.#phase = "complete";
        this.#controller.goTo(step.id);
      });
      this.#stepButtons.set(step.id, button);
      item.append(button);
      list.append(item);
    }
  }

  #syncSteps(currentId: string): void {
    for (const [id, button] of this.#stepButtons) {
      if (id === currentId) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
  }

  /**
   * Renders the complete route immediately, then arms a one-shot reveal for
   * when the chapter first enters view.
   *
   * The complete state is painted *first* on purpose: if the reveal never runs
   * — reduced motion, no IntersectionObserver, script error — the visitor still
   * sees the whole operational route.
   */
  mount(target: HTMLElement): void {
    const last = this.#steps[this.#steps.length - 1];
    if (last) this.#controller.goToNow(last.id);
    this.#view.render(this.#controller.current, { animate: false });

    if (this.#motion === "reduced") {
      // §28.8: a direct semantic swap into the complete proof composition.
      this.#setPhase("complete");
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      this.#setPhase("complete");
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry?.isIntersecting || this.#phase !== "idle") return;
        this.#observer?.disconnect();
        this.#observer = null;
        this.#startReveal();
      },
      { threshold: 0.25 },
    );
    this.#observer.observe(target);
  }

  #startReveal(): void {
    const first = this.#steps[0];
    if (!first) return;

    this.#setPhase("revealing");
    this.#index = 0;
    this.#controller.goToNow(first.id);

    const advance = (): void => {
      if (this.#phase !== "revealing") return;
      this.#index += 1;
      const next = this.#steps[this.#index];
      if (!next) {
        this.#stop();
        this.#setPhase("complete");
        return;
      }
      this.#controller.goTo(next.id);
      this.#timer = window.setTimeout(advance, STEP_MS);
    };

    this.#timer = window.setTimeout(advance, STEP_MS);
  }

  setMotion(motion: ResolvedMotion): void {
    this.#motion = motion;
    this.#view.applyMotion(motion);
    if (motion === "reduced") {
      this.#stop();
      const last = this.#steps[this.#steps.length - 1];
      if (last) this.#controller.goToNow(last.id);
      this.#setPhase("complete");
    }
  }

  #stop(): void {
    if (this.#timer !== null) {
      window.clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#observer?.disconnect();
    this.#observer = null;
  }

  #setPhase(phase: FlagshipPhase): void {
    if (this.#phase === phase) return;
    this.#phase = phase;
    document.documentElement.dataset["flagshipPhase"] = phase;
    this.#onPhase?.(phase);
  }

  dispose(): void {
    this.#stop();
    this.#controller.dispose();
    this.#view.dispose();
    this.#stepButtons.clear();
  }
}

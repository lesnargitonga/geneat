import type { SignalController } from "./signal-controller";
import type { ResolvedMotion } from "../state/experience-state";
import type { SignalStateId } from "./signal-types";

/**
 * The hero formation sequence.
 *
 * This is **not** a state machine. It is a scheduler that asks the existing
 * `SignalController` for one state after another — §26.2 forbids a second
 * hero-only machine, and the whole value of Wave C was that the states are
 * already deterministic. Everything here is timing.
 *
 * Narrative (§26.2):
 *   unresolved ambition → evidence appears → structure forms →
 *   confidence increases → boundaries appear → human gate is respected →
 *   action becomes possible → proof remains
 *
 * Three properties matter more than the animation itself:
 *
 *   1. **Nothing waits for it.** The headline and CTA are in the served HTML
 *      and are usable before this module is even parsed. There is no loader,
 *      and there is no blank frame — the hero starts on `idea`, which is a
 *      coherent still composition, not an empty stage.
 *   2. **It yields.** Any sign that the visitor has taken over — scrolling,
 *      touching, a key, the stepper — cancels the remaining schedule and
 *      leaves the signal wherever it is. It never fights the user for control.
 *   3. **It ends.** No ambient loop after settle (§26.3). Once `prove` is
 *      reached the timers are gone and the page is completely still.
 */

/**
 * Dwell before advancing to the next state, in ms.
 *
 * Total is the sum of the first seven: 340×5 + 420 + 620 = 2740 ms, inside the
 * 2.2–3.2 s window. `human-review` is the longest deliberately — the gate is
 * the one moment the sequence is *supposed* to feel held rather than paced.
 * `prove` has no successor, so its value is unused and recorded as 0.
 */
const DWELL_MS: Readonly<Record<SignalStateId, number>> = {
  idea: 340,
  observe: 340,
  model: 340,
  engineer: 340,
  protect: 420,
  "human-review": 620,
  act: 340,
  prove: 0,
};

export const HERO_SEQUENCE: readonly SignalStateId[] = [
  "idea",
  "observe",
  "model",
  "engineer",
  "protect",
  "human-review",
  "act",
  "prove",
];

/** Total scheduled duration, excluding the final state's unused dwell. */
export const HERO_TOTAL_MS = HERO_SEQUENCE.slice(0, -1).reduce(
  (total, id) => total + DWELL_MS[id],
  0,
);

/** Budget from §26.3. Asserted in the Wave D tests. */
export const HERO_TIMING_LIMITS = { minMs: 2200, maxMs: 3200 } as const;

export type HeroPhase = "idle" | "playing" | "settled" | "cancelled";

export interface HeroChoreographyOptions {
  readonly controller: SignalController;
  /** Called on every phase change, for the diagnostics bridge and tests. */
  readonly onPhase?: (phase: HeroPhase) => void;
  readonly setTimeoutFn?: (callback: () => void, ms: number) => number;
  readonly clearTimeoutFn?: (handle: number) => void;
}

export class HeroChoreography {
  readonly #controller: SignalController;
  readonly #onPhase: ((phase: HeroPhase) => void) | undefined;
  readonly #setTimeout: (callback: () => void, ms: number) => number;
  readonly #clearTimeout: (handle: number) => void;

  #timer: number | null = null;
  #step = 0;
  #phase: HeroPhase = "idle";
  #startedAt = 0;
  #settledAt = 0;
  #detach: (() => void) | null = null;

  constructor(options: HeroChoreographyOptions) {
    this.#controller = options.controller;
    this.#onPhase = options.onPhase;
    this.#setTimeout =
      options.setTimeoutFn ?? ((callback, ms) => window.setTimeout(callback, ms));
    this.#clearTimeout = options.clearTimeoutFn ?? ((handle) => window.clearTimeout(handle));
  }

  get phase(): HeroPhase {
    return this.#phase;
  }

  /** ms from start to settle, or null if it has not settled. */
  get elapsedMs(): number | null {
    return this.#settledAt > 0 ? this.#settledAt - this.#startedAt : null;
  }

  /**
   * Starts the sequence.
   *
   * Under reduced motion it does not run at all: the signal is placed directly
   * on the final state and the phase goes straight to `settled`. Reduced motion
   * asks for no movement, and a faster version of a movement is still a
   * movement (§26.3). Nothing is lost — `prove` is the most complete state, so
   * the reduced view is the *whole* story rather than an abbreviated one.
   */
  start(motion: ResolvedMotion): void {
    if (this.#phase !== "idle") return;

    if (motion === "reduced") {
      this.#controller.goToNow("prove");
      this.#startedAt = this.#now();
      this.#settledAt = this.#startedAt;
      this.#setPhase("settled");
      return;
    }

    this.#startedAt = this.#now();
    this.#step = 0;
    this.#setPhase("playing");
    this.#watchForTakeover();
    this.#scheduleNext();
  }

  #scheduleNext(): void {
    const currentId = HERO_SEQUENCE[this.#step];
    if (!currentId) return;

    if (this.#step >= HERO_SEQUENCE.length - 1) {
      this.#settle();
      return;
    }

    this.#timer = this.#setTimeout(() => {
      this.#timer = null;
      if (this.#phase !== "playing") return;

      this.#step += 1;
      const nextId = HERO_SEQUENCE[this.#step];
      if (nextId) this.#controller.goTo(nextId);
      this.#scheduleNext();
    }, DWELL_MS[currentId]);
  }

  #settle(): void {
    this.#settledAt = this.#now();
    this.#stopTimers();
    this.#setPhase("settled");
  }

  /**
   * Cancels the remaining sequence, leaving the signal where it is.
   *
   * Deliberately does *not* jump to the final state. If someone has started
   * driving the stepper, snapping the composition to `prove` underneath them
   * would be the animation overriding the person.
   */
  cancel(): void {
    if (this.#phase !== "playing") return;
    this.#stopTimers();
    this.#setPhase("cancelled");
  }

  /**
   * Any sign of intent hands control over.
   *
   * All listeners are passive — this must never delay or block a scroll, and
   * §26.3 forbids blocking scrolling outright.
   */
  #watchForTakeover(): void {
    const events: (keyof WindowEventMap)[] = ["wheel", "touchstart", "keydown", "pointerdown"];
    const onIntent = (): void => this.cancel();

    for (const type of events) {
      window.addEventListener(type, onIntent, { passive: true, once: true });
    }

    // Scroll is watched separately: a page restored mid-scroll fires it
    // immediately, so a threshold avoids cancelling on a restored position.
    const startY = window.scrollY;
    const onScroll = (): void => {
      if (Math.abs(window.scrollY - startY) > 24) this.cancel();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    this.#detach = () => {
      for (const type of events) window.removeEventListener(type, onIntent);
      window.removeEventListener("scroll", onScroll);
    };
  }

  #stopTimers(): void {
    if (this.#timer !== null) {
      this.#clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#detach?.();
    this.#detach = null;
  }

  #setPhase(phase: HeroPhase): void {
    if (this.#phase === phase) return;
    this.#phase = phase;
    document.documentElement.dataset["heroPhase"] = phase;
    this.#onPhase?.(phase);
  }

  #now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  dispose(): void {
    this.#stopTimers();
    this.#phase = "idle";
  }
}

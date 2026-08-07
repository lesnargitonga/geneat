import { SIGNAL_STATES, getSignalState, isSignalStateId } from "./signal-states";
import type { SignalState, SignalStateId } from "./signal-types";

/**
 * The signal state machine.
 *
 * Deliberately independent of scroll (§7.18 Wave C: "implement state changes
 * independent of scroll"). Nothing here observes scroll position, and there is
 * no timeline — a state is entered because something asked for it, which is
 * what makes the system deterministic and testable.
 *
 * Rapid selection coalesces. Clicking Idea → Prove → Act in the same frame
 * applies exactly one transition, to Act. Without this, each click would start
 * its own transition and the composition would visibly chase the input; the
 * requirement is that it settles on the *final requested* state, not that it
 * replays the ones in between.
 */

export type Direction = "forward" | "backward" | "none";

export interface SignalChange {
  readonly state: SignalState;
  readonly previous: SignalState;
  readonly direction: Direction;
  /** True when the request did not change the state (same-state no-op). */
  readonly noop: boolean;
}

export type SignalListener = (change: SignalChange) => void;

export interface SignalControllerOptions {
  readonly initial?: SignalStateId;
  /** Injectable so tests can run transitions synchronously. */
  readonly schedule?: (callback: () => void) => void;
}

export class SignalController {
  #current: SignalState;
  #pending: SignalStateId | null = null;
  #scheduled = false;
  readonly #listeners = new Set<SignalListener>();
  readonly #schedule: (callback: () => void) => void;

  constructor(options: SignalControllerOptions = {}) {
    const first = SIGNAL_STATES[0];
    if (!first) throw new Error("signal states are empty");
    this.#current = options.initial ? getSignalState(options.initial) : first;
    this.#schedule =
      options.schedule ?? ((callback) => requestAnimationFrame(() => callback()));
  }

  get current(): SignalState {
    return this.#current;
  }

  get index(): number {
    return this.#current.index;
  }

  get states(): readonly SignalState[] {
    return SIGNAL_STATES;
  }

  get isFirst(): boolean {
    return this.#current.index === 0;
  }

  get isLast(): boolean {
    return this.#current.index === SIGNAL_STATES.length - 1;
  }

  subscribe(listener: SignalListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Requests a state. Coalesced: the last request before the next frame wins,
   * and intermediate requests are discarded rather than queued.
   */
  goTo(id: SignalStateId): void {
    if (!isSignalStateId(id)) throw new Error(`unknown signal state: ${String(id)}`);
    this.#pending = id;

    if (this.#scheduled) return;
    this.#scheduled = true;
    this.#schedule(() => {
      this.#scheduled = false;
      const target = this.#pending;
      this.#pending = null;
      if (target) this.#apply(target);
    });
  }

  /** Applies immediately, bypassing coalescing. Used for initial render. */
  goToNow(id: SignalStateId): void {
    this.#pending = null;
    this.#apply(id);
  }

  next(): void {
    const target = SIGNAL_STATES[Math.min(this.#current.index + 1, SIGNAL_STATES.length - 1)];
    if (target) this.goTo(target.id);
  }

  previous(): void {
    const target = SIGNAL_STATES[Math.max(this.#current.index - 1, 0)];
    if (target) this.goTo(target.id);
  }

  first(): void {
    const target = SIGNAL_STATES[0];
    if (target) this.goTo(target.id);
  }

  last(): void {
    const target = SIGNAL_STATES[SIGNAL_STATES.length - 1];
    if (target) this.goTo(target.id);
  }

  #apply(id: SignalStateId): void {
    const previous = this.#current;
    const next = getSignalState(id);
    const noop = next.id === previous.id;

    // A same-state request still notifies, with `noop: true`, so the initial
    // render can go through the identical path as every later transition.
    // Listeners that would re-run motion check the flag; nothing has to
    // special-case "first paint".
    this.#current = next;

    const direction: Direction = noop
      ? "none"
      : next.index > previous.index
        ? "forward"
        : "backward";

    const change: SignalChange = { state: next, previous, direction, noop };
    for (const listener of this.#listeners) listener(change);
  }

  dispose(): void {
    this.#listeners.clear();
    this.#pending = null;
  }
}

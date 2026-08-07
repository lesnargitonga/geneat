import { SIGNAL_STATES, getSignalState, isSignalStateId } from "./signal-states";
import type { SequenceState, SignalState } from "./signal-types";

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

export interface SignalChange<S extends SequenceState = SignalState> {
  readonly state: S;
  readonly previous: S;
  readonly direction: Direction;
  /** True when the request did not change the state (same-state no-op). */
  readonly noop: boolean;
}

export type SignalListener<S extends SequenceState = SignalState> = (change: SignalChange<S>) => void;

export interface SignalControllerOptions<S extends SequenceState = SignalState> {
  readonly initial?: S["id"];
  /** Injectable so tests can run transitions synchronously. */
  readonly schedule?: (callback: () => void) => void;
  /**
   * The sequence this controller drives. Defaults to the eight canonical
   * company-level signal states.
   *
   * Parameterised for §25.3: "The Lesnar Signal must be able to transform into
   * different proof grammars." A Gen-Eat route, a CarePro route and a
   * SentinelCore route are different *operational structures* moving through
   * the same signature system — so they are different state lists driven by
   * **this** controller, not three controllers.
   *
   * There is deliberately no second state machine anywhere in the codebase,
   * and a test asserts that every project grammar is driven by this class.
   */
  readonly states?: readonly S[];
}

export class SignalController<S extends SequenceState = SignalState> {
  /**
   * Stable engine identity.
   *
   * `constructor.name` is mangled by the production minifier, so a test that
   * used it to prove "one shared engine" passed in dev and failed in the build
   * it was actually meant to qualify.
   */
  static readonly engineId = "SignalController" as const;

  #current: S;
  #pending: S["id"] | null = null;
  #scheduled = false;
  readonly #listeners = new Set<SignalListener<S>>();
  readonly #schedule: (callback: () => void) => void;
  readonly #states: readonly S[];
  readonly #byId: Map<string, S>;

  constructor(options: SignalControllerOptions<S> = {}) {
    this.#states = options.states ?? (SIGNAL_STATES as unknown as readonly S[]);
    if (this.#states.length === 0) throw new Error("signal states are empty");
    this.#byId = new Map(this.#states.map((state) => [state.id, state]));

    const first = this.#states[0];
    if (!first) throw new Error("signal states are empty");
    this.#current =
      options.initial !== undefined ? this.#lookup(options.initial) : first;
    this.#schedule =
      options.schedule ?? ((callback) => requestAnimationFrame(() => callback()));
  }

  /**
   * Resolves an id within this controller's own sequence, falling back to the
   * canonical lookup so the default path keeps its original error message.
   */
  #lookup(id: S["id"]): S {
    const state = this.#byId.get(id);
    if (state) return state;
    // Canonical default keeps its original error message and lookup path.
    if (this.#states.length === SIGNAL_STATES.length && isSignalStateId(id)) {
      return getSignalState(id) as unknown as S;
    }
    throw new Error(`unknown signal state for this grammar: ${String(id)}`);
  }

  has(id: string): boolean {
    return this.#byId.has(id);
  }

  get current(): S {
    return this.#current;
  }

  get index(): number {
    return this.#current.index;
  }

  get states(): readonly S[] {
    return this.#states;
  }

  get isFirst(): boolean {
    return this.#current.index === 0;
  }

  get isLast(): boolean {
    return this.#current.index === this.#states.length - 1;
  }

  subscribe(listener: SignalListener<S>): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Requests a state. Coalesced: the last request before the next frame wins,
   * and intermediate requests are discarded rather than queued.
   */
  goTo(id: S["id"]): void {
    // Canonical ids are validated against the shared union; grammar ids are
    // validated against this controller's own sequence.
    if (!this.#byId.has(id) && !isSignalStateId(id)) {
      throw new Error(`unknown signal state: ${String(id)}`);
    }
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
  goToNow(id: S["id"]): void {
    this.#pending = null;
    this.#apply(id);
  }

  next(): void {
    const target = this.#states[Math.min(this.#current.index + 1, this.#states.length - 1)];
    if (target) this.goTo(target.id);
  }

  previous(): void {
    const target = this.#states[Math.max(this.#current.index - 1, 0)];
    if (target) this.goTo(target.id);
  }

  first(): void {
    const target = this.#states[0];
    if (target) this.goTo(target.id);
  }

  last(): void {
    const target = this.#states[this.#states.length - 1];
    if (target) this.goTo(target.id);
  }

  #apply(id: S["id"]): void {
    const previous = this.#current;
    const next = this.#lookup(id);
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

    const change: SignalChange<S> = { state: next, previous, direction, noop };
    for (const listener of this.#listeners) listener(change);
  }

  dispose(): void {
    this.#listeners.clear();
    this.#pending = null;
  }
}

import type { ChapterId } from "../content";

/**
 * Study A's experience state.
 *
 * Deliberately much smaller than Study B's equivalent. Study B has to track a
 * renderer, a quality tier, a context state and a render-loop state because it
 * owns a GPU resource that can fail. Study A owns nothing that can fail, so
 * there are exactly two things worth knowing: which chapter is current, and
 * whether the visitor wants motion.
 *
 * The size difference between these two files is one of the more honest
 * maintainability signals the comparison will produce.
 */

export type MotionMode = "auto" | "full" | "reduced";
export type ResolvedMotion = "full" | "reduced";

export interface ExperienceState {
  readonly chapter: ChapterId;
  readonly motionMode: MotionMode;
  readonly resolvedMotion: ResolvedMotion;
}

export const INITIAL_STATE: ExperienceState = {
  chapter: "idea",
  motionMode: "auto",
  resolvedMotion: "full",
};

type Listener = (state: ExperienceState) => void;

export class ExperienceStore {
  #state: ExperienceState = INITIAL_STATE;
  readonly #listeners = new Set<Listener>();

  get state(): ExperienceState {
    return this.#state;
  }

  update(patch: Partial<ExperienceState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof ExperienceState)[]) {
      if (patch[key] !== undefined && patch[key] !== this.#state[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener(this.#state);
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  clearListeners(): void {
    this.#listeners.clear();
  }
}

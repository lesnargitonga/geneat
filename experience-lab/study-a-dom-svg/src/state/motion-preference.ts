import type { MotionMode, ResolvedMotion } from "./experience-state";

/**
 * The Effects control: Auto / Full / Reduced (dossier 7.14).
 *
 * An honest note about this wave: **there is currently no motion to reduce.**
 * Waves A and B build the static narrative only — no animated SVG, no
 * timelines, no scroll-linked movement. The control is shipped now because
 * parity with Study B requires the same control in the same place with the
 * same wording, and because building the preference plumbing before the motion
 * means reduced-motion is designed in from the first frame of Wave C rather
 * than retrofitted (dossier 10: "implement reduced motion during the feature,
 * not afterward").
 *
 * Precedence matches Study B exactly:
 *   Full    — user overrides the OS; an explicit choice is a choice.
 *   Reduced — always reduced.
 *   Auto    — follows `prefers-reduced-motion`.
 */

const STORAGE_KEY = "lesnar.study-a.effects";

export function isMotionMode(value: unknown): value is MotionMode {
  return value === "auto" || value === "full" || value === "reduced";
}

export function readStoredPreference(): MotionMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isMotionMode(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}

export function writeStoredPreference(mode: MotionMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Blocked storage must never break boot. The preference simply does not
    // persist across reloads.
  }
}

export function resolveMotion(mode: MotionMode, prefersReducedMotion: boolean): ResolvedMotion {
  if (mode === "full") return "full";
  if (mode === "reduced") return "reduced";
  return prefersReducedMotion ? "reduced" : "full";
}

export interface MotionPreferenceOptions {
  readonly onChange: (mode: MotionMode, resolved: ResolvedMotion) => void;
}

export class MotionPreference {
  #mode: MotionMode;
  #prefersReducedMotion: boolean;
  readonly #onChange: (mode: MotionMode, resolved: ResolvedMotion) => void;
  readonly #query: MediaQueryList | null;
  readonly #inputs: HTMLInputElement[] = [];

  constructor(options: MotionPreferenceOptions) {
    this.#onChange = options.onChange;
    this.#mode = readStoredPreference();
    this.#query =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    this.#prefersReducedMotion = this.#query?.matches ?? false;
  }

  get mode(): MotionMode {
    return this.#mode;
  }

  get resolved(): ResolvedMotion {
    return resolveMotion(this.#mode, this.#prefersReducedMotion);
  }

  attach(root: ParentNode): void {
    for (const input of root.querySelectorAll<HTMLInputElement>('input[name="effects"]')) {
      input.checked = input.value === this.#mode;
      input.addEventListener("change", this.#onInputChange);
      this.#inputs.push(input);
    }
    this.#query?.addEventListener("change", this.#onQueryChange);
    this.#reflect();
  }

  readonly #onInputChange = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement) || !isMotionMode(target.value)) return;
    this.set(target.value);
  };

  readonly #onQueryChange = (event: MediaQueryListEvent): void => {
    this.#prefersReducedMotion = event.matches;
    // Only Auto follows the OS; an explicit choice is left alone.
    if (this.#mode === "auto") this.#reflect();
  };

  set(mode: MotionMode): void {
    if (mode === this.#mode) return;
    this.#mode = mode;
    writeStoredPreference(mode);
    for (const input of this.#inputs) input.checked = input.value === mode;
    this.#reflect();
  }

  #reflect(): void {
    document.documentElement.dataset["motion"] = this.resolved;
    document.documentElement.dataset["effects"] = this.#mode;
    this.#onChange(this.#mode, this.resolved);
  }

  dispose(): void {
    for (const input of this.#inputs) input.removeEventListener("change", this.#onInputChange);
    this.#inputs.length = 0;
    this.#query?.removeEventListener("change", this.#onQueryChange);
  }
}

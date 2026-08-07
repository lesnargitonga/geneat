import type { SignalState } from "./signal-types";

/**
 * The structured textual equivalent.
 *
 * The visual SVG is `aria-hidden="true"`. That is only defensible if the text
 * below carries the whole relationship — §7.17: "no relationship may exist
 * only visually". So each state publishes five fields: title, explanation,
 * input, boundary/control condition, and output.
 *
 * The live region is deliberately restrained. It announces the state *name*
 * only, because a polite region that re-reads five paragraphs on every step
 * makes the stepper unusable with a screen reader — the detail is in the
 * panel, which a reader can navigate to at their own pace.
 */

export interface SignalTextTargets {
  /** Container whose fields are replaced on every state change. */
  readonly panel: HTMLElement;
  /** `aria-live="polite"` region. Receives the state name only. */
  readonly liveRegion: HTMLElement;
}

const FIELDS: readonly { key: keyof SignalState; term: string }[] = [
  { key: "explanation", term: "What happens" },
  { key: "input", term: "Input" },
  { key: "boundary", term: "Boundary" },
  { key: "output", term: "Output" },
];

export class SignalAccessibility {
  readonly #panel: HTMLElement;
  readonly #liveRegion: HTMLElement;

  constructor(targets: SignalTextTargets) {
    this.#panel = targets.panel;
    this.#liveRegion = targets.liveRegion;
  }

  render(state: SignalState, options: { announce?: boolean } = {}): void {
    this.#panel.dataset["state"] = state.id;

    // h2, not h3: this section sits directly under the hero's h1, and a jump
    // from 1 to 3 is a heading-order defect that the structure suite catches.
    const heading = document.createElement("h2");
    heading.className = "signal-text__title";
    heading.id = "signal-text-title";
    heading.textContent = `${String(state.index).padStart(2, "0")} · ${state.label}`;

    const list = document.createElement("dl");
    list.className = "signal-text__list";

    for (const field of FIELDS) {
      const term = document.createElement("dt");
      term.textContent = field.term;
      const value = document.createElement("dd");
      value.textContent = String(state[field.key]);
      list.append(term, value);
    }

    const position = document.createElement("p");
    position.className = "signal-text__position";
    position.textContent = `State ${state.index + 1} of 8 in the Lesnar Signal sequence.`;

    this.#panel.replaceChildren(heading, list, position);

    // Skipped on first paint: announcing a state nobody navigated to is noise.
    if (options.announce !== false) this.announce(state);
  }

  announce(state: SignalState): void {
    const message = `Signal state ${state.index + 1} of 8: ${state.label}`;
    if (this.#liveRegion.textContent === message) return;
    this.#liveRegion.textContent = message;
  }
}

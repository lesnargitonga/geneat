import { SIGNAL_STATES } from "./signal-states";
import { isSignalStateId } from "./signal-states";
import type { SignalController } from "./signal-controller";
import type { SignalState, SignalStateId } from "./signal-types";

/**
 * The development state stepper.
 *
 * **This is a development and qualification tool, not the final homepage
 * navigation.** It exists so a reviewer can reach any of the eight states
 * deterministically, and so the qualification suite can drive them without
 * scrolling. It is labelled as a prototype control in the markup.
 *
 * Built from real `<button>` elements. The buttons are generated here rather
 * than authored in HTML because the state list is data — a hand-written set
 * would be a second definition of the sequence, free to drift from
 * `signal-states.ts`.
 *
 * Keyboard model follows the WAI-ARIA toolbar pattern: Tab reaches the group
 * once, then arrows move within it. Roving `tabindex` keeps the group a single
 * tab stop instead of ten.
 */

export interface SignalStepperOptions {
  readonly root: HTMLElement;
  readonly controller: SignalController;
}

export class SignalStepper {
  readonly #root: HTMLElement;
  readonly #controller: SignalController;
  readonly #stateButtons = new Map<SignalStateId, HTMLButtonElement>();
  #previousButton: HTMLButtonElement | null = null;
  #nextButton: HTMLButtonElement | null = null;
  #list: HTMLElement | null = null;

  constructor(options: SignalStepperOptions) {
    this.#root = options.root;
    this.#controller = options.controller;
  }

  mount(): void {
    this.#root.replaceChildren();
    this.#root.hidden = false;

    const label = document.createElement("p");
    label.className = "stepper__label";
    label.id = "signal-stepper-label";
    label.textContent = "Signal state — prototype control";

    const group = document.createElement("div");
    group.className = "stepper__group";
    group.setAttribute("role", "toolbar");
    group.setAttribute("aria-labelledby", "signal-stepper-label");
    group.setAttribute("aria-orientation", "horizontal");
    group.addEventListener("keydown", this.#onKeyDown);

    this.#previousButton = this.#createControl("Previous", () => this.#controller.previous());
    this.#previousButton.classList.add("stepper__button--nav");

    const list = document.createElement("div");
    list.className = "stepper__states";
    this.#list = list;

    for (const state of SIGNAL_STATES) {
      const button = this.#createControl(state.label, () => this.#controller.goTo(state.id));
      button.dataset["signalState"] = state.id;
      button.dataset["signalIndex"] = String(state.index);
      // The index is decorative; the label already names the state, so it is
      // hidden from assistive technology to avoid "zero zero Idea".
      const index = document.createElement("span");
      index.className = "stepper__index";
      index.setAttribute("aria-hidden", "true");
      index.textContent = String(state.index).padStart(2, "0");
      button.prepend(index);
      list.append(button);
      this.#stateButtons.set(state.id, button);
    }

    this.#nextButton = this.#createControl("Next", () => this.#controller.next());
    this.#nextButton.classList.add("stepper__button--nav");

    group.append(this.#previousButton, list, this.#nextButton);
    this.#root.append(label, group);

    this.sync(this.#controller.current);
  }

  #createControl(text: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stepper__button";
    button.append(document.createTextNode(text));
    button.addEventListener("click", action);
    return button;
  }

  /** Reflects controller state onto the controls. */
  sync(state: SignalState): void {
    for (const [id, button] of this.#stateButtons) {
      const isCurrent = id === state.id;
      // `aria-current="true"` is the state marker; `aria-pressed` would imply
      // an independent toggle rather than one-of-eight selection.
      if (isCurrent) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
      button.dataset["active"] = isCurrent ? "true" : "false";
      // Roving tabindex: exactly one stop inside the group.
      button.tabIndex = isCurrent ? 0 : -1;
    }

    if (this.#previousButton) this.#previousButton.disabled = this.#controller.isFirst;
    if (this.#nextButton) this.#nextButton.disabled = this.#controller.isLast;

    this.#scrollCurrentIntoView(state);
  }

  /**
   * Keeps the active chip visible in the horizontally scrolling mobile strip.
   * Scoped to the strip's own scroll container — `scrollIntoView` on the
   * element would scroll the *page*, and the brief requires direct state
   * selection without page scrolling.
   */
  #scrollCurrentIntoView(state: SignalState): void {
    const list = this.#list;
    const button = this.#stateButtons.get(state.id);
    if (!list || !button) return;
    if (list.scrollWidth <= list.clientWidth) return;

    const target = button.offsetLeft - (list.clientWidth - button.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const stateId = target.dataset["signalState"];
    if (!isSignalStateId(stateId)) return;

    const handlers: Record<string, (() => void) | undefined> = {
      ArrowRight: () => this.#controller.next(),
      ArrowDown: () => this.#controller.next(),
      ArrowLeft: () => this.#controller.previous(),
      ArrowUp: () => this.#controller.previous(),
      Home: () => this.#controller.first(),
      End: () => this.#controller.last(),
    };

    const handler = handlers[event.key];
    if (!handler) return;

    event.preventDefault();
    handler();
    // Focus follows selection so the next arrow press continues from the new
    // position rather than the one the user left behind.
    requestAnimationFrame(() => this.focusCurrent());
  };

  focusCurrent(): void {
    this.#stateButtons.get(this.#controller.current.id)?.focus();
  }

  dispose(): void {
    this.#root.replaceChildren();
    this.#stateButtons.clear();
    this.#previousButton = null;
    this.#nextButton = null;
    this.#list = null;
  }
}

/**
 * The diagnostic-trace stepper.
 *
 * Progressive enhancement over markup that already contains every stage. With
 * script the trace shows one stage at a time so the reader follows the fault
 * the way it was actually followed — symptom, isolate, measure, classify,
 * contain, recover. Without script the whole trace reads top to bottom.
 *
 * This is not a tab strip. Each stage is a step in one causal path, so the
 * index reads as an ordered route rather than a set of alternatives.
 */

export interface TraceStepperOptions {
  readonly root: HTMLElement;
  readonly onStep?: (id: string) => void;
}

export class TraceStepper {
  static readonly engineId = "TraceStepper";

  readonly #stages = new Map<string, HTMLElement>();
  readonly #links = new Map<string, HTMLAnchorElement>();
  readonly #list: HTMLElement;
  readonly #onStep: ((id: string) => void) | undefined;
  #current: string | null = null;

  constructor(options: TraceStepperOptions) {
    const list = options.root.querySelector<HTMLElement>("[data-trace-stages]");
    if (!list) throw new Error("trace has no stage list");
    this.#list = list;
    this.#onStep = options.onStep;
    for (const el of list.querySelectorAll<HTMLElement>("[data-trace-stage]")) {
      const id = el.dataset["traceStage"];
      if (id) this.#stages.set(id, el);
    }
    for (const el of options.root.querySelectorAll<HTMLAnchorElement>("[data-trace-link]")) {
      const id = el.dataset["traceLink"];
      if (id) this.#links.set(id, el);
    }
  }

  get ids(): readonly string[] {
    return [...this.#stages.keys()];
  }

  mount(): void {
    this.#list.setAttribute("data-stepping", "");
    for (const [id, link] of this.#links) {
      link.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        this.step(id);
      });
      link.addEventListener("keydown", (event) => this.#onKeydown(event, id));
    }
    this.step(this.ids[0] ?? "");
  }

  /** Arrow keys walk the path in causal order; Home/End jump to its ends. */
  #onKeydown(event: KeyboardEvent, id: string): void {
    const ids = this.ids;
    const at = ids.indexOf(id);
    let next: string | undefined;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = ids[(at + 1) % ids.length];
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = ids[(at - 1 + ids.length) % ids.length];
    else if (event.key === "Home") next = ids[0];
    else if (event.key === "End") next = ids[ids.length - 1];
    if (!next) return;
    event.preventDefault();
    this.step(next);
    this.#links.get(next)?.focus();
  }

  step(id: string): void {
    if (!this.#stages.has(id) || id === this.#current) return;
    this.#current = id;
    for (const [stageId, el] of this.#stages) el.hidden = stageId !== id;
    for (const [linkId, link] of this.#links) {
      if (linkId === id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
    // Not `data-trace-stage`: that marks a stage element, and writing it to
    // <html> would make the document match the stage selector.
    document.documentElement.dataset["traceCurrent"] = id;
    this.#onStep?.(id);
  }

  dispose(): void {
    this.#list.removeAttribute("data-stepping");
    for (const el of this.#stages.values()) el.hidden = false;
    for (const link of this.#links.values()) link.removeAttribute("aria-current");
    delete document.documentElement.dataset["traceCurrent"];
  }
}

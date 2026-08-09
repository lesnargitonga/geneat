import type { CapabilityId } from "./capability-model";

/**
 * The capability inspector.
 *
 * Progressive enhancement only. The served markup already contains every
 * capability in full; this narrows the field to one specimen at a time and
 * keeps the register index in sync. If the script never runs, the section is
 * still complete — it simply reads as a whole field sheet.
 *
 * Selection follows the URL fragment, so a chosen capability is linkable, the
 * back button works, and the anchors keep functioning with script disabled.
 */

const INSPECTING = "data-inspecting";

export interface CapabilityInspectorOptions {
  readonly register: HTMLElement;
  /** Reports a selection so the page can record a future analytics event. */
  readonly onInspect?: (id: CapabilityId) => void;
}

export class CapabilityInspector {
  static readonly engineId = "CapabilityInspector";

  readonly #field: HTMLElement;
  readonly #links = new Map<string, HTMLAnchorElement>();
  readonly #entries = new Map<string, HTMLElement>();
  readonly #onInspect: ((id: CapabilityId) => void) | undefined;
  #current: string | null = null;
  #onHashChange: (() => void) | null = null;

  constructor(options: CapabilityInspectorOptions) {
    const field = options.register.querySelector<HTMLElement>("[data-capability-field]");
    if (!field) throw new Error("capability register has no field");
    this.#field = field;
    this.#onInspect = options.onInspect;

    for (const link of options.register.querySelectorAll<HTMLAnchorElement>("[data-capability-link]")) {
      const id = link.dataset["capabilityLink"];
      if (id) this.#links.set(id, link);
    }
    for (const entry of field.querySelectorAll<HTMLElement>("[data-capability]")) {
      const id = entry.dataset["capability"];
      if (id) this.#entries.set(id, entry);
    }
  }

  /** Ids in register order — the order a reader meets them. */
  get ids(): readonly string[] {
    return [...this.#entries.keys()];
  }

  get current(): string | null {
    return this.#current;
  }

  mount(): void {
    this.#field.setAttribute(INSPECTING, "");

    for (const [id, link] of this.#links) {
      link.addEventListener("click", (event) => {
        // Let modified clicks open a new tab; only take over the plain case.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        this.select(id, { updateHash: true });
      });
      link.addEventListener("keydown", (event) => this.#onKeydown(event, id));
    }

    this.#onHashChange = () => {
      const id = window.location.hash.replace("#capability-", "");
      if (this.#entries.has(id)) this.select(id, { updateHash: false, focusEntry: true });
    };
    window.addEventListener("hashchange", this.#onHashChange);

    const fromHash = window.location.hash.replace("#capability-", "");
    this.select(this.#entries.has(fromHash) ? fromHash : (this.ids[0] ?? ""), { updateHash: false });
  }

  /**
   * Roving arrow-key movement across the register, which is what a reader
   * expects from a list of related choices. Home/End jump to the ends.
   */
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
    this.select(next, { updateHash: true });
    this.#links.get(next)?.focus();
  }

  select(id: string, options: { updateHash?: boolean; focusEntry?: boolean } = {}): void {
    if (!this.#entries.has(id) || id === this.#current) return;
    this.#current = id;

    for (const [entryId, entry] of this.#entries) entry.hidden = entryId !== id;
    for (const [linkId, link] of this.#links) {
      if (linkId === id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }

    if (options.updateHash && window.history?.replaceState) {
      window.history.replaceState(null, "", `#capability-${id}`);
    }
    if (options.focusEntry) this.#entries.get(id)?.focus?.();

    // NOT `data-capability`: that attribute marks a register entry, and writing
    // it to <html> would make the document itself match the entry selector.
    document.documentElement.dataset["capabilityCurrent"] = id;
    this.#onInspect?.(id as CapabilityId);
  }

  dispose(): void {
    if (this.#onHashChange) window.removeEventListener("hashchange", this.#onHashChange);
    this.#onHashChange = null;
    this.#field.removeAttribute(INSPECTING);
    for (const entry of this.#entries.values()) entry.hidden = false;
    for (const link of this.#links.values()) link.removeAttribute("aria-current");
    delete document.documentElement.dataset["capabilityCurrent"];
  }
}

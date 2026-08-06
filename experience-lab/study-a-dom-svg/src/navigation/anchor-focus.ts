/**
 * Moves keyboard focus to the target of an in-page anchor.
 *
 * Browsers move the *scroll* position on anchor navigation but historically
 * disagree about moving focus. When focus stays behind in the header, a
 * keyboard or screen-reader user who activates "02 System" is scrolled to the
 * section while their next Tab continues from the navigation — the link
 * appears to do nothing useful.
 *
 * This is the smallest correct fix: set `tabindex="-1"` on the landing
 * element, focus it without a second scroll, and remove the attribute again on
 * blur so the section never becomes a stray tab stop.
 *
 * It enhances behaviour that already works. With JavaScript disabled the
 * anchors still navigate — they simply do not move focus, which is the
 * browser's default and is what the no-JS baseline is measured against.
 */
export class AnchorFocus {
  readonly #root: ParentNode;
  #attached = false;

  constructor(root: ParentNode) {
    this.#root = root;
  }

  attach(): void {
    if (this.#attached) return;
    this.#attached = true;
    this.#root.addEventListener("click", this.#onClick as EventListener);
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) return;

    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#") || href.length < 2) return;

    const destination = document.getElementById(href.slice(1));
    if (!destination) return;

    // Do not preventDefault: the browser's own scrolling and history entry are
    // correct and should be left alone. Only focus is being corrected.
    if (!destination.hasAttribute("tabindex")) {
      destination.setAttribute("tabindex", "-1");
      destination.addEventListener(
        "blur",
        () => destination.removeAttribute("tabindex"),
        { once: true },
      );
    }
    destination.focus({ preventScroll: true });
  };

  dispose(): void {
    if (!this.#attached) return;
    this.#attached = false;
    this.#root.removeEventListener("click", this.#onClick as EventListener);
  }
}

import { CHAPTERS, type ChapterId } from "../content";

/**
 * Chapter tracking for the journey rail (dossier 7.13).
 *
 * The rail is a list of real anchors that work with JavaScript disabled. This
 * module only adds *current position* on top of navigation that already
 * functions — it never becomes the mechanism by which navigation works.
 *
 * Position is derived from IntersectionObserver rather than a scroll handler,
 * so nothing reads layout on every scroll event. There is no scroll hijacking,
 * no scrub, and no scroll-linked animation anywhere in Study A.
 */

export interface ChapterControllerOptions {
  readonly sections: readonly HTMLElement[];
  readonly links: readonly HTMLAnchorElement[];
  readonly onChange: (chapter: ChapterId) => void;
}

/**
 * Derived from CHAPTERS rather than listed again.
 *
 * The hand-written list silently omitted "work" when Wave H added the chapter,
 * so the rail would have tracked every chapter except the new one — a defect
 * that reports no error and simply never highlights. Deriving it means adding a
 * chapter cannot leave this behind.
 */
const CHAPTER_IDS = new Set<string>(CHAPTERS.map((c) => c.id));

function isChapterId(value: string | undefined): value is ChapterId {
  return value !== undefined && CHAPTER_IDS.has(value);
}

export class ChapterController {
  readonly #sections: readonly HTMLElement[];
  readonly #links: readonly HTMLAnchorElement[];
  readonly #onChange: (chapter: ChapterId) => void;

  #observer: IntersectionObserver | null = null;
  #current: ChapterId = "idea";
  readonly #ratios = new Map<ChapterId, number>();

  constructor(options: ChapterControllerOptions) {
    this.#sections = options.sections;
    this.#links = options.links;
    this.#onChange = options.onChange;
  }

  get current(): ChapterId {
    return this.#current;
  }

  attach(): void {
    this.#reflect();
    if (typeof IntersectionObserver === "undefined") return;

    this.#observer = new IntersectionObserver(this.#onIntersect, {
      threshold: [0, 0.15, 0.35, 0.55, 0.75, 1],
      rootMargin: "-10% 0px -35% 0px",
    });
    for (const section of this.#sections) this.#observer.observe(section);
  }

  readonly #onIntersect: IntersectionObserverCallback = (entries) => {
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset["chapter"];
      if (!isChapterId(id)) continue;
      this.#ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
    }

    let best: ChapterId = this.#current;
    let bestRatio = -1;
    for (const [id, ratio] of this.#ratios) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = id;
      }
    }

    if (bestRatio <= 0 || best === this.#current) return;
    this.#current = best;
    this.#reflect();
    this.#onChange(best);
  };

  #reflect(): void {
    // `data-current-chapter`, not `data-chapter`.
    //
    // On a section, `data-chapter` means "this *is* a chapter". On <html> the
    // same name would mean "this is the *current* chapter" — a different
    // relationship under an identical selector, which made
    // `querySelectorAll("[data-chapter]")` count five chapters where the page
    // has four. Distinct meanings get distinct attributes.
    document.documentElement.dataset["currentChapter"] = this.#current;
    for (const link of this.#links) {
      const isCurrent = link.dataset["chapterLink"] === this.#current;
      // `aria-current` is set only on the active link. Setting it to "false"
      // everywhere else is valid but noisier for screen readers than simply
      // removing it.
      if (isCurrent) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
      link.dataset["active"] = isCurrent ? "true" : "false";
    }
  }

  dispose(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#ratios.clear();
  }
}

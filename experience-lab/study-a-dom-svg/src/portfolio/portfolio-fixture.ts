import { SignalController } from "../signal/signal-controller";
import { SignalView } from "../signal/signal-view";
import { createSequenceGeometry } from "../signal/signal-geometry";
import { PROJECT_GRAMMARS } from "./project-grammars";
import type { ProjectGrammar } from "./project-grammars";
import type { SequenceState } from "../signal/signal-types";
import type { ResolvedMotion } from "../state/experience-state";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Development-only portfolio extensibility fixture.
 *
 * Renders each project grammar through **the same** `SignalController` and
 * `SignalView` used by the hero. Nothing here subclasses, forks or
 * reimplements either one — the only difference between the hero and a
 * grammar is the array of states handed to the constructor.
 *
 * That is the whole point. §25.1 warns against hard-coding the assumption that
 * Gen-Eat is the only serious project, and the cheapest way for that assumption
 * to creep in is a second renderer written "just for" one project. This fixture
 * makes such a divergence immediately visible: if a grammar ever needed its own
 * engine, it could not be mounted here.
 *
 * Visible only under `?diagnostics=1` or in dev. It is not homepage content and
 * carries no published project claims.
 */
export class PortfolioFixture {
  readonly #root: HTMLElement;
  readonly #instances: {
    grammar: ProjectGrammar;
    controller: SignalController<SequenceState>;
    view: SignalView;
  }[] = [];

  constructor(root: HTMLElement) {
    this.#root = root;
  }

  get grammarCount(): number {
    return this.#instances.length;
  }

  mount(motion: ResolvedMotion): void {
    this.#root.hidden = false;
    this.#root.replaceChildren();

    const heading = document.createElement("h2");
    heading.className = "fixture__title";
    heading.id = "portfolio-fixture-title";
    heading.textContent = "Portfolio extensibility — development fixture";

    const note = document.createElement("p");
    note.className = "fixture__note";
    note.textContent =
      "Three operational grammars of different lengths, each driven by the same signal engine. " +
      "Development check only — no project status, adoption or metrics are claimed here.";

    this.#root.append(heading, note);

    for (const grammar of PROJECT_GRAMMARS) {
      this.#root.append(this.#buildGrammar(grammar, motion));
    }
  }

  #buildGrammar(grammar: ProjectGrammar, motion: ResolvedMotion): HTMLElement {
    const section = document.createElement("section");
    section.className = "fixture__grammar";
    section.dataset["grammar"] = grammar.id;

    const title = document.createElement("h3");
    title.className = "fixture__grammar-title";
    title.textContent = grammar.label;

    const shape = document.createElement("p");
    shape.className = "fixture__shape";
    shape.textContent = `${grammar.steps.length} steps · ${grammar.shape}`;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "signal signal--fixture");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.dataset["signalFixture"] = grammar.id;

    const steps = document.createElement("ol");
    steps.className = "fixture__steps";

    // One controller and one view per grammar — the same classes as the hero.
    const geometry = createSequenceGeometry("horizontal", grammar.steps.length);
    const controller = new SignalController<SequenceState>({ states: grammar.steps });
    const view = new SignalView(svg, window.innerWidth, geometry, `fixture-${grammar.id}`);
    view.applyMotion(motion);

    const buttons = new Map<string, HTMLButtonElement>();

    controller.subscribe((change) => {
      view.render(change.state, { animate: !change.noop });
      for (const [id, button] of buttons) {
        const isCurrent = id === change.state.id;
        if (isCurrent) button.setAttribute("aria-current", "true");
        else button.removeAttribute("aria-current");
      }
      caption.textContent = `${change.state.label} — ${change.state.explanation}`;
    });

    for (const step of grammar.steps) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fixture__step";
      button.dataset["fixtureStep"] = step.id;
      button.textContent = step.label;
      button.addEventListener("click", () => controller.goTo(step.id));
      buttons.set(step.id, button);
      item.append(button);
      steps.append(item);
    }

    const caption = document.createElement("p");
    caption.className = "fixture__caption";
    caption.dataset["fixtureCaption"] = grammar.id;

    section.append(title, shape, svg, steps, caption);

    // Render the final state: a still frame showing the complete route, which
    // is what a reviewer needs from a fixture.
    const last = grammar.steps[grammar.steps.length - 1];
    if (last) controller.goToNow(last.id);

    this.#instances.push({ grammar, controller, view });
    return section;
  }

  /**
   * Test access: proves every grammar is driven by the shared engine.
   *
   * The identity is read *through each instance's own constructor*, not from
   * the imported class. Reading `SignalController.engineId` directly would
   * report "SignalController" no matter what actually built the instance,
   * which would make this check unfalsifiable — a project-specific engine
   * would slip straight past it.
   */
  describe(): { id: string; steps: number; engine: string; viewEngine: string }[] {
    return this.#instances.map((instance) => ({
      id: instance.grammar.id,
      steps: instance.controller.states.length,
      engine: (instance.controller.constructor as typeof SignalController).engineId ?? "unknown",
      viewEngine: (instance.view.constructor as typeof SignalView).engineId ?? "unknown",
    }));
  }

  dispose(): void {
    for (const instance of this.#instances) {
      instance.controller.dispose();
      instance.view.dispose();
    }
    this.#instances.length = 0;
    this.#root.replaceChildren();
    this.#root.hidden = true;
  }
}

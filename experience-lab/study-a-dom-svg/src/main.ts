import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/signal.css";
import "./styles/scenes.css";
import "./styles/controls.css";
import "./styles/accessibility.css";

import { ExperienceStore } from "./state/experience-state";
import { MotionPreference } from "./state/motion-preference";
import { ChapterController } from "./navigation/chapter-controller";
import { AnchorFocus } from "./navigation/anchor-focus";
import { reportContentIntegrity } from "./accessibility/content-integrity";

/**
 * Boot for Study A.
 *
 * Everything below is progressive enhancement over a page that is already
 * complete. If this file never runs — script blocked, parse error, JavaScript
 * disabled — the visitor still gets the headline, both calls to action, the
 * Gen-Eat proof, all six system stages, the seven-step action sequence, the
 * static signal composition and working chapter navigation.
 *
 * Wave A/B adds exactly three things on top: current-chapter state on the
 * rail, focus correction for in-page anchors, and the Effects preference.
 * No animation is started here, because none exists yet.
 */

function shouldReportDiagnostics(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).get("diagnostics") === "1";
  } catch {
    return false;
  }
}

function boot(): void {
  document.documentElement.dataset["js"] = "true";

  const store = new ExperienceStore();

  const motion = new MotionPreference({
    onChange: (motionMode, resolvedMotion) => store.update({ motionMode, resolvedMotion }),
  });
  motion.attach(document);

  const chapters = new ChapterController({
    sections: [...document.querySelectorAll<HTMLElement>("[data-chapter]")],
    links: [...document.querySelectorAll<HTMLAnchorElement>("[data-chapter-link]")],
    onChange: (chapter) => store.update({ chapter }),
  });
  chapters.attach();

  new AnchorFocus(document).attach();

  if (shouldReportDiagnostics()) {
    const issues = reportContentIntegrity(document);
    // Exposed for the parity and structure tests, which assert that the
    // markup and the content model agree before comparing against Study B.
    window.__STUDY_A__ = {
      version: 1,
      state: () => ({ ...store.state }),
      integrityIssues: () => issues,
      setEffects: (mode) => motion.set(mode),
    };
  }
}

declare global {
  interface Window {
    __STUDY_A__?: {
      version: 1;
      state: () => Record<string, unknown>;
      integrityIssues: () => { kind: string; id: string; detail: string }[];
      setEffects: (mode: "auto" | "full" | "reduced") => void;
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

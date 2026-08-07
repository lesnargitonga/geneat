import type { MotionBudget } from "./signal-types";
import type { ResolvedMotion } from "../state/experience-state";

/**
 * Motion budget (Wave C limits).
 *
 * ```text
 * Normal transition:      max 450 ms
 * Signal-head movement:   max 650 ms
 * Reduced motion:         0–80 ms, no path travel, no scale pulse
 * ```
 *
 * The values below sit under those ceilings rather than at them. A transition
 * that uses its entire budget leaves no room for the state to be re-read
 * during rapid stepping, and rapid stepping is a required behaviour.
 */

export const FULL_MOTION: MotionBudget = {
  transitionMs: 320,
  headTravelMs: 520,
};

/**
 * Reduced is not "faster full motion" — 60 ms is short enough to read as an
 * instant state change rather than a movement, which is the actual
 * requirement. No path travel and no scale pulse are enforced structurally in
 * `signal-view.ts`, not by shortening a duration.
 */
export const REDUCED_MOTION: MotionBudget = {
  transitionMs: 60,
  headTravelMs: 60,
};

/** Ceilings from the brief. Asserted in the contract test. */
export const MOTION_LIMITS = {
  maxTransitionMs: 450,
  maxHeadTravelMs: 650,
  maxReducedMs: 80,
} as const;

export function budgetFor(motion: ResolvedMotion): MotionBudget {
  return motion === "reduced" ? REDUCED_MOTION : FULL_MOTION;
}

/**
 * Publishes the budget as CSS custom properties on the signal root, so the
 * stylesheet owns *how* things transition and this module owns only *how
 * long*. Nothing in CSS hard-codes a duration.
 */
export function applyMotionBudget(root: HTMLElement | SVGElement, motion: ResolvedMotion): void {
  const budget = budgetFor(motion);
  root.style.setProperty("--signal-transition", `${budget.transitionMs}ms`);
  root.style.setProperty("--signal-head-travel", `${budget.headTravelMs}ms`);
  root.dataset["motion"] = motion;
}

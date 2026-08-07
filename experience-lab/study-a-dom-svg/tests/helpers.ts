import type { Page } from "@playwright/test";

/**
 * Shared test helpers.
 *
 * Study A's bridge is deliberately tiny — it exposes state and the content
 * integrity result, nothing more. There is no renderer to drive, no context to
 * lose and no loop to pause, so there is nothing else worth automating.
 */

/**
 * Diagnostics **with a pinned state**.
 *
 * `?signal=` suppresses the hero formation sequence. Tests that drive states
 * directly need the signal to stay where they put it — without the pin, the
 * sequence advances underneath them and the assertions race it.
 *
 * Hero tests deliberately pass `/?diagnostics=1` instead, so the sequence runs.
 */
export const DIAGNOSTIC_URL = "/?diagnostics=1&signal=idea";

export interface StudyAState {
  chapter: string;
  motionMode: string;
  resolvedMotion: string;
}

export interface IntegrityIssue {
  kind: string;
  id: string;
  detail: string;
}

export async function gotoAndReady(page: Page, url = DIAGNOSTIC_URL): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => typeof window.__STUDY_A__ !== "undefined");
}

export function state(page: Page): Promise<StudyAState> {
  return page.evaluate(() => window.__STUDY_A__!.state() as unknown) as Promise<StudyAState>;
}

export function integrityIssues(page: Page): Promise<IntegrityIssue[]> {
  return page.evaluate(() => window.__STUDY_A__!.integrityIssues());
}

/** Heading levels in document order, e.g. [1, 2, 3, 4, 4, 2, ...]. */
export function headingLevels(page: Page): Promise<number[]> {
  return page
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
}

/**
 * Waits until an in-page smooth scroll has genuinely finished.
 *
 * Polled once per animation frame; settles when the scroll offset is identical
 * on three consecutive frames. No fixed sleep is involved — the condition is
 * observed scroll state, so it is as fast as the machine allows and as slow as
 * the machine needs.
 *
 * Why this exists: `scroll-behavior: smooth` means a chapter anchor keeps
 * animating for ~700-800 ms after activation, while `hash` and `activeElement`
 * are already correct within ~30 ms. A test that asserts and then immediately
 * activates the *next* link fires `focus()` into a scroll that is still in
 * flight, and `focus()` scrolls too. The application is not wrong — measured at
 * 1x, 4x and 8x CPU it resolves hash and focus every time — but the overlap
 * makes the timing of later assertions load-dependent.
 */
export async function waitForScrollSettled(page: Page): Promise<void> {
  // Reset the frame-to-frame counters before each use.
  await page.evaluate(() => {
    const w = window as unknown as { __scrollY: number | null; __scrollStable: number };
    w.__scrollY = null;
    w.__scrollStable = 0;
  });

  await page.waitForFunction(
    () => {
      const w = window as unknown as { __scrollY: number | null; __scrollStable: number };
      const y = Math.round(window.scrollY);
      if (w.__scrollY === y) w.__scrollStable += 1;
      else {
        w.__scrollY = y;
        w.__scrollStable = 0;
      }
      return w.__scrollStable >= 3;
    },
    null,
    { polling: "raf", timeout: 10_000 },
  );
}

/**
 * Waits for a chapter anchor activation to complete in full: the hash updates,
 * focus moves to the target section, and the smooth scroll finishes.
 *
 * Each step waits on observable state rather than elapsed time, so the sequence
 * is deterministic regardless of machine load.
 */
export async function settleChapterNavigation(page: Page, id: string): Promise<void> {
  // 1. The navigation itself took effect.
  await page.waitForFunction((target) => window.location.hash === `#${target}`, id, {
    timeout: 10_000,
  });

  // 2. Focus moved to the target section (AnchorFocus).
  await page.waitForFunction(
    (target) => document.activeElement instanceof HTMLElement && document.activeElement.id === target,
    id,
    { timeout: 10_000 },
  );

  // 3. The smooth scroll finished, so the next action cannot collide with it.
  await waitForScrollSettled(page);
}

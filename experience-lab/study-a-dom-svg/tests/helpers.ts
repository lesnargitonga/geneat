import type { Page } from "@playwright/test";

/**
 * Shared test helpers.
 *
 * Study A's bridge is deliberately tiny — it exposes state and the content
 * integrity result, nothing more. There is no renderer to drive, no context to
 * lose and no loop to pause, so there is nothing else worth automating.
 */

export const DIAGNOSTIC_URL = "/?diagnostics=1";

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

import { defineConfig, devices } from "@playwright/test";

/**
 * Tests run against the production build via `vite preview`.
 *
 * Study A needs no GPU flags — there is no renderer. That absence is worth
 * noticing: Study B's config has to enable SwiftShader and assert a non-zero
 * tier to avoid silently testing its own fallback. Study A has no such failure
 * mode to guard against, which is a maintainability data point rather than an
 * oversight.
 */

const PORT = 4184;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "evidence/playwright-results.json" }]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /no-js\.spec\.ts/,
    },
    {
      // A real mobile descriptor rather than a narrow window: `hasTouch`
      // changes `(pointer: coarse)`, hover behaviour and touch-target
      // enforcement, none of which a resized desktop profile exercises.
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: /(responsive|structure)\.spec\.ts/,
    },
    {
      name: "no-javascript",
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /no-js\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npm run build && npm run preview",
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E config for the Ask-Me flows. Playwright builds once, then serves the
 * production output so fully parallel browser workers share stable assets
 * instead of racing the development compiler and image cache. `/api/generate`
 * is stubbed per-test via route interception, so no OPENROUTER_API_KEY / live
 * LLM is required.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Each page owns a full-screen WebGL canvas; serialize for deterministic input.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { OPENROUTER_API_KEY: "test-key-not-used" },
  },
});

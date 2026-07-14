import { defineConfig, devices } from "@playwright/test";
import { PLAYWRIGHT_STORY_RECORDS } from "./app/ask/[storyId]/__tests__/story-fixtures";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const STORY_FIXTURES = JSON.stringify(PLAYWRIGHT_STORY_RECORDS);

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
    video: process.env.PLAYWRIGHT_VIDEO ? "on" : "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      OPENROUTER_API_KEY: "test-key-not-used",
      STORY_CACHE_HMAC_KEY: "playwright-only-hmac-key-64-story-fixtures",
      STORY_CACHE_HMAC_KEY_ID: "playwright-v1",
      PLAYWRIGHT_TEST_MODE: "1",
      PLAYWRIGHT_STORY_FIXTURES: STORY_FIXTURES,
    },
  },
});

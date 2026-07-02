import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E config for the Ask-Me flows. The dev server is started without the
 * `--inspect` flag (unlike `npm run dev`) so parallel Playwright workers don't
 * fight over the debugger port. `/api/generate` is stubbed per-test via route
 * interception, so no OPENROUTER_API_KEY / live LLM is required.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { OPENROUTER_API_KEY: "test-key-not-used" },
  },
});

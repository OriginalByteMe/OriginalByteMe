import { test, expect, type Page } from "@playwright/test";

/**
 * A minimal, valid answer spec the stubbed /api/generate returns. Uses only
 * catalog components + a literal /corpus/* statePath, mirroring what the model
 * is prompted to emit.
 */
const ANSWER_SPEC = {
  root: "root",
  elements: {
    root: { type: "Section", props: { title: "Answer" }, children: ["prose", "projects"] },
    prose: {
      type: "Prose",
      props: { text: "Here is a tailored answer composed from Noah's corpus." },
      children: [],
    },
    projects: { type: "ProjectShowcase", props: { statePath: "/corpus/projects" }, children: [] },
  },
};

/** Stub the generation route with a fixture spec (no live LLM). */
async function stubGenerate(page: Page) {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ spec: ANSWER_SPEC }),
    });
  });
}

/** Stub the generation route with a 500 to exercise the fallback path. */
async function stubGenerateError(page: Page) {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "boom" }),
    });
  });
}

test("home canvas shows default content by default", async ({ page }) => {
  await stubGenerate(page);
  await page.goto("/");
  // homeSpec renders an "About Me" section and a "Projects" section.
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About Me" })).toBeVisible();
});

test("asking a question renders an answer and syncs ?q=", async ({ page }) => {
  await stubGenerate(page);
  await page.goto("/");

  await page.getByRole("textbox", { name: /ask a question/i }).fill("What are Noah's projects?");
  await page.getByRole("button", { name: /send question/i }).click();

  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeVisible();
  await expect(page).toHaveURL(/\?q=/);
});

test("reload with ?q= reproduces the answer", async ({ page }) => {
  await stubGenerate(page);
  await page.goto("/?q=What%20are%20Noah%27s%20projects%3F");

  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeVisible();
});

test("↺ home restores the default canvas", async ({ page }) => {
  await stubGenerate(page);
  await page.goto("/");

  await page.getByRole("textbox", { name: /ask a question/i }).fill("Tell me about Noah");
  await page.getByRole("button", { name: /send question/i }).click();
  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeVisible();

  await page.getByRole("button", { name: /home/i }).click();
  await expect(page.getByRole("heading", { name: "About Me" })).toBeVisible();
  await expect(page).not.toHaveURL(/\?q=/);
});

test("a 500 from /api/generate falls back to home + shows an error", async ({ page }) => {
  await stubGenerateError(page);
  await page.goto("/");

  await page.getByRole("textbox", { name: /ask a question/i }).fill("break it");
  await page.getByRole("button", { name: /send question/i }).click();

  // Never blank: home content stays, and an error alert appears. Scope to our
  // toast text — Next's route announcer is also role="alert".
  await expect(page.getByRole("alert").filter({ hasText: /Couldn.t generate/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About Me" })).toBeVisible();
});

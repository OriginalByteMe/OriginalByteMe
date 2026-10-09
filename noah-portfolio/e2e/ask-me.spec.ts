import { expect, test, type Page } from "@playwright/test";
import type { PublicStory, StoryStreamEvent } from "@/lib/story/types";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_QUESTION,
  CURRENT_STORY_ID,
  OUTDATED_STORY_ID,
  RELATED_PUBLIC_STORY,
  RELATED_QUESTION,
  RELATED_STORY_ID,
} from "@/lib/story/__fixtures__/story-fixtures";

type StreamWindow = Window & { __pushStoryEvent?: () => boolean };

const tokenFor = (story: PublicStory) => `${story.id}.${"a".repeat(43)}`;
const headlineOf = (page: Page, story: PublicStory) =>
  page.getByRole("heading", { level: 1, name: story.site.hero.headline });

function storyEvents(story: PublicStory): StoryStreamEvent[] {
  return [
    { type: "phase", phase: "generating" },
    { type: "site", site: story.site, evidence: story.evidence },
    { type: "phase", phase: "validating" },
    { type: "phase", phase: "publishing", publicationToken: tokenFor(story) },
  ];
}

/** Holds `/api/generate` open so the test releases one NDJSON event at a time. */
async function installControlledStream(page: Page, story: PublicStory) {
  await page.addInitScript((lines) => {
    const nativeFetch = window.fetch.bind(window);
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    let next = 0;
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (url.pathname !== "/api/generate") return nativeFetch(input, init);
      const body = new ReadableStream<Uint8Array>({ start: (nextController) => void (controller = nextController) });
      return new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
    };
    (window as StreamWindow).__pushStoryEvent = () => {
      if (!controller || next >= lines.length) return false;
      controller.enqueue(encoder.encode(`${lines[next]}\n`));
      next += 1;
      if (next === lines.length) controller.close();
      return true;
    };
  }, storyEvents(story).map((event) => JSON.stringify(event)));
}

async function pushStoryEvents(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await expect
      .poll(() => page.evaluate(() => Boolean((window as StreamWindow).__pushStoryEvent?.())))
      .toBe(true);
  }
}

async function stubPublish(page: Page, story: PublicStory) {
  await page.route("**/api/generate/publish", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ publicationToken: tokenFor(story) });
    await route.fulfill({ json: { type: "complete", story } });
  });
}

async function stubGeneration(page: Page, story: PublicStory, question: string) {
  await page.route("**/api/generate", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ question });
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: storyEvents(story).map((event) => `${JSON.stringify(event)}\n`).join(""),
    });
  });
  await stubPublish(page, story);
}

async function askFromHome(page: Page, question: string) {
  await page.getByRole("textbox", { name: /ask a question/i }).fill(question);
  await page.getByRole("button", { name: /send question/i }).click();
}

test("builds the generated site block by block, publishes an opaque link, and goes back home", async ({ page }) => {
  await installControlledStream(page, CURRENT_PUBLIC_STORY);
  await stubPublish(page, CURRENT_PUBLIC_STORY);
  await page.goto("/");
  await askFromHome(page, CURRENT_QUESTION);

  await expect(page.getByRole("status", { name: "Building your site" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: CURRENT_QUESTION })).toBeVisible();

  await pushStoryEvents(page, 2); // generating, site
  await expect(headlineOf(page, CURRENT_PUBLIC_STORY)).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: `${CURRENT_PUBLIC_STORY.site.brand} sections` }).getByRole("link"),
  ).toHaveText(CURRENT_PUBLIC_STORY.site.sections.map((section) => section.nav));
  await expect(page.getByRole("button", { name: "Copy link" })).toHaveCount(0);

  await pushStoryEvents(page, 2); // validating, publishing
  await expect(page).toHaveURL(`/ask/${CURRENT_STORY_ID}`);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Back to portfolio" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("dialog.site-takeover")).toHaveCount(0);
});

test("a public link renders its site fully built, including after reload, without generating", async ({ page }) => {
  let generateRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/generate") generateRequests += 1;
  });

  await page.goto(`/ask/${CURRENT_STORY_ID}`);
  await expect(headlineOf(page, CURRENT_PUBLIC_STORY)).toBeVisible();
  await expect(page.locator(".gs[data-building]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();

  await page.reload();
  await expect(headlineOf(page, CURRENT_PUBLIC_STORY)).toBeVisible();
  expect(generateRequests).toBe(0);
});

test("an outdated link shows no stale site and regenerates into a current one", async ({ page }) => {
  await stubGeneration(page, CURRENT_PUBLIC_STORY, CURRENT_QUESTION);
  await page.goto(`/ask/${OUTDATED_STORY_ID}`);

  await expect(page.getByRole("heading", { name: "This Story is outdated" })).toBeVisible();
  await expect(page.getByText(/STALE SITE/)).toHaveCount(0);

  await page.getByRole("button", { name: "Regenerate with current facts" }).click();
  await expect(page).toHaveURL(`/ask/${CURRENT_STORY_ID}`);
  await expect(headlineOf(page, CURRENT_PUBLIC_STORY)).toBeVisible();
});

test("a related question builds a new site and browser Back restores the previous one", async ({ page }) => {
  await stubGeneration(page, RELATED_PUBLIC_STORY, RELATED_QUESTION);
  await page.goto(`/ask/${CURRENT_STORY_ID}`);

  await page
    .getByRole("region", { name: "Keep exploring" })
    .getByRole("button", { name: RELATED_QUESTION })
    .click();
  await expect(page).toHaveURL(`/ask/${RELATED_STORY_ID}`);
  await expect(headlineOf(page, RELATED_PUBLIC_STORY)).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(`/ask/${CURRENT_STORY_ID}`);
  await expect(headlineOf(page, CURRENT_PUBLIC_STORY)).toBeVisible();
});

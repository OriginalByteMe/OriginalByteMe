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

const ACTIVE_ASSET_IDS = ["circuit-mind", "print-layers", "morning-coffee"];

function publicationTokenFor(story: PublicStory): string {
  return `${story.id}.${"a".repeat(43)}`;
}

type StoryTestWindow = Window & {
  __storyStreamPush?: (streamIndex: number) => boolean;
  __storyStreamAborted?: (streamIndex: number) => boolean;
};

function storyEvents(story: PublicStory): StoryStreamEvent[] {
  return [
    { type: "phase", phase: "planning" },
    { type: "plan", plan: story.plan, evidence: story.evidence },
    { type: "phase", phase: "composing" },
    ...story.scenes.map((scene, index) => ({ type: "scene" as const, index, scene })),
    { type: "phase", phase: "validating" },
    {
      type: "phase",
      phase: "publishing",
      publicationToken: publicationTokenFor(story),
    },
  ];
}

async function installControlledStoryStreams(
  page: Page,
  streams: StoryStreamEvent[][],
  publishedStories: PublicStory[],
) {
  await page.addInitScript(
    ({ streamLines, publications }) => {

      const nativeFetch = window.fetch.bind(window);
      const controls = window as StoryTestWindow;
      const states = new Map<
        number,
        { controller: ReadableStreamDefaultController<Uint8Array>; lines: string[]; next: number }
      >();
      const aborted = new Set<number>();
      let nextStream = 0;

      window.fetch = async (input, init) => {
        const url =
          typeof input === "string"
            ? new URL(input, window.location.href)
            : input instanceof URL
              ? input
              : new URL(input.url);
        if (url.pathname === "/api/generate/publish") {
          const request = JSON.parse(String(init?.body)) as { publicationToken?: string };
          const publication = publications.find(
            (candidate) => candidate.publicationToken === request.publicationToken,
          );
          if (!publication) {
            return new Response(JSON.stringify({ error: "Unknown publication token" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({ type: "complete", story: publication.story }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.pathname !== "/api/generate") return nativeFetch(input, init);

        const streamIndex = nextStream++;
        const lines = streamLines[streamIndex];
        if (!lines) {
          return new Response(JSON.stringify({ error: "Unexpected generation request" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const encoder = new TextEncoder();
        const signal = init?.signal ?? (input instanceof Request ? input.signal : null);
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              states.set(streamIndex, { controller, lines, next: 0 });
              signal?.addEventListener(
                "abort",
                () => {
                  aborted.add(streamIndex);
                  states.delete(streamIndex);
                  controller.error(new DOMException("Aborted", "AbortError"));
                },
                { once: true },
              );
            },
            cancel() {
              aborted.add(streamIndex);
              states.delete(streamIndex);
            },
          }),
          { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
        );
      };

      controls.__storyStreamPush = (streamIndex) => {
        const state = states.get(streamIndex);
        if (!state) return false;
        const line = state.lines[state.next];
        if (line === undefined) return false;
        state.controller.enqueue(new TextEncoder().encode(`${line}\n`));
        state.next += 1;
        if (state.next === state.lines.length) {
          state.controller.close();
          states.delete(streamIndex);
        }
        return true;
      };
      controls.__storyStreamAborted = (streamIndex) => aborted.has(streamIndex);
    },
    {
      streamLines: streams.map((events) => events.map((event) => JSON.stringify(event))),
      publications: publishedStories.map((story) => ({
        publicationToken: publicationTokenFor(story),
        story,
      })),
    },
  );
}

async function pushStoryEvent(page: Page, streamIndex = 0) {
  await expect
    .poll(() =>
      page.evaluate(
        (index) => typeof (window as StoryTestWindow).__storyStreamPush === "function" &&
          Boolean((window as StoryTestWindow).__storyStreamPush?.(index)),
        streamIndex,
      ),
    )
    .toBe(true);
}

async function pushRemainingStoryEvents(
  page: Page,
  eventCount: number,
  alreadyPushed = 0,
  streamIndex = 0,
) {
  for (let index = alreadyPushed; index < eventCount; index += 1) {
    await pushStoryEvent(page, streamIndex);
  }
}

async function stubPublishedStory(page: Page, story: PublicStory, expectedQuestion: string) {
  await page.route("**/api/generate", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.postDataJSON()).toEqual({ question: expectedQuestion });
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: `${storyEvents(story).map((event) => JSON.stringify(event)).join("\n")}\n`,
    });
  });
  await page.route("**/api/generate/publish", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      publicationToken: publicationTokenFor(story),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ type: "complete", story }),
    });
  });
}

async function openAskMe(page: Page) {
  const heroLauncher = page.getByRole("button", { name: "Open Ask-Me" });
  if (await heroLauncher.isVisible()) {
    await heroLauncher.click();
    return;
  }
  await page.getByRole("button", { name: /ask this portfolio a question/i }).click();
}

async function submitQuestion(page: Page, question: string) {
  await page.getByRole("textbox", { name: /ask a question/i }).fill(question);
  await page.getByRole("button", { name: /send question/i }).click();
}

async function expectSceneOrder(page: Page, titles: string[]) {
  await expect(page.locator("[data-story-scene] h2")).toHaveText(titles);
}

test("progressively reveals ordered Scenes, stable reading position, Rail, share, and opaque URL", async ({
  page,
}) => {
  const events = storyEvents(CURRENT_PUBLIC_STORY);
  await installControlledStoryStreams(page, [events], [CURRENT_PUBLIC_STORY]);
  await page.goto("/");
  await openAskMe(page);
  await submitQuestion(page, CURRENT_QUESTION);

  await expect(page.getByRole("heading", { name: "Preparing your Story" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Story preparation" })).toContainText(
    "Let me think about Noah",
  );
  await expect(page.locator(".story-phrase__typed")).toContainText("Let");
  await expect(page.getByRole("button", { name: "Share this Story" })).toHaveCount(0);

  await pushStoryEvent(page); // planning
  await expect(page.getByText("Planning the Story")).toBeVisible();
  await pushStoryEvent(page); // plan
  await expect(page.getByRole("heading", { name: "Building the plan into Scenes" })).toBeVisible();
  const blueprintRows = page
    .getByRole("list", { name: "Planned Story scenes" })
    .getByRole("listitem");
  await expect(blueprintRows).toHaveCount(3);
  await expect(blueprintRows.nth(0)).toHaveAttribute("data-state", "pending");
  await expect(blueprintRows.nth(0)).toContainText("hero statement");
  await pushStoryEvent(page); // composing
  await expect(blueprintRows.nth(0)).toHaveAttribute("data-state", "composing");

  await pushStoryEvent(page); // Scene 1
  await expect(page.getByRole("heading", { name: "Systems become usable products" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preparing your Story" })).toHaveCount(0);
  await expect(blueprintRows.nth(0)).toHaveAttribute("data-state", "ready");
  await expect(blueprintRows.nth(1)).toHaveAttribute("data-state", "composing");
  const desktopRail = page.getByRole("navigation", { name: "Story scenes" });
  await expect(desktopRail).toBeVisible();
  await expect(desktopRail.getByRole("button", { name: /Evidence from shipped work/ })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Composing Scene 2 of 3" })).toBeVisible();

  const firstScene = page.locator("[data-story-scene]").first();
  const firstSource = CURRENT_PUBLIC_STORY.evidence.find(
    ({ id }) => id === CURRENT_PUBLIC_STORY.scenes[0].evidenceRefIds[0],
  )!;
  const sourceTrigger = firstScene.getByRole("button", { name: "Sources for this claim" });
  await sourceTrigger.focus();
  const sourcePopover = firstScene.getByRole("dialog", { name: "Sources for this claim" });
  await expect(sourcePopover).toBeVisible();
  await expect(sourcePopover).toContainText(firstSource.label);
  await expect(sourcePopover).toContainText(firstSource.excerpt);
  await page.keyboard.press("Escape");
  await expect(sourcePopover).toHaveCount(0);
  await expect(sourceTrigger).toBeFocused();

  await sourceTrigger.hover();
  await expect(sourcePopover).toBeVisible();
  await page.getByRole("heading", { name: CURRENT_QUESTION }).hover();
  await expect(sourcePopover).toHaveCount(0);
  await sourceTrigger.click();
  await expect(sourcePopover).toBeVisible();
  await page.getByRole("heading", { name: CURRENT_QUESTION }).click();
  await expect(sourcePopover).toHaveCount(0);

  const firstRailTarget = desktopRail.getByRole("button", { name: /Systems become usable products/ });
  await firstRailTarget.focus();
  await expect(firstRailTarget).toBeFocused();
  const scrollBeforeAppend = await page.evaluate(() => window.scrollY);

  await pushStoryEvent(page); // Scene 2
  await expect(page.getByRole("heading", { name: "Evidence from shipped work" })).toBeVisible();
  await expect(firstRailTarget).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBeforeAppend);
  await expect(blueprintRows.nth(1)).toHaveAttribute("data-state", "ready");
  await expect(blueprintRows.nth(2)).toHaveAttribute("data-state", "composing");
  await expect(page.getByRole("status").filter({ hasText: "Composing Scene 3 of 3" })).toBeVisible();

  await pushStoryEvent(page); // Scene 3
  await expectSceneOrder(page, [
    "Systems become usable products",
    "Evidence from shipped work",
    "Craft meets delivery",
  ]);
  await expect(blueprintRows.nth(2)).toHaveAttribute("data-state", "ready");
  const projectShowcases = page.getByLabel("Referenced projects");
  await expect(projectShowcases).toHaveCount(2);
  await expect(projectShowcases.first().getByRole("link")).toHaveCount(2);
  await expect(projectShowcases.last().getByRole("link")).toHaveCount(1);
  await expect(page.locator(".story-sentinel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share this Story" })).toHaveCount(0);

  const scenes = page.locator("[data-story-scene]");
  await expect(scenes).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(scenes.nth(index).locator("[data-motion-asset]")).toHaveCount(1);
  }
  expect(
    await scenes.locator("[data-motion-asset]").evaluateAll((assets) =>
      assets.map((asset) => asset.getAttribute("data-motion-asset")),
    ),
  ).toEqual(ACTIVE_ASSET_IDS);

  await pushRemainingStoryEvents(page, events.length, 6);
  await expect(page).toHaveURL(`/ask/${CURRENT_STORY_ID}`);
  await expect(page).toHaveURL(/\/ask\/[A-Za-z0-9_-]{24}$/);
  expect(page.url()).not.toContain(encodeURIComponent(CURRENT_QUESTION));
  expect(page.url()).not.toContain("?q=");
  await expect(page.getByRole("button", { name: "Share this Story" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Related Questions" })).toBeVisible();
});

test("a current public Story survives reload without generation", async ({ page }) => {
  let generateRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/generate") generateRequests += 1;
  });

  await page.goto(`/ask/${CURRENT_STORY_ID}`);
  await expect(page.getByRole("heading", { name: CURRENT_QUESTION })).toBeVisible();
  await expectSceneOrder(page, [
    "Systems become usable products",
    "Evidence from shipped work",
    "Craft meets delivery",
  ]);
  await expect(page.getByRole("button", { name: "Share this Story" })).toBeVisible();
  const { sceneHeights, viewportHeight } = await page.locator("[data-story-scene]").evaluateAll(
    (scenes) => ({
      sceneHeights: scenes.map((scene) => scene.getBoundingClientRect().height),
      viewportHeight: window.innerHeight,
    }),
  );
  const compactHeaderHeight = await page.getByRole("banner").evaluate(
    (header) => header.getBoundingClientRect().height,
  );
  expect(sceneHeights).toHaveLength(3);
  for (const height of sceneHeights) {
    expect(height).toBeGreaterThanOrEqual(viewportHeight - compactHeaderHeight - 1);
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: CURRENT_QUESTION })).toBeVisible();
  await expect(page.locator("[data-story-scene]")).toHaveCount(3);
  expect(generateRequests).toBe(0);
});

test("an outdated URL exposes no stale Scene and regenerates into a current opaque ID", async ({ page }) => {
  await stubPublishedStory(page, CURRENT_PUBLIC_STORY, CURRENT_QUESTION);
  await page.goto(`/ask/${OUTDATED_STORY_ID}`);

  await expect(page.getByRole("heading", { name: "This Story is outdated" })).toBeVisible();
  await expect(page.getByText(CURRENT_QUESTION)).toBeVisible();
  await expect(page.locator("[data-story-scene]")).toHaveCount(0);
  await expect(page.getByText(/STALE SCENE BODY/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share this Story" })).toHaveCount(0);

  await page.getByRole("button", { name: "Regenerate with current facts" }).click();
  await expect(page).toHaveURL(`/ask/${CURRENT_STORY_ID}`);
  await expect(page.getByRole("heading", { name: CURRENT_QUESTION })).toBeVisible();
  expect(CURRENT_STORY_ID).not.toBe(OUTDATED_STORY_ID);
});

test("an outdated URL never redirects when publication fails", async ({ page }) => {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: `${storyEvents(CURRENT_PUBLIC_STORY).map((event) => JSON.stringify(event)).join("\n")}\n`,
    });
  });
  await page.route("**/api/generate/publish", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "publication unavailable" }),
    });
  });
  await page.goto(`/ask/${OUTDATED_STORY_ID}`);

  await page.getByRole("button", { name: "Regenerate with current facts" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: /could not be published/i }),
  ).toBeVisible();
  await expect(page).toHaveURL(`/ask/${OUTDATED_STORY_ID}`);
  await expect(page.getByRole("heading", { name: "This Story is outdated" })).toBeVisible();
  await expect(page.locator("[data-story-scene]")).toHaveCount(0);
});

test("a Related Question pushes history and Back restores the prior Story and reading position", async ({
  page,
}) => {
  await stubPublishedStory(page, RELATED_PUBLIC_STORY, RELATED_QUESTION);
  await page.goto(`/ask/${CURRENT_STORY_ID}`);
  await page.getByRole("heading", { name: "Craft meets delivery" }).scrollIntoViewIfNeeded();
  const priorScroll = await page.evaluate(() => window.scrollY);
  expect(priorScroll).toBeGreaterThan(0);

  await page.getByRole("button", { name: RELATED_QUESTION }).click();
  await expect(page).toHaveURL(`/ask/${RELATED_STORY_ID}`);
  await expect(page.getByRole("heading", { name: RELATED_QUESTION })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Technical range in practice" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(`/ask/${CURRENT_STORY_ID}`);
  await expect(page.getByRole("heading", { name: "Systems become usable products" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(priorScroll - 100);
});

test("a newer question cancels an unfinished Story and prevents stale updates", async ({ page }) => {
  const firstEvents = storyEvents(CURRENT_PUBLIC_STORY);
  const secondEvents = storyEvents(RELATED_PUBLIC_STORY);
  await installControlledStoryStreams(
    page,
    [firstEvents, secondEvents],
    [CURRENT_PUBLIC_STORY, RELATED_PUBLIC_STORY],
  );
  await page.goto("/");
  await openAskMe(page);
  await submitQuestion(page, CURRENT_QUESTION);
  await expect(page.getByRole("heading", { name: "Preparing your Story" })).toBeVisible();

  await openAskMe(page);
  await submitQuestion(page, RELATED_QUESTION);
  await expect
    .poll(() => page.evaluate(() => Boolean((window as StoryTestWindow).__storyStreamAborted?.(0))))
    .toBe(true);

  await pushRemainingStoryEvents(page, secondEvents.length, 0, 1);
  await expect(page).toHaveURL(`/ask/${RELATED_STORY_ID}`);
  await expect(page.getByRole("heading", { name: RELATED_QUESTION })).toBeVisible();
  await expect(page.getByText(CURRENT_PUBLIC_STORY.scenes[0].body)).toHaveCount(0);
});

test("desktop scroll, theme, keyboard navigation, and offscreen motion preserve Story semantics", async ({ page }) => {
  await page.goto(`/ask/${CURRENT_STORY_ID}`);
  const desktopRail = page.getByRole("navigation", { name: "Story scenes" });
  const mobileRail = page.getByRole("navigation", { name: "Story navigation" });
  await expect(desktopRail).toBeVisible();
  await expect(mobileRail).toBeHidden();
  const railBox = await desktopRail.boundingBox();
  const firstSceneContentBox = await page.locator("[data-story-scene]").first()
    .locator(".story-scene__frame").boundingBox();
  expect(railBox).not.toBeNull();
  expect(firstSceneContentBox).not.toBeNull();
  expect(firstSceneContentBox!.x - (railBox!.x + railBox!.width)).toBeGreaterThan(0);

  const viewportHeight = await page.evaluate(() => window.innerHeight);
  await page.mouse.wheel(0, viewportHeight * 1.25);
  await expect(page.getByRole("heading", { name: "Evidence from shipped work" })).toBeInViewport();

  const thirdTarget = desktopRail.getByRole("button", { name: /Craft meets delivery/ });
  await thirdTarget.focus();
  await page.keyboard.press("Enter");
  await expect(thirdTarget).toBeFocused();
  const morningCoffee = page.locator('[data-motion-asset="morning-coffee"]');
  await expect(page.getByRole("heading", { name: "Craft meets delivery" })).toBeInViewport();
  await expect(morningCoffee).toHaveAttribute("data-motion-renderer", "dotlottie");
  await expect(morningCoffee).toHaveAttribute("data-motion-state", "playing");

  const themeToggle = page.getByRole("button", { name: "Toggle color theme" });
  const previousTheme = await themeToggle.getAttribute("aria-pressed");
  await themeToggle.click();
  await expect(themeToggle).toHaveAttribute("aria-pressed", previousTheme === "true" ? "false" : "true");
  await expect(page.getByRole("heading", { name: CURRENT_QUESTION })).toBeVisible();
  await expectSceneOrder(page, [
    "Systems become usable products",
    "Evidence from shipped work",
    "Craft meets delivery",
  ]);

  await page.keyboard.press("Home");
  await expect(page.getByRole("heading", { name: "Systems become usable products" })).toBeInViewport();
  await expect(morningCoffee).toHaveAttribute("data-motion-state", "paused");
  await expect(page.locator("[data-motion-asset]")).toHaveCount(ACTIVE_ASSET_IDS.length);
});

test("dotLottie failure falls back to a semantic static poster", async ({ page }) => {
  await page.route("**/motion/morning-coffee.lottie", (route) => route.abort("failed"));
  await page.goto(`/ask/${CURRENT_STORY_ID}`);

  const morningCoffee = page.locator('[data-motion-asset="morning-coffee"]');
  await page.getByRole("heading", { name: "Craft meets delivery" }).scrollIntoViewIfNeeded();

  await expect(morningCoffee).toHaveAttribute("data-motion-runtime-fallback", "true");
  await expect(morningCoffee).toHaveAttribute("data-motion-state", "static");
  await expect(morningCoffee.locator('[data-motion-poster-state="static"]')).toBeVisible();
  await expect(
    page.getByRole("img", { name: "A steaming cup completes a morning coffee ritual" }),
  ).toBeVisible();
  await expect(page.getByText(CURRENT_PUBLIC_STORY.scenes[2].body)).toBeVisible();
});

test.describe("mobile and touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("offers compact Scene navigation and touch-equivalent Related Questions", async ({ page }) => {
    await stubPublishedStory(page, RELATED_PUBLIC_STORY, RELATED_QUESTION);
    await page.goto(`/ask/${CURRENT_STORY_ID}`);

    await expect(page.getByRole("navigation", { name: "Story scenes" })).toBeHidden();
    const mobileRail = page.getByRole("navigation", { name: "Story navigation" });
    await expect(mobileRail).toBeVisible();
    const sceneSelect = page.getByRole("combobox", { name: "Choose a Story scene" });
    await expect(sceneSelect).toHaveValue("0");
    await sceneSelect.selectOption("1");
    await expect(page.getByRole("heading", { name: "Evidence from shipped work" })).toBeInViewport();

    await page.getByRole("button", { name: RELATED_QUESTION }).tap();
    await expect(page).toHaveURL(`/ask/${RELATED_STORY_ID}`);
    await expect(page.getByRole("heading", { name: RELATED_QUESTION })).toBeVisible();
  });
});

test("reduced motion uses curated static assets without hiding any claim", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/ask/${CURRENT_STORY_ID}`);

  const assets = page.locator("[data-motion-asset]");
  await expect(assets).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(assets.nth(index)).toHaveAttribute("data-motion-state", "static");
  }
  await expect(page.getByRole("img", { name: "Circuit paths animate through an isometric robot brain" })).toBeVisible();
  await expect(page.getByText(CURRENT_PUBLIC_STORY.scenes[0].claim)).toBeVisible();
  await expect(page.getByText(CURRENT_PUBLIC_STORY.scenes[1].claim)).toBeVisible();
  await expect(page.getByText(CURRENT_PUBLIC_STORY.scenes[2].claim)).toBeVisible();
});

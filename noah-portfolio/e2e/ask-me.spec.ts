import { test, expect, type Page } from "@playwright/test";

/**
 * A minimal, valid answer spec the stubbed /api/generate returns. Uses only
 * catalog components + a literal /corpus/* statePath, mirroring what the model
 * is prompted to emit.
 */
const ANSWER_SPEC = {
  root: "root",
  state: { "/backdrop/preset": "nightMatte" },
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

type StreamingWindow = typeof window & {
  __pushGeneratePatch?: () => boolean;
};

/**
 * Replace only the generation fetch with a browser-native ReadableStream.
 * The test advances one patch at a time, so partial renders are deterministic.
 */
async function stubGenerateStream(page: Page) {
  const patches = [
    { op: "add", path: "/root", value: "root" },
    { op: "add", path: "/state", value: ANSWER_SPEC.state },
    {
      op: "add",
      path: "/elements/root",
      value: ANSWER_SPEC.elements.root,
    },
    {
      op: "add",
      path: "/elements/prose",
      value: ANSWER_SPEC.elements.prose,
    },
    {
      op: "add",
      path: "/elements/projects",
      value: ANSWER_SPEC.elements.projects,
    },
  ];

  await page.addInitScript(
    ({ lines }) => {
      const nativeFetch = window.fetch.bind(window);
      const controls = window as StreamingWindow;

      window.fetch = async (input, init) => {
        const url =
          typeof input === "string"
            ? new URL(input, window.location.href)
            : input instanceof URL
              ? input
              : new URL(input.url);
        if (url.pathname !== "/api/generate") return nativeFetch(input, init);

        const encoder = new TextEncoder();
        let index = 0;
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controls.__pushGeneratePatch = () => {
                const line = lines[index];
                if (line === undefined) return false;
                controller.enqueue(encoder.encode(`${line}\n`));
                index += 1;
                if (index === lines.length) controller.close();
                return true;
              };
            },
          }),
          { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
        );
      };
    },
    { lines: patches.map((patch) => JSON.stringify(patch)) },
  );
}

async function pushNextStreamPatch(page: Page) {
  await expect
    .poll(() => page.evaluate(() => typeof (window as StreamingWindow).__pushGeneratePatch === "function"))
    .toBe(true);
  const pushed = await page.evaluate(() => (window as StreamingWindow).__pushGeneratePatch?.());
  expect(pushed).toBe(true);
}

async function openAskMe(page: Page) {
  await page.getByRole("button", { name: "Open Ask-Me" }).click();
}

/** Stub malformed NDJSON to exercise the client-side stream fallback. */
async function stubGenerateMalformedStream(page: Page) {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: '{"op":"add","path":',
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
  // homeSpec flagship story: chapter headings from Scene/ChapterHeading anchors
  await expect(page.getByRole("heading", { name: "Noah, in brief" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Things I've built" })).toBeVisible();
});

test("asking a question renders an answer and syncs ?q=", async ({ page }) => {
  await stubGenerate(page);
  await page.goto("/");
  await openAskMe(page);

  await page.getByRole("textbox", { name: /ask a question/i }).fill("What are Noah's projects?");
  await page.getByRole("button", { name: /send question/i }).click();

  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeVisible();
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByTestId("backdrop")).toHaveClass(/from-\[#dfe3ee\]/);
});

test("reload with ?q= reproduces the answer", async ({ page }) => {
  await stubGenerate(page);
  await page.goto("/?q=What%20are%20Noah%27s%20projects%3F");

  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeVisible();
});

test("↺ home restores the default canvas", async ({ page }) => {
  test.setTimeout(45_000);
  await stubGenerate(page);
  await page.goto("/");
  await openAskMe(page);

  await page.getByRole("textbox", { name: /ask a question/i }).fill("Tell me about Noah");
  await page.getByRole("button", { name: /send question/i }).click();
  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeVisible();
  await expect(page.getByTestId("backdrop")).toHaveClass(/from-\[#dfe3ee\]/);

  await page.getByRole("button", { name: /home/i }).click();
  await expect(page.getByRole("heading", { name: "Noah, in brief" })).toBeVisible();
  await expect(page.getByTestId("backdrop")).toHaveClass(/from-\[#f2e7d9\]/);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
});

test("asking a question progressively assembles an NDJSON answer and steers the backdrop", async ({
  page,
}) => {
  await stubGenerateStream(page);
  await page.goto("/");
  await openAskMe(page);

  await page.getByRole("textbox", { name: /ask a question/i }).fill("What are Noah's projects?");
  await page.getByRole("button", { name: /send question/i }).click();

  await expect(page.getByText(/Composing an answer/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Noah, in brief" })).toBeHidden();
  await pushNextStreamPatch(page);
  await pushNextStreamPatch(page);
  await pushNextStreamPatch(page);

  await expect(page.getByRole("heading", { name: "Answer", exact: true })).toBeVisible();
  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeHidden();
  await expect(page.getByTestId("backdrop")).toHaveClass(/from-\[#f2e7d9\]/);

  await pushNextStreamPatch(page);
  await expect(page.getByText("Here is a tailored answer composed from Noah's corpus.")).toBeVisible();
  await expect(page.getByText(/Composing an answer/)).toBeVisible();

  await pushNextStreamPatch(page);
  await expect(page.getByText(/Composing an answer/)).toBeHidden();
  await expect(page.getByTestId("backdrop")).toHaveClass(/from-\[#dfe3ee\]/);
  await expect(page).toHaveURL(/\?q=/);
});

test("a 500 from /api/generate falls back to home + shows an error", async ({ page }) => {
  await stubGenerateError(page);
  await page.goto("/");
  await openAskMe(page);

  await page.getByRole("textbox", { name: /ask a question/i }).fill("break it");
  await page.getByRole("button", { name: /send question/i }).click();

  // Never blank: home content stays, and an error alert appears. Scope to our
  // toast text — Next's route announcer is also role="alert".
  await expect(page.getByRole("alert").filter({ hasText: /Couldn.t generate/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Noah, in brief" })).toBeVisible();
});

test("malformed NDJSON falls back to home and clears the shared query", async ({ page }) => {
  await stubGenerateMalformedStream(page);
  await page.goto("/");
  await openAskMe(page);

  await page.getByRole("textbox", { name: /ask a question/i }).fill("break the stream");
  await page.getByRole("button", { name: /send question/i }).click();

  await expect(page.getByRole("alert").filter({ hasText: /Couldn.t generate/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Noah, in brief" })).toBeVisible();
  await expect(page.getByTestId("backdrop")).toHaveClass(/from-\[#f2e7d9\]/);
  await expect(page).not.toHaveURL(/\?q=/);
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { streamText } from "ai";
import type * as Ai from "ai";
import { getModel } from "@/lib/llm/openrouter";
import { CORPUS_EVIDENCE_REFS, resolveStoryProjects } from "@/lib/story/evidence";
import {
  findCurrentStory,
  findPreparedStory,
  prepareCompleteStory,
  publishPreparedStory,
  seedStoryFixtures,
} from "@/lib/story/store";
import {
  CORPUS_REVISION,
  STORY_CONTRACT_VERSION,
  StoryStreamEventSchema,
  PublishStoryResponseSchema,
  type NewStoryRecord,
  type Site,
  type SiteDraft,
  type StoryRecord,
  type StoryStreamEvent,
} from "@/lib/story/types";
import { POST as generate } from "@/app/api/generate/route";
import { POST as publish } from "@/app/api/generate/publish/route";
import { POST as seedFixtures } from "@/app/api/playwright-seed/route";

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  streamText: vi.fn(),
}));
vi.mock("@/lib/llm/openrouter", () => ({ getModel: vi.fn() }));
vi.mock("@/lib/story/store", () => ({
  findCurrentStory: vi.fn(),
  findPreparedStory: vi.fn(),
  prepareCompleteStory: vi.fn(),
  publishPreparedStory: vi.fn(),
  seedStoryFixtures: vi.fn(),
}));

const streamTextMock = vi.mocked(streamText);
const getModelMock = vi.mocked(getModel);
const findCurrentStoryMock = vi.mocked(findCurrentStory);
const findPreparedStoryMock = vi.mocked(findPreparedStory);
const prepareCompleteStoryMock = vi.mocked(prepareCompleteStory);
const publishPreparedStoryMock = vi.mocked(publishPreparedStory);
const seedStoryFixturesMock = vi.mocked(seedStoryFixtures);

const QUESTION = "What does Noah self-host?";
const PUBLIC_ID = "AbCdEfGhIjKlMnOpQrStUvWx";
const PUBLICATION_TOKEN = `${PUBLIC_ID}.${"A".repeat(43)}`;

const GROUNDED_DRAFT: SiteDraft = {
  layout: "bento",
  brand: "Noah / Homelab",
  hero: {
    evidenceRefIds: ["fun-fact-2"],
    eyebrow: "Self-hosting",
    headline: "I self-host on Proxmox and Unraid",
    lede: "My homelab runs on Proxmox and Unraid.",
    art: "server-rack",
  },
  sections: [
    {
      kind: "list",
      evidenceRefIds: ["operating-systems-4"],
      title: "Linux and Unraid on the server",
      nav: "Server",
      body: "My homelab server runs Linux and Unraid.",
      items: [{ title: "Linux", text: "Runs on my homelab server." }],
    },
    {
      kind: "cards",
      evidenceRefIds: ["project-llm-comparison"],
      title: "LLM Comparison",
      nav: "Projects",
      body: "My portfolio includes the LLM Comparison app.",
      items: [],
    },
  ],
  relatedQuestions: ["Which databases does Noah know?", "Where is Noah based?"],
};

const BOUNDARY_DRAFT: SiteDraft = {
  layout: "editorial",
  brand: "Noah",
  hero: {
    evidenceRefIds: [],
    eyebrow: "Not shared",
    headline: "I haven't shared my salary",
    lede: "That is not something I have published.",
    art: "coffee-cup",
  },
  sections: [],
  relatedQuestions: ["Where has Noah worked?", "What does Noah self-host?"],
};

const GROUNDED_SITE: Site = {
  mode: "grounded",
  ...GROUNDED_DRAFT,
  palette: "forest",
  // The second section cites project-llm-comparison, so the server attaches that project's card.
  sections: [
    GROUNDED_DRAFT.sections[0],
    { ...GROUNDED_DRAFT.sections[1], projectSlugs: ["llm-comparison"], projects: resolveStoryProjects(["llm-comparison"]) },
  ],
};
const BOUNDARY_SITE: Site = { mode: "boundary", ...BOUNDARY_DRAFT, palette: "midnight" };
const GROUNDED_EVIDENCE = CORPUS_EVIDENCE_REFS.filter((ref) =>
  ["operating-systems-4", "project-llm-comparison", "fun-fact-2"].includes(ref.id),
);

function modelResult(text: string) {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
  } as never;
}

function storyFromInput(input: NewStoryRecord): StoryRecord {
  return {
    id: PUBLIC_ID,
    displayQuestion: input.displayQuestion,
    corpusRevision: CORPUS_REVISION,
    storyContractVersion: STORY_CONTRACT_VERSION,
    createdAt: "2026-07-14T08:00:00.000Z",
    site: input.site,
    evidence: input.evidence,
  };
}

const GROUNDED_STORY = storyFromInput({
  displayQuestion: QUESTION,
  site: GROUNDED_SITE,
  evidence: GROUNDED_EVIDENCE,
});

function postRequest(body: unknown, signal?: AbortSignal, path = "/api/generate"): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

async function readEvents(response: Response): Promise<StoryStreamEvent[]> {
  const text = await response.text();
  if (!text.trim()) return [];
  return text
    .trim()
    .split("\n")
    .map((line) => StoryStreamEventSchema.parse(JSON.parse(line)));
}

beforeEach(() => {
  vi.clearAllMocks();
  getModelMock.mockReturnValue({} as never);
  findCurrentStoryMock.mockResolvedValue(null);
  findPreparedStoryMock.mockResolvedValue(null);
  prepareCompleteStoryMock.mockImplementation(async (input) => ({
    story: storyFromInput(input),
    publicationToken: PUBLICATION_TOKEN,
  }));
  publishPreparedStoryMock.mockResolvedValue(GROUNDED_STORY);
});

describe("POST /api/generate", () => {
  it.each([
    null,
    {},
    { question: 42 },
    { question: "   " },
    { question: "x".repeat(281) },
  ])("returns a typed 400 response for an invalid question: %j", async (body) => {
    const response = await generate(postRequest(body));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "question must be a string between 1 and 280 characters",
    });
    expect(findCurrentStoryMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it.each([
    { label: "grounded", draft: GROUNDED_DRAFT, site: GROUNDED_SITE, evidence: GROUNDED_EVIDENCE },
    { label: "boundary", draft: BOUNDARY_DRAFT, site: BOUNDARY_SITE, evidence: [] },
  ])("streams a validated $label site and ends with a publication token", async ({ draft, site, evidence }) => {
    streamTextMock.mockReturnValueOnce(modelResult(JSON.stringify(draft)));

    const response = await generate(postRequest({ question: `  ${QUESTION}  ` }));
    const events = await readEvents(response);

    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(response.headers.get("x-cache")).toBe("miss");
    expect(events).toEqual([
      { type: "phase", phase: "generating" },
      { type: "site", site, evidence },
      { type: "phase", phase: "validating" },
      { type: "phase", phase: "publishing", publicationToken: PUBLICATION_TOKEN },
    ]);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const [input, options] = prepareCompleteStoryMock.mock.calls[0];
    expect(input).toEqual({ displayQuestion: QUESTION, site, evidence });
    expect(options?.signal?.aborted).toBe(false);
  });

  it("puts each cited project's card on the first section that cites it, at most three per section", async () => {
    const cited = ["project-ai-image-cutout", "project-ask-me-portfolio", "project-llm-comparison", "project-moodify"];
    const draft = {
      ...GROUNDED_DRAFT,
      sections: [
        { ...GROUNDED_DRAFT.sections[1], evidenceRefIds: cited },
        { ...GROUNDED_DRAFT.sections[0], evidenceRefIds: ["project-llm-comparison", "project-moodify"] },
      ],
    };
    streamTextMock.mockReturnValueOnce(modelResult(JSON.stringify(draft)));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));
    const site = events.find((event) => event.type === "site");
    const cards = site?.type === "site" ? site.site.sections.map((section) => section.projects?.map((project) => project.slug)) : null;

    expect(cards).toEqual([["ai-image-cutout", "ask-me-portfolio", "llm-comparison"], ["moodify"]]);
  });

  it("repairs an invalid first site by naming its validation error", async () => {
    const invalid = JSON.stringify({
      ...GROUNDED_DRAFT,
      hero: { ...GROUNDED_DRAFT.hero, evidenceRefIds: ["invented-ref"] },
    });
    streamTextMock
      .mockReturnValueOnce(modelResult(invalid))
      .mockReturnValueOnce(modelResult(JSON.stringify(GROUNDED_DRAFT)));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));

    expect(streamTextMock).toHaveBeenCalledTimes(2);
    const repairMessages = streamTextMock.mock.calls[1][0].messages ?? [];
    expect(repairMessages).toHaveLength(2);
    expect(JSON.stringify(repairMessages[1])).toMatch(/invented-ref/);
    expect(JSON.stringify(repairMessages)).not.toContain(invalid);
    expect(events.find((event) => event.type === "site")).toEqual({
      type: "site",
      site: GROUNDED_SITE,
      evidence: GROUNDED_EVIDENCE,
    });
    expect(events.at(-1)).toEqual({
      type: "phase",
      phase: "publishing",
      publicationToken: PUBLICATION_TOKEN,
    });
  });

  it.each([
    { label: "malformed JSON", output: "{\"mode\":", message: /JSON/ },
    {
      label: "a model-chosen project slug",
      output: JSON.stringify({
        ...GROUNDED_DRAFT,
        sections: [GROUNDED_DRAFT.sections[0], { ...GROUNDED_DRAFT.sections[1], projectSlugs: ["moodify"] }],
      }),
      message: /Unrecognized key.*projectSlugs/,
    },
    {
      label: "model-authored project cards",
      output: JSON.stringify({
        ...GROUNDED_DRAFT,
        sections: [GROUNDED_DRAFT.sections[0], GROUNDED_SITE.sections[1]],
      }),
      message: /Unrecognized key.*projects/,
    },
    {
      label: "sections under a hero that cites nothing",
      output: JSON.stringify({ ...GROUNDED_DRAFT, hero: { ...GROUNDED_DRAFT.hero, evidenceRefIds: [] } }),
      message: /at least one Evidence Ref on the hero/,
    },
  ])("emits an error event and never persists after two outputs with $label", async ({ output, message }) => {
    streamTextMock
      .mockReturnValueOnce(modelResult(output))
      .mockReturnValueOnce(modelResult(output));

    const response = await generate(postRequest({ question: QUESTION }));
    const events = await readEvents(response);

    expect(response.status).toBe(200);
    expect(events.map((event) => event.type)).toEqual(["phase", "error"]);
    expect(events[1]).toMatchObject({ type: "error", message: expect.stringMatching(message) });
    expect(streamTextMock).toHaveBeenCalledTimes(2);
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("completes directly when preparation observes a concurrently published cache row", async () => {
    findCurrentStoryMock.mockResolvedValueOnce(null).mockResolvedValueOnce(GROUNDED_STORY);
    streamTextMock.mockReturnValueOnce(modelResult(JSON.stringify(GROUNDED_DRAFT)));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));

    expect(events.map((event) => event.type)).toEqual(["phase", "site", "phase", "complete"]);
    expect(prepareCompleteStoryMock).toHaveBeenCalledTimes(1);
  });

  it("replays a complete cache hit in the generation event order without model work", async () => {
    findCurrentStoryMock.mockResolvedValue(GROUNDED_STORY);

    const response = await generate(postRequest({ question: QUESTION }));
    const events = await readEvents(response);

    expect(response.headers.get("x-cache")).toBe("hit");
    expect(events.map((event) => event.type)).toEqual(["phase", "site", "phase", "complete"]);
    expect(events[0]).toEqual({ type: "phase", phase: "generating" });
    expect(events[1]).toEqual({ type: "site", site: GROUNDED_SITE, evidence: GROUNDED_EVIDENCE });
    expect(events[2]).toEqual({ type: "phase", phase: "validating" });
    expect(events[3]).not.toHaveProperty("story.corpusRevision");
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("replays an unexpired pending Story and re-issues its publication token without model work", async () => {
    findPreparedStoryMock.mockResolvedValue({
      story: GROUNDED_STORY,
      publicationToken: PUBLICATION_TOKEN,
    });

    const response = await generate(postRequest({ question: QUESTION }));
    const events = await readEvents(response);

    expect(response.headers.get("x-cache")).toBe("pending");
    expect(events).toEqual([
      { type: "phase", phase: "generating" },
      { type: "site", site: GROUNDED_SITE, evidence: GROUNDED_EVIDENCE },
      { type: "phase", phase: "validating" },
      { type: "phase", phase: "publishing", publicationToken: PUBLICATION_TOKEN },
    ]);
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("does no model or persistence work for a request already canceled before generation", async () => {
    const abortController = new AbortController();
    abortController.abort(new DOMException("Superseded question", "AbortError"));

    const response = await generate(postRequest({ question: QUESTION }, abortController.signal));
    const events = await readEvents(response);

    expect(events).toEqual([]);
    expect(findCurrentStoryMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("passes cancellation into preparation and emits no publishing token when disconnected", async () => {
    streamTextMock.mockReturnValueOnce(modelResult(JSON.stringify(GROUNDED_DRAFT)));
    const persistStarted = Promise.withResolvers<void>();
    const persistRelease = Promise.withResolvers<void>();
    let committed = false;
    prepareCompleteStoryMock.mockImplementation(async (input, options) => {
      persistStarted.resolve();
      await persistRelease.promise;
      options?.signal?.throwIfAborted();
      committed = true;
      return { story: storyFromInput(input), publicationToken: PUBLICATION_TOKEN };
    });

    const abortController = new AbortController();
    const response = await generate(postRequest({ question: QUESTION }, abortController.signal));
    const eventsPromise = readEvents(response);
    await persistStarted.promise;
    abortController.abort(new DOMException("Visitor disconnected", "AbortError"));
    persistRelease.resolve();
    const events = await eventsPromise;

    expect(committed).toBe(false);
    expect(prepareCompleteStoryMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(events.map((event) => event.type)).toEqual(["phase", "site", "phase"]);
  });
});

describe("POST /api/generate/publish", () => {
  it.each([
    null,
    {},
    { publicationToken: "not-a-token" },
    { publicationToken: PUBLICATION_TOKEN, extra: true },
  ])("rejects an invalid strict publication request: %j", async (body) => {
    const response = await publish(postRequest(body, undefined, "/api/generate/publish"));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "publicationToken must be a valid Story publication token",
    });
    expect(publishPreparedStoryMock).not.toHaveBeenCalled();
  });

  it("atomically publishes and returns the strict privacy-filtered complete event", async () => {
    const response = await publish(
      postRequest({ publicationToken: PUBLICATION_TOKEN }, undefined, "/api/generate/publish"),
    );
    const event = PublishStoryResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(event.story.id).toBe(PUBLIC_ID);
    expect(event.story.site).toEqual(GROUNDED_SITE);
    expect(event.story).not.toHaveProperty("corpusRevision");
    expect(event.story).not.toHaveProperty("storyContractVersion");
    expect(publishPreparedStoryMock).toHaveBeenCalledWith(
      PUBLICATION_TOKEN,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each([
    [new Error("Story publication token is not recognized"), 404, "Story publication token is not recognized"],
    [new Error("Invalid Story publication token signature"), 404, "Story publication token is not recognized"],
    [new Error("Story publication token has expired"), 410, "Story publication token has expired"],
  ])("returns a typed response for unusable tokens", async (error, status, message) => {
    publishPreparedStoryMock.mockRejectedValueOnce(error);

    const response = await publish(
      postRequest({ publicationToken: PUBLICATION_TOKEN }, undefined, "/api/generate/publish"),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: message });
  });

  it("emits no complete response when publication is aborted", async () => {
    const publishStarted = Promise.withResolvers<void>();
    const publishRelease = Promise.withResolvers<void>();
    publishPreparedStoryMock.mockImplementationOnce(async (_token, options) => {
      publishStarted.resolve();
      await publishRelease.promise;
      options?.signal?.throwIfAborted();
      throw new Error("unreachable");
    });
    const abortController = new AbortController();

    const responsePromise = publish(
      postRequest({ publicationToken: PUBLICATION_TOKEN }, abortController.signal, "/api/generate/publish"),
    );
    await publishStarted.promise;
    abortController.abort(new DOMException("Visitor disconnected", "AbortError"));
    publishRelease.resolve();
    const response = await responsePromise;

    expect(response.status).toBe(499);
    await expect(response.text()).resolves.toBe("");
  });
});

describe("POST /api/playwright-seed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hard-refuses outside explicit Playwright mode and seeds only when enabled", async () => {
    const request = () =>
      new Request("http://localhost/api/playwright-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ id: PUBLIC_ID }]),
      });

    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "");
    expect((await seedFixtures(request())).status).toBe(404);
    expect(seedStoryFixturesMock).not.toHaveBeenCalled();

    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "1");
    expect((await seedFixtures(request())).status).toBe(204);
    expect(seedStoryFixturesMock).toHaveBeenCalledWith([{ id: PUBLIC_ID }]);
  });
});

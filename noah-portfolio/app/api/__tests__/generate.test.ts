import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getModel } from "@/lib/llm/openrouter";
import {
  CORPUS_EVIDENCE_REFS,
  resolveStoryProjects,
} from "@/lib/story/evidence";
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
  type StoryPlan,
  type StoryRecord,
  type StoryStreamEvent,
  type StoryScene,
} from "@/lib/story/types";
import { assertValidStoryPlan, assertValidStoryScene } from "@/lib/story/validation";
import { POST as generate } from "@/app/api/generate/route";
import { POST as publish } from "@/app/api/generate/publish/route";
import { POST as seedFixtures } from "@/app/api/playwright-seed/route";

vi.mock("ai", () => ({ streamText: vi.fn() }));
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

const QUESTION = "What kind of work does Noah do?";
const PUBLIC_ID = "AbCdEfGhIjKlMnOpQrStUvWx";
const PUBLICATION_TOKEN = `${PUBLIC_ID}.${"A".repeat(43)}`;
const EVIDENCE = CORPUS_EVIDENCE_REFS.slice(0, 3);

const VALID_PLAN: StoryPlan = {
  question: QUESTION,
  mode: "grounded",
  backdropPreset: "ambientLava",
  scenes: [
    {
      id: "scene-1",
      index: 0,
      role: "direct-answer",
      pattern: "hero-statement",
      register: "editorial",
      title: "The direct answer",
      claim: EVIDENCE[0].excerpt,
      assetId: "circuit-mind",
      evidenceRefIds: [EVIDENCE[0].id],
      cue: { phase: "intro", focus: "center", intensity: "strong" },
    },
    {
      id: "scene-2",
      index: 1,
      role: "evidence",
      pattern: "evidence-ledger",
      register: "technical",
      title: "Evidence in practice",
      claim: `${EVIDENCE[0].excerpt} ${EVIDENCE[1].excerpt}`,
      assetId: "print-layers",
      evidenceRefIds: [EVIDENCE[0].id, EVIDENCE[1].id],
      projectSlugs: ["ask-me-portfolio", "llm-comparison"],
      cue: { phase: "develop", focus: "left", intensity: "medium" },
    },
    {
      id: "scene-3",
      index: 2,
      role: "synthesis",
      pattern: "closing-synthesis",
      register: "reflective",
      title: "The useful takeaway",
      claim: EVIDENCE[2].excerpt,
      assetId: "morning-coffee",
      evidenceRefIds: [EVIDENCE[2].id],
      projectSlugs: ["moodify"],
      cue: { phase: "resolve", focus: "right", intensity: "quiet" },
    },
  ],
  relatedQuestions: [
    "Which projects best demonstrate that approach?",
    "Which skills does Noah use most often?",
  ],
};

const ONE_SCENE_PLAN: StoryPlan = {
  ...VALID_PLAN,
  mode: "boundary",
  scenes: [{ ...VALID_PLAN.scenes[0], evidenceRefIds: [] }],
};

const FIVE_SCENE_PLAN: StoryPlan = {
  ...VALID_PLAN,
  scenes: [
    VALID_PLAN.scenes[0],
    {
      id: "scene-2",
      index: 1,
      role: "evidence",
      pattern: "project-spotlight",
      register: "technical",
      title: "Project evidence",
      claim: EVIDENCE[1].excerpt,
      assetId: "printer-forge",
      evidenceRefIds: [EVIDENCE[0].id, EVIDENCE[1].id],
      projectSlugs: ["ai-image-cutout"],
      cue: { phase: "develop", focus: "left", intensity: "medium" },
    },
    {
      id: "scene-3",
      index: 2,
      role: "evidence",
      pattern: "evidence-ledger",
      register: "diagrammatic",
      title: "Traceable evidence",
      claim: EVIDENCE[2].excerpt,
      assetId: "print-layers",
      evidenceRefIds: [EVIDENCE[2].id],
      cue: { phase: "develop", focus: "center", intensity: "strong" },
    },
    {
      id: "scene-4",
      index: 3,
      role: "evidence",
      pattern: "system-diagram",
      register: "editorial",
      title: "Connected systems",
      claim: EVIDENCE[0].excerpt,
      assetId: "data-center",
      evidenceRefIds: [EVIDENCE[0].id],
      cue: { phase: "develop", focus: "right", intensity: "medium" },
    },
    {
      ...VALID_PLAN.scenes[2],
      id: "scene-5",
      index: 4,
      assetId: "morning-coffee",
    },
  ],
};

function modelResult(text: string, beforeText?: Promise<unknown>) {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        if (beforeText) await beforeText;
        yield text;
      },
    },
  } as never;
}

function scenesForPlan(plan: StoryPlan, bodyLabel: string): StoryScene[] {
  return plan.scenes.map((scene, index) => ({
    ...scene,
    body: `${bodyLabel} ${index + 1}.`,
    ...(scene.projectSlugs
      ? { projects: resolveStoryProjects(scene.projectSlugs) }
      : {}),
  }));
}

function storyFromInput(input: NewStoryRecord): StoryRecord {
  return {
    id: PUBLIC_ID,
    displayQuestion: input.displayQuestion,
    corpusRevision: CORPUS_REVISION,
    storyContractVersion: STORY_CONTRACT_VERSION,
    createdAt: "2026-07-14T08:00:00.000Z",
    plan: input.plan,
    scenes: input.scenes,
    evidence: input.evidence,
  };
}

function postRequest(
  body: unknown,
  signal?: AbortSignal,
  path = "/api/generate",
): NextRequest {
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

async function nextEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
): Promise<StoryStreamEvent> {
  const result = await reader.read();
  if (result.done) throw new Error("Story stream ended before the expected event");
  return StoryStreamEventSchema.parse(JSON.parse(decoder.decode(result.value)));
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
  publishPreparedStoryMock.mockImplementation(async () =>
    storyFromInput({
      displayQuestion: QUESTION,
      plan: VALID_PLAN,
      scenes: scenesForPlan(VALID_PLAN, "Body"),
      evidence: EVIDENCE,
    }),
  );
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

  it("streams a validated plan first, reveals Scene 1 early, and ends with a publication token", async () => {
    const secondSceneGate = Promise.withResolvers<void>();
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(VALID_PLAN)))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "A direct grounded answer." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Evidence arrives next." }), secondSceneGate.promise))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "A grounded synthesis." })));

    const response = await generate(postRequest({ question: `  ${QUESTION}  ` }));
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(response.headers.get("x-cache")).toBe("miss");
    expect(await nextEvent(reader, decoder)).toEqual({ type: "phase", phase: "planning" });
    const planEvent = await nextEvent(reader, decoder);
    expect(planEvent).toEqual({ type: "plan", plan: VALID_PLAN, evidence: EVIDENCE });
    expect(await nextEvent(reader, decoder)).toEqual({ type: "phase", phase: "composing" });
    const firstScene = await nextEvent(reader, decoder);
    expect(firstScene.type).toBe("scene");
    if (firstScene.type === "scene") expect(firstScene.index).toBe(0);
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();

    secondSceneGate.resolve();
    const remainingText = await new Response(new ReadableStream({
      async start(controller) {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          controller.enqueue(chunk.value);
        }
        controller.close();
      },
    })).text();
    const remaining = remainingText
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => StoryStreamEventSchema.parse(JSON.parse(line)));

    expect(remaining.map((event) => event.type)).toEqual([
      "scene",
      "scene",
      "phase",
      "phase",
    ]);
    expect(remaining.filter((event) => event.type === "scene").map((event) => event.index)).toEqual([1, 2]);
    expect(remaining.filter((event) => event.type === "phase").map((event) => event.phase)).toEqual([
      "validating",
      "publishing",
    ]);

    expect(remaining.at(-1)).toEqual({
      type: "phase",
      phase: "publishing",
      publicationToken: PUBLICATION_TOKEN,
    });
    expect(remaining.some((event) => event.type === "complete")).toBe(false);

    expect(prepareCompleteStoryMock).toHaveBeenCalledTimes(1);
    const [persisted, options] = prepareCompleteStoryMock.mock.calls[0];
    expect(persisted.displayQuestion).toBe(QUESTION);
    expect(persisted.scenes).toHaveLength(3);
    assertValidStoryPlan(persisted.plan, persisted.evidence, QUESTION);
    persisted.scenes.forEach((scene, index) =>
      assertValidStoryScene(scene, persisted.plan.scenes[index], persisted.evidence),
    );
    expect(options?.signal?.aborted).toBe(false);
    expect(persisted.scenes[1].projects).toEqual(
      resolveStoryProjects(VALID_PLAN.scenes[1].projectSlugs),
    );
    expect(persisted.scenes[2].projects).toEqual(
      resolveStoryProjects(VALID_PLAN.scenes[2].projectSlugs),
    );
  });

  it("streams, composes, and prepares an uncited one-Scene Boundary Story for publication", async () => {
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(ONE_SCENE_PLAN)))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "I have not shared that information." })));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));
    const sceneEvents = events.filter((event) => event.type === "scene");

    expect(sceneEvents).toHaveLength(1);
    expect(events.find((event) => event.type === "plan")).toEqual({
      type: "plan",
      plan: ONE_SCENE_PLAN,
      evidence: [],
    });
    expect(sceneEvents[0]).toEqual({
      type: "scene",
      index: 0,
      scene: { ...ONE_SCENE_PLAN.scenes[0], body: "I have not shared that information." },
    });
    expect(prepareCompleteStoryMock.mock.calls[0][0].scenes).toHaveLength(1);
    expect(prepareCompleteStoryMock.mock.calls[0][0].evidence).toEqual([]);
    expect(events.at(-1)).toEqual({
      type: "phase",
      phase: "publishing",
      publicationToken: PUBLICATION_TOKEN,
    });
  });

  it("accepts and preserves the five-Scene upper boundary in Plan order", async () => {
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(FIVE_SCENE_PLAN)))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 1." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 2." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 3." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 4." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 5." })));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));
    const sceneEvents = events.filter((event) => event.type === "scene");

    expect(sceneEvents.map((event) => event.index)).toEqual([0, 1, 2, 3, 4]);
    expect(sceneEvents.map((event) => event.scene.id)).toEqual([
      "scene-1",
      "scene-2",
      "scene-3",
      "scene-4",
      "scene-5",
    ]);
    expect(prepareCompleteStoryMock.mock.calls[0][0].scenes).toHaveLength(5);
    expect(events.at(-1)).toEqual({
      type: "phase",
      phase: "publishing",
      publicationToken: PUBLICATION_TOKEN,
    });
  });

  it("bounds Scene repair and uses the deterministic locked-claim fallback", async () => {
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(VALID_PLAN)))
      .mockReturnValueOnce(modelResult('{"body":"","claim":"changed"}'))
      .mockReturnValueOnce(modelResult("not json"))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Grounded middle evidence." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Grounded closing synthesis." })));

    const response = await generate(postRequest({ question: QUESTION }));
    const events = await readEvents(response);
    const scenes = events.filter((event) => event.type === "scene").map((event) => event.scene);

    expect(streamTextMock).toHaveBeenCalledTimes(5);
    expect(scenes).toHaveLength(3);
    expect(scenes[0]).toEqual({ ...VALID_PLAN.scenes[0], body: VALID_PLAN.scenes[0].claim });
    expect(scenes[0].claim).toBe(VALID_PLAN.scenes[0].claim);
    expect(scenes[0].assetId).toBe(VALID_PLAN.scenes[0].assetId);
    expect(scenes[0].evidenceRefIds).toEqual(VALID_PLAN.scenes[0].evidenceRefIds);

    const repairCall = streamTextMock.mock.calls[2][0];
    expect(JSON.stringify(repairCall.messages)).toMatch(/locked Scene Plan and Evidence Refs remain unchanged/i);
    expect(events.at(-1)).toEqual({
      type: "phase",
      phase: "publishing",
      publicationToken: PUBLICATION_TOKEN,
    });
  });

  it("emits a typed error event after bounded invalid planning and never persists", async () => {
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify({ ...VALID_PLAN, scenes: [] })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ ...VALID_PLAN, scenes: [{ assetId: "remote-url" }] })));

    const response = await generate(postRequest({ question: QUESTION }));
    const events = await readEvents(response);

    expect(response.status).toBe(200);
    expect(events[0]).toEqual({ type: "phase", phase: "planning" });
    expect(events[1]?.type).toBe("error");
    if (events[1]?.type === "error") expect(events[1].message.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "plan")).toBe(false);
    expect(events.some((event) => event.type === "complete")).toBe(false);
    expect(streamTextMock).toHaveBeenCalledTimes(2);
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("rejects an invented project slug through the typed planning error event", async () => {
    const invented = structuredClone(VALID_PLAN);
    invented.scenes[1].projectSlugs = ["invented-project" as never];
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(invented)))
      .mockReturnValueOnce(modelResult(JSON.stringify(invented)));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));

    expect(events.map((event) => event.type)).toEqual(["phase", "error"]);
    expect(events[1]).toMatchObject({
      type: "error",
      message: "Unknown Corpus project slug: invented-project",
    });
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("rejects an otherwise valid Plan bound to a different question", async () => {
    const wrongQuestionPlan = {
      ...VALID_PLAN,
      question: "What unrelated work does Noah do?",
    };
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(wrongQuestionPlan)))
      .mockReturnValueOnce(modelResult(JSON.stringify(wrongQuestionPlan)));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));

    expect(events.map((event) => event.type)).toEqual(["phase", "error"]);
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("completes directly when preparation observes a concurrently published cache row", async () => {
    const scenes = scenesForPlan(VALID_PLAN, "Body");
    const published = storyFromInput({
      displayQuestion: QUESTION,
      plan: VALID_PLAN,
      scenes,
      evidence: EVIDENCE,
    });
    findCurrentStoryMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(published);
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(VALID_PLAN)))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 1." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 2." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Body 3." })));

    const events = await readEvents(await generate(postRequest({ question: QUESTION })));

    expect(events.at(-1)?.type).toBe("complete");
    expect(events.some((event) => event.type === "phase" && event.phase === "publishing")).toBe(false);
    expect(prepareCompleteStoryMock).toHaveBeenCalledTimes(1);
  });

  it("replays a complete cache hit through the same typed lifecycle without model work", async () => {
    const scenes = scenesForPlan(VALID_PLAN, "Cached body");
    const cached = storyFromInput({
      displayQuestion: QUESTION,
      plan: VALID_PLAN,
      scenes,
      evidence: EVIDENCE,
    });
    findCurrentStoryMock.mockResolvedValue(cached);

    const response = await generate(postRequest({ question: QUESTION }));
    const events = await readEvents(response);

    expect(response.headers.get("x-cache")).toBe("hit");
    expect(events.map((event) => event.type)).toEqual([
      "phase",
      "plan",
      "phase",
      "scene",
      "scene",
      "scene",
      "phase",
      "complete",
    ]);
    expect(events.filter((event) => event.type === "phase").map((event) => event.phase)).toEqual([
      "planning",
      "composing",
      "validating",
    ]);
    const complete = events.at(-1);
    if (complete?.type === "complete") expect(complete.story).not.toHaveProperty("questionDigest");
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(events.filter((event) => event.type === "scene").map((event) => event.scene.projects)).toEqual(
      scenes.map((scene) => scene.projects),
    );
    expect(prepareCompleteStoryMock).not.toHaveBeenCalled();
  });

  it("replays an unexpired pending Story and re-issues its publication token without model work", async () => {
    const scenes = scenesForPlan(VALID_PLAN, "Pending body");
    const pending = storyFromInput({
      displayQuestion: QUESTION,
      plan: VALID_PLAN,
      scenes,
      evidence: EVIDENCE,
    });
    findPreparedStoryMock.mockResolvedValue({
      story: pending,
      publicationToken: PUBLICATION_TOKEN,
    });

    const response = await generate(postRequest({ question: QUESTION }));
    const events = await readEvents(response);

    expect(response.headers.get("x-cache")).toBe("pending");
    expect(events.map((event) => event.type)).toEqual([
      "phase",
      "plan",
      "phase",
      "scene",
      "scene",
      "scene",
      "phase",
      "phase",
    ]);
    expect(events.at(-1)).toEqual({
      type: "phase",
      phase: "publishing",
      publicationToken: PUBLICATION_TOKEN,
    });
    const streamedScenes = events.filter((event) => event.type === "scene");
    expect(streamedScenes.map((event) => event.index)).toEqual([0, 1, 2]);
    expect(streamedScenes.map((event) => event.scene.body)).toEqual(
      scenes.map((scene) => scene.body),
    );
    expect(events.some((event) => event.type === "complete")).toBe(false);
    expect(streamedScenes.map((event) => event.scene.projects)).toEqual(
      scenes.map((scene) => scene.projects),
    );
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
    streamTextMock
      .mockReturnValueOnce(modelResult(JSON.stringify(VALID_PLAN)))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Direct." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Evidence." })))
      .mockReturnValueOnce(modelResult(JSON.stringify({ body: "Synthesis." })));

    const persistStarted = Promise.withResolvers<void>();
    const persistRelease = Promise.withResolvers<void>();
    let committed = false;
    prepareCompleteStoryMock.mockImplementation(async (input, options) => {
      persistStarted.resolve();
      await persistRelease.promise;
      options?.signal?.throwIfAborted();
      committed = true;
      return {
        story: storyFromInput(input),
        publicationToken: PUBLICATION_TOKEN,
      };
    });

    const abortController = new AbortController();
    const response = await generate(postRequest({ question: QUESTION }, abortController.signal));
    const eventsPromise = readEvents(response);
    await persistStarted.promise;
    abortController.abort(new DOMException("Visitor disconnected", "AbortError"));
    persistRelease.resolve();
    const events = await eventsPromise;

    expect(committed).toBe(false);
    expect(prepareCompleteStoryMock).toHaveBeenCalledTimes(1);
    expect(prepareCompleteStoryMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(events.some((event) => event.type === "complete")).toBe(false);
    expect(events.filter((event) => event.type === "scene")).toHaveLength(3);
    expect(events.some((event) => event.type === "phase" && event.phase === "publishing")).toBe(false);
  });
});

describe("POST /api/generate/publish", () => {
  it.each([
    null,
    {},
    { publicationToken: "not-a-token" },
    { publicationToken: PUBLICATION_TOKEN, extra: true },
  ])("rejects an invalid strict publication request: %j", async (body) => {
    const response = await publish(
      postRequest(body, undefined, "/api/generate/publish"),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: "publicationToken must be a valid Story publication token",
    });
    expect(publishPreparedStoryMock).not.toHaveBeenCalled();
  });

  it("atomically publishes and returns the strict privacy-filtered complete event", async () => {
    const response = await publish(
      postRequest(
        { publicationToken: PUBLICATION_TOKEN },
        undefined,
        "/api/generate/publish",
      ),
    );
    const event = PublishStoryResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(event.type).toBe("complete");
    expect(event.story.id).toBe(PUBLIC_ID);
    expect(event.story.displayQuestion).toBe(QUESTION);
    expect(event.story).not.toHaveProperty("questionDigest");
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
      postRequest(
        { publicationToken: PUBLICATION_TOKEN },
        undefined,
        "/api/generate/publish",
      ),
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
      postRequest(
        { publicationToken: PUBLICATION_TOKEN },
        abortController.signal,
        "/api/generate/publish",
      ),
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
    const request = () => new Request(
      "http://localhost/api/playwright-seed",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ id: PUBLIC_ID }]),
      },
    );

    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "");
    expect((await seedFixtures(request())).status).toBe(404);
    expect(seedStoryFixturesMock).not.toHaveBeenCalled();

    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "1");
    expect((await seedFixtures(request())).status).toBe(204);
    expect(seedStoryFixturesMock).toHaveBeenCalledWith([{ id: PUBLIC_ID }]);
  });
});

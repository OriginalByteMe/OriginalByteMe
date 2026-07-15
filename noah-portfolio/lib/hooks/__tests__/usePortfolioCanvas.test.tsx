import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_BACKDROP_PRESET } from "@/lib/backdrop/presets";
import { homeSpec } from "@/lib/jsonui/homeSpec";
import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";
import { MAX_STORY_QUESTION_LENGTH } from "@/lib/story/types";
import type {
  PublicStory,
  StoryPlan,
  StoryScene,
  StoryStreamEvent,
} from "@/lib/story/types";
import { makeStore, type AppStore } from "@/lib/store";
import { usePortfolioCanvas } from "@/lib/hooks/usePortfolioCanvas";

const EVIDENCE = [CORPUS_EVIDENCE_REFS[0], CORPUS_EVIDENCE_REFS[1]];
const FIRST_STORY_ID = "AbCdEfGhIjKlMnOpQrStUvWx";
const SECOND_STORY_ID = "ZyXwVuTsRqPoNmLkJiHgFeDc";
const FIRST_PUBLICATION_TOKEN = `${FIRST_STORY_ID}.${"A".repeat(43)}`;
const SECOND_PUBLICATION_TOKEN = `${SECOND_STORY_ID}.${"B".repeat(43)}`;

function makePlan(question = "What has Noah built?"): StoryPlan {
  return {
    question,
    backdropPreset: "ditherIndigo",
    relatedQuestions: [
      "Which systems has Noah designed?",
      "How does Noah validate delivery work?",
    ],
    scenes: [
      {
        id: "direct-answer",
        index: 0,
        role: "direct-answer",
        pattern: "hero-statement",
        register: "editorial",
        title: "A systems-minded builder",
        claim: "Noah builds dependable products and the systems behind them.",
        assetId: "circuit-mind",
        evidenceRefIds: [EVIDENCE[0].id],
        cue: { phase: "intro", focus: "center", intensity: "quiet" },
      },
      {
        id: "grounded-evidence",
        index: 1,
        role: "evidence",
        pattern: "evidence-ledger",
        register: "technical",
        title: "Grounded in delivery",
        claim: "His work connects technical decisions to visible outcomes.",
        assetId: "print-layers",
        evidenceRefIds: EVIDENCE.map((reference) => reference.id),
        cue: { phase: "develop", focus: "left", intensity: "strong" },
      },
      {
        id: "useful-synthesis",
        index: 2,
        role: "synthesis",
        pattern: "closing-synthesis",
        register: "reflective",
        title: "Craft with operational depth",
        claim: "The through-line is thoughtful craft that survives production.",
        assetId: "morning-coffee",
        evidenceRefIds: [EVIDENCE[1].id],
        cue: { phase: "resolve", focus: "right", intensity: "medium" },
      },
    ],
  };
}

function makeScenes(plan: StoryPlan): StoryScene[] {
  return plan.scenes.map((scene, index) => ({
    ...scene,
    body: [
      "The semantic explanation arrives in ordinary text, independent of motion.",
      index === 1 ? "Both references remain visible beside this claim." : "The Story stays concise and grounded.",
    ].join(" "),
  }));
}

function makeStory(
  displayQuestion: string,
  id = FIRST_STORY_ID,
  plan = makePlan(displayQuestion),
): PublicStory {
  return {
    id,
    displayQuestion,
    createdAt: "2026-07-14T08:00:00.000Z",
    plan,
    scenes: makeScenes(plan),
    evidence: [...EVIDENCE],
  };
}

function storyDraftEvents(
  story: PublicStory,
  publicationToken = FIRST_PUBLICATION_TOKEN,
): StoryStreamEvent[] {
  return [
    { type: "phase", phase: "planning" },
    { type: "plan", plan: story.plan, evidence: story.evidence },
    { type: "phase", phase: "composing" },
    ...story.scenes.map(
      (scene): StoryStreamEvent => ({ type: "scene", index: scene.index, scene }),
    ),
    { type: "phase", phase: "validating" },
    { type: "phase", phase: "publishing", publicationToken },
  ];
}

function storyCacheEvents(story: PublicStory): StoryStreamEvent[] {
  return [
    { type: "phase", phase: "planning" },
    { type: "plan", plan: story.plan, evidence: story.evidence },
    { type: "phase", phase: "composing" },
    ...story.scenes.map(
      (scene): StoryStreamEvent => ({ type: "scene", index: scene.index, scene }),
    ),
    { type: "phase", phase: "validating" },
    { type: "complete", story },
  ];
}

function publicationResponse(story: PublicStory, payload: unknown = { type: "complete", story }) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function wrapperFor(store: AppStore) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }
  Wrapper.displayName = "PortfolioCanvasTestProvider";
  return Wrapper;
}

function controlledStoryResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(nextController) {
        controller = nextController;
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );

  return {
    response,
    push(event: unknown) {
      if (!controller) throw new Error("Stream controller is unavailable");
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    },
    pushRaw(line: string) {
      if (!controller) throw new Error("Stream controller is unavailable");
      controller.enqueue(encoder.encode(line));
    },
    close() {
      if (!controller) throw new Error("Stream controller is unavailable");
      controller.close();
      controller = null;
    },
  };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("usePortfolioCanvas", () => {
  it("shows real phases, reveals Scene one immediately, appends in order, and publishes an opaque URL", async () => {
    const stream = controlledStoryResponse();
    const completed = makeStory("What has Noah built?");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(stream.response)
      .mockResolvedValueOnce(publicationResponse(completed));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });

    let askPromise!: Promise<void>;
    act(() => {
      askPromise = result.current.ask("  What has Noah built?  ");
    });
    await waitFor(() => expect(result.current.mode).toBe("streaming"));
    expect(result.current.spec).toBe(homeSpec);
    expect(result.current.story).toBeNull();
    expect(window.location.search).toBe("");

    act(() => stream.push({ type: "phase", phase: "planning" }));
    await waitFor(() => expect(result.current.phase).toBe("planning"));

    act(() => stream.push({ type: "plan", plan: completed.plan, evidence: completed.evidence }));
    await waitFor(() => expect(result.current.plan).toEqual(completed.plan));
    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);

    act(() => stream.push({ type: "phase", phase: "composing" }));
    act(() =>
      stream.push({ type: "scene", index: 0, scene: completed.scenes[0] }),
    );
    await waitFor(() => expect(result.current.scenes).toEqual([completed.scenes[0]]));
    expect(result.current.phase).toBe("composing");
    expect(result.current.story).toBeNull();
    expect(window.location.pathname).toBe("/");

    act(() =>
      stream.push({ type: "scene", index: 1, scene: completed.scenes[1] }),
    );
    await waitFor(() => expect(result.current.scenes).toHaveLength(2));
    act(() =>
      stream.push({ type: "scene", index: 2, scene: completed.scenes[2] }),
    );
    await waitFor(() => expect(result.current.scenes).toHaveLength(3));

    await act(async () => {
      stream.push({ type: "phase", phase: "validating" });
      stream.push({
        type: "phase",
        phase: "publishing",
        publicationToken: FIRST_PUBLICATION_TOKEN,
      });
      stream.close();
      await askPromise;
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.story).toEqual(completed);
    expect(result.current.phase).toBe("publishing");
    expect(window.location.pathname).toBe(`/ask/${FIRST_STORY_ID}`);
    expect(window.location.search).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/generate/publish",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ publicationToken: FIRST_PUBLICATION_TOKEN }),
        signal: (fetchMock.mock.calls[0][1] as RequestInit).signal,
      }),
    ]);
  });

  it("strictly rejects malformed, unknown, and out-of-order NDJSON events", async () => {
    const malformed = controlledStoryResponse();
    const unknown = controlledStoryResponse();
    const outOfOrder = controlledStoryResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(malformed.response)
        .mockResolvedValueOnce(unknown.response)
        .mockResolvedValueOnce(outOfOrder.response),
    );
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("Malformed stream");
    });
    await act(async () => {
      malformed.pushRaw('{"type":"phase","phase":');
      malformed.close();
      await pending;
    });
    expect(result.current.mode).toBe("error");
    expect(result.current.error).toMatch(/malformed JSON/i);
    expect(result.current.story).toBeNull();

    act(() => {
      pending = result.current.ask("Unknown field");
    });
    await act(async () => {
      unknown.push({ type: "phase", phase: "planning", internal: "not public" });
      unknown.close();
      await pending;
    });
    expect(result.current.error).toMatch(/invalid event/i);

    const completed = makeStory("Out of order");
    act(() => {
      pending = result.current.ask("Out of order");
    });
    await act(async () => {
      outOfOrder.push({ type: "phase", phase: "planning" });
      outOfOrder.push({ type: "plan", plan: completed.plan, evidence: completed.evidence });
      outOfOrder.push({ type: "phase", phase: "composing" });
      outOfOrder.push({ type: "scene", index: 1, scene: completed.scenes[1] });
      outOfOrder.close();
      await pending;
    });
    expect(result.current.error).toMatch(/out of order/i);
    expect(result.current.scenes).toHaveLength(0);
    expect(result.current.story).toBeNull();
  });

  it("rejects a valid Plan locked to a different question", async () => {
    const stream = controlledStoryResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stream.response));
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });
    const wrongStory = makeStory("What did Noah ship?");

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("How does Noah work?");
    });
    await act(async () => {
      stream.push({ type: "phase", phase: "planning" });
      stream.push({
        type: "plan",
        plan: wrongStory.plan,
        evidence: wrongStory.evidence,
      });
      stream.close();
      await pending;
    });

    expect(result.current.mode).toBe("error");
    expect(result.current.error).toMatch(/question differs from the expected display question/i);
    expect(result.current.plan).toBeNull();
    expect(result.current.story).toBeNull();
  });

  it("aborts publication and prevents its stale acknowledgement from winning", async () => {
    const firstStream = controlledStoryResponse();
    const secondStream = controlledStoryResponse();
    let resolveFirstPublish!: (response: Response) => void;
    const firstPublish = new Promise<Response>((resolve) => {
      resolveFirstPublish = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(firstStream.response)
      .mockImplementationOnce(() => firstPublish)
      .mockResolvedValueOnce(secondStream.response);
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });
    const firstStory = makeStory("First question", FIRST_STORY_ID);
    const secondStory = makeStory("Second question", SECOND_STORY_ID);

    let firstAsk!: Promise<void>;
    let secondAsk!: Promise<void>;
    act(() => {
      firstAsk = result.current.ask("First question");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      for (const event of storyDraftEvents(firstStory)) firstStream.push(event);
      firstStream.close();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.mode).toBe("streaming");
    expect(result.current.phase).toBe("publishing");
    expect(result.current.scenes).toEqual(firstStory.scenes);
    expect(result.current.story).toBeNull();

    act(() => {
      secondAsk = result.current.ask("Second question");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toHaveProperty("aborted", true);
    expect((fetchMock.mock.calls[1][1] as RequestInit).signal).toHaveProperty("aborted", true);

    await act(async () => {
      for (const event of storyCacheEvents(secondStory)) secondStream.push(event);
      secondStream.close();
      resolveFirstPublish(publicationResponse(firstStory));
      await Promise.all([firstAsk, secondAsk]);
    });

    expect(result.current.story).toEqual(secondStory);
    expect(result.current.question).toBe("Second question");
    expect(window.location.pathname).toBe(`/ask/${SECOND_STORY_ID}`);
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/generate/publish"),
    ).toHaveLength(1);
  });

  it("adopts the canonical same-question publish winner after an aborted retry", async () => {
    const abandonedStream = controlledStoryResponse();
    const retryStream = controlledStoryResponse();
    const canonicalStory = makeStory("Concurrent question", FIRST_STORY_ID);
    const retryDraft = makeStory("Concurrent question", SECOND_STORY_ID);
    retryDraft.plan.backdropPreset = "nightMatte";
    retryDraft.plan.scenes[0].title = "A newly composed concurrent answer";
    retryDraft.scenes[0].title = retryDraft.plan.scenes[0].title;
    let resolveAbandonedPublish!: (response: Response) => void;
    const abandonedPublish = new Promise<Response>((resolve) => {
      resolveAbandonedPublish = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(abandonedStream.response)
      .mockImplementationOnce(() => abandonedPublish)
      .mockResolvedValueOnce(retryStream.response)
      .mockResolvedValueOnce(publicationResponse(canonicalStory));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    let abandonedAsk!: Promise<void>;
    let retryAsk!: Promise<void>;
    act(() => {
      abandonedAsk = result.current.ask("Concurrent question");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      for (const event of storyDraftEvents(canonicalStory)) abandonedStream.push(event);
      abandonedStream.close();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    act(() => {
      retryAsk = result.current.ask("Concurrent question");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await act(async () => {
      for (const event of storyDraftEvents(retryDraft, SECOND_PUBLICATION_TOKEN)) {
        retryStream.push(event);
      }
      retryStream.close();
      await retryAsk;
      resolveAbandonedPublish(publicationResponse(canonicalStory));
      await abandonedAsk;
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.story).toEqual(canonicalStory);
    expect(result.current.scenes).toEqual(canonicalStory.scenes);
    expect(result.current.scenes).not.toEqual(retryDraft.scenes);
    expect(window.location.pathname).toBe(`/ask/${FIRST_STORY_ID}`);
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/generate/publish"),
    ).toHaveLength(2);
    expect(fetchMock.mock.calls[3]).toEqual([
      "/api/generate/publish",
      expect.objectContaining({
        body: JSON.stringify({ publicationToken: SECOND_PUBLICATION_TOKEN }),
      }),
    ]);
  });

  it("starts from a current public Story and restores it with scroll on Related history Back", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 321 });
    const scrollTo = vi.mocked(window.scrollTo);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const nextStream = controlledStoryResponse();
    const initial = makeStory("Initial Story", FIRST_STORY_ID);
    const related = makeStory("Related Story", SECOND_STORY_ID);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(nextStream.response)
      .mockResolvedValueOnce(publicationResponse(related));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", `/ask/${FIRST_STORY_ID}`);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(initial), {
      wrapper: wrapperFor(store),
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.story).toEqual(initial);
    await waitFor(() =>
      expect(window.history.state.__noahPortfolioStory).toEqual({
        id: FIRST_STORY_ID,
        scrollY: 321,
      }),
    );

    let askPromise!: Promise<void>;
    act(() => {
      askPromise = result.current.ask("Related Story", { history: "push" });
    });
    const previousState = window.history.state;
    await act(async () => {
      for (const event of storyDraftEvents(related, SECOND_PUBLICATION_TOKEN)) {
        nextStream.push(event);
      }
      nextStream.close();
      await askPromise;
    });

    expect(result.current.story).toEqual(related);
    expect(window.location.pathname).toBe(`/ask/${SECOND_STORY_ID}`);
    expect(window.history.state.__noahPortfolioStory.id).toBe(SECOND_STORY_ID);

    scrollTo.mockClear();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: previousState }));
    });

    expect(result.current.story).toEqual(initial);
    expect(result.current.question).toBe("Initial Story");
    expect(scrollTo).toHaveBeenCalledWith({ top: 321, left: 0, behavior: "auto" });
    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);
  });

  it("accepts a cache-hit Story whose question differs only by canonical normalization", async () => {
    const stream = controlledStoryResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stream.response));
    const store = makeStore();
    const equivalent = makeStory("WHAT   has Noah built?");
    equivalent.plan.question = "what has noah built?";
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("What has Noah built?");
    });
    await act(async () => {
      for (const event of storyCacheEvents(equivalent)) stream.push(event);
      stream.close();
      await pending;
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.story).toEqual(equivalent);
    expect(window.location.pathname).toBe(`/ask/${FIRST_STORY_ID}`);
  });

  it("rejects duplicate or skipped lifecycle phases", async () => {
    const duplicate = controlledStoryResponse();
    const skipped = controlledStoryResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(duplicate.response).mockResolvedValueOnce(skipped.response),
    );
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("Duplicate phase");
    });
    await act(async () => {
      duplicate.push({ type: "phase", phase: "planning" });
      duplicate.push({ type: "phase", phase: "planning" });
      duplicate.close();
      await pending;
    });
    expect(result.current.error).toMatch(/lifecycle phases out of order/i);

    act(() => {
      pending = result.current.ask("Skipped phase");
    });
    await act(async () => {
      skipped.push({ type: "phase", phase: "planning" });
      skipped.push({ type: "phase", phase: "validating" });
      skipped.close();
      await pending;
    });
    expect(result.current.error).toMatch(/lifecycle phases out of order/i);
  });

  it("keeps the complete draft visible but unpublished when publication is invalid", async () => {
    const stream = controlledStoryResponse();
    const draft = makeStory("Invalid publication");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(stream.response)
      .mockResolvedValueOnce(publicationResponse(draft, { type: "complete", story: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("Invalid publication");
    });
    await act(async () => {
      for (const event of storyDraftEvents(draft)) stream.push(event);
      stream.close();
      await pending;
    });

    expect(result.current.mode).toBe("error");
    expect(result.current.scenes).toEqual(draft.scenes);
    expect(result.current.story).toBeNull();
    expect(result.current.error).toMatch(/publication response was invalid/i);
    expect(window.location.pathname).toBe("/");
  });

  it("accepts a validated cache replay without calling publication", async () => {
    const stream = controlledStoryResponse();
    const cached = makeStory("Cached Story");
    const fetchMock = vi.fn().mockResolvedValueOnce(stream.response);
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("Cached Story");
    });
    await act(async () => {
      for (const event of storyCacheEvents(cached)) stream.push(event);
      stream.close();
      await pending;
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.story).toEqual(cached);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({ body: JSON.stringify({ question: "Cached Story" }) }),
    );
  });

  it("rejects a complete-only cache response that bypasses validated lifecycle events", async () => {
    const stream = controlledStoryResponse();
    const cached = makeStory("Bypassed Cache");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(stream.response));
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("Bypassed Cache");
    });
    await act(async () => {
      stream.push({ type: "complete", story: cached });
      stream.close();
      await pending;
    });

    expect(result.current.mode).toBe("error");
    expect(result.current.story).toBeNull();
    expect(result.current.error).toMatch(/bypassed its validated lifecycle/i);
    expect(window.location.pathname).toBe("/");
  });

  it("rejects structurally typed Plans that violate shared semantic validation", async () => {
    const duplicateEvidenceStream = controlledStoryResponse();
    const decorativeAssetStream = controlledStoryResponse();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(duplicateEvidenceStream.response)
        .mockResolvedValueOnce(decorativeAssetStream.response),
    );
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    const duplicateEvidence = makeStory("Duplicate evidence");
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("Duplicate evidence");
    });
    await act(async () => {
      duplicateEvidenceStream.push({ type: "phase", phase: "planning" });
      duplicateEvidenceStream.push({
        type: "plan",
        plan: duplicateEvidence.plan,
        evidence: [duplicateEvidence.evidence[0], duplicateEvidence.evidence[0]],
      });
      duplicateEvidenceStream.close();
      await pending;
    });
    expect(result.current.error).toMatch(/duplicate ID/i);
    expect(result.current.plan).toBeNull();

    const decorativeAsset = makeStory("Decorative asset");
    decorativeAsset.plan.scenes[2].assetId = "spark-loader";
    act(() => {
      pending = result.current.ask("Decorative asset");
    });
    await act(async () => {
      decorativeAssetStream.push({ type: "phase", phase: "planning" });
      decorativeAssetStream.push({
        type: "plan",
        plan: decorativeAsset.plan,
        evidence: decorativeAsset.evidence,
      });
      decorativeAssetStream.close();
      await pending;
    });
    expect(result.current.error).toMatch(/meaningful generator-eligible/i);
    expect(result.current.plan).toBeNull();
  });

  it("snapshots a home-origin Story before Home so Back restores its scroll", async () => {
    const stream = controlledStoryResponse();
    const completed = makeStory("Home history Story");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(stream.response)
        .mockResolvedValueOnce(publicationResponse(completed)),
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.ask("Home history Story");
    });
    await act(async () => {
      for (const event of storyDraftEvents(completed)) stream.push(event);
      stream.close();
      await pending;
    });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 456 });
    vi.mocked(window.scrollTo).mockClear();

    act(() => result.current.goHome());
    expect(result.current.mode).toBe("home");
    expect(window.location.pathname).toBe("/");
    expect(window.history.state.__noahPortfolioStory).toBeNull();

    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe(`/ask/${FIRST_STORY_ID}`));
    await waitFor(() => expect(result.current.story).toEqual(completed));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 456, left: 0, behavior: "auto" });
  });

  it("rejects questions beyond the canonical bound before starting a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    await act(async () => {
      await result.current.ask("q".repeat(MAX_STORY_QUESTION_LENGTH + 1));
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("home");
    expect(result.current.question).toBe("");
  });

  it("keeps incomplete Stories unpublished and returns home without a legacy query", async () => {
    const stream = controlledStoryResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stream.response));
    const store = makeStore({ backdrop: { preset: "nightMatte" } });
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });
    const partial = makeStory("Partial Story");

    let askPromise!: Promise<void>;
    act(() => {
      askPromise = result.current.ask("Partial Story");
    });
    await act(async () => {
      stream.push({ type: "phase", phase: "planning" });
      stream.push({ type: "plan", plan: partial.plan, evidence: partial.evidence });
      stream.push({ type: "phase", phase: "composing" });
      stream.push({ type: "scene", index: 0, scene: partial.scenes[0] });
      stream.close();
      await askPromise;
    });

    expect(result.current.mode).toBe("error");
    expect(result.current.scenes).toHaveLength(1);
    expect(result.current.story).toBeNull();
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");

    act(() => result.current.reset());
    expect(result.current.mode).toBe("home");
    expect(result.current.spec).toBe(homeSpec);
    expect(result.current.plan).toBeNull();
    expect(store.getState().backdrop.preset).toBe("nightMatte");
    expect(window.location.pathname).toBe("/");
  });
});

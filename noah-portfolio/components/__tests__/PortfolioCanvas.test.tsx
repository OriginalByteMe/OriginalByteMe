import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskMeProvider, useAskMe } from "@/components/AskMeProvider";
import { JsonUiProvider } from "@/components/JsonUiProvider";
import PortfolioCanvas from "@/components/PortfolioCanvas";
// Static import warms the module `next/dynamic` resolves lazily, so the home
// canvas renders deterministically even under full-suite transform contention.
import "@/components/HomePortfolioCanvas";
import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";
import type { PublicStory, StoryPlan, StoryStreamEvent } from "@/lib/story/types";
import { makeStore } from "@/lib/store";

vi.mock("@/components/ui/spotify-reveal", () => ({
  default: () => <div>Spotify</div>,
}));

vi.mock("@/components/story/MotionAsset", () => ({
  MotionAsset: ({ assetId }: { assetId: string }) => (
    <div data-testid="motion-asset" data-asset-id={assetId}>
      {assetId}
    </div>
  ),
}));

vi.mock("@/components/story/SceneTransition", () => ({
  SceneTransition: () => <div data-testid="scene-transition" />,
}));

const evidence = [CORPUS_EVIDENCE_REFS[0], CORPUS_EVIDENCE_REFS[1]];
const FIRST_STORY_ID = "AbCdEfGhIjKlMnOpQrStUvWx";
const SECOND_STORY_ID = "ZyXwVuTsRqPoNmLkJiHgFeDc";
const FIRST_PUBLICATION_TOKEN = `${FIRST_STORY_ID}.${"A".repeat(43)}`;
const SECOND_PUBLICATION_TOKEN = `${SECOND_STORY_ID}.${"B".repeat(43)}`;

function makePlan(question: string): StoryPlan {
  return {
    question,
    mode: "grounded",
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
        title: "A direct systems answer",
        claim: "Noah joins product craft with dependable operation.",
        assetId: "circuit-mind",
        evidenceRefIds: [evidence[0].id],
        cue: { phase: "intro", focus: "center", intensity: "quiet" },
      },
      {
        id: "grounded-evidence",
        index: 1,
        role: "evidence",
        pattern: "evidence-ledger",
        register: "technical",
        title: "Evidence remains visible",
        claim: "The technical narrative stays tied to concrete references.",
        assetId: "print-layers",
        evidenceRefIds: evidence.map((reference) => reference.id),
        cue: { phase: "develop", focus: "left", intensity: "strong" },
      },
      {
        id: "closing-synthesis",
        index: 2,
        role: "synthesis",
        pattern: "closing-synthesis",
        register: "reflective",
        title: "Useful beyond launch",
        claim: "The result is software that keeps working after release.",
        assetId: "morning-coffee",
        evidenceRefIds: [evidence[1].id],
        cue: { phase: "resolve", focus: "right", intensity: "medium" },
      },
    ],
  };
}

function makeStory(question: string, id: string): PublicStory {
  const plan = makePlan(question);
  return {
    id,
    displayQuestion: question,
    createdAt: "2026-07-14T08:00:00.000Z",
    plan,
    scenes: plan.scenes.map((scene) => ({
      ...scene,
      body: "The complete answer remains available as semantic copy without relying on motion.",
    })),
    evidence,
  };
}

function draftEvents(
  story: PublicStory,
  publicationToken: string,
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

function publicationResponse(story: PublicStory) {
  return new Response(JSON.stringify({ type: "complete", story }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function AskControls() {
  const { ask, mode, scenes } = useAskMe();
  return (
    <>
      <button type="button" onClick={() => void ask("What has Noah built?")}>
        Ask first
      </button>
      <output data-testid="canvas-mode">{mode}</output>
      <output data-testid="scene-count">{scenes.length}</output>
    </>
  );
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
    push(event: StoryStreamEvent) {
      if (!controller) throw new Error("Stream controller is unavailable");
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
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
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PortfolioCanvas Story integration", () => {
  it("keeps home on json-render and cuts generated answers over to progressive typed Stories", async () => {
    const firstStream = controlledStoryResponse();
    const relatedStream = controlledStoryResponse();
    const firstStory = makeStory("What has Noah built?", FIRST_STORY_ID);
    const relatedStory = makeStory(firstStory.plan.relatedQuestions[0], SECOND_STORY_ID);
    const generationResponses = [firstStream.response, relatedStream.response];
    const publicationResponses = [
      publicationResponse(firstStory),
      publicationResponse(relatedStory),
    ];
    let generationIndex = 0;
    let publicationIndex = 0;
    const fetchMock = vi.fn((input: string | URL | Request) => {
      if (input === "/api/generate") {
        const response = generationResponses[generationIndex++];
        if (!response) throw new Error("Unexpected generation request");
        return Promise.resolve(response);
      }
      if (input === "/api/generate/publish") {
        const response = publicationResponses[publicationIndex++];
        if (!response) throw new Error("Unexpected publication request");
        return Promise.resolve(response);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <Provider store={makeStore()}>
        <JsonUiProvider initialState={{}}>
          <AskMeProvider>
            <AskControls />
            <PortfolioCanvas />
          </AskMeProvider>
        </JsonUiProvider>
      </Provider>,
    );

    expect(await screen.findByText("Noah, in brief")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask first" }));

    expect(await screen.findByRole("heading", { name: "Preparing your Story" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share this Story" })).not.toBeInTheDocument();
    expect(window.location.search).toBe("");

    const firstEvents = draftEvents(firstStory, FIRST_PUBLICATION_TOKEN);
    act(() => firstStream.push(firstEvents[0]));
    await waitFor(() =>
      expect(screen.getByText("Planning the Story")).toBeInTheDocument(),
    );
    act(() => firstStream.push(firstEvents[1]));
    act(() => firstStream.push(firstEvents[2]));
    act(() => firstStream.push(firstEvents[3]));

    expect(await screen.findByRole("heading", { name: firstStory.scenes[0].title })).toBeInTheDocument();
    expect(screen.queryByText("Preparing your Story")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-count")).toHaveTextContent("1");
    expect(screen.getByText("Composing Scene 2 of 3")).toBeInTheDocument();
    expect(document.querySelectorAll("section[data-story-scene]")).toHaveLength(1);
    expect(screen.getAllByTestId("motion-asset")).toHaveLength(1);
    expect(screen.queryByTestId("scene-transition")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share this Story" })).not.toBeInTheDocument();

    await act(async () => {
      for (const event of firstEvents.slice(4)) firstStream.push(event);
      firstStream.close();
    });

    await waitFor(() => expect(screen.getByTestId("canvas-mode")).toHaveTextContent("answer"));
    expect(document.querySelectorAll("section[data-story-scene]")).toHaveLength(3);
    expect(screen.getAllByTestId("motion-asset")).toHaveLength(3);
    expect(screen.getAllByTestId("scene-transition")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Share this Story" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Related Questions" })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/ask/${FIRST_STORY_ID}`);
    expect(screen.queryByText("Noah, in brief")).not.toBeInTheDocument();

    const historyLength = window.history.length;
    fireEvent.click(
      screen.getByRole("button", { name: firstStory.plan.relatedQuestions[0] }),
    );
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([input]) => input === "/api/generate")).toHaveLength(2),
    );
    expect(screen.getByRole("heading", { name: "Preparing your Story" })).toBeInTheDocument();

    await act(async () => {
      for (const event of draftEvents(relatedStory, SECOND_PUBLICATION_TOKEN)) {
        relatedStream.push(event);
      }
      relatedStream.close();
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: relatedStory.displayQuestion }),
      ).toBeInTheDocument(),
    );
    expect(window.location.pathname).toBe(`/ask/${SECOND_STORY_ID}`);
    expect(window.history.length).toBe(historyLength + 1);
    const generationCalls = fetchMock.mock.calls.filter(([input]) => input === "/api/generate");
    expect(generationCalls[1]).toEqual([
      "/api/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: relatedStory.displayQuestion }),
      }),
    ]);
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/generate/publish"),
    ).toHaveLength(2);
  });
});

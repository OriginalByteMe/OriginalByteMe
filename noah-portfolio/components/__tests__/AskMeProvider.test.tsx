import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AskMeProvider, useAskMe } from "@/components/AskMeProvider";
import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";
import type { PublicStory, StoryPlan } from "@/lib/story/types";
import { makeStore } from "@/lib/store";

const evidence = [CORPUS_EVIDENCE_REFS[0], CORPUS_EVIDENCE_REFS[1]];
const plan: StoryPlan = {
  question: "How does Noah work?",
  mode: "grounded",
  backdropPreset: "ditherIndigo",
  relatedQuestions: ["What has Noah built?", "How does Noah work?"],
  scenes: [
    {
      id: "direct-answer",
      index: 0,
      role: "direct-answer",
      pattern: "hero-statement",
      register: "editorial",
      title: "A direct answer",
      claim: "Noah connects product craft to dependable systems.",
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
      title: "Grounded evidence",
      claim: "The Story keeps its supporting references visible.",
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
      title: "A useful synthesis",
      claim: "The work remains useful after launch.",
      assetId: "morning-coffee",
      evidenceRefIds: [evidence[1].id],
      cue: { phase: "resolve", focus: "right", intensity: "medium" },
    },
  ],
};
const initialStory: PublicStory = {
  id: "AbCdEfGhIjKlMnOpQrStUvWx",
  displayQuestion: "How does Noah work?",
  createdAt: "2026-07-14T08:00:00.000Z",
  plan,
  scenes: plan.scenes.map((scene) => ({
    ...scene,
    body: "The complete meaning is available in this semantic Scene copy.",
  })),
  evidence,
};

function CanvasStateProbe() {
  const canvas = useAskMe();
  return (
    <>
      <output data-testid="mode">{canvas.mode}</output>
      <output data-testid="question">{canvas.question}</output>
      <output data-testid="scene-count">{canvas.scenes.length}</output>
      <output data-testid="story-id">{canvas.story?.id}</output>
    </>
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", `/ask/${initialStory.id}`);
});

afterEach(() => {
  cleanup();
});

describe("AskMeProvider", () => {
  it("seeds a current public Story without regenerating or exposing server identity fields", async () => {
    render(
      <Provider store={makeStore()}>
        <AskMeProvider initialStory={initialStory}>
          <CanvasStateProbe />
        </AskMeProvider>
      </Provider>,
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("answer");
    expect(screen.getByTestId("question")).toHaveTextContent(initialStory.displayQuestion);
    expect(screen.getByTestId("scene-count")).toHaveTextContent("3");
    expect(screen.getByTestId("story-id")).toHaveTextContent(initialStory.id);
    expect(initialStory).not.toHaveProperty("questionDigest");
    expect(initialStory).not.toHaveProperty("corpusRevision");
    expect(initialStory).not.toHaveProperty("storyContractVersion");
    await waitFor(() =>
      expect(window.history.state.__noahPortfolioStory).toEqual({
        id: initialStory.id,
        scrollY: 0,
      }),
    );
  });
});

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AskMeProvider, useAskMe } from "@/components/AskMeProvider";
import { CURRENT_PUBLIC_STORY } from "@/lib/story/__fixtures__/story-fixtures";

function CanvasStateProbe() {
  const canvas = useAskMe();
  return (
    <>
      <output data-testid="mode">{canvas.mode}</output>
      <output data-testid="question">{canvas.question}</output>
      <output data-testid="headline">{canvas.site?.hero.headline}</output>
      <output data-testid="story-id">{canvas.story?.id}</output>
    </>
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", `/ask/${CURRENT_PUBLIC_STORY.id}`);
});

afterEach(() => {
  cleanup();
});

describe("AskMeProvider", () => {
  it("seeds a shared public story as the answer without regenerating it", async () => {
    render(
      <AskMeProvider initialStory={CURRENT_PUBLIC_STORY}>
        <CanvasStateProbe />
      </AskMeProvider>,
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("answer");
    expect(screen.getByTestId("question")).toHaveTextContent(CURRENT_PUBLIC_STORY.displayQuestion);
    expect(screen.getByTestId("headline")).toHaveTextContent(CURRENT_PUBLIC_STORY.site.hero.headline);
    expect(screen.getByTestId("story-id")).toHaveTextContent(CURRENT_PUBLIC_STORY.id);
    await waitFor(() =>
      expect(window.history.state.__noahPortfolioStory).toEqual({ id: CURRENT_PUBLIC_STORY.id, scrollY: 0 }),
    );
  });
});

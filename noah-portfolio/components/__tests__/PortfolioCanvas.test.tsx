import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AskMeProvider, useAskMe } from "@/components/AskMeProvider";
import { JsonUiProvider } from "@/components/JsonUiProvider";
import PortfolioCanvas from "@/components/PortfolioCanvas";
// Static import warms the module `next/dynamic` resolves lazily, so the home
// canvas renders deterministically even under full-suite transform contention.
import "@/components/HomePortfolioCanvas";
import { stubDialog } from "@/lib/site/__fixtures__/browser-fakes";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_QUESTION,
  CURRENT_STORY_ID,
  RELATED_PUBLIC_STORY,
  RELATED_QUESTION,
  RELATED_STORY_ID,
} from "@/lib/story/__fixtures__/story-fixtures";
import type { PublicStory } from "@/lib/story/types";
import { makeStore } from "@/lib/store";

vi.mock("@/components/ui/spotify-reveal", () => ({
  default: () => <div>Spotify</div>,
}));

const tokenFor = (story: PublicStory) => `${story.id}.${"a".repeat(43)}`;

/** One controllable NDJSON generation per story; publication answers with the matching story. */
function stubServer(stories: PublicStory[]) {
  const encoder = new TextEncoder();
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string, init?: RequestInit) => {
      if (input === "/api/generate/publish") {
        const { publicationToken } = JSON.parse(String(init?.body));
        const story = stories.find((candidate) => tokenFor(candidate) === publicationToken);
        return Promise.resolve(
          new Response(JSON.stringify({ type: "complete", story }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      const body = new ReadableStream<Uint8Array>({ start: (controller) => void streams.push(controller) });
      return Promise.resolve(new Response(body, { headers: { "Content-Type": "application/x-ndjson" } }));
    }),
  );
  return (index: number, story: PublicStory) => {
    const lines = [
      { type: "phase", phase: "generating" },
      { type: "site", site: story.site, evidence: story.evidence },
      { type: "phase", phase: "validating" },
      { type: "phase", phase: "publishing", publicationToken: tokenFor(story) },
    ];
    for (const line of lines) streams[index].enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
    streams[index].close();
  };
}

function AskButton() {
  const { ask } = useAskMe();
  return (
    <button type="button" onClick={() => void ask(CURRENT_QUESTION)}>
      Ask first
    </button>
  );
}

beforeAll(stubDialog);

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PortfolioCanvas", () => {
  it("takes over home with a generated site, follows a related question, and goes back home", async () => {
    const finishStream = stubServer([CURRENT_PUBLIC_STORY, RELATED_PUBLIC_STORY]);
    render(
      <Provider store={makeStore()}>
        <JsonUiProvider initialState={{}}>
          <AskMeProvider>
            <AskButton />
            <PortfolioCanvas />
          </AskMeProvider>
        </JsonUiProvider>
      </Provider>,
    );

    expect(await screen.findByText("Noah, in brief")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask first" }));
    expect(await screen.findByRole("status", { name: "Building your site" })).toBeInTheDocument();
    expect(screen.queryByText("Noah, in brief")).not.toBeInTheDocument();

    await act(async () => finishStream(0, CURRENT_PUBLIC_STORY));
    await waitFor(() => expect(window.location.pathname).toBe(`/ask/${CURRENT_STORY_ID}`));
    expect(
      screen.getByRole("heading", { level: 1, name: CURRENT_PUBLIC_STORY.site.hero.headline }),
    ).toBeInTheDocument();

    const historyLength = window.history.length;
    const related = screen.getByRole("region", { name: "Keep exploring" });
    fireEvent.click(within(related).getByRole("button", { name: RELATED_QUESTION }));
    expect(await screen.findByRole("status", { name: "Building your site" })).toBeInTheDocument();
    await act(async () => finishStream(1, RELATED_PUBLIC_STORY));
    await waitFor(() => expect(window.location.pathname).toBe(`/ask/${RELATED_STORY_ID}`));
    expect(window.history.length).toBe(historyLength + 1);
    expect(
      screen.getByRole("heading", { level: 1, name: RELATED_PUBLIC_STORY.site.hero.headline }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to portfolio" }));
    // Home replays its spec as timed local patches, so give it more than the default second.
    expect(await screen.findByText("Noah, in brief", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
});

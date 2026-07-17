import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStory: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  replace: vi.fn(),
  provider: vi.fn(({ children }: { children: ReactNode; initialStory?: unknown }) => (
    <div data-testid="ask-me-provider">{children}</div>
  )),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/story/store", () => ({ resolveStory: mocks.resolveStory }));
vi.mock("@/components/Backdrop", () => ({ default: () => <div data-testid="backdrop" /> }));
vi.mock("@/components/BackdropSceneSync", () => ({ default: () => <div data-testid="scene-sync" /> }));
vi.mock("@/components/AskMeProvider", () => ({ AskMeProvider: mocks.provider }));
vi.mock("@/components/SiteShell", () => ({
  default: () => <div data-testid="site-shell">Current Story experience</div>,
}));

import StoryPage from "../page";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_PUBLICATION_TOKEN,
  CURRENT_STORY_RECORD,
  CURRENT_STORY_ID,
} from "@/lib/story/__fixtures__/story-fixtures";

function regenerationNdjson(terminalEvent: unknown): string {
  return [
    { type: "phase", phase: "planning" },
    { type: "plan", plan: CURRENT_PUBLIC_STORY.plan, evidence: CURRENT_PUBLIC_STORY.evidence },
    { type: "phase", phase: "composing" },
    ...CURRENT_PUBLIC_STORY.scenes.map((scene, index) => ({ type: "scene", index, scene })),
    { type: "phase", phase: "validating" },
    terminalEvent,
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}


describe("public Story route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("awaits the opaque ID and renders a current Story through the normal experience", async () => {
    mocks.resolveStory.mockResolvedValue({ status: "current", story: CURRENT_STORY_RECORD });

    render(await StoryPage({ params: Promise.resolve({ storyId: CURRENT_STORY_ID }) }));

    expect(mocks.resolveStory).toHaveBeenCalledWith(CURRENT_STORY_ID);
    const providerProps = mocks.provider.mock.calls[0]?.[0];
    expect(providerProps?.initialStory).toEqual(CURRENT_PUBLIC_STORY);
    expect(providerProps?.initialStory).toEqual(
      expect.not.objectContaining({
        questionDigest: expect.anything(),
        corpusRevision: expect.anything(),
        storyContractVersion: expect.anything(),
      }),
    );
    expect(screen.getByTestId("backdrop")).toBeInTheDocument();
    expect(screen.getByTestId("scene-sync")).toBeInTheDocument();
    expect(screen.getByTestId("site-shell")).toHaveTextContent("Current Story experience");
  });

  it("renders metadata-only recovery for an outdated Story and no stored scene body", async () => {
    mocks.resolveStory.mockResolvedValue({
      status: "outdated",
      id: "A0-old-public-id",
      displayQuestion: "How does Noah approach product design?",
      corpusRevision: "retired-corpus",
      storyContractVersion: "retired-contract",
      scenes: [{ body: "STALE PRIVATE SCENE BODY MUST NOT RENDER" }],
    });

    render(await StoryPage({ params: Promise.resolve({ storyId: "A0-old-public-id" }) }));

    expect(screen.getByRole("heading", { name: "This Story is outdated" })).toBeVisible();
    expect(screen.getByText("How does Noah approach product design?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Regenerate with current facts" })).toBeEnabled();
    expect(screen.queryByText("STALE PRIVATE SCENE BODY MUST NOT RENDER")).not.toBeInTheDocument();
    expect(screen.queryByTestId("site-shell")).not.toBeInTheDocument();
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("accepts fresh publication and a complete ordered cache replay before replacing", async () => {
    mocks.resolveStory.mockResolvedValue({
      status: "outdated",
      id: "A0-old-public-id",
      displayQuestion: CURRENT_PUBLIC_STORY.displayQuestion,
      corpusRevision: "retired-corpus",
      storyContractVersion: "retired-contract",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          regenerationNdjson({
            type: "phase",
            phase: "publishing",
            publicationToken: CURRENT_PUBLICATION_TOKEN,
          }),
          { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ type: "complete", story: CURRENT_PUBLIC_STORY }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const publishView = render(
      await StoryPage({ params: Promise.resolve({ storyId: "A0-old-public-id" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Regenerate with current facts" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/ask/${CURRENT_STORY_ID}`));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: CURRENT_PUBLIC_STORY.displayQuestion }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate/publish",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ publicationToken: CURRENT_PUBLICATION_TOKEN }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledWith(`/ask/${CURRENT_STORY_ID}`);
    expect(mocks.replace).not.toHaveBeenCalledWith("/ask/A0-old-public-id");
    publishView.unmount();

    mocks.replace.mockClear();
    const cacheFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        regenerationNdjson({ type: "complete", story: CURRENT_PUBLIC_STORY }),
        { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
      ),
    );
    vi.stubGlobal("fetch", cacheFetch);
    const cacheView = render(
      await StoryPage({ params: Promise.resolve({ storyId: "A0-old-public-id" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Regenerate with current facts" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/ask/${CURRENT_STORY_ID}`));
    expect(cacheFetch).toHaveBeenCalledTimes(1);
    expect(cacheFetch).not.toHaveBeenCalledWith(
      "/api/generate/publish",
      expect.anything(),
    );
    cacheView.unmount();
  });

  it("never navigates for standalone complete or invalid and failed publication", async () => {
    mocks.resolveStory.mockResolvedValue({
      status: "outdated",
      id: "A0-old-public-id",
      displayQuestion: CURRENT_PUBLIC_STORY.displayQuestion,
      corpusRevision: "retired-corpus",
      storyContractVersion: "retired-contract",
    });
    const publishResponses = [
      new Response(JSON.stringify({ type: "phase", phase: "validating" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
      new Response(JSON.stringify({ error: "publication failed" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          `${JSON.stringify({ type: "complete", story: CURRENT_PUBLIC_STORY })}\n`,
          { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
        ),
      ),
    );
    const shortcutView = render(
      await StoryPage({ params: Promise.resolve({ storyId: "A0-old-public-id" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Regenerate with current facts" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
    shortcutView.unmount();

    for (const publishResponse of publishResponses) {
      mocks.replace.mockClear();
      const generateResponse = new Response(
        regenerationNdjson({
          type: "phase",
          phase: "publishing",
          publicationToken: CURRENT_PUBLICATION_TOKEN,
        }),
        { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
      );
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(generateResponse)
          .mockResolvedValueOnce(publishResponse),
      );

      const view = render(
        await StoryPage({ params: Promise.resolve({ storyId: "A0-old-public-id" }) }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Regenerate with current facts" }));

      expect(await screen.findByRole("alert")).toBeVisible();
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Regenerate with current facts" })).toBeEnabled();
      view.unmount();
    }
  });

  it("delegates a missing opaque ID to notFound", async () => {
    mocks.resolveStory.mockResolvedValue({ status: "missing" });

    await expect(
      StoryPage({ params: Promise.resolve({ storyId: "not-a-story" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.resolveStory).toHaveBeenCalledWith("not-a-story");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.provider).not.toHaveBeenCalled();
  });
});

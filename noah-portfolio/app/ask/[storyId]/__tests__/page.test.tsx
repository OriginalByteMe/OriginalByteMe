import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveStory: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/story/store", () => ({ resolveStory: mocks.resolveStory }));
vi.mock("@/components/Backdrop", () => ({ default: () => null }));
vi.mock("@/components/BackdropSceneSync", () => ({ default: () => null }));
// The page chrome is out of scope; the generated site renders for real. vi.mock factories run
// before static imports bind, so the canvas has to be imported inside the factory.
vi.mock("@/components/SiteShell", async () => ({
  default: (await import("@/components/PortfolioCanvas")).default,
}));

import StoryPage from "../page";
import { stubDialog } from "@/lib/site/__fixtures__/browser-fakes";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_PUBLICATION_TOKEN,
  CURRENT_STORY_ID,
  CURRENT_STORY_RECORD,
  OUTDATED_STORY_ID,
  OUTDATED_STORY_RECORD,
} from "@/lib/story/__fixtures__/story-fixtures";

const openStory = async (storyId: string) => render(await StoryPage({ params: Promise.resolve({ storyId }) }));

const ndjson = (events: unknown[]) =>
  new Response(events.map((event) => `${JSON.stringify(event)}\n`).join(""), {
    headers: { "Content-Type": "application/x-ndjson" },
  });
const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

const COMPLETE = { type: "complete", story: CURRENT_PUBLIC_STORY };
const regeneration = (terminalEvent: unknown) =>
  ndjson([
    { type: "phase", phase: "generating" },
    { type: "site", site: CURRENT_PUBLIC_STORY.site, evidence: CURRENT_PUBLIC_STORY.evidence },
    { type: "phase", phase: "validating" },
    terminalEvent,
  ]);
const draft = () => regeneration({ type: "phase", phase: "publishing", publicationToken: CURRENT_PUBLICATION_TOKEN });

async function regenerateWith(responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  await openStory(OUTDATED_STORY_ID);
  fireEvent.click(screen.getByRole("button", { name: "Regenerate with current facts" }));
  return fetchMock;
}

beforeAll(stubDialog);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
  // The outdated resolution leaks the whole stored record; the page must still show metadata only.
  mocks.resolveStory.mockImplementation(async (id: string) =>
    id === CURRENT_STORY_ID
      ? { status: "current", story: CURRENT_STORY_RECORD }
      : id === OUTDATED_STORY_ID
        ? { status: "outdated", ...OUTDATED_STORY_RECORD }
        : { status: "missing" },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public Story route", () => {
  it("renders a current story as its generated site, inside the page's only main landmark", async () => {
    await openStory(CURRENT_STORY_ID);

    expect(screen.getByRole("heading", { level: 1, name: CURRENT_PUBLIC_STORY.site.hero.headline })).toBeVisible();
    // A <main> inside the page's own is invalid HTML and a second main landmark for screen readers.
    expect(screen.getAllByRole("main", { hidden: true })).toHaveLength(1);
  });

  it("renders the regenerate screen for an outdated story and never its stale site", async () => {
    await openStory(OUTDATED_STORY_ID);

    expect(screen.getByRole("heading", { name: "This Story is outdated" })).toBeVisible();
    expect(screen.getByText(OUTDATED_STORY_RECORD.displayQuestion)).toBeVisible();
    expect(screen.getByRole("button", { name: "Regenerate with current facts" })).toBeEnabled();
    expect(screen.queryByText(/STALE SITE/)).not.toBeInTheDocument();
  });

  it.each([
    ["a fresh publication", () => [draft(), json(COMPLETE)]],
    ["a cache replay", () => [regeneration(COMPLETE)]],
  ])("regenerates an outdated story through %s into its new link", async (_case, responses) => {
    const fetchMock = await regenerateWith(responses());

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/ask/${CURRENT_STORY_ID}`));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/generate",
      expect.objectContaining({ body: JSON.stringify({ question: OUTDATED_STORY_RECORD.displayQuestion }) }),
    );
  });

  it.each([
    ["a complete with no lifecycle", () => [ndjson([COMPLETE])]],
    ["an invalid publication", () => [draft(), json({ type: "phase", phase: "validating" })]],
    ["a failed publication", () => [draft(), json({ error: "publication failed" }, 503)]],
  ])("stays on the outdated link and offers a retry after %s", async (_case, responses) => {
    await regenerateWith(responses());

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Regenerate with current facts" })).toBeEnabled();
  });

  it("delegates a missing id to notFound", async () => {
    await expect(openStory("not-a-story")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});

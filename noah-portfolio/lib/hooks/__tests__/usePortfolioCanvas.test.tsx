import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePortfolioCanvas } from "@/lib/hooks/usePortfolioCanvas";
import { homeSpec } from "@/lib/jsonui/homeSpec";
import { installFakeAudio } from "@/lib/site/__fixtures__/browser-fakes";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_QUESTION,
  CURRENT_STORY_ID,
  RELATED_PUBLIC_STORY,
  RELATED_QUESTION,
  RELATED_STORY_ID,
} from "@/lib/story/__fixtures__/story-fixtures";
import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";
import {
  MAX_STORY_QUESTION_LENGTH,
  type PublicStory,
  type StoryStreamEvent,
} from "@/lib/story/types";

const tokenFor = (story: PublicStory) => `${story.id}.${"a".repeat(43)}`;

/** The full v7 stream: a fresh draft ends in a publication token, a cache replay in `complete`. */
function streamEvents(story: PublicStory, ending: "publish" | "complete" = "publish"): StoryStreamEvent[] {
  return [
    { type: "phase", phase: "generating" },
    { type: "site", site: story.site, evidence: story.evidence },
    { type: "phase", phase: "validating" },
    ending === "publish"
      ? { type: "phase", phase: "publishing", publicationToken: tokenFor(story) }
      : { type: "complete", story },
  ];
}

const [GENERATING, SITE, VALIDATING, PUBLISHING] = streamEvents(CURRENT_PUBLIC_STORY);

/** Strings are sent verbatim so malformed lines can be tested; anything else is serialized. */
function ndjsonResponse(entries: Array<string | object>) {
  const body = entries.map((entry) => `${typeof entry === "string" ? entry : JSON.stringify(entry)}\n`);
  return new Response(body.join(""), { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function controlledStoryResponse() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
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
    push: (...events: StoryStreamEvent[]) => {
      for (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    },
    close: () => controller.close(),
  };
}

/** Serves generation responses in order; `publish` answers each publication token. */
function stubServer(generations: Response[], publish: (token: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: string, init?: RequestInit) => {
    if (input === "/api/generate") {
      const response = generations.shift();
      return response ? Promise.resolve(response) : Promise.reject(new Error("Unexpected generation"));
    }
    if (input === "/api/generate/publish") {
      return Promise.resolve(publish(JSON.parse(String(init?.body)).publicationToken));
    }
    return Promise.reject(new Error(`Unexpected request ${input}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const publishes = (...stories: PublicStory[]) => (token: string) => {
  const story = stories.find((candidate) => tokenFor(candidate) === token);
  return story ? jsonResponse({ type: "complete", story }) : jsonResponse({ error: "Unknown token" }, 400);
};

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePortfolioCanvas", () => {
  it("shows the streamed site before publication, then publishes it at an opaque URL", async () => {
    const audio = installFakeAudio();
    const stream = controlledStoryResponse();
    stubServer([stream.response], publishes(CURRENT_PUBLIC_STORY));
    const { result } = renderHook(() => usePortfolioCanvas());

    let asked!: Promise<void>;
    act(() => {
      asked = result.current.ask(`  ${CURRENT_QUESTION}  `);
      // Safari only allows audio that starts inside the visitor's own click.
      expect(audio.resumes).toBe(1);
    });
    expect(result.current.mode).toBe("streaming");
    expect(result.current.question).toBe(CURRENT_QUESTION);
    expect(result.current.spec).toBe(homeSpec);

    act(() => stream.push(GENERATING));
    await waitFor(() => expect(result.current.phase).toBe("generating"));
    expect(result.current.site).toBeNull();

    act(() => stream.push(SITE));
    await waitFor(() => expect(result.current.site).toEqual(CURRENT_PUBLIC_STORY.site));
    expect(result.current.evidence).toEqual(CURRENT_PUBLIC_STORY.evidence);
    expect(result.current.story).toBeNull();
    expect(window.location.pathname).toBe("/");

    await act(async () => {
      stream.push(VALIDATING, PUBLISHING);
      stream.close();
      await asked;
    });
    expect(result.current.mode).toBe("answer");
    expect(result.current.story).toEqual(CURRENT_PUBLIC_STORY);
    expect(result.current.site).toEqual(CURRENT_PUBLIC_STORY.site);
    expect(window.location.pathname).toBe(`/ask/${CURRENT_STORY_ID}`);
    expect(window.location.search).toBe("");
  });

  it("adopts a cache replay whose question differs only by normalization, without publishing", async () => {
    stubServer([ndjsonResponse(streamEvents(CURRENT_PUBLIC_STORY, "complete"))], () => {
      throw new Error("A cache replay must not publish again");
    });
    const { result } = renderHook(() => usePortfolioCanvas());

    await act(() => result.current.ask(CURRENT_QUESTION.toUpperCase()));

    expect(result.current.error).toBeNull();
    expect(result.current.mode).toBe("answer");
    expect(result.current.story).toEqual(CURRENT_PUBLIC_STORY);
    expect(window.location.pathname).toBe(`/ask/${CURRENT_STORY_ID}`);
  });

  it("shows the canonical story publication returns, so the link matches what the visitor sees", async () => {
    const draft = { ...CURRENT_PUBLIC_STORY, id: RELATED_STORY_ID, site: RELATED_PUBLIC_STORY.site };
    stubServer([ndjsonResponse(streamEvents(draft))], (token) =>
      token === tokenFor(draft)
        ? jsonResponse({ type: "complete", story: CURRENT_PUBLIC_STORY })
        : jsonResponse({ error: "Unknown token" }, 400),
    );
    const { result } = renderHook(() => usePortfolioCanvas());

    await act(() => result.current.ask(CURRENT_QUESTION));

    expect(result.current.site).toEqual(CURRENT_PUBLIC_STORY.site);
    expect(window.location.pathname).toBe(`/ask/${CURRENT_STORY_ID}`);
  });

  const complete = (story: PublicStory) => ({ type: "complete", story });
  it.each([
    ["malformed JSON", ['{"type":"phase","phase":'], /malformed JSON/],
    ["an unknown field", [{ ...GENERATING, internal: "not public" }], /invalid event/],
    ["validation before the site", [GENERATING, VALIDATING], /validation before its site arrived/],
    ["a second site", [GENERATING, SITE, SITE], /site outside the generating phase/],
    ["a skipped validation phase", [GENERATING, SITE, PUBLISHING], /phases out of order/],
    ["a complete with no lifecycle", [complete(CURRENT_PUBLIC_STORY)], /bypassed its validated lifecycle/],
    [
      "a complete whose site differs from the stream",
      [GENERATING, SITE, VALIDATING, complete({ ...CURRENT_PUBLIC_STORY, site: RELATED_PUBLIC_STORY.site })],
      /did not match its replayed draft/,
    ],
    [
      "a complete whose evidence differs from the stream",
      [
        GENERATING,
        SITE,
        VALIDATING,
        complete({ ...CURRENT_PUBLIC_STORY, evidence: [...CURRENT_PUBLIC_STORY.evidence, CORPUS_EVIDENCE_REFS[3]] }),
      ],
      /did not match its replayed draft/,
    ],
    ["an error event", [GENERATING, { type: "error", message: "The model is busy" }], /^The model is busy$/],
  ])("ends in error mode, unpublished, on %s", async (_case, lines, message) => {
    stubServer([ndjsonResponse(lines)], publishes(CURRENT_PUBLIC_STORY));
    const { result } = renderHook(() => usePortfolioCanvas());

    await act(() => result.current.ask(CURRENT_QUESTION));

    expect(result.current.mode).toBe("error");
    expect(result.current.error).toMatch(message);
    expect(result.current.story).toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("never shows a streamed site that cites evidence the stream did not send", async () => {
    const ungrounded = { type: "site", site: CURRENT_PUBLIC_STORY.site, evidence: CURRENT_PUBLIC_STORY.evidence.slice(1) };
    stubServer([ndjsonResponse([GENERATING, ungrounded])], publishes(CURRENT_PUBLIC_STORY));
    const { result } = renderHook(() => usePortfolioCanvas());

    await act(() => result.current.ask(CURRENT_QUESTION));

    expect(result.current.mode).toBe("error");
    expect(result.current.error).toMatch(/unknown Evidence Ref ID/);
    expect(result.current.site).toBeNull();
  });

  it.each([
    ["an invalid payload", jsonResponse({ type: "complete", story: {} }), /publication response was invalid/],
    ["a server refusal", jsonResponse({ error: "Publishing is paused" }, 503), /^Publishing is paused$/],
    [
      "a story for another question",
      jsonResponse({ type: "complete", story: RELATED_PUBLIC_STORY }),
      /differs from the requested question/,
    ],
  ])("keeps the streamed site but stays unpublished after %s", async (_case, publication, message) => {
    stubServer([ndjsonResponse([GENERATING, SITE, VALIDATING, PUBLISHING])], () => publication);
    const { result } = renderHook(() => usePortfolioCanvas());

    await act(() => result.current.ask(CURRENT_QUESTION));

    expect(result.current.mode).toBe("error");
    expect(result.current.error).toMatch(message);
    expect(result.current.site).toEqual(CURRENT_PUBLIC_STORY.site);
    expect(result.current.story).toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("never lets a superseded request's late publication overwrite the newer site", async () => {
    let resolveFirstPublish!: (response: Response) => void;
    const firstPublish = new Promise<Response>((resolve) => {
      resolveFirstPublish = resolve;
    });
    const firstStream = controlledStoryResponse();
    const secondStream = controlledStoryResponse();
    const fetchMock = stubServer([firstStream.response, secondStream.response], () => firstPublish);
    const { result } = renderHook(() => usePortfolioCanvas());

    let firstAsk!: Promise<void>;
    act(() => {
      firstAsk = result.current.ask(CURRENT_QUESTION);
    });
    act(() => {
      firstStream.push(...streamEvents(CURRENT_PUBLIC_STORY));
      firstStream.close();
    });
    // The race only exists once the first request is waiting on publication.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/generate/publish", expect.anything()));

    let secondAsk!: Promise<void>;
    act(() => {
      secondAsk = result.current.ask(RELATED_QUESTION);
    });
    expect(result.current.site).toBeNull();
    await act(async () => {
      secondStream.push(...streamEvents(RELATED_PUBLIC_STORY, "complete"));
      secondStream.close();
      await secondAsk;
      resolveFirstPublish(jsonResponse({ type: "complete", story: CURRENT_PUBLIC_STORY }));
      await firstAsk;
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.question).toBe(RELATED_QUESTION);
    expect(result.current.site).toEqual(RELATED_PUBLIC_STORY.site);
    expect(window.location.pathname).toBe(`/ask/${RELATED_STORY_ID}`);
  });

  it("pushes history for a related question and restores the cached site and scroll on Back", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 321 });
    window.history.replaceState({}, "", `/ask/${CURRENT_STORY_ID}`);
    stubServer([ndjsonResponse(streamEvents(RELATED_PUBLIC_STORY))], publishes(RELATED_PUBLIC_STORY));
    const { result } = renderHook(() => usePortfolioCanvas(CURRENT_PUBLIC_STORY));
    expect(result.current.mode).toBe("answer");
    expect(result.current.site).toEqual(CURRENT_PUBLIC_STORY.site);
    await waitFor(() =>
      expect(window.history.state.__noahPortfolioStory).toEqual({ id: CURRENT_STORY_ID, scrollY: 321 }),
    );

    const historyLength = window.history.length;
    const previousState = window.history.state;
    await act(() => result.current.ask(RELATED_QUESTION, { history: "push" }));
    expect(result.current.site).toEqual(RELATED_PUBLIC_STORY.site);
    expect(window.location.pathname).toBe(`/ask/${RELATED_STORY_ID}`);
    expect(window.history.length).toBe(historyLength + 1);

    vi.mocked(window.scrollTo).mockClear();
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: previousState })));
    expect(result.current.question).toBe(CURRENT_QUESTION);
    expect(result.current.site).toEqual(CURRENT_PUBLIC_STORY.site);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 321, left: 0, behavior: "auto" });
  });

  it("goHome clears the site and browser Back brings the published one back", async () => {
    stubServer([ndjsonResponse(streamEvents(CURRENT_PUBLIC_STORY))], publishes(CURRENT_PUBLIC_STORY));
    const { result } = renderHook(() => usePortfolioCanvas());
    await act(() => result.current.ask(CURRENT_QUESTION));
    Object.defineProperty(window, "scrollY", { configurable: true, value: 456 });

    act(() => result.current.goHome());
    expect(result.current.mode).toBe("home");
    expect(result.current.site).toBeNull();
    expect(result.current.story).toBeNull();
    expect(window.location.pathname).toBe("/");

    vi.mocked(window.scrollTo).mockClear();
    act(() => window.history.back());
    await waitFor(() => expect(result.current.story).toEqual(CURRENT_PUBLIC_STORY));
    expect(result.current.mode).toBe("answer");
    expect(window.location.pathname).toBe(`/ask/${CURRENT_STORY_ID}`);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 456, left: 0, behavior: "auto" });
  });

  it("reset after a stream that ended before publication clears the site and returns home", async () => {
    stubServer([ndjsonResponse([GENERATING, SITE])], publishes(CURRENT_PUBLIC_STORY));
    const { result } = renderHook(() => usePortfolioCanvas());
    await act(() => result.current.ask(CURRENT_QUESTION));
    expect(result.current.mode).toBe("error");
    expect(result.current.error).toMatch(/ended before publication/);
    expect(result.current.site).toEqual(CURRENT_PUBLIC_STORY.site);

    act(() => result.current.reset());
    expect(result.current.mode).toBe("home");
    expect(result.current.spec).toBe(homeSpec);
    expect(result.current.site).toBeNull();
    expect(result.current.evidence).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("ignores a question beyond the length bound without starting a request", async () => {
    const fetchMock = stubServer([], publishes());
    const { result } = renderHook(() => usePortfolioCanvas());

    await act(() => result.current.ask("q".repeat(MAX_STORY_QUESTION_LENGTH + 1)));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("home");
  });
});

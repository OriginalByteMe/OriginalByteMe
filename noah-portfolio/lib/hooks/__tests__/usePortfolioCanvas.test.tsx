import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonPatch, Spec } from "@json-render/core";

import { homeSpec } from "@/lib/jsonui/homeSpec";
import { makeStore, type AppStore } from "@/lib/store";
import { usePortfolioCanvas } from "@/lib/hooks/usePortfolioCanvas";

const ANSWER_SPEC: Spec = {
  root: "main",
  state: { "/backdrop/preset": "nightMatte" },
  elements: {
    main: { type: "Prose", props: { text: "A streamed answer." }, children: [] },
  },
};

const ANSWER_PATCHES: JsonPatch[] = [
  { op: "add", path: "/root", value: ANSWER_SPEC.root },
  { op: "add", path: "/state", value: ANSWER_SPEC.state },
  { op: "add", path: "/elements/main", value: ANSWER_SPEC.elements.main },
];

function wrapperFor(store: AppStore, strict = false) {
  function Wrapper({ children }: { children: ReactNode }) {
    const content = <Provider store={store}>{children}</Provider>;
    return strict ? <StrictMode>{content}</StrictMode> : content;
  }
  Wrapper.displayName = "PortfolioCanvasTestProvider";
  return Wrapper;
}

function controlledPatchResponse() {
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
    push(patch: JsonPatch) {
      if (!controller) throw new Error("Stream controller is unavailable");
      controller.enqueue(encoder.encode(`${JSON.stringify(patch)}\n`));
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("usePortfolioCanvas", () => {
  it("progressively compiles patches, steers only after validation, and resets home", async () => {
    const stream = controlledPatchResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stream.response));
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });

    let askPromise!: Promise<void>;
    act(() => {
      askPromise = result.current.ask("  What has Noah built?  ");
    });

    await waitFor(() => expect(result.current.mode).toBe("streaming"));
    expect(result.current.spec).toEqual({ root: "", elements: {} });
    expect(result.current.question).toBe("What has Noah built?");
    expect(window.location.search).toContain("q=What+has+Noah+built%3F");

    act(() => stream.push(ANSWER_PATCHES[0]));
    await waitFor(() => expect(result.current.spec.root).toBe("main"));

    act(() => stream.push(ANSWER_PATCHES[1]));
    act(() => stream.push(ANSWER_PATCHES[2]));
    await waitFor(() => expect(result.current.spec.elements.main).toEqual(ANSWER_SPEC.elements.main));
    expect(result.current.mode).toBe("streaming");
    expect(store.getState().backdrop.preset).toBe("softField");

    await act(async () => {
      stream.close();
      await askPromise;
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.spec).toEqual(ANSWER_SPEC);
    expect(store.getState().backdrop.preset).toBe("nightMatte");

    act(() => result.current.reset());
    expect(result.current.mode).toBe("home");
    expect(result.current.spec).toBe(homeSpec);
    expect(result.current.question).toBe("");
    expect(window.location.search).toBe("");
    expect(store.getState().backdrop.preset).toBe("softField");
  });

  it("accepts a validated cached full spec and applies its allowlisted backdrop preset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ spec: ANSWER_SPEC }), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }),
      ),
    );
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });

    await act(async () => {
      await result.current.ask("cached answer");
    });

    expect(result.current.mode).toBe("answer");
    expect(result.current.spec).toEqual(ANSWER_SPEC);
    expect(store.getState().backdrop.preset).toBe("nightMatte");
  });

  it("falls back to home for malformed patch data and clears the shared query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"op":"add","path":', {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        }),
      ),
    );
    const store = makeStore({ backdrop: { preset: "nightMatte" } });
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });

    await act(async () => {
      await result.current.ask("malformed stream");
    });

    expect(result.current.mode).toBe("home");
    expect(result.current.spec).toBe(homeSpec);
    expect(result.current.error).toMatch(/malformed patch data/i);
    expect(window.location.search).toBe("");
    expect(store.getState().backdrop.preset).toBe("softField");
  });

  it("falls back to home with the server message for an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "generation unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });

    await act(async () => {
      await result.current.ask("HTTP error");
    });

    expect(result.current.mode).toBe("home");
    expect(result.current.error).toBe("generation unavailable");
    expect(window.location.search).toBe("");
    expect(store.getState().backdrop.preset).toBe("softField");
  });

  it("does not let an in-flight stream restore an answer after reset", async () => {
    const stream = controlledPatchResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stream.response));
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), { wrapper: wrapperFor(store) });

    let askPromise!: Promise<void>;
    act(() => {
      askPromise = result.current.ask("reset while streaming");
    });
    await waitFor(() => expect(result.current.mode).toBe("streaming"));

    act(() => result.current.reset());
    await act(async () => {
      for (const patch of ANSWER_PATCHES) stream.push(patch);
      stream.close();
      await askPromise;
    });

    expect(result.current.mode).toBe("home");
    expect(result.current.spec).toBe(homeSpec);
    expect(result.current.question).toBe("");
    expect(result.current.error).toBeNull();
    expect(window.location.search).toBe("");
    expect(store.getState().backdrop.preset).toBe("softField");
  });

  it("completes an initial query once through StrictMode effect replay", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?q=shared%20question");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ spec: ANSWER_SPEC }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas("  shared question  "), {
      wrapper: wrapperFor(store, true),
    });
    expect(result.current.mode).toBe("streaming");
    expect(result.current.spec).toEqual({ root: "", elements: {} });
    expect(result.current.spec).not.toBe(homeSpec);
    expect(result.current.question).toBe("shared question");
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.mode).toBe("answer");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({ body: JSON.stringify({ question: "shared question" }) }),
    );
    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?q=shared%20question");
    expect(result.current.question).toBe("shared question");
    expect(result.current.spec).toEqual(ANSWER_SPEC);
    expect(store.getState().backdrop.preset).toBe("nightMatte");
  });

  it("syncs a manual query without invoking Next's patched history method", async () => {
    window.history.replaceState({ __NA: true, marker: "preserved" }, "", "/");
    const routerReplaceState = vi
      .spyOn(window.history, "replaceState")
      .mockImplementation(() => {
        throw new Error("Next navigation should not run for local canvas state");
      });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ spec: ANSWER_SPEC }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });

    await act(async () => {
      await result.current.ask("manual question");
    });

    expect(result.current.mode).toBe("answer");
    expect(routerReplaceState).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?q=manual+question");
    expect(window.history.state).toEqual({ __NA: true, marker: "preserved" });
  });

  it("does not rewrite history when reset clears an absent query", () => {
    const store = makeStore();
    const { result } = renderHook(() => usePortfolioCanvas(), {
      wrapper: wrapperFor(store),
    });
    const replaceState = vi.spyOn(window.history, "replaceState");

    act(() => result.current.reset());

    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});

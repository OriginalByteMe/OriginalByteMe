import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonPatch, Spec } from "@json-render/core";

import { AskMeProvider, useAskMe } from "@/components/AskMeProvider";
import { JsonUiProvider } from "@/components/JsonUiProvider";
import PortfolioCanvas from "@/components/PortfolioCanvas";
import { makeStore } from "@/lib/store";

vi.mock("@/components/ui/spotify-reveal", () => ({
  default: () => <div>Spotify</div>,
}));

vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: () => <div data-testid="lottie" />,
}));

function AskControls() {
  const { ask, mode, spec } = useAskMe();

  return (
    <>
      <button type="button" onClick={() => void ask("first question")}>
        Ask first
      </button>
      <button type="button" onClick={() => void ask("second question")}>
        Ask second
      </button>
      <span data-testid="canvas-mode">{mode}</span>
      <span data-testid="canvas-root">{spec.root}</span>
    </>
  );
}

function answerPatches(id: string, text: string): JsonPatch[] {
  const element: Spec["elements"][string] = {
    type: "Prose",
    props: { text },
    children: [],
  };

  return [
    { op: "add", path: "/root", value: id },
    { op: "add", path: `/elements/${id}`, value: element },
  ];
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
});

describe("PortfolioCanvas generated UI integration", () => {
  it("renders streamed UI through the real Renderer and replaces it on the next answer", async () => {
    const firstStream = controlledPatchResponse();
    const secondStream = controlledPatchResponse();
    const generationResponses = [firstStream.response, secondStream.response];
    let generationIndex = 0;
    const fetchMock = vi.fn((input: string | URL | Request) => {
      if (input === "/api/generate") {
        const response = generationResponses[generationIndex++];
        if (!response) throw new Error("Unexpected extra generation request");
        return Promise.resolve(response);
      }
      return Promise.resolve(
        new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
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

    fireEvent.click(screen.getByRole("button", { name: "Ask first" }));

    const loadingStatus = await screen.findByRole("status");
    expect(loadingStatus).toHaveTextContent("Composing your answer");
    expect(loadingStatus).toHaveTextContent("first question");
    expect(loadingStatus).toHaveClass("min-h-[52vh]");
    expect(screen.getByTestId("canvas-mode")).toHaveTextContent("streaming");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generate",
      expect.objectContaining({ body: JSON.stringify({ question: "first question" }) }),
    );

    const firstPatches = answerPatches("first-answer", "The first generated answer.");
    act(() => firstStream.push(firstPatches[0]));
    await waitFor(() => expect(screen.getByTestId("canvas-root")).toHaveTextContent("first-answer"));
    act(() => firstStream.push(firstPatches[1]));

    expect(await screen.findByText("The first generated answer.")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveClass("min-h-[52vh]");
    expect(screen.getByTestId("canvas-mode")).toHaveTextContent("streaming");

    act(() => firstStream.close());
    await waitFor(() => expect(screen.getByTestId("canvas-mode")).toHaveTextContent("answer"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask second" }));
    await waitFor(() => expect(screen.getByTestId("canvas-mode")).toHaveTextContent("streaming"));

    const secondPatches = answerPatches("second-answer", "The second generated answer.");
    act(() => secondStream.push(secondPatches[0]));
    await waitFor(() => expect(screen.getByTestId("canvas-root")).toHaveTextContent("second-answer"));
    act(() => secondStream.push(secondPatches[1]));
    expect(await screen.findByText("The second generated answer.")).toBeInTheDocument();

    act(() => secondStream.close());
    await waitFor(() => expect(screen.getByTestId("canvas-mode")).toHaveTextContent("answer"));
    await waitFor(() =>
      expect(screen.queryByText("The first generated answer.")).not.toBeInTheDocument(),
    );

    expect(screen.getByText("The second generated answer.")).toBeInTheDocument();
    const generationCalls = fetchMock.mock.calls.filter(([input]) => input === "/api/generate");
    expect(generationCalls).toHaveLength(2);
    expect(generationCalls[1]).toEqual([
      "/api/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: "second question" }),
      }),
    ]);
  });
});

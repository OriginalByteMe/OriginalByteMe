import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AskMeProvider, useAskMe } from "@/components/AskMeProvider";
import { makeStore } from "@/lib/store";

function CanvasStateProbe() {
  const canvas = useAskMe();
  return (
    <>
      <output data-testid="mode">{canvas.mode}</output>
      <output data-testid="root">{canvas.spec.root}</output>
      <output data-testid="question">{canvas.question}</output>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AskMeProvider", () => {
  it("seeds shared queries into streaming state before client effects run", () => {
    vi.useFakeTimers();

    render(
      <Provider store={makeStore()}>
        <AskMeProvider initialQuery="  server-seeded question  ">
          <CanvasStateProbe />
        </AskMeProvider>
      </Provider>,
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("streaming");
    expect(screen.getByTestId("root")).toBeEmptyDOMElement();
    expect(screen.getByTestId("question")).toHaveTextContent("server-seeded question");
  });
});

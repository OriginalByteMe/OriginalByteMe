import { act, cleanup, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BackdropSceneSync from "@/components/BackdropSceneSync";
import {
  DEFAULT_BACKDROP_PRESET,
  STREAMING_BACKDROP_PRESET,
  type BackdropPresetName,
} from "@/lib/backdrop/presets";
import { makeStore } from "@/lib/store";
import { setBackdropPreset } from "@/lib/store/slices/backdrop-slice";

const askMeState = vi.hoisted(() => ({
  mode: "home" as "home" | "streaming" | "answer",
  plan: null as { backdropPreset: BackdropPresetName } | null,
}));

vi.mock("@/components/AskMeProvider", () => ({
  useAskMe: () => askMeState,
}));

const intersectionObserver = vi.fn();

function renderSceneSync(initialPreset?: BackdropPresetName) {
  const store = makeStore();
  if (initialPreset) store.dispatch(setBackdropPreset(initialPreset));
  const view = render(
    <Provider store={store}>
      <BackdropSceneSync />
    </Provider>,
  );
  return { store, ...view };
}

beforeEach(() => {
  askMeState.mode = "home";
  askMeState.plan = null;
  document.body.innerHTML = `
    <div data-backdrop-scene data-chapter="hero"></div>
    <section id="hero"></section>
    <section id="intro"></section>
    <section id="stack"></section>
    <section id="career"></section>
    <section id="builds"></section>
    <section id="setup"></section>
    <section id="contact"></section>
  `;
  intersectionObserver.mockClear();
  vi.stubGlobal("IntersectionObserver", intersectionObserver);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("BackdropSceneSync", () => {
  it("pins the hero scene and default preset throughout home scrolling", () => {
    const { store } = renderSceneSync("ditherEmber");

    expect(DEFAULT_BACKDROP_PRESET).toBe("ambientLava");
    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);
    expect(document.querySelector("[data-backdrop-scene]")).toHaveAttribute(
      "data-chapter",
      "hero",
    );
    expect(intersectionObserver).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new Event("scroll")));

    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);
    expect(document.querySelector("[data-backdrop-scene]")).toHaveAttribute(
      "data-chapter",
      "hero",
    );
    expect(intersectionObserver).not.toHaveBeenCalled();
  });

  it("holds the typed streaming preset without observing or scheduling", () => {
    vi.useFakeTimers();
    askMeState.mode = "streaming";

    const { store } = renderSceneSync("nightMatte");
    expect(store.getState().backdrop.preset).toBe(STREAMING_BACKDROP_PRESET);
    expect(document.querySelector("[data-backdrop-scene]")).toHaveAttribute(
      "data-chapter",
      "hero",
    );
    expect(intersectionObserver).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(35_000));
    expect(store.getState().backdrop.preset).toBe(STREAMING_BACKDROP_PRESET);
  });

  it("derives the generated preset from the Story Plan", () => {
    askMeState.mode = "answer";
    askMeState.plan = { backdropPreset: "panelParade" };

    const { store } = renderSceneSync("nightMatte");
    expect(store.getState().backdrop.preset).toBe("panelParade");
    expect(document.querySelector("[data-backdrop-scene]")).toHaveAttribute(
      "data-chapter",
      "hero",
    );
    expect(intersectionObserver).not.toHaveBeenCalled();
  });

  it("owns home, planned, and immediate unplanned-streaming transitions", () => {
    const { store, rerender } = renderSceneSync("ditherEmber");
    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);

    askMeState.mode = "answer";
    askMeState.plan = { backdropPreset: "panelParade" };
    rerender(
      <Provider store={store}>
        <BackdropSceneSync />
      </Provider>,
    );
    expect(store.getState().backdrop.preset).toBe("panelParade");

    const streamingPresets: BackdropPresetName[] = [];
    const unsubscribe = store.subscribe(() => {
      streamingPresets.push(store.getState().backdrop.preset);
    });

    askMeState.mode = "streaming";
    askMeState.plan = null;
    rerender(
      <Provider store={store}>
        <BackdropSceneSync />
      </Provider>,
    );
    expect(store.getState().backdrop.preset).toBe(STREAMING_BACKDROP_PRESET);
    expect(streamingPresets).toEqual([
      DEFAULT_BACKDROP_PRESET,
      STREAMING_BACKDROP_PRESET,
    ]);
    unsubscribe();

    askMeState.mode = "home";
    rerender(
      <Provider store={store}>
        <BackdropSceneSync />
      </Provider>,
    );
    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);
  });
});

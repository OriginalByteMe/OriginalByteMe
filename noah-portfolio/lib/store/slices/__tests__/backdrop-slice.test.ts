import { describe, it, expect } from "vitest";

import { DEFAULT_BACKDROP_PRESET } from "@/lib/backdrop/presets";

import { makeStore } from "@/lib/store";
import {
  setBackdropPreset,
  resetBackdropPreset,
  selectBackdropPreset,
} from "@/lib/store/slices/backdrop-slice";

describe("backdrop slice (wired through makeStore)", () => {
  it("initialises backdrop.preset to the ambient default", () => {
    const store = makeStore();
    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);
    expect(selectBackdropPreset(store.getState())).toBe(DEFAULT_BACKDROP_PRESET);
  });

  it("applies a valid preset name", () => {
    const store = makeStore();
    store.dispatch(setBackdropPreset("nightMatte"));
    expect(store.getState().backdrop.preset).toBe("nightMatte");
  });

  it("is a silent no-op for names outside the allowlist", () => {
    const store = makeStore();
    store.dispatch(setBackdropPreset("nightMatte"));
    store.dispatch(setBackdropPreset("bogus"));
    expect(store.getState().backdrop.preset).toBe("nightMatte");

    store.dispatch(setBackdropPreset(""));
    store.dispatch(setBackdropPreset("lavaLamp"));
    expect(store.getState().backdrop.preset).toBe("nightMatte");
  });

  it("resets back to the default preset", () => {
    const store = makeStore();
    store.dispatch(setBackdropPreset("nightMatte"));
    store.dispatch(resetBackdropPreset());
    expect(store.getState().backdrop.preset).toBe(DEFAULT_BACKDROP_PRESET);
    expect(selectBackdropPreset(store.getState())).toBe(DEFAULT_BACKDROP_PRESET);
  });
});

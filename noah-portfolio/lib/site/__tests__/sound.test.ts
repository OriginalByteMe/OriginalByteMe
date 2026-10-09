import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installFakeAudio, type HeardAudio } from "@/lib/site/__fixtures__/browser-fakes";
import type * as Sound from "@/lib/site/sound";

let sound: typeof Sound;
let audio: HeardAudio;

beforeEach(async () => {
  // A fresh module per test keeps the audio singleton out of the "never unlocked" case, so a static
  // import cannot work here.
  vi.resetModules();
  sound = await import("@/lib/site/sound");
  audio = installFakeAudio();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("startThinkingNoises", () => {
  it("makes noises until stopped, then schedules nothing more", () => {
    sound.unlockSiteSound();
    const stop = sound.startThinkingNoises();
    vi.advanceTimersByTime(12_000);
    expect(audio.sounds).toBeGreaterThan(0);

    stop();
    const heard = audio.sounds;
    vi.advanceTimersByTime(12_000);
    expect(audio.sounds).toBe(heard);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stays silent when the visitor's Ask never unlocked sound", () => {
    const stop = sound.startThinkingNoises();
    vi.advanceTimersByTime(12_000);
    stop();
    expect(audio.contexts).toBe(0);
    expect(audio.sounds).toBe(0);
  });
});

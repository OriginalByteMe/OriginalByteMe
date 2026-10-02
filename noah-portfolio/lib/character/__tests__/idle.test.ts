import { describe, expect, it } from "vitest";
import {
  CHARACTER_GREETINGS,
  CharacterIdleController,
  GREETING_BEATS,
  IDLE_CONFIG,
  type IdleFrame,
} from "../idle";

function advance(controller: CharacterIdleController, seconds: number, stationary = true, fps = 60) {
  const frames: IdleFrame[] = [];
  for (let index = 0; index < Math.round(seconds * fps); index += 1) {
    frames.push(controller.tick(1 / fps, stationary));
  }
  return frames;
}

describe("character idle scheduler", () => {
  it("starts only after 6–9 active seconds and at least three uninterrupted idle seconds", () => {
    const controller = new CharacterIdleController({ random: () => 0 });
    expect(advance(controller, 5.5).some((frame) => frame.greetingStarted)).toBe(false);
    advance(controller, 2, false);
    expect(advance(controller, 2.9).some((frame) => frame.greetingStarted)).toBe(false);
    const started = advance(controller, 0.2).find((frame) => frame.greetingStarted);
    expect(started?.greeting?.line).toBe("Hey, my name is Noah. Ask me a question down here.");
    expect(started?.greetingsShown).toBe(1);

    const later = new CharacterIdleController({ random: () => 1 });
    expect(advance(later, 8.9).some((frame) => frame.greetingStarted)).toBe(false);
    expect(advance(later, 0.2).some((frame) => frame.greetingStarted)).toBe(true);
  });

  it("leaves at least 35 active seconds of quiet and never exceeds two automatic greetings", () => {
    const controller = new CharacterIdleController({ random: () => 0 });
    const frames = advance(controller, 180);
    const startIndices = frames.flatMap((frame, index) => frame.greetingStarted ? [index] : []);
    expect(startIndices).toHaveLength(2);
    expect(frames[startIndices[0]].greetingStarted?.id).toBe("intro");
    expect(frames[startIndices[1]].greetingStarted?.id).toBe("hello");
    expect((startIndices[1] - startIndices[0]) / 60).toBeGreaterThanOrEqual(CHARACTER_GREETINGS[0].duration + 35);
    expect(frames.at(-1)?.greetingsShown).toBe(2);
  });

  it("honors session count across controller remounts", () => {
    const oneShown = new CharacterIdleController({ greetingsShown: 1, random: () => 0 });
    expect(advance(oneShown, 34).some((frame) => frame.greetingStarted)).toBe(false);
    const starts = advance(oneShown, 90).filter((frame) => frame.greetingStarted);
    expect(starts).toHaveLength(1);
    expect(starts[0].greetingStarted?.id).toBe("hello");
    const exhausted = new CharacterIdleController({ greetingsShown: 2 });
    expect(advance(exhausted, 120).every((frame) => frame.greeting === null)).toBe(true);
  });

  it("cancels on movement or bump without refunding or replaying the greeting", () => {
    const controller = new CharacterIdleController({ random: () => 0 });
    expect(advance(controller, 6.1).some((frame) => frame.greetingStarted)).toBe(true);
    const cancelled = controller.tick(1 / 60, false);
    expect(cancelled.greetingEnded).toBe(true);
    expect(cancelled.greeting).toBeNull();
    expect(cancelled.talking).toBe(false);
    expect(cancelled.mouthOpen).toBe(0);
    expect(cancelled.bob).toBe(0);
    expect(cancelled.greetingsShown).toBe(1);
    expect(advance(controller, 20).some((frame) => frame.greetingStarted)).toBe(false);
    expect(advance(controller, 60, false).every((frame) => !frame.greetingStarted)).toBe(true);
    expect(advance(controller, 2.9).every((frame) => !frame.greetingStarted)).toBe(true);
    expect(advance(controller, 0.2).some((frame) => frame.greetingStarted?.id === "hello")).toBe(true);
  });

  it("does not advance without ticks and cancels greetings on explicit pause", () => {
    const controller = new CharacterIdleController({ random: () => 0 });
    advance(controller, 6.2);
    controller.cancelGreeting();
    const paused = controller.tick(0, true);
    expect(paused.greeting).toBeNull();
    expect(paused.greetingEnded).toBe(true);
    expect(paused.greetingsShown).toBe(1);
    expect(controller.tick(0, true).greetingEnded).toBe(false);
    expect(advance(controller, 25).every((frame) => !frame.greetingStarted)).toBe(true);
  });

  it("ignores invalid deltas and caps resume spikes", () => {
    const controller = new CharacterIdleController({ random: () => 0 });
    for (const delta of [NaN, Infinity, -1, 0]) {
      const frame = controller.tick(delta, true);
      expect(frame.greetingStarted).toBeNull();
      expect(frame.bob).toBe(0);
    }
    const spike = controller.tick(10000, true);
    expect(spike.greetingStarted).toBeNull();
    expect(spike.bob).toBeCloseTo(0.01 * Math.sin(IDLE_CONFIG.maxDelta * 1.9)
      + 0.005 * Math.sin(IDLE_CONFIG.maxDelta * 0.83));
  });

  it("is repeatable from a seed and produces finite bounded envelopes", () => {
    const first = advance(new CharacterIdleController({ seed: 314 }), 60);
    const second = advance(new CharacterIdleController({ seed: 314 }), 60);
    expect(second).toEqual(first);
    expect(first.some((frame) => frame.mouthOpen > 0.5)).toBe(true);
    expect(first.some((frame) => !frame.talking && frame.mouthOpen > 0.01)).toBe(true);
    for (const frame of first) {
      expect(frame.blink).toBeGreaterThanOrEqual(0);
      expect(frame.blink).toBeLessThanOrEqual(1);
      expect(frame.mouthOpen).toBeGreaterThanOrEqual(0);
      expect(frame.mouthOpen).toBeLessThanOrEqual(frame.talking ? 0.8 : 0.15);
      expect(Math.abs(frame.bob)).toBeLessThanOrEqual(0.015);
    }
  });

  it("blinks naturally for 0.15–0.22 seconds with 3–6 seconds between starts", () => {
    const frames = advance(new CharacterIdleController({ greetingsShown: 2, seed: 52 }), 40, true, 1000);
    const blinks: { start: number; duration: number }[] = [];
    frames.forEach((frame, index) => {
      if (frame.blink > 0 && (index === 0 || frames[index - 1].blink === 0)) {
        blinks.push({ start: index / 1000, duration: 0 });
      }
      if (frame.blink > 0) blinks[blinks.length - 1].duration += 0.001;
    });
    expect(blinks.length).toBeGreaterThan(5);
    for (const [index, blink] of blinks.entries()) {
      expect(blink.duration).toBeGreaterThanOrEqual(0.149);
      expect(blink.duration).toBeLessThanOrEqual(0.221);
      if (index > 0) {
        expect(blink.start - blinks[index - 1].start).toBeGreaterThanOrEqual(3);
        expect(blink.start - blinks[index - 1].start).toBeLessThanOrEqual(6.001);
      }
    }
  });

  it("reserves manual Say hi outside the automatic cap and emits one start event", () => {
    const controller = new CharacterIdleController({ greetingsShown: 2 });
    expect(controller.greetNow().line).toBe("Hi, you see me? Do you see me? Oh, hello.");
    const frame = controller.tick(1 / 60, true);
    expect(frame.greetingStarted?.id).toBe("hello");
    expect(frame.greetingsShown).toBe(2);
    expect(frame.talking).toBe(true);
    expect(controller.tick(1 / 60, true).greetingStarted).toBeNull();
    expect(advance(controller, 6).filter((next) => next.greetingEnded)).toHaveLength(1);
    expect(controller.greetNow("intro").id).toBe("intro");
    expect(controller.tick(1 / 60, true).greetingsShown).toBe(2);
  });

  it("defers automatic greetings after a manual greeting and cancels pending starts", () => {
    const controller = new CharacterIdleController({ random: () => 0 });
    controller.greetNow("intro");
    expect(controller.tick(0, true).greetingStarted?.id).toBe("intro");
    expect(advance(controller, 39).every((frame) => !frame.greetingStarted)).toBe(true);
    expect(advance(controller, 2).some((frame) => frame.greetingStarted?.id === "intro")).toBe(true);
    controller.greetNow();
    controller.cancelGreeting();
    expect(controller.tick(1 / 60, true).greetingStarted).toBeNull();
    controller.greetNow();
    const moving = controller.tick(1 / 60, false);
    expect(moving.greetingStarted).toBeNull();
    expect(moving.greetingEnded).toBe(true);
  });

  it("keeps shared voice beats inside the matching visible line", () => {
    for (const greeting of CHARACTER_GREETINGS) {
      for (const beat of GREETING_BEATS[greeting.id]) {
        expect(beat.at).toBeGreaterThanOrEqual(0);
        expect(beat.duration).toBeGreaterThan(0);
        expect(beat.at + beat.duration).toBeLessThan(greeting.duration);
      }
    }
  });
});

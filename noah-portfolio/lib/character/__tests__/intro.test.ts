import { describe, expect, it } from "vitest";
import {
  CharacterIntroController,
  INTRO_DIALOGUE,
  INTRO_DURATION,
  INTRO_MAX_DELTA,
  INTRO_PHASE_START,
  INTRO_TITLE,
  sampleTimedIntro,
  type IntroFrame,
  type IntroPhase,
  type IntroSample,
  type IntroTickOptions,
} from "../intro";

const START = INTRO_PHASE_START;

function advance(controller: CharacterIntroController, seconds: number, fps = 60, options: IntroTickOptions = {}) {
  const frames: IntroFrame[] = [];
  for (let index = 0; index < Math.round(seconds * fps); index += 1) {
    frames.push(controller.tick(1 / fps, options));
  }
  return frames;
}

/** Every channel the scene reads, including the run pace. */
function values(frame: IntroSample): number[] {
  return [frame.elapsed, frame.progress, frame.phaseProgress, frame.blackOpacity, frame.titleOpacity,
    frame.lens, frame.point, frame.cameraShake, ...Object.values(frame.pose)];
}
/** Channels that place him or the camera; pace is a speed and stops dead at the bonk on purpose. */
function positions(frame: IntroSample): number[] {
  const { travel, slide, lift, lean, turn, squash } = frame.pose;
  return [frame.blackOpacity, frame.titleOpacity, frame.lens, frame.point, frame.cameraShake, travel, slide, lift, lean, turn, squash];
}
const times = (from: number, to: number, step = 0.01) => Array.from({ length: Math.floor((to - from) / step + 1e-6) + 1 }, (_, index) => from + index * step);

describe("timed intro sampler", () => {
  it.each<[number, IntroPhase]>([
    [-1, "opening"], [0, "opening"], [START.approach - 1e-6, "opening"],
    [START.approach, "approach"], [START.bonk - 1e-6, "approach"], [START.bonk, "bonk"],
    [START.recoil, "recoil"], [START.recover, "recover"], [START.point - 1e-6, "recover"],
    [START.point, "point"], [START.roam - 1e-6, "point"], [START.roam, "roam"], [100, "roam"],
  ])("assigns %s active seconds to %s", (time, phase) => {
    expect(sampleTimedIntro(time).phase).toBe(phase);
  });

  it("fades the click card's black and title out over a short opening, with him at the far end of his run", () => {
    expect(INTRO_TITLE).toBe("Hi, I’m Noah Rijkaard");
    expect(sampleTimedIntro(0).blackOpacity).toBe(1);
    expect(sampleTimedIntro(0).titleOpacity).toBe(1);
    expect(sampleTimedIntro(START.approach / 2).blackOpacity).toBeGreaterThan(0);
    expect(sampleTimedIntro(START.approach / 2).blackOpacity).toBeLessThan(1);
    const start = sampleTimedIntro(START.approach);
    expect(start.blackOpacity).toBe(0);
    expect(start.titleOpacity).toBe(0);
    expect(start.pose.travel).toBe(0);
    expect(start.lens).toBe(1);
  });

  it("runs at the lens without slowing down, so he hits it at full speed", () => {
    const run = times(START.approach, START.bonk - 0.001).map((time) => sampleTimedIntro(time));
    expect(run[0].pose.travel).toBe(0);
    for (let index = 1; index < run.length; index += 1) {
      expect(run[index].pose.travel).toBeGreaterThan(run[index - 1].pose.travel);
      expect(run[index].pose.pace).toBeGreaterThanOrEqual(run[index - 1].pose.pace - 1e-12);
    }
    const last = run.at(-1)!;
    expect(last.pose.pace).toBeGreaterThan(0);
    expect(last.pose.pace).toBeCloseTo(run[Math.floor(run.length / 2)].pose.pace, 8);
    // Pace is the travel per second: integrating it lands on the lens.
    let travel = 0;
    for (const time of times(START.approach, START.bonk, 0.001).slice(1)) travel += sampleTimedIntro(time - 0.0005).pose.pace * 0.001;
    expect(travel).toBeCloseTo(1, 3);
    expect(sampleTimedIntro(START.bonk).pose.travel).toBe(1);
    expect(sampleTimedIntro(START.bonk).pose.pace).toBe(0);
  });

  it("bonks, falls back a short slide, stands up and points, holding the lens shot until he recovers", () => {
    const bonk = sampleTimedIntro((START.bonk + START.recoil) / 2);
    expect(bonk.pose.squash).toBeCloseTo(0.87);
    expect(bonk.cameraShake).toBeGreaterThan(0.5);
    expect(bonk.caption).toBeNull();
    expect(sampleTimedIntro(START.recoil).caption).toBe("Ow");
    expect(sampleTimedIntro(START.recover).pose.lean).toBe(-1.22);
    expect(sampleTimedIntro(START.recover).pose.slide).toBeCloseTo(0.6);
    for (const time of times(0, START.recover)) expect(sampleTimedIntro(time).lens).toBe(1);
    // One dolly out: the lens weight only falls, and it is done while he points.
    const dolly = times(START.recover, START.roam).map((time) => sampleTimedIntro(time).lens);
    dolly.slice(1).forEach((lens, index) => expect(lens).toBeLessThanOrEqual(dolly[index]));
    expect(sampleTimedIntro(START.point + 1.2).lens).toBe(0);
    expect(sampleTimedIntro(START.point).caption).toBe(INTRO_DIALOGUE.point.line);
    expect(sampleTimedIntro(START.point - 0.01).point).toBe(0);
    expect(sampleTimedIntro((START.point + START.roam) / 2).point).toBe(1);
    const end = sampleTimedIntro(INTRO_DURATION);
    expect(end.pose).toEqual({ travel: 1, pace: 0, slide: 0.6, lift: 0, lean: 0, turn: 0, squash: 1 });
    expect(end.lens).toBe(0);
    expect(end.point).toBe(0);
    expect(end.cameraShake).toBe(0);
  });

  it("keeps every position, opacity and camera channel continuous at every phase boundary", () => {
    for (const time of Object.values(START).slice(1)) {
      const before = positions(sampleTimedIntro(time - 0.000001));
      const after = positions(sampleTimedIntro(time + 0.000001));
      before.forEach((value, index) => expect(Math.abs(value - after[index])).toBeLessThan(0.0001));
    }
  });

  it("is finite and deterministic across the whole timeline and malformed samples", () => {
    expect(sampleTimedIntro(NaN)).toEqual(sampleTimedIntro(0));
    expect(sampleTimedIntro(-Infinity)).toEqual(sampleTimedIntro(0));
    expect(sampleTimedIntro(Infinity)).toEqual(sampleTimedIntro(INTRO_DURATION));
    const samples = [-99, NaN, Infinity, -Infinity, ...times(0, 12)];
    for (const time of samples) {
      const frame = sampleTimedIntro(time);
      expect(values(frame).every(Number.isFinite)).toBe(true);
      for (const value of [frame.progress, frame.phaseProgress, frame.blackOpacity, frame.titleOpacity,
        frame.lens, frame.point, frame.cameraShake, frame.pose.travel]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(sampleTimedIntro(time)).toEqual(frame);
    }
  });

  it("provides a static reduced-motion endpoint without a black overlay or caption", () => {
    const frame = sampleTimedIntro(0, { reducedMotion: true });
    expect(frame).toEqual(sampleTimedIntro(INTRO_DURATION));
    expect(frame.blackOpacity).toBe(0);
    expect(frame.titleOpacity).toBe(0);
    expect(frame.caption).toBeNull();
  });
});

describe("active-time intro controller", () => {
  it("stays at opening until active ticks and finishes after the whole intro", () => {
    const controller = new CharacterIntroController();
    expect(controller.tick(0).phase).toBe("opening");
    expect(controller.tick(0).elapsed).toBe(0);
    expect(advance(controller, START.approach + 0.1).at(-1)?.phase).toBe("approach");
    const end = advance(controller, INTRO_DURATION).at(-1)!;
    expect(end.elapsed).toBe(INTRO_DURATION);
    expect(end.phase).toBe("roam");
    expect(advance(controller, 10).at(-1)).toEqual(end);
  });

  it("matches poses and one-shot dialogue at 30, 60, and 120 Hz", () => {
    const runs = [30, 60, 120].map((fps) => {
      const controller = new CharacterIntroController();
      const samples: IntroFrame[] = [];
      const cues: string[] = [];
      for (let index = 0; index < 24; index += 1) {
        const frames = advance(controller, 0.5, fps);
        samples.push(frames.at(-1)!);
        cues.push(...frames.flatMap((frame) => frame.dialogueStarted ? [frame.dialogueStarted.id] : []));
      }
      return { samples, cues };
    });
    for (const run of runs) {
      expect(run.cues).toEqual(["approach", "recoil", "recover", "point"]);
      run.samples.forEach((frame, index) => {
        expect(frame.phase).toBe(runs[0].samples[index].phase);
        expect(frame.caption).toBe(runs[0].samples[index].caption);
        values(frame).forEach((value, channel) => expect(value).toBeCloseTo(values(runs[0].samples[index])[channel], 8));
      });
    }
  });

  it("freezes hidden/offscreen playback, cancels speech once, and never replays on resume", () => {
    const controller = new CharacterIntroController();
    const before = advance(controller, START.approach + 1).at(-1)!;
    expect(before.caption).toBe(INTRO_DIALOGUE.approach.line);
    const paused = advance(controller, 60, 30, { paused: true });
    expect(paused[0].dialogueEnded).toBe(true);
    expect(paused.slice(1).every((frame) => !frame.dialogueEnded && !frame.dialogueStarted)).toBe(true);
    expect(paused.at(-1)?.pose).toEqual(before.pose);
    expect(paused.at(-1)?.elapsed).toBe(before.elapsed);
    expect(paused.at(-1)?.caption).toBeNull();
    const resumed = advance(controller, 0.5);
    expect(resumed.every((frame) => frame.dialogueStarted === null && frame.caption === null)).toBe(true);
    expect(advance(controller, START.recover - before.elapsed - 0.6).filter((frame) => frame.dialogueStarted).map((frame) => frame.dialogueStarted?.id))
      .toEqual(["recoil"]);
  });

  it("ignores invalid deltas, bounds resume spikes, and clamps overshoot to the endpoint", () => {
    const controller = new CharacterIntroController();
    for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
      expect(controller.tick(dt).elapsed).toBe(0);
    }
    expect(controller.tick(3600).elapsed).toBe(INTRO_MAX_DELTA);
    expect(controller.tick(3600, { paused: true }).elapsed).toBe(INTRO_MAX_DELTA);
    advance(controller, INTRO_DURATION - 0.15, 100);
    expect(controller.tick(3600).elapsed).toBe(INTRO_DURATION);
    expect(controller.tick(3600).phase).toBe("roam");
  });

  it("gates each dialogue once and ends the caption at its duration", () => {
    const controller = new CharacterIntroController();
    const frames = advance(controller, INTRO_DURATION + 1, 100);
    const starts = frames.filter((frame) => frame.dialogueStarted);
    expect(starts.map((frame) => frame.dialogueStarted)).toEqual(Object.values(INTRO_DIALOGUE));
    expect(starts.map((frame) => frame.phase)).toEqual(["approach", "recoil", "recover", "point"]);
    expect(frames.filter((frame) => frame.dialogueEnded)).toHaveLength(4);
    for (const frame of starts) {
      const dialogue = frame.dialogueStarted!;
      expect(frame.elapsed).toBeCloseTo(INTRO_PHASE_START[dialogue.id], 8);
      const afterEnd = frames.find((item) => item.elapsed >= INTRO_PHASE_START[dialogue.id] + dialogue.duration)!;
      // The point line starts the moment the recover line ends.
      expect(afterEnd.caption).not.toBe(dialogue.line);
    }
    expect(controller.consumedDialogueIds).toEqual(["approach", "recoil", "recover", "point"]);
    expect(controller.tick(0).dialogueStarted).toBeNull();
  });

  it("skips immediately from every phase, cancels once, and cannot accidentally restart", () => {
    for (const time of [0, 0.3, 2, 3.7, 4.5, 6, 9, 12]) {
      const controller = new CharacterIntroController();
      const before = advance(controller, time, 100).at(-1) ?? controller.tick(0);
      const skipped = controller.skip();
      expect(skipped.phase).toBe("roam");
      expect(skipped.skipped).toBe(true);
      expect(skipped.blackOpacity).toBe(0);
      expect(skipped.dialogueEnded).toBe(before.dialogue !== null);
      expect(skipped.dialogueStarted).toBeNull();
      expect(skipped.caption).toBeNull();
      expect(controller.skip().dialogueEnded).toBe(false);
      expect(controller.tick(10, { paused: true }).phase).toBe("roam");
      expect(controller.tick(0).dialogueEnded).toBe(false);
    }
    expect(new CharacterIntroController({ skipped: true }).tick(0).phase).toBe("roam");
  });

  it("honors reduced motion on construction and live changes without restarting when disabled", () => {
    expect(new CharacterIntroController({ reducedMotion: true }).tick(0).phase).toBe("roam");
    const controller = new CharacterIntroController();
    advance(controller, START.approach + 1);
    const reduced = controller.tick(0, { paused: true, reducedMotion: true });
    expect(reduced.phase).toBe("roam");
    expect(reduced.dialogueEnded).toBe(true);
    expect(reduced.cameraShake).toBe(0);
    expect(controller.tick(0, { reducedMotion: false }).phase).toBe("roam");
    expect(controller.tick(0).dialogueEnded).toBe(false);
    const stillReduced = new CharacterIntroController({ reducedMotion: true });
    expect(stillReduced.reset().phase).toBe("roam");
    expect(stillReduced.reset({ reducedMotion: false }).phase).toBe("opening");
  });

  it("restores consumed cues and supports an explicit deterministic replay", () => {
    const controller = new CharacterIntroController({ consumedDialogueIds: ["approach", "recoil"] });
    const restored = advance(controller, INTRO_DURATION + 1);
    expect(restored.filter((frame) => frame.dialogueStarted).map((frame) => frame.dialogueStarted?.id))
      .toEqual(["recover", "point"]);
    expect(controller.reset().elapsed).toBe(0);
    expect(controller.consumedDialogueIds).toEqual([]);
    const first = advance(controller, START.approach + 1);
    expect(controller.reset().dialogueEnded).toBe(true);
    expect(advance(controller, START.approach + 1)).toEqual(first);
    controller.skip();
    expect(controller.reset().skipped).toBe(false);
    expect(controller.tick(0).phase).toBe("opening");
  });
});

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

function advance(controller: CharacterIntroController, seconds: number, fps = 60, options: IntroTickOptions = {}) {
  const frames: IntroFrame[] = [];
  for (let index = 0; index < Math.round(seconds * fps); index += 1) {
    frames.push(controller.tick(1 / fps, options));
  }
  return frames;
}

function values(frame: IntroSample): number[] {
  return [frame.elapsed, frame.progress, frame.phaseProgress, frame.revealProgress,
    frame.approachProgress, frame.recoilProgress, frame.recoverProgress, frame.cameraProgress,
    frame.blackOpacity, frame.titleOpacity, frame.runBlend, frame.stridePhase,
    frame.cameraShake, ...Object.values(frame.pose)];
}

describe("timed intro sampler", () => {
  it.each<[number, IntroPhase]>([
    [-1, "opening"], [0, "opening"], [2.199999, "opening"],
    [2.2, "reveal"], [3.599999, "reveal"], [3.6, "approach"],
    [6.599999, "approach"], [6.6, "bonk"], [7.049999, "bonk"],
    [7.05, "recoil"], [8.799999, "recoil"], [8.8, "recover"],
    [11.599999, "recover"], [11.6, "roam"], [100, "roam"],
  ])("assigns %s active seconds to %s", (time, phase) => {
    expect(sampleTimedIntro(time).phase).toBe(phase);
  });

  it("starts black, presents the exact title, and fades to the scene before the run", () => {
    expect(INTRO_TITLE).toBe("Hi, I’m Noah Rijkaard");
    expect(sampleTimedIntro(0).blackOpacity).toBe(1);
    expect(sampleTimedIntro(1).titleOpacity).toBe(1);
    expect(sampleTimedIntro(2.8).blackOpacity).toBeGreaterThan(0);
    expect(sampleTimedIntro(2.8).blackOpacity).toBeLessThan(1);
    expect(sampleTimedIntro(INTRO_PHASE_START.approach).blackOpacity).toBe(0);
    expect(sampleTimedIntro(INTRO_PHASE_START.approach).titleOpacity).toBe(0);
    expect(sampleTimedIntro(INTRO_PHASE_START.approach).pose.depth).toBe(0);
  });

  it("runs to the lens, impacts, falls back, and stands up at the roam position", () => {
    expect(sampleTimedIntro(5).runBlend).toBe(1);
    expect(sampleTimedIntro(INTRO_PHASE_START.bonk).pose.depth).toBe(1);
    const bonk = sampleTimedIntro(6.825);
    expect(bonk.pose.squash).toBeCloseTo(0.87);
    expect(bonk.cameraShake).toBeGreaterThan(0.5);
    expect(bonk.caption).toBeNull();
    expect(sampleTimedIntro(INTRO_PHASE_START.recoil).caption).toBe("Ow");
    expect(sampleTimedIntro(8.5).pose.lean).toBeLessThan(-1);
    expect(sampleTimedIntro(INTRO_PHASE_START.recover).pose.lean).toBe(-1.22);
    const end = sampleTimedIntro(INTRO_DURATION);
    expect(end.pose).toEqual({ depth: 0.45, lift: 0, lean: 0, turn: 0, squash: 1 });
    expect(end.cameraProgress).toBe(1);
    expect(end.cameraShake).toBe(0);
    expect(end.runBlend).toBe(0);
  });

  it("keeps all pose, opacity, and camera channels continuous at every phase boundary", () => {
    const channels = (frame: IntroSample) => [frame.blackOpacity, frame.titleOpacity,
      frame.cameraProgress, frame.runBlend, frame.stridePhase, frame.cameraShake, ...Object.values(frame.pose)];
    for (const time of Object.values(INTRO_PHASE_START).slice(1)) {
      const before = channels(sampleTimedIntro(time - 0.000001));
      const after = channels(sampleTimedIntro(time + 0.000001));
      before.forEach((value, index) => expect(Math.abs(value - after[index])).toBeLessThan(0.0001));
    }
  });

  it("is finite and deterministic across the whole timeline and malformed samples", () => {
    expect(sampleTimedIntro(NaN)).toEqual(sampleTimedIntro(0));
    expect(sampleTimedIntro(-Infinity)).toEqual(sampleTimedIntro(0));
    expect(sampleTimedIntro(Infinity)).toEqual(sampleTimedIntro(INTRO_DURATION));
    const samples = [-99, NaN, Infinity, -Infinity,
      ...Array.from({ length: 1201 }, (_, index) => index / 100)];
    for (const time of samples) {
      const frame = sampleTimedIntro(time);
      expect(values(frame).every(Number.isFinite)).toBe(true);
      for (const value of [frame.progress, frame.phaseProgress, frame.blackOpacity,
        frame.titleOpacity, frame.cameraProgress, frame.runBlend, frame.cameraShake, frame.pose.depth]) {
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
  it("stays at opening until active ticks and finishes after 11.6 active seconds", () => {
    const controller = new CharacterIntroController();
    expect(controller.tick(0).phase).toBe("opening");
    expect(controller.tick(0).elapsed).toBe(0);
    expect(advance(controller, 3.6).at(-1)?.phase).toBe("approach");
    const end = advance(controller, 8).at(-1)!;
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
      expect(run.cues).toEqual(["approach", "recoil", "recover"]);
      run.samples.forEach((frame, index) => {
        expect(frame.phase).toBe(runs[0].samples[index].phase);
        expect(frame.caption).toBe(runs[0].samples[index].caption);
        values(frame).forEach((value, channel) => expect(value).toBeCloseTo(values(runs[0].samples[index])[channel], 8));
      });
    }
  });

  it("freezes hidden/offscreen playback, cancels speech once, and never replays on resume", () => {
    const controller = new CharacterIntroController();
    const before = advance(controller, 4).at(-1)!;
    expect(before.caption).toBe(INTRO_DIALOGUE.approach.line);
    const paused = advance(controller, 60, 30, { paused: true });
    expect(paused[0].dialogueEnded).toBe(true);
    expect(paused.slice(1).every((frame) => !frame.dialogueEnded && !frame.dialogueStarted)).toBe(true);
    expect(paused.at(-1)?.pose).toEqual(before.pose);
    expect(paused.at(-1)?.elapsed).toBe(before.elapsed);
    expect(paused.at(-1)?.caption).toBeNull();
    const resumed = advance(controller, 0.5);
    expect(resumed.every((frame) => frame.dialogueStarted === null && frame.caption === null)).toBe(true);
    expect(advance(controller, 4).filter((frame) => frame.dialogueStarted).map((frame) => frame.dialogueStarted?.id))
      .toEqual(["recoil"]);
  });

  it("ignores invalid deltas, bounds resume spikes, and clamps overshoot to the endpoint", () => {
    const controller = new CharacterIntroController();
    for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
      expect(controller.tick(dt).elapsed).toBe(0);
    }
    expect(controller.tick(3600).elapsed).toBe(INTRO_MAX_DELTA);
    expect(controller.tick(3600, { paused: true }).elapsed).toBe(INTRO_MAX_DELTA);
    advance(controller, 11.45, 100);
    expect(controller.tick(3600).elapsed).toBe(INTRO_DURATION);
    expect(controller.tick(3600).phase).toBe("roam");
  });

  it("gates each dialogue once and ends the caption at its duration", () => {
    const controller = new CharacterIntroController();
    const frames = advance(controller, 12, 100);
    const starts = frames.filter((frame) => frame.dialogueStarted);
    expect(starts.map((frame) => frame.dialogueStarted)).toEqual(Object.values(INTRO_DIALOGUE));
    expect(starts.map((frame) => frame.phase)).toEqual(["approach", "recoil", "recover"]);
    expect(frames.filter((frame) => frame.dialogueEnded)).toHaveLength(3);
    for (const frame of starts) {
      const dialogue = frame.dialogueStarted!;
      expect(frame.elapsed).toBeCloseTo(INTRO_PHASE_START[dialogue.id], 8);
      const afterEnd = frames.find((item) => item.elapsed >= INTRO_PHASE_START[dialogue.id] + dialogue.duration)!;
      expect(afterEnd.caption).toBeNull();
    }
    expect(controller.consumedDialogueIds).toEqual(["approach", "recoil", "recover"]);
    expect(controller.tick(0).dialogueStarted).toBeNull();
  });

  it("skips immediately from every phase, cancels once, and cannot accidentally restart", () => {
    for (const time of [0, 2.5, 4, 6.8, 7.3, 9, 12]) {
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
    advance(controller, 4);
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
    const restored = advance(controller, 12);
    expect(restored.filter((frame) => frame.dialogueStarted).map((frame) => frame.dialogueStarted?.id))
      .toEqual(["recover"]);
    expect(controller.reset().elapsed).toBe(0);
    expect(controller.consumedDialogueIds).toEqual([]);
    const first = advance(controller, 4);
    expect(controller.reset().dialogueEnded).toBe(true);
    expect(advance(controller, 4)).toEqual(first);
    controller.skip();
    expect(controller.reset().skipped).toBe(false);
    expect(controller.tick(0).phase).toBe("opening");
  });
});

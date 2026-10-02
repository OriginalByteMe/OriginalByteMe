import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CharacterNarrativeController,
  NarrativeFactController,
  NARRATIVE_FACT_CONFIG,
  type NarrativeFactFrame,
  type NarrativeFactTickOptions,
  heroScrollProgress,
  NARRATIVE_DIALOGUE,
  NARRATIVE_PHASE_START,
  PUBLIC_CHARACTER_FACTS,
  sampleNarrative,
  type NarrativePhase,
} from "../narrative";

describe("scroll narrative sampler", () => {
  it.each<[number, NarrativePhase]>([
    [-1, "intro"], [0, "intro"], [0.119999, "intro"],
    [0.12, "approach"], [0.379999, "approach"],
    [0.38, "bonk"], [0.499999, "bonk"],
    [0.5, "invitation"], [0.649999, "invitation"],
    [0.65, "roam"], [1, "roam"], [2, "roam"],
  ])("assigns progress %s to %s at exact lower bounds", (progress, phase) => {
    expect(sampleNarrative(progress).phase).toBe(phase);
  });

  it("sanitizes non-finite inputs and clamps progress", () => {
    expect(sampleNarrative(NaN)).toEqual(sampleNarrative(0));
    expect(sampleNarrative(-Infinity)).toEqual(sampleNarrative(0));
    expect(sampleNarrative(Infinity)).toEqual(sampleNarrative(1));
    for (const progress of [-9, NaN, Infinity, -Infinity, 0, 0.38, 1, 99]) {
      const frame = sampleNarrative(progress);
      for (const value of [frame.progress, frame.phaseProgress, frame.approachProgress,
        frame.recoilProgress, frame.invitationProgress, frame.runBlend, frame.cameraShake]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(Object.values(frame.pose).every(Number.isFinite)).toBe(true);
    }
  });

  it("is deterministic when reversed and has no clock-driven advancement", () => {
    const progress = Array.from({ length: 101 }, (_, index) => index / 100);
    const forward = progress.map((value) => sampleNarrative(value));
    const backward = progress.toReversed().map((value) => sampleNarrative(value));
    expect(backward.toReversed()).toEqual(forward);
    expect(sampleNarrative(0.3)).toEqual(sampleNarrative(0.3));
  });

  it("moves to the lens, recoils, then settles without position discontinuities", () => {
    expect(sampleNarrative(0).pose.depth).toBe(0);
    expect(sampleNarrative(0.38).pose.depth).toBe(1);
    expect(sampleNarrative(0.5).pose.depth).toBe(0.5);
    expect(sampleNarrative(0.65).pose.depth).toBe(0.45);
    expect(sampleNarrative(0.23).runBlend).toBe(1);
    expect(sampleNarrative(0.4).cameraShake).toBeGreaterThan(0.5);
    expect(sampleNarrative(0.48).cameraShake).toBe(0);
    expect(sampleNarrative(0.65).runBlend).toBe(0);
    for (const start of Object.values(NARRATIVE_PHASE_START).slice(1)) {
      const before = sampleNarrative(start - 0.000001);
      const after = sampleNarrative(start);
      expect(Math.abs(before.pose.depth - after.pose.depth)).toBeLessThan(0.00001);
      expect(Math.abs(before.pose.lean - after.pose.lean)).toBeLessThan(0.0001);
      expect(Math.abs(before.runBlend - after.runBlend)).toBeLessThan(0.0001);
    }
  });

  it("makes reduced motion immediately static and ready for roaming", () => {
    const staticFrame = sampleNarrative(0, { reducedMotion: true });
    expect(staticFrame.phase).toBe("roam");
    expect(staticFrame.pose).toEqual({ depth: 0.45, lift: 0, lean: 0, turn: 0, squash: 1 });
    expect(staticFrame.cameraShake).toBe(0);
    expect(staticFrame.runBlend).toBe(0);
    expect(staticFrame.caption).toBeNull();
    expect(sampleNarrative(0.4, { reducedMotion: true })).toEqual(staticFrame);
  });

  it("uses the requested dialogue and exposes no invitation before its phase", () => {
    expect(sampleNarrative(0.2).caption).toBe("Hi hi hi hi");
    expect(sampleNarrative(0.4).caption).toBe("Ow");
    expect(sampleNarrative(0.55).caption).toBe(
      "Hey, is there anything you’d like to know about me? I’m just gonna follow you around for a little bit.",
    );
    expect(sampleNarrative(0).caption).toBeNull();
  });
});

describe("one-shot cinematic dialogue", () => {
  it("emits one entry event, holds its caption, and ends it on phase exit", () => {
    const controller = new CharacterNarrativeController();
    expect(controller.update(0).dialogueStarted).toBeNull();
    const start = controller.update(0.12);
    expect(start.dialogueStarted).toEqual(NARRATIVE_DIALOGUE.approach);
    expect(start.caption).toBe("Hi hi hi hi");
    expect(start.dialogueEnded).toBe(false);
    const held = controller.update(0.25);
    expect(held.dialogueStarted).toBeNull();
    expect(held.caption).toBe("Hi hi hi hi");
    const bonk = controller.update(0.38);
    expect(bonk.dialogueEnded).toBe(true);
    expect(bonk.dialogueStarted?.id).toBe("bonk");
    expect(controller.update(0.42).dialogueEnded).toBe(false);
    expect(controller.update(0.5).dialogueStarted?.id).toBe("invitation");
    expect(controller.update(0.65).dialogueEnded).toBe(true);
    expect(controller.update(0.8).caption).toBeNull();
  });

  it("allows pose reversal but no caption or audio spam on repeated crossings", () => {
    const controller = new CharacterNarrativeController();
    const progress = [0.2, 0.39, 0.2, 0.39, 0.37, 0.39, 0.51, 0.64, 0.66, 0.51, 0, 1];
    const frames = progress.map((value) => controller.update(value));
    expect(frames.flatMap((frame) => frame.dialogueStarted ? [frame.dialogueStarted.id] : []))
      .toEqual(["approach", "bonk", "invitation"]);
    expect(frames[2].pose).toEqual(sampleNarrative(0.2).pose);
    expect(frames[2].caption).toBeNull();
    expect(frames[3].caption).toBeNull();
    expect(frames[9].caption).toBeNull();
    expect(controller.consumedDialogueIds).toEqual(["approach", "bonk", "invitation"]);
  });

  it("consumes skipped phases without queuing their old lines on a fast scroll", () => {
    const controller = new CharacterNarrativeController();
    expect(controller.update(0.52).dialogueStarted?.id).toBe("invitation");
    expect(controller.update(0.2).dialogueStarted).toBeNull();
    expect(controller.update(0.4).dialogueStarted).toBeNull();
    const restoredScroll = new CharacterNarrativeController();
    expect(restoredScroll.update(1).dialogueStarted).toBeNull();
    expect(restoredScroll.update(0.52).caption).toBeNull();
  });

  it("persists consumed IDs across scene remounts without touching browser storage", () => {
    const first = new CharacterNarrativeController();
    first.update(0.4);
    const remounted = new CharacterNarrativeController({ consumedDialogueIds: first.consumedDialogueIds });
    expect(remounted.update(0.4).dialogueStarted).toBeNull();
    expect(remounted.update(0.5).dialogueStarted?.id).toBe("invitation");
  });

  it("skips permanently, cancels once, and never restarts when scrolled backwards", () => {
    const controller = new CharacterNarrativeController();
    controller.update(0.2);
    controller.skipIntro();
    const skipped = controller.update(0.2, { paused: true });
    expect(skipped.phase).toBe("roam");
    expect(skipped.skipped).toBe(true);
    expect(skipped.dialogueEnded).toBe(true);
    expect(skipped.dialogueStarted).toBeNull();
    expect(controller.update(0).phase).toBe("roam");
    expect(controller.update(0).dialogueEnded).toBe(false);
    expect(controller.update(0.5).caption).toBeNull();
    const restored = new CharacterNarrativeController({ skipped: true });
    expect(restored.update(0).phase).toBe("roam");
  });

  it("freezes progress on pause, cancels a line once, and does not replay it on resume", () => {
    const controller = new CharacterNarrativeController();
    const before = controller.update(0.2);
    const paused = controller.update(0.6, { paused: true });
    expect(paused.progress).toBe(before.progress);
    expect(paused.pose).toEqual(before.pose);
    expect(paused.dialogueStarted).toBeNull();
    expect(paused.dialogueEnded).toBe(true);
    expect(paused.caption).toBeNull();
    expect(controller.update(0.6, { paused: true }).dialogueEnded).toBe(false);
    expect(controller.update(0.2).dialogueStarted).toBeNull();
    expect(controller.update(0.5).dialogueStarted?.id).toBe("invitation");
  });

  it("handles reduced motion at initialization and live preference changes", () => {
    const reduced = new CharacterNarrativeController({ reducedMotion: true });
    expect(reduced.update(0).phase).toBe("roam");
    expect(reduced.update(0.4).dialogueStarted).toBeNull();
    const controller = new CharacterNarrativeController();
    controller.update(0.2);
    const changed = controller.update(0.4, { reducedMotion: true, paused: true });
    expect(changed.phase).toBe("roam");
    expect(changed.dialogueEnded).toBe(true);
    expect(changed.cameraShake).toBe(0);
    expect(controller.update(0.4, { reducedMotion: false }).dialogueStarted).toBeNull();
  });
});

describe("hero geometry and public fact provenance", () => {
  it("derives progress from current hero geometry after scrolling or resize", () => {
    expect(heroScrollProgress({ top: 100, height: 3000 }, 1000)).toBe(0);
    expect(heroScrollProgress({ top: -1000, height: 3000 }, 1000)).toBe(0.5);
    expect(heroScrollProgress({ top: -1000, height: 3000 }, 500)).toBe(0.4);
    expect(heroScrollProgress({ top: -9999, height: 3000 }, 1000)).toBe(1);
    expect(heroScrollProgress({ top: -10, height: 500 }, 1000)).toBe(0);
    expect(heroScrollProgress({ top: NaN, height: 3000 }, 1000)).toBe(0);
    expect(heroScrollProgress({ top: -100, height: 3000 }, 0)).toBe(0);
  });

  it("includes only four brief facts linked to real, public corpus files", () => {
    expect(PUBLIC_CHARACTER_FACTS).toHaveLength(4);
    expect(new Set(PUBLIC_CHARACTER_FACTS.map((fact) => fact.id)).size).toBe(4);
    const evidence = ["3D printing / CAD", "Proxmox + Unraid", "Building marketplace analytics", "pit two LLMs against each other"];
    PUBLIC_CHARACTER_FACTS.forEach((fact, index) => {
      expect(fact.source).toMatch(/^content\/about-me\/(?:projects\/)?[a-z-]+\.md$/);
      expect(fact.line.length).toBeLessThan(100);
      expect(fact.duration).toBeGreaterThan(0);
      expect(readFileSync(resolve(process.cwd(), fact.source), "utf8")).toContain(evidence[index]);
    });
  });
});


function advanceFacts(controller: NarrativeFactController, seconds: number,
  options: NarrativeFactTickOptions = { phase: "roam", stationary: true }) {
  const frames: NarrativeFactFrame[] = [];
  for (let index = 0; index < Math.round(seconds * 60); index += 1) {
    frames.push(controller.tick(1 / 60, options));
  }
  return frames;
}

describe("roaming fact asides", () => {
  it("requires roaming and three uninterrupted stationary seconds", () => {
    const controller = new NarrativeFactController();
    expect(advanceFacts(controller, 20, { phase: "invitation", stationary: true })
      .every((frame) => frame.factStarted === null)).toBe(true);
    expect(advanceFacts(controller, 2.9).some((frame) => frame.factStarted)).toBe(false);
    advanceFacts(controller, 1, { phase: "roam", stationary: false });
    expect(advanceFacts(controller, 2.9).some((frame) => frame.factStarted)).toBe(false);
    const start = advanceFacts(controller, 0.2).find((frame) => frame.factStarted);
    expect(start?.factStarted).toEqual(PUBLIC_CHARACTER_FACTS[0]);
    expect(start?.count).toBe(1);
  });

  it("leaves 25 active seconds of quiet after completion and caps at three per session", () => {
    const controller = new NarrativeFactController();
    const frames = advanceFacts(controller, 180);
    const starts = frames.flatMap((frame, index) => frame.factStarted ? [index] : []);
    expect(starts).toHaveLength(3);
    starts.slice(1).forEach((index, previous) => {
      expect((index - starts[previous]) / 60).toBeGreaterThanOrEqual(
        PUBLIC_CHARACTER_FACTS[previous].duration + NARRATIVE_FACT_CONFIG.minimumQuietGap,
      );
    });
    expect(frames.at(-1)?.count).toBe(3);
    expect(frames.at(-1)?.activeFact).toBeNull();
  });

  it("cancels on movement without refund and requires stationary time before the next fact", () => {
    const controller = new NarrativeFactController();
    advanceFacts(controller, 3.1);
    const cancelled = controller.tick(1 / 60, { phase: "roam", stationary: false });
    expect(cancelled.factEnded).toBe(true);
    expect(cancelled.activeFact).toBeNull();
    expect(cancelled.count).toBe(1);
    expect(controller.tick(0, { phase: "roam", stationary: false }).factEnded).toBe(false);
    advanceFacts(controller, 30, { phase: "roam", stationary: false });
    expect(advanceFacts(controller, 2.9).some((frame) => frame.factStarted)).toBe(false);
    expect(advanceFacts(controller, 0.2).find((frame) => frame.factStarted)?.factStarted)
      .toEqual(PUBLIC_CHARACTER_FACTS[1]);
  });

  it("does not advance while paused or outside roam and cancels current text once", () => {
    const controller = new NarrativeFactController();
    advanceFacts(controller, 3.1);
    const paused = advanceFacts(controller, 100, { phase: "roam", stationary: true, paused: true });
    expect(paused[0].factEnded).toBe(true);
    expect(paused.slice(1).every((frame) => !frame.factEnded && !frame.factStarted)).toBe(true);
    expect(advanceFacts(controller, 24).some((frame) => frame.factStarted)).toBe(false);
    expect(advanceFacts(controller, 1.1).some((frame) => frame.factStarted)).toBe(true);
    const leftRoam = controller.tick(0, { phase: "intro", stationary: true });
    expect(leftRoam.factEnded).toBe(true);
    expect(leftRoam.activeFact).toBeNull();
    expect(advanceFacts(controller, 100, { phase: "intro", stationary: true })
      .every((frame) => !frame.factStarted)).toBe(true);
  });

  it("restores the count and a conservative quiet gap after a scene remount", () => {
    const restored = new NarrativeFactController({ factsShown: 2 });
    expect(advanceFacts(restored, 24.9).some((frame) => frame.factStarted)).toBe(false);
    const starts = advanceFacts(restored, 120).filter((frame) => frame.factStarted);
    expect(starts).toHaveLength(1);
    expect(starts[0].factStarted).toEqual(PUBLIC_CHARACTER_FACTS[2]);
    const exhausted = new NarrativeFactController({ factsShown: 100 });
    expect(advanceFacts(exhausted, 120).every((frame) => frame.count === 3 && !frame.factStarted)).toBe(true);
  });

  it("ignores invalid deltas, limits resume spikes, and never speaks from a zero tick", () => {
    const controller = new NarrativeFactController({ factsShown: NaN });
    for (const delta of [NaN, Infinity, -1, 0, 1000]) {
      const frame = controller.tick(delta, { phase: "roam", stationary: true });
      expect(frame.factStarted).toBeNull();
      expect(frame.count).toBe(0);
    }
    advanceFacts(controller, 2.8);
    expect(controller.tick(0, { phase: "roam", stationary: true }).factStarted).toBeNull();
    expect(advanceFacts(controller, 0.2).some((frame) => frame.factStarted)).toBe(true);
    controller.cancel();
    expect(controller.tick(0, { phase: "roam", stationary: true }).factEnded).toBe(true);
    expect(controller.tick(0, { phase: "roam", stationary: true }).factEnded).toBe(false);
  });
});

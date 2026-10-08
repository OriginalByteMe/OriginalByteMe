import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AFRO_LINES,
  AREA_ARRIVAL_LINES,
  BUMP_LINE,
  CHASE_LINE,
  CharacterNarrativeController,
  CharacterTidbitController,
  type CharacterLine,
  heroScrollProgress,
  JUMP_LINE,
  NARRATIVE_DIALOGUE,
  NARRATIVE_PHASE_START,
  PORTRAIT_LINE,
  sampleNarrative,
  STATION_LINES,
  TIDBIT_CONFIG,
  TIDBIT_LINES,
  type NarrativePhase,
  type TidbitInput,
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

describe("hero geometry", () => {
  it("derives progress from current hero geometry after scrolling or resize", () => {
    expect(heroScrollProgress({ top: 100, height: 3000 }, 1000)).toBe(0);
    expect(heroScrollProgress({ top: -1000, height: 3000 }, 1000)).toBe(0.5);
    expect(heroScrollProgress({ top: -1000, height: 3000 }, 500)).toBe(0.4);
    expect(heroScrollProgress({ top: -9999, height: 3000 }, 1000)).toBe(1);
    expect(heroScrollProgress({ top: -10, height: 500 }, 1000)).toBe(0);
    expect(heroScrollProgress({ top: NaN, height: 3000 }, 1000)).toBe(0);
    expect(heroScrollProgress({ top: -100, height: 3000 }, 0)).toBe(0);
  });
});

const projectSlugs = readdirSync(resolve(process.cwd(), "content/about-me/projects")).map((file) => file.replace(/\.md$/, ""));
const allLines: CharacterLine[] = [
  ...Object.values(STATION_LINES).flat(), ...Object.values(AREA_ARRIVAL_LINES), ...Object.values(TIDBIT_LINES).flat(),
  CHASE_LINE, JUMP_LINE, BUMP_LINE, PORTRAIT_LINE, ...AFRO_LINES,
];

describe("character lines", () => {
  it("has lines for every contract station id, including one exhibit per corpus project", () => {
    expect(projectSlugs).toHaveLength(5);
    expect(Object.keys(STATION_LINES).sort()).toEqual([
      "desk", "printer", "rack", "ball", "bed", ...projectSlugs.map((slug) => `project:${slug}`), "skills", "portrait", "skyline", "career",
    ].sort());
    for (const lines of Object.values(STATION_LINES)) expect(lines.length).toBeGreaterThan(0);
    for (const slug of projectSlugs) {
      expect(STATION_LINES[`project:${slug}`].map((line) => line.source)).toContain(`content/about-me/projects/${slug}.md`);
    }
  });

  it("keeps every line short, uniquely identified, and every fact sourced from a real public corpus file", () => {
    const unique = new Map(allLines.map((line) => [line.id, line]));
    expect([...unique.values()]).toEqual([...new Set(allLines)]);
    for (const { line, source } of allLines) {
      expect(line.length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(70);
      if (source) {
        expect(source).toMatch(/^content\/about-me\/(?:projects\/)?[a-z-]+\.md$/);
        expect(existsSync(resolve(process.cwd(), source)), source).toBe(true);
      }
    }
    for (const pool of Object.values(TIDBIT_LINES)) {
      expect(pool.length).toBeGreaterThanOrEqual(3);
      expect(pool.every((line) => line.source)).toBe(true);
    }
  });

  it("uses the exact afro, portrait, and chase lines", () => {
    expect(AFRO_LINES[0].line).toBe("Stop, don't do that.");
    expect(AFRO_LINES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(AFRO_LINES.map((line) => line.line)).size).toBe(AFRO_LINES.length);
    expect(PORTRAIT_LINE.line).toBe("Huh. Maybe that's what I'd look like.");
    expect(STATION_LINES.portrait[0]).toBe(PORTRAIT_LINE);
    expect(CHASE_LINE.line).toBe("Hey, wait for me!");
    expect(AREA_ARRIVAL_LINES.lab.line).toMatch(/welcome to my lab/i);
    expect(AREA_ARRIVAL_LINES.about.line).toMatch(/about me/i);
  });
});

type Spoken = { time: number; line: CharacterLine; area: TidbitInput["area"] };
function listen(controller: CharacterTidbitController, seconds: number, input: TidbitInput | ((time: number) => TidbitInput), from = 0) {
  const spoken: Spoken[] = [];
  for (let index = 1; index <= Math.round(seconds * 20); index += 1) {
    const time = from + index / 20;
    const current = typeof input === "function" ? input(time) : input;
    const line = controller.tick(1 / 20, current);
    if (line) spoken.push({ time, line, area: current.area });
  }
  return spoken;
}

describe("idle tidbits", () => {
  it("speaks from the current area's pool, spaced by the quiet gap, up to the session cap", () => {
    const controller = new CharacterTidbitController();
    const spoken = listen(controller, 900, (time) => ({ area: time < 100 ? "bedroom" : time < 200 ? "lab" : "about", ready: true }));
    expect(spoken).toHaveLength(TIDBIT_CONFIG.maximumLines);
    expect(controller.spoken).toBe(TIDBIT_CONFIG.maximumLines);
    expect(spoken[0].time).toBeGreaterThanOrEqual(18);
    spoken.slice(1).forEach(({ time }, index) => {
      expect(time - spoken[index].time).toBeGreaterThanOrEqual(18 - 1e-6);
      expect(time - spoken[index].time).toBeLessThanOrEqual(25 + 1e-6);
    });
    for (const { line, area } of spoken) expect(TIDBIT_LINES[area]).toContain(line);
    expect(new Set(spoken.map(({ area }) => area))).toEqual(new Set(["bedroom", "lab", "about"]));
  });

  it("never repeats the previous line and works through a pool before reusing it", () => {
    const spoken = listen(new CharacterTidbitController({ seed: 7 }), 400, { area: "lab", ready: true }).map(({ line }) => line.id);
    spoken.slice(1).forEach((id, index) => expect(id).not.toBe(spoken[index]));
    const pool = TIDBIT_LINES.lab.length;
    expect(new Set(spoken.slice(0, pool)).size).toBe(pool);
  });

  it("waits for three uninterrupted ready seconds and does not advance while paused", () => {
    const controller = new CharacterTidbitController();
    expect(listen(controller, 30, { area: "bedroom", ready: false })).toEqual([]);
    expect(listen(controller, 2.5, { area: "bedroom", ready: true })).toEqual([]);
    expect(listen(controller, 1, { area: "bedroom", ready: false })).toEqual([]);
    expect(listen(controller, 2.9, { area: "bedroom", ready: true })).toEqual([]);
    expect(listen(controller, 100, { area: "bedroom", ready: true, paused: true })).toEqual([]);
    expect(listen(controller, .15, { area: "bedroom", ready: true })).toHaveLength(1);
    const paused = new CharacterTidbitController();
    listen(paused, 300, { area: "bedroom", ready: true, paused: true });
    expect(listen(paused, 17.9, { area: "bedroom", ready: true })).toEqual([]);
  });

  it("restores the session count, ignores bad deltas, and never speaks from a zero tick", () => {
    expect(listen(new CharacterTidbitController({ spoken: 99 }), 300, { area: "about", ready: true })).toEqual([]);
    const restored = new CharacterTidbitController({ spoken: TIDBIT_CONFIG.maximumLines - 1 });
    expect(listen(restored, 300, { area: "about", ready: true })).toHaveLength(1);
    const controller = new CharacterTidbitController({ spoken: NaN });
    expect(controller.spoken).toBe(0);
    for (const delta of [NaN, Infinity, -1, 0, 1000]) expect(controller.tick(delta, { area: "lab", ready: true })).toBeNull();
    listen(controller, 40, { area: "lab", ready: true });
    expect(controller.tick(0, { area: "lab", ready: true })).toBeNull();
  });
});

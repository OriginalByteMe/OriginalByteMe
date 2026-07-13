import { describe, it, expect } from "vitest";

import {
  BACKDROP_PRESETS,
  DEFAULT_BACKDROP_PRESET,
  isBackdropPresetName,
  resolveBackdropPreset,
  type BackdropPresetName,
} from "@/lib/backdrop/presets";

const HEX = /^#[0-9a-f]{6}$/i;
const THEMES = ["light", "dark"] as const;
const ALL_NAMES = [
  "ditherEmber",
  "ditherIndigo",
  "ditherMint",
  "ditherRose",
  "ditherSky",
  "ditherTide",
  "ditherViolet",
  "meshBloom",
  "metaOrbs",
  "nightMatte",
  "panelParade",
  "softField",
] as const;

describe("backdrop presets registry", () => {
  it("contains exactly the allowlisted presets, each self-named", () => {
    const names = Object.keys(BACKDROP_PRESETS).sort();
    expect(names).toEqual([...ALL_NAMES]);
    for (const [key, preset] of Object.entries(BACKDROP_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(typeof preset.label).toBe("string");
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("spans the sanctioned shader families", () => {
    expect(BACKDROP_PRESETS.softField.shader).toBe("grainGradient");
    expect(BACKDROP_PRESETS.nightMatte.shader).toBe("grainGradient");
    expect(BACKDROP_PRESETS.meshBloom.shader).toBe("meshGradient");
    expect(BACKDROP_PRESETS.metaOrbs.shader).toBe("metaballs");
    expect(BACKDROP_PRESETS.panelParade.shader).toBe("colorPanels");
    expect(BACKDROP_PRESETS.ditherTide.shader).toBe("dithering");
    expect(BACKDROP_PRESETS.ditherViolet.shader).toBe("dithering");
  });

  it("keeps the dither-flow series on one shared geometry so chapters tween, not cross-fade", () => {
    const series = [
      BACKDROP_PRESETS.ditherViolet,
      BACKDROP_PRESETS.ditherSky,
      BACKDROP_PRESETS.ditherEmber,
      BACKDROP_PRESETS.ditherMint,
      BACKDROP_PRESETS.ditherRose,
      BACKDROP_PRESETS.ditherIndigo,
    ];
    for (const preset of series) {
      expect(preset.shader).toBe("dithering");
      if (preset.shader !== "dithering") continue;
      expect(preset.shape).toBe("wave");
      expect(preset.type).toBe("4x4");
      expect(preset.palette.light.colors).toHaveLength(1);
      expect(preset.palette.dark.colors).toHaveLength(1);
      // One consistent paper base per theme across the whole series.
      expect(preset.palette.light.colorBack).toBe(BACKDROP_PRESETS.ditherViolet.palette.light.colorBack);
      expect(preset.palette.dark.colorBack).toBe(BACKDROP_PRESETS.ditherViolet.palette.dark.colorBack);
    }
  });

  it("defaults to ditherViolet (the home story's hero preset)", () => {
    expect(DEFAULT_BACKDROP_PRESET).toBe("ditherViolet");
    expect(BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET]).toBeDefined();
  });

  it("carries the contract shapes per grain preset", () => {
    expect(BACKDROP_PRESETS.softField.shape).toBe("wave");
    expect(BACKDROP_PRESETS.nightMatte.shape).toBe("sphere");
  });
});

describe("isBackdropPresetName", () => {
  it("accepts every allowlisted name", () => {
    for (const name of ALL_NAMES) {
      expect(isBackdropPresetName(name)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const bad of ["", "bogus", "lavaLamp", "SoftField", null, undefined, 42, {}]) {
      expect(isBackdropPresetName(bad)).toBe(false);
    }
  });
});

describe("resolveBackdropPreset", () => {
  it("returns the requested preset when the name is valid", () => {
    expect(resolveBackdropPreset("nightMatte").name).toBe("nightMatte");
    expect(resolveBackdropPreset("softField").name).toBe("softField");
    expect(resolveBackdropPreset("metaOrbs").name).toBe("metaOrbs");
  });

  it("falls back to the default for unknown / empty / nullish input", () => {
    const def = BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET];
    for (const bad of [undefined, null, "", "lavaLamp", "bogus"] as (
      | string
      | null
      | undefined
    )[]) {
      expect(resolveBackdropPreset(bad)).toBe(def);
      expect(resolveBackdropPreset(bad).name).toBe("ditherViolet");
    }
  });
});

describe("palette invariants", () => {
  it("every preset x theme has well-formed hex colors, matched counts, and a positive speed", () => {
    for (const preset of Object.values(BACKDROP_PRESETS)) {
      expect(preset.speed).toBeGreaterThan(0);
      expect(preset.fallbackClass).toContain("dark:");
      // Theme tween runs on one canvas, so light/dark counts must match.
      expect(preset.palette.light.colors).toHaveLength(preset.palette.dark.colors.length);
      for (const theme of THEMES) {
        const palette = preset.palette[theme];
        expect(palette.colors.length).toBeGreaterThanOrEqual(1);
        expect(palette.colorBack).toMatch(HEX);
        for (const color of palette.colors) {
          expect(color).toMatch(HEX);
        }
      }
    }
  });

  it("keeps the four-color invariant for the grainGradient family", () => {
    expect(BACKDROP_PRESETS.softField.palette.light.colors).toHaveLength(4);
    expect(BACKDROP_PRESETS.softField.palette.dark.colors).toHaveLength(4);
    expect(BACKDROP_PRESETS.nightMatte.palette.light.colors).toHaveLength(4);
    expect(BACKDROP_PRESETS.nightMatte.palette.dark.colors).toHaveLength(4);
  });

  it("pins the documented dark colorBack values", () => {
    expect(BACKDROP_PRESETS.softField.palette.dark.colorBack).toBe("#222026");
    expect(BACKDROP_PRESETS.nightMatte.palette.dark.colorBack).toBe("#141319");
  });
});

// Type-level guard usage keeps BackdropPresetName referenced for the compiler.
const _typecheck: BackdropPresetName = DEFAULT_BACKDROP_PRESET;
void _typecheck;

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

describe("backdrop presets registry", () => {
  it("contains exactly the two sanctioned presets, each self-named", () => {
    const names = Object.keys(BACKDROP_PRESETS).sort();
    expect(names).toEqual(["nightMatte", "softField"]);
    for (const [key, preset] of Object.entries(BACKDROP_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.shader).toBe("grainGradient");
      expect(typeof preset.label).toBe("string");
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("defaults to softField", () => {
    expect(DEFAULT_BACKDROP_PRESET).toBe("softField");
    expect(BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET]).toBeDefined();
  });

  it("carries the contract shapes per preset", () => {
    expect(BACKDROP_PRESETS.softField.shape).toBe("wave");
    expect(BACKDROP_PRESETS.nightMatte.shape).toBe("sphere");
  });
});

describe("isBackdropPresetName", () => {
  it("accepts only the two allowlisted names", () => {
    expect(isBackdropPresetName("softField")).toBe(true);
    expect(isBackdropPresetName("nightMatte")).toBe(true);
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
    expect(resolveBackdropPreset("nightMatte").shape).toBe("sphere");
    expect(resolveBackdropPreset("softField").name).toBe("softField");
  });

  it("falls back to the default for unknown / empty / nullish input", () => {
    const def = BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET];
    for (const bad of [undefined, null, "", "lavaLamp", "bogus"] as (
      | string
      | null
      | undefined
    )[]) {
      expect(resolveBackdropPreset(bad)).toBe(def);
      expect(resolveBackdropPreset(bad).name).toBe("softField");
    }
  });
});

describe("palette invariants", () => {
  it("every preset x theme has exactly 4 well-formed hex colors and a positive speed", () => {
    for (const preset of Object.values(BACKDROP_PRESETS)) {
      expect(preset.speed).toBeGreaterThan(0);
      expect(preset.fallbackClass).toContain("dark:");
      for (const theme of THEMES) {
        const palette = preset.palette[theme];
        expect(palette.colors).toHaveLength(4);
        expect(palette.colorBack).toMatch(HEX);
        for (const color of palette.colors) {
          expect(color).toMatch(HEX);
        }
      }
    }
  });

  it("pins the documented dark colorBack values", () => {
    expect(BACKDROP_PRESETS.softField.palette.dark.colorBack).toBe("#222026");
    expect(BACKDROP_PRESETS.nightMatte.palette.dark.colorBack).toBe("#141319");
  });
});

// Type-level guard usage keeps BackdropPresetName referenced for the compiler.
const _typecheck: BackdropPresetName = DEFAULT_BACKDROP_PRESET;
void _typecheck;

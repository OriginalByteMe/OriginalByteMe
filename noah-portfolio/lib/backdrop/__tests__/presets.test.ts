import { describe, expect, it } from "vitest";

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
  "ambientLava",
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

const GENERATED_DITHER_SHAPES = {
  ditherViolet: "wave",
  ditherSky: "simplex",
  ditherEmber: "warp",
  ditherMint: "sphere",
  ditherRose: "swirl",
  ditherIndigo: "ripple",
} as const;

describe("backdrop presets registry", () => {
  it("contains exactly the allowlisted presets, each self-named", () => {
    expect(Object.keys(BACKDROP_PRESETS).sort()).toEqual([...ALL_NAMES]);
    for (const [key, preset] of Object.entries(BACKDROP_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("spans the sanctioned shader families", () => {
    expect(BACKDROP_PRESETS.ambientLava.shader).toBe("dithering");
    expect(BACKDROP_PRESETS.softField.shader).toBe("grainGradient");
    expect(BACKDROP_PRESETS.nightMatte.shader).toBe("grainGradient");
    expect(BACKDROP_PRESETS.meshBloom.shader).toBe("meshGradient");
    expect(BACKDROP_PRESETS.metaOrbs.shader).toBe("metaballs");
    expect(BACKDROP_PRESETS.panelParade.shader).toBe("colorPanels");
  });

  it("replaces the blob default with a restrained dithered nocturne", () => {
    expect(DEFAULT_BACKDROP_PRESET).toBe("ambientLava");
    const preset = BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET];
    expect(preset.label).toBe("Nocturne — Simplex");
    expect(preset.shader).toBe("dithering");
    if (preset.shader !== "dithering") return;

    expect(preset.shape).toBe("simplex");
    expect(preset.type).toBe("4x4");
    expect(preset.pxSize).toBe(3.5);
    expect(preset.speed).toBe(0.18);
    expect(preset.palette.light).toEqual({
      colorBack: "#f4efe6",
      colors: ["#b9afc7"],
    });
    expect(preset.palette.dark).toEqual({
      colorBack: "#17151d",
      colors: ["#3d374b"],
    });
  });

  it("preserves every generated-answer dither variant and parameter", () => {
    for (const [name, shape] of Object.entries(GENERATED_DITHER_SHAPES)) {
      const preset = BACKDROP_PRESETS[name as keyof typeof GENERATED_DITHER_SHAPES];
      expect(preset.shader).toBe("dithering");
      if (preset.shader !== "dithering") continue;
      expect(preset.shape).toBe(shape);
      expect(preset.type).toBe("4x4");
      expect(preset.pxSize).toBe(3);
      expect(preset.palette.light.colorBack).toBe("#f7f2e7");
      expect(preset.palette.dark.colorBack).toBe("#1a1721");
      expect(preset.speed).toBe(name === "ditherViolet" ? 0.72 : 0.5);
    }
  });

});

describe("preset name validation", () => {
  it("accepts every allowlisted name and rejects unknown input", () => {
    for (const name of ALL_NAMES) expect(isBackdropPresetName(name)).toBe(true);
    for (const value of ["", "bogus", "lavaLamp", "SoftField", null, undefined, 42, {}]) {
      expect(isBackdropPresetName(value)).toBe(false);
    }
  });

  it("resolves valid names and falls back to the nocturne default", () => {
    expect(resolveBackdropPreset("nightMatte")).toBe(BACKDROP_PRESETS.nightMatte);
    expect(resolveBackdropPreset("ditherViolet")).toBe(BACKDROP_PRESETS.ditherViolet);
    for (const value of [undefined, null, "", "lavaLamp", "bogus"] as const) {
      expect(resolveBackdropPreset(value)).toBe(BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET]);
      expect(resolveBackdropPreset(value).name).toBe("ambientLava");
    }
  });
});

describe("palette invariants", () => {
  it("keeps valid theme palettes, matched color counts, fallbacks, and positive speed", () => {
    for (const preset of Object.values(BACKDROP_PRESETS)) {
      expect(preset.speed).toBeGreaterThan(0);
      expect(preset.fallbackClass).toContain("dark:");
      expect(preset.palette.light.colors).toHaveLength(preset.palette.dark.colors.length);
      for (const theme of THEMES) {
        const palette = preset.palette[theme];
        expect(palette.colorBack).toMatch(HEX);
        expect(palette.colors.length).toBeGreaterThanOrEqual(1);
        for (const color of palette.colors) expect(color).toMatch(HEX);
      }
    }
  });

  it("keeps the remaining grain gradients at four colors", () => {
    expect(BACKDROP_PRESETS.softField.palette.light.colors).toHaveLength(4);
    expect(BACKDROP_PRESETS.softField.palette.dark.colors).toHaveLength(4);
    expect(BACKDROP_PRESETS.nightMatte.palette.light.colors).toHaveLength(4);
    expect(BACKDROP_PRESETS.nightMatte.palette.dark.colors).toHaveLength(4);
  });
});

const _typecheck: BackdropPresetName = DEFAULT_BACKDROP_PRESET;
void _typecheck;

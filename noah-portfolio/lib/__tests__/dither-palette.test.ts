import { describe, expect, it } from "vitest";
import { ditherPaletteFromTrack, type DitherPalette } from "@/lib/dither-palette";

const FALLBACK: DitherPalette = {
  colorFront: "#c9b3ec",
  colorBack: "#26232c",
  colorHighlight: "#8d7bb0",
};

describe("ditherPaletteFromTrack", () => {
  it("returns the fallback when the palette is missing or too small", () => {
    expect(ditherPaletteFromTrack(undefined, true, FALLBACK)).toEqual(FALLBACK);
    expect(ditherPaletteFromTrack([], true, FALLBACK)).toEqual(FALLBACK);
    expect(ditherPaletteFromTrack([[10, 10, 10]], true, FALLBACK)).toEqual(FALLBACK);
  });

  it("ignores malformed swatches", () => {
    expect(
      ditherPaletteFromTrack([[10, 10], "nope", null, [1, 2, Number.NaN]], true, FALLBACK),
    ).toEqual(FALLBACK);
  });

  it("uses the darkest swatch as colorBack in dark mode", () => {
    const palette = ditherPaletteFromTrack(
      [
        [240, 240, 240],
        [10, 10, 10],
        [200, 30, 30],
        [30, 200, 120],
      ],
      true,
      FALLBACK,
    );
    expect(palette.colorBack).toBe("#0a0a0a");
    // Most saturated remaining swatch becomes the front colour.
    expect([palette.colorFront, palette.colorHighlight]).toContain("#c81e1e");
  });

  it("uses the lightest swatch as colorBack in light mode", () => {
    const palette = ditherPaletteFromTrack(
      [
        [240, 240, 240],
        [10, 10, 10],
        [200, 30, 30],
      ],
      false,
      FALLBACK,
    );
    expect(palette.colorBack).toBe("#f0f0f0");
    expect(palette.colorFront).toBe("#c81e1e");
  });

  it("derives a contrasting highlight from a two-swatch palette", () => {
    const palette = ditherPaletteFromTrack(
      [
        [10, 10, 10],
        [200, 30, 30],
      ],
      true,
      FALLBACK,
    );
    expect(palette.colorBack).toBe("#0a0a0a");
    expect(palette.colorFront).toBe("#c81e1e");
    expect(palette.colorHighlight).toBe("#c81e1e");
  });

  it("clamps out-of-range channels into hex range", () => {
    const palette = ditherPaletteFromTrack(
      [
        [300, -5, 12],
        [0, 0, 0],
        [90, 90, 260],
      ],
      true,
      FALLBACK,
    );
    expect(palette.colorBack).toBe("#000000");
    expect(palette.colorFront).toBe("#ff000c");
  });
});

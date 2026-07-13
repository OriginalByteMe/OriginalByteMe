/**
 * Maps a track's album-art colour palette (RGB triplets from
 * /api/spotify/palette-picker) onto the hero ImageDithering colour trio.
 *
 * Strategy: the dither reads best when colorBack sits at the theme's value
 * end (darkest swatch in dark mode, lightest in light mode) and the two
 * foreground colours carry the album's character — so colorFront takes the
 * most saturated remaining swatch and colorHighlight the next one.
 */

export type RgbTuple = number[];

export interface DitherPalette {
  colorFront: string;
  colorBack: string;
  colorHighlight: string;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function toHex(rgb: RgbTuple): string {
  return (
    "#" +
    rgb
      .slice(0, 3)
      .map((c) => clampChannel(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

function luminance([r, g, b]: RgbTuple): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(rgb: RgbTuple): number {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function isValidRgb(value: unknown): value is RgbTuple {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.slice(0, 3).every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function ditherPaletteFromTrack(
  colors: unknown[] | undefined | null,
  isDark: boolean,
  fallback: DitherPalette,
): DitherPalette {
  const valid = (colors ?? []).filter(isValidRgb);
  if (valid.length < 2) return fallback;

  const byLuminance = [...valid].sort((a, b) => luminance(a) - luminance(b));
  const back = isDark ? byLuminance[0] : byLuminance[byLuminance.length - 1];
  const rest = valid.filter((c) => c !== back);
  const bySaturation = [...rest].sort((a, b) => saturation(b) - saturation(a));
  const front = bySaturation[0];
  // With only two swatches, reuse the opposite value end so the highlight
  // still contrasts with colorBack instead of duplicating colorFront.
  const highlight =
    bySaturation[1] ?? (isDark ? byLuminance[byLuminance.length - 1] : byLuminance[0]);

  return {
    colorFront: toHex(front),
    colorBack: toHex(back),
    colorHighlight: toHex(highlight),
  };
}

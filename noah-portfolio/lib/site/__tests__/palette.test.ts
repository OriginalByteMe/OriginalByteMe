import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Vitest runs from the app root.
const globals = readFileSync("app/globals.css", "utf8");

/** The hex `--site-*` colours one colour-mode block of globals.css defines, as RGB channels. */
function siteColours(selector: ":root" | ".dark"): Record<string, number[]> {
  const block = globals.match(new RegExp(`^${selector.replace(".", "\\.")} \\{([^}]*)\\}`, "m"))?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/--site-([a-z0-9-]+):\s*#([0-9a-f]{6});/g)].map(([, name, hex]) => [
      name,
      [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16)),
    ]),
  );
}

// WCAG 2 relative luminance and contrast ratio.
const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: number[], b: number[]) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const MODES = { light: siteColours(":root"), dark: siteColours(".dark") };

describe("generated site colours", () => {
  it("come from the light and dark blocks only, so a site follows the visitor's mode", () => {
    expect(Object.keys(MODES.light).sort()).toEqual(["accent", "accent-2", "bg", "ink", "muted", "paper", "soft"]);
    expect(Object.keys(MODES.dark).sort()).toEqual(Object.keys(MODES.light).sort());
    for (const file of ["lib/site/art/art.css", "components/site/site.css", "components/site/thoughts.css"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/--site-[a-z0-9-]+\s*:/);
    }
  });

  it.each(Object.entries(MODES))("meet WCAG AA in %s mode", (_mode, colour) => {
    // [text, background, minimum]: every text colour on every surface the site sets it on.
    const pairs: Array<[string, number[], number[], number]> = [
      ...["bg", "paper", "soft"].flatMap((surface): Array<[string, number[], number[], number]> => [
        [`ink on ${surface}`, colour.ink, colour[surface], 4.5],
        [`muted on ${surface}`, colour.muted, colour[surface], 4.5],
        [`accent focus ring on ${surface}`, colour.accent, colour[surface], 3],
      ]),
      ["accent timeline label on bg", colour.accent, colour.bg, 4.5],
      ["accent timeline label on paper", colour.accent, colour.paper, 4.5],
      ["button label", colour.bg, colour.ink, 4.5],
      ["banner title", colour.bg, colour.accent, 4.5],
      // site.css tints banner copy with color-mix(in srgb, bg 82%, accent).
      ["banner copy", colour.bg.map((value, index) => value * 0.82 + colour.accent[index] * 0.18), colour.accent, 4.5],
    ];
    for (const [label, text, background, minimum] of pairs) {
      expect(contrast(text, background), label).toBeGreaterThanOrEqual(minimum);
    }
  });
});

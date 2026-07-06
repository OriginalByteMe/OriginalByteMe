import { describe, it, expect } from "vitest";

import { resolveTheme, HOLIDAY_THEMES } from "@/lib/themes/registry";
import { isBackdropPresetName } from "@/lib/backdrop/presets";

// Dates use the NUMERIC (local) Date constructor on purpose: resolveTheme reads
// getMonth()+1 / getDate() (LOCAL wall-clock), and those getters invert the
// local constructor, so month/day are deterministic on any CI timezone. A
// UTC/ISO string would make the calendar day timezone-dependent and flaky.
const CHRISTMAS = new Date(2026, 11, 25, 12); // Dec 25 2026, local noon
const HALLOWEEN = new Date(2026, 9, 31, 12); // Oct 31 2026, local noon
const ORDINARY = new Date(2026, 6, 6, 12); // Jul 6 2026, no holiday

describe("resolveTheme", () => {
  it("returns the global Christmas theme on Dec 25 regardless of country", () => {
    // locales === null => the locale gate is ignored for every visitor.
    expect(resolveTheme(CHRISTMAS, "US")).toBe(HOLIDAY_THEMES.christmas);
    expect(resolveTheme(CHRISTMAS, "FR")).toBe(HOLIDAY_THEMES.christmas);
    expect(resolveTheme(CHRISTMAS, "JP")).toBe(HOLIDAY_THEMES.christmas);
    // A null country still matches a global theme.
    expect(resolveTheme(CHRISTMAS, null)).toBe(HOLIDAY_THEMES.christmas);
  });

  it("gates the Halloween theme by locale on Oct 31", () => {
    expect(resolveTheme(HALLOWEEN, "US")).toBe(HOLIDAY_THEMES.halloween);
    // FR is not in the Halloween allowlist.
    expect(resolveTheme(HALLOWEEN, "FR")).toBeNull();
    // A null country cannot satisfy a non-null locale gate.
    expect(resolveTheme(HALLOWEEN, null)).toBeNull();
  });

  it("returns null on a non-holiday date (fallback = no theme)", () => {
    expect(resolveTheme(ORDINARY, "US")).toBeNull();
    expect(resolveTheme(ORDINARY, null)).toBeNull();
  });

  it("matches on the LOCAL calendar day, not UTC", () => {
    // Local day boundaries still resolve by their local month/day.
    expect(resolveTheme(new Date(2026, 11, 25, 0, 0, 0), null)).toBe(
      HOLIDAY_THEMES.christmas,
    );
    expect(resolveTheme(new Date(2026, 9, 31, 23, 30), "CA")).toBe(
      HOLIDAY_THEMES.halloween,
    );
  });
});

describe("HOLIDAY_THEMES registry invariants", () => {
  it("binds every theme to an allowlisted backdrop preset", () => {
    for (const theme of Object.values(HOLIDAY_THEMES)) {
      expect(isBackdropPresetName(theme.backdropPreset)).toBe(true);
    }
  });

  it("carries non-empty light and dark accents for every theme", () => {
    for (const theme of Object.values(HOLIDAY_THEMES)) {
      for (const mode of ["light", "dark"] as const) {
        expect(typeof theme.accents[mode].primary).toBe("string");
        expect(typeof theme.accents[mode].secondary).toBe("string");
        expect(theme.accents[mode].primary.length).toBeGreaterThan(0);
        expect(theme.accents[mode].secondary.length).toBeGreaterThan(0);
      }
    }
  });

  it("models Christmas as global and Halloween as locale-gated", () => {
    expect(HOLIDAY_THEMES.christmas.locales).toBeNull();
    expect(HOLIDAY_THEMES.halloween.locales).toContain("US");
    expect(HOLIDAY_THEMES.halloween.locales).not.toContain("FR");
  });
});

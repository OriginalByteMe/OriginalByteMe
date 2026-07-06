/**
 * Holiday theme registry.
 *
 * Pure TypeScript, no React imports — same invariant as `lib/backdrop/presets.ts`,
 * so the resolver is safe to call from server code, client components, and tests.
 *
 * A Theme (CONTEXT.md sense) is a locale- or calendar-driven styling overlay
 * (e.g. Christmas, Halloween) that modulates the backdrop Preset and scene
 * accents for a visitor. Fixed-date only for now; date windows / movable feasts
 * are future work.
 */

import type { BackdropPresetName } from '@/lib/backdrop/presets';

export type ThemeName = 'christmas' | 'halloween';

export interface ThemeAccents {
  /** Emphasis hue for scene components (headline spans, decorative strokes). */
  primary: string;
  /** Supporting hue (secondary highlights, decoration tint). */
  secondary: string;
}

export interface HolidayTheme {
  name: ThemeName;
  label: string;
  /** Fixed-date holiday: 1-based month + day-of-month. Date windows / movable feasts are future work. */
  date: { month: number; day: number };
  /** ISO 3166-1 alpha-2 allowlist; null = applies to every visitor. */
  locales: readonly string[] | null;
  /** Must name an allowlisted preset from lib/backdrop/presets. */
  backdropPreset: BackdropPresetName;
  /** Free-hex is a Theme privilege per design-contract v2 §2.2 (specs may not choose hex; Themes may). */
  accents: { light: ThemeAccents; dark: ThemeAccents };
  /** Key into a future decorative-component map; nothing renders yet (stub). */
  decoration?: string;
}

export const HOLIDAY_THEMES: Record<ThemeName, HolidayTheme> = {
  christmas: {
    name: 'christmas',
    label: 'Christmas',
    date: { month: 12, day: 25 },
    locales: null, // global
    backdropPreset: 'softField',
    accents: {
      light: { primary: '#a84646', secondary: '#3f7a55' },
      dark: { primary: '#e89a9a', secondary: '#8fd4a8' },
    },
    decoration: 'snowfall',
  },
  halloween: {
    name: 'halloween',
    label: 'Halloween',
    date: { month: 10, day: 31 },
    locales: ['US', 'CA', 'GB', 'IE', 'AU', 'NZ'],
    backdropPreset: 'nightMatte',
    accents: {
      light: { primary: '#c56a2e', secondary: '#5646a8' },
      dark: { primary: '#f2a55e', secondary: '#9d8ff2' },
    },
    decoration: 'lanterns',
  },
};

/**
 * First registry entry whose month/day equal the given date's LOCAL month/day
 * (getMonth()+1 / getDate()) and whose locale gate passes: locales === null,
 * OR country is non-null and included in locales (case-exact, alpha-2 uppercase).
 * No match -> null (fallback = no theme; backdrop stays DEFAULT_BACKDROP_PRESET).
 */
export function resolveTheme(date: Date, country: string | null): HolidayTheme | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const theme of Object.values(HOLIDAY_THEMES)) {
    if (theme.date.month !== month || theme.date.day !== day) {
      continue;
    }
    if (theme.locales === null || (country !== null && theme.locales.includes(country))) {
      return theme;
    }
  }

  return null;
}

/**
 * Allowlisted backdrop preset registry.
 *
 * Pure TypeScript, no React imports — safe to consume from the Redux slice, the
 * `Backdrop` component, and tests alike. Every preset targets the `grainGradient`
 * shader family (the only sanctioned family per docs/design-contract.md v2 §10).
 *
 * INVARIANT: every palette carries exactly four colors so the shader's uniform
 * array length stays stable across preset/theme tweens.
 */

export type BackdropPresetName = 'softField' | 'nightMatte';

export interface BackdropPalette {
  colorBack: string;
  colors: [string, string, string, string];
}

export interface BackdropPreset {
  name: BackdropPresetName;
  /** Human-readable label. */
  label: string;
  /** Only sanctioned shader family (contract v2 §10). */
  shader: 'grainGradient';
  shape: 'wave' | 'sphere';
  softness: number;
  intensity: number;
  noise: number;
  /** Active speed; reduced-motion is handled by the component, not here. */
  speed: number;
  palette: { light: BackdropPalette; dark: BackdropPalette };
  /** Tailwind CSS gradient (incl. `dark:` variants) painted as the fallback. */
  fallbackClass: string;
}

export const BACKDROP_PRESETS: Record<BackdropPresetName, BackdropPreset> = {
  softField: {
    name: 'softField',
    label: 'Soft Field',
    shader: 'grainGradient',
    shape: 'wave',
    softness: 0.85,
    intensity: 0.4,
    noise: 0.3,
    speed: 0.35,
    palette: {
      light: {
        colorBack: '#f7f2e7',
        colors: ['#dcc8f0', '#f8d7c4', '#cfe7d6', '#f4e3c2'],
      },
      dark: {
        colorBack: '#222026',
        colors: ['#5e5175', '#75564e', '#4d6154', '#6e6550'],
      },
    },
    fallbackClass:
      'bg-gradient-to-br from-[#f2e7d9] via-[#e7dcf1] to-[#dcead9] dark:from-[#252129] dark:via-[#2a2430] dark:to-[#232820]',
  },
  nightMatte: {
    name: 'nightMatte',
    label: 'Night Matte Bento',
    shader: 'grainGradient',
    shape: 'sphere',
    softness: 0.7,
    intensity: 0.5,
    noise: 0.3,
    speed: 0.45,
    palette: {
      light: {
        colorBack: '#e9e7ef',
        colors: ['#bcc9e6', '#cdb7e0', '#eec6d5', '#bfe2d8'],
      },
      dark: {
        colorBack: '#141319',
        colors: ['#9d8ff2', '#6ea3e8', '#ef9cc2', '#7fe0bd'],
      },
    },
    fallbackClass:
      'bg-gradient-to-b from-[#dfe3ee] via-[#e6dcea] to-[#dce7e2] dark:from-[#17161d] dark:via-[#1b1723] dark:to-[#141a18]',
  },
};

export const DEFAULT_BACKDROP_PRESET: BackdropPresetName = 'softField';

export function isBackdropPresetName(v: unknown): v is BackdropPresetName {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(BACKDROP_PRESETS, v);
}

export function resolveBackdropPreset(name?: string | null): BackdropPreset {
  return isBackdropPresetName(name)
    ? BACKDROP_PRESETS[name]
    : BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET];
}

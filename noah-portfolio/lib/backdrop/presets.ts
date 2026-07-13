/**
 * Allowlisted backdrop preset registry.
 *
 * Pure TypeScript, no React imports — safe to consume from the Redux slice, the
 * `Backdrop` component, and tests alike. Presets now span five sanctioned
 * paper-shaders families (grainGradient, meshGradient, metaballs, colorPanels,
 * dithering); specs still select presets by NAME only — free-form shader
 * parameters remain forbidden (docs/design-contract.md v2 §10).
 *
 * INVARIANT: within one preset, `palette.light.colors` and
 * `palette.dark.colors` have the same length, so theme changes can tween
 * uniforms on a single canvas. Different presets may carry different counts;
 * the Backdrop cross-fades between canvases when counts (or families) differ.
 */

export type BackdropPresetName =
  | 'softField'
  | 'nightMatte'
  | 'meshBloom'
  | 'metaOrbs'
  | 'panelParade'
  | 'ditherTide';

export interface BackdropPalette {
  colorBack: string;
  colors: string[];
}

interface BackdropPresetBase {
  name: BackdropPresetName;
  /** Human-readable label. */
  label: string;
  /** Active speed; reduced-motion is handled by the component, not here. */
  speed: number;
  palette: { light: BackdropPalette; dark: BackdropPalette };
  /** Tailwind CSS gradient (incl. `dark:` variants) painted as the fallback. */
  fallbackClass: string;
}

export interface GrainGradientPreset extends BackdropPresetBase {
  shader: 'grainGradient';
  shape: 'wave' | 'sphere';
  softness: number;
  intensity: number;
  noise: number;
}

export interface MeshGradientPreset extends BackdropPresetBase {
  shader: 'meshGradient';
  distortion: number;
  swirl: number;
}

export interface MetaballsPreset extends BackdropPresetBase {
  shader: 'metaballs';
  count: number;
  size: number;
}

export interface ColorPanelsPreset extends BackdropPresetBase {
  shader: 'colorPanels';
  angle1: number;
  angle2: number;
  length: number;
  edges: boolean;
  blur: number;
  fadeIn: number;
  fadeOut: number;
  gradient: number;
  density: number;
}

export interface DitheringPreset extends BackdropPresetBase {
  shader: 'dithering';
  shape: 'simplex' | 'warp' | 'dots' | 'wave' | 'ripple' | 'swirl' | 'sphere';
  type: 'random' | '2x2' | '4x4' | '8x8';
  /** Dither grid pixel size (the shader's `size` param). */
  pxSize: number;
}

export type BackdropPreset =
  | GrainGradientPreset
  | MeshGradientPreset
  | MetaballsPreset
  | ColorPanelsPreset
  | DitheringPreset;

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
  meshBloom: {
    name: 'meshBloom',
    label: 'Mesh Bloom',
    shader: 'meshGradient',
    distortion: 0.9,
    swirl: 0.4,
    speed: 0.4,
    palette: {
      light: {
        colorBack: '#f7f2e7',
        colors: ['#dcc8f0', '#f8d7c4', '#cfe7d6', '#c9d8ef'],
      },
      dark: {
        colorBack: '#222026',
        colors: ['#5c5080', '#3d5674', '#6f5265', '#476455'],
      },
    },
    fallbackClass:
      'bg-gradient-to-tr from-[#e7dcf1] via-[#f4e3d4] to-[#d9e8f0] dark:from-[#2a2438] dark:via-[#2c2330] dark:to-[#22303c]',
  },
  metaOrbs: {
    name: 'metaOrbs',
    label: 'Meta Orbs',
    shader: 'metaballs',
    count: 9,
    size: 0.8,
    speed: 0.6,
    palette: {
      light: {
        colorBack: '#f7f2e7',
        colors: ['#b79ad6', '#f0b797', '#8fd0b2'],
      },
      dark: {
        colorBack: '#141319',
        colors: ['#9d8ff2', '#f2a55e', '#7fe0bd'],
      },
    },
    fallbackClass:
      'bg-gradient-to-br from-[#efe4f4] via-[#f7ead9] to-[#e0efe6] dark:from-[#1d1826] dark:via-[#241d1b] dark:to-[#16211c]',
  },
  panelParade: {
    name: 'panelParade',
    label: 'Panel Parade',
    shader: 'colorPanels',
    angle1: 0.3,
    angle2: 0.3,
    length: 1.1,
    edges: true,
    blur: 0.25,
    fadeIn: 0.9,
    fadeOut: 0.35,
    gradient: 0.2,
    density: 1.8,
    speed: 0.45,
    palette: {
      light: {
        colorBack: '#f7f2e7',
        colors: ['#dcc8f0', '#f8d7c4', '#cfe7d6', '#f4e3c2', '#c9d8ef'],
      },
      dark: {
        colorBack: '#17161d',
        colors: ['#9d8ff2', '#ef9cc2', '#7fe0bd', '#f2a55e', '#6ea3e8'],
      },
    },
    fallbackClass:
      'bg-gradient-to-r from-[#e7dcf1] via-[#f6e7da] to-[#dce9f2] dark:from-[#211c2e] dark:via-[#291f28] dark:to-[#1a2430]',
  },
  ditherTide: {
    name: 'ditherTide',
    label: 'Dither Tide',
    shader: 'dithering',
    shape: 'ripple',
    type: '4x4',
    pxSize: 3.5,
    speed: 0.9,
    palette: {
      light: {
        colorBack: '#f7f2e7',
        colors: ['#cbb7e6'],
      },
      dark: {
        colorBack: '#141319',
        colors: ['#54497a'],
      },
    },
    fallbackClass:
      'bg-gradient-to-b from-[#f2ecdf] via-[#eae2ef] to-[#efe9dc] dark:from-[#16141b] dark:via-[#1c1824] dark:to-[#151318]',
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

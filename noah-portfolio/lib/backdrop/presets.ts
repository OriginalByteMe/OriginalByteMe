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
 * `palette.dark.colors` have the same length. The Backdrop mounts at most one
 * shader component; preset and theme changes update that component in place or
 * replace it in one React commit, never by overlapping WebGL canvases.
 */

export type BackdropPresetName =
  | 'ambientLava'
  | 'softField'
  | 'nightMatte'
  | 'meshBloom'
  | 'metaOrbs'
  | 'panelParade'
  | 'ditherTide'
  | 'ditherViolet'
  | 'ditherSky'
  | 'ditherEmber'
  | 'ditherMint'
  | 'ditherRose'
  | 'ditherIndigo';

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
  shape: 'wave' | 'blob' | 'sphere';
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

/**
 * Generated answers can select this "dither flow" series: six palettes with
 * shared dither rendering settings and distinct Paper Shader shapes. Light
 * mode keeps one cream paper base; dark mode keeps one near-black base; only
 * the ink hue shifts.
 */
const DITHER_FLOW = {
  shader: 'dithering',
  type: '4x4',
  pxSize: 3,
  speed: 0.5,
} as const;

const DITHER_LIGHT_BACK = '#f7f2e7';
const DITHER_DARK_BACK = '#1a1721';

function ditherFlowPreset(
  name: BackdropPresetName,
  label: string,
  shape: DitheringPreset['shape'],
  ink: { light: string; dark: string },
  fallbackClass: string,
): DitheringPreset {
  return {
    name,
    label,
    ...DITHER_FLOW,
    shape,
    palette: {
      light: { colorBack: DITHER_LIGHT_BACK, colors: [ink.light] },
      dark: { colorBack: DITHER_DARK_BACK, colors: [ink.dark] },
    },
    fallbackClass,
  };
}

export const BACKDROP_PRESETS: Record<BackdropPresetName, BackdropPreset> = {
  ambientLava: {
    ...ditherFlowPreset(
      'ambientLava',
      'Nocturne — Simplex',
      'simplex',
      { light: '#b9afc7', dark: '#3d374b' },
      'bg-gradient-to-b from-[#f4efe6] via-[#ece7ee] to-[#eee9e2] dark:from-[#17151d] dark:via-[#1d1925] dark:to-[#15131a]',
    ),
    pxSize: 3.5,
    speed: 0.18,
    palette: {
      light: { colorBack: '#f4efe6', colors: ['#b9afc7'] },
      dark: { colorBack: '#17151d', colors: ['#3d374b'] },
    },
  },
  ditherViolet: {
    ...ditherFlowPreset(
      'ditherViolet',
      'Dither Flow — Violet',
      'wave',
      { light: '#c3aee0', dark: '#4f4670' },
      'bg-gradient-to-b from-[#f2ecdf] via-[#eae2ef] to-[#efe9dc] dark:from-[#1b1824] dark:via-[#201b2b] dark:to-[#191621]',
    ),
    speed: 0.72,
  },
  ditherSky: ditherFlowPreset(
    'ditherSky',
    'Dither Flow — Sky',
    'simplex',
    { light: '#aac4e6', dark: '#3d5674' },
    'bg-gradient-to-b from-[#eceff5] via-[#e3e9f2] to-[#eef0ea] dark:from-[#171b23] dark:via-[#1a202b] dark:to-[#171a20]',
  ),
  ditherEmber: ditherFlowPreset(
    'ditherEmber',
    'Dither Flow — Ember',
    'warp',
    { light: '#ecc4a2', dark: '#6f5265' },
    'bg-gradient-to-b from-[#f6ede2] via-[#f2e4d6] to-[#f0ebde] dark:from-[#211a1e] dark:via-[#251c22] dark:to-[#1c171d]',
  ),
  ditherMint: ditherFlowPreset(
    'ditherMint',
    'Dither Flow — Mint',
    'sphere',
    { light: '#a9d8c0', dark: '#476455' },
    'bg-gradient-to-b from-[#eaf2ec] via-[#e2eee7] to-[#eef0e6] dark:from-[#161e19] dark:via-[#19231d] dark:to-[#151b17]',
  ),
  ditherRose: ditherFlowPreset(
    'ditherRose',
    'Dither Flow — Rose',
    'swirl',
    { light: '#eab8cc', dark: '#5d3f50' },
    'bg-gradient-to-b from-[#f6ecf1] via-[#f2e2ea] to-[#f0eae2] dark:from-[#201720] dark:via-[#241a23] dark:to-[#1b151c]',
  ),
  ditherIndigo: ditherFlowPreset(
    'ditherIndigo',
    'Dither Flow — Indigo',
    'ripple',
    { light: '#b3b3e6', dark: '#3f3a66' },
    'bg-gradient-to-b from-[#ecedf6] via-[#e4e4f2] to-[#ebeaf0] dark:from-[#17172a] dark:via-[#1b1a2e] dark:to-[#161624]',
  ),
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

export const DEFAULT_BACKDROP_PRESET: BackdropPresetName = 'ambientLava';


export function isBackdropPresetName(v: unknown): v is BackdropPresetName {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(BACKDROP_PRESETS, v);
}

export function resolveBackdropPreset(name?: string | null): BackdropPreset {
  return isBackdropPresetName(name)
    ? BACKDROP_PRESETS[name]
    : BACKDROP_PRESETS[DEFAULT_BACKDROP_PRESET];
}

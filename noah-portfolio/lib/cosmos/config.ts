/**
 * Cosmos — the catalogue of scenes, render styles, palettes and transitions.
 *
 * Pure data, no DOM. Everything the engine can draw is named here so pages
 * select by id (`scene: "afroHole"`, `style: "ascii"`) and never pass shader
 * parameters around.
 */

export type RGB = [number, number, number];

export interface Palette {
  id: string;
  label: string;
  /** Deep background. */
  bg: RGB;
  /** Primary light. */
  c1: RGB;
  /** Secondary light. */
  c2: RGB;
  /** Tertiary / shadow tint. */
  c3: RGB;
  /** Hottest highlight (accretion disk core, nozzle, sparks). */
  hot: RGB;
}

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const PALETTES: Palette[] = [
  {
    // The site's own dark tokens: --site-bg, --site-accent, --site-accent-2.
    id: 'nocturne',
    label: 'Nocturne',
    bg: hex('#100e17'),
    c1: hex('#9d8ff2'),
    c2: hex('#7fe0bd'),
    c3: hex('#3d2f7a'),
    hot: hex('#ffd9a0'),
  },
  {
    id: 'solar',
    label: 'Solar Fro',
    bg: hex('#120a08'),
    c1: hex('#ff9d3c'),
    c2: hex('#ff4f7b'),
    c3: hex('#6b1f3a'),
    hot: hex('#fff1c2'),
  },
  {
    // Kente cloth: gold, green, red on black.
    id: 'kente',
    label: 'Kente',
    bg: hex('#0b0a06'),
    c1: hex('#f5b82e'),
    c2: hex('#2fae66'),
    c3: hex('#b5262b'),
    hot: hex('#fff3b8'),
  },
  {
    id: 'synth',
    label: 'KL Neon',
    bg: hex('#0a0716'),
    c1: hex('#ff5fc8'),
    c2: hex('#3ee6ff'),
    c3: hex('#4127a8'),
    hot: hex('#ffffff'),
  },
  {
    id: 'phosphor',
    label: 'Phosphor',
    bg: hex('#030a06'),
    c1: hex('#5dff9b'),
    c2: hex('#1fbf6a'),
    c3: hex('#0c5a36'),
    hot: hex('#e8ffe9'),
  },
  {
    id: 'ember',
    label: 'Filament',
    bg: hex('#0d0f14'),
    c1: hex('#6fb6ff'),
    c2: hex('#ff7a3d'),
    c3: hex('#24456e'),
    hot: hex('#ffe0b0'),
  },
];

export const SCENES = [
  {
    id: 'home',
    label: 'Home planet',
    blurb: 'Sunrise over a night-side planet, aurora, a twin-spire skyline. Scroll launches the rocket; click for a shooting star.',
    variants: ['Sunrise'],
  },
  {
    id: 'warp',
    label: 'Signal',
    blurb: 'Starlines and nebula. The jump out of Kuala Lumpur.',
    variants: ['Starlines', 'Tunnel'],
  },
  {
    id: 'afroHole',
    label: 'Fro-rizon',
    blurb: 'A black hole whose event horizon is an afro, with an afro-pick satellite.',
    variants: ['Face + headband', 'Twin puffs', 'Pure horizon'],
  },
  {
    id: 'neural',
    label: 'Constellation',
    blurb: 'A neural network drawn as a constellation. Signals fire along the edges.',
    variants: ['Network', 'Dense'],
  },
  {
    id: 'printer',
    label: 'Layer by layer',
    blurb: 'A raymarched FDM printer. Scroll drives the print, gyroid infill included.',
    variants: ['Afro pick', 'Rocket', 'Gyroid cube'],
  },
  {
    id: 'gears',
    label: 'Machine works',
    blurb: 'A meshing gear train on a CAD blueprint.',
    variants: ['Gear train', 'With calipers'],
  },
  {
    id: 'city',
    label: 'The rig',
    blurb: 'A flyover of server towers. The homelab as a city.',
    variants: ['Flyover', 'Top-down'],
  },
  {
    id: 'flask',
    label: 'Experiments',
    blurb: 'A flask boiling a small galaxy. Bubbles leave as stars.',
    variants: ['Flask', 'Overdrive'],
  },
  {
    id: 'nebula',
    label: 'Nursery',
    blurb: 'Painted gas pillars where stars switch on. The cursor is a protostar that lights the cloud.',
    variants: ['Pillars'],
  },
  {
    id: 'astro',
    label: 'Say hi',
    blurb: 'An astronaut whose afro needs an oversized helmet, waving.',
    variants: ['Wave', 'Twin puffs'],
  },
] as const;

export type SceneId = (typeof SCENES)[number]['id'];

export const STYLES = [
  { id: 'raw', label: '3D', blurb: 'The scene as rendered, with grain and a vignette.' },
  { id: 'pixel', label: 'Pixel', blurb: 'Chunky cells with ordered dithering.' },
  { id: 'ascii', label: 'ASCII', blurb: 'Brightness mapped to characters.' },
  { id: 'dots', label: 'Halftone', blurb: 'A rotated dot screen.' },
  { id: 'wire', label: 'Blueprint', blurb: 'Edge-detected line art on a grid.' },
  { id: 'porthole', label: 'Hybrid', blurb: '3D in the middle, a pixel ring, ASCII outside.' },
] as const;

export type StyleId = (typeof STYLES)[number]['id'];

export const TRANSITIONS = [
  { id: 'fade', label: 'Crossfade' },
  { id: 'swallow', label: 'Swallow' },
  { id: 'dissolve', label: 'Pixel dissolve' },
  { id: 'print', label: 'Layer print' },
  { id: 'zoom', label: 'Warp zoom' },
  { id: 'glitch', label: 'Glitch' },
] as const;

export type TransitionId = (typeof TRANSITIONS)[number]['id'];

export const sceneIndex = (id: SceneId) => SCENES.findIndex((s) => s.id === id);
export const styleIndex = (id: StyleId) => STYLES.findIndex((s) => s.id === id);
export const transitionIndex = (id: TransitionId) => TRANSITIONS.findIndex((t) => t.id === id);
export const paletteById = (id: string): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const m = (x: RGB, y: RGB): RGB => [
    x[0] + (y[0] - x[0]) * t,
    x[1] + (y[1] - x[1]) * t,
    x[2] + (y[2] - x[2]) * t,
  ];
  return {
    id: t < 0.5 ? a.id : b.id,
    label: t < 0.5 ? a.label : b.label,
    bg: m(a.bg, b.bg),
    c1: m(a.c1, b.c1),
    c2: m(a.c2, b.c2),
    c3: m(a.c3, b.c3),
    hot: m(a.hot, b.hot),
  };
}

/* ---- The story ------------------------------------------------------------ */

export interface Chapter {
  id: string;
  kicker: string;
  title: string;
  body: string;
  /** Short mono tags under the body. */
  tags: string[];
  scene: SceneId;
  variant: number;
  style: StyleId;
  palette: string;
  /** How this chapter hands over to the next one. */
  out: TransitionId;
}

/** Copy is drawn from content/about-me — keep it in step with the Corpus. */
export const CHAPTERS: Chapter[] = [
  {
    id: 'home',
    kicker: 'Origin',
    title: 'A signal from Kuala Lumpur',
    body: 'Noah Rijkaard is a full-stack developer based in Kuala Lumpur, working across backend, infra and frontend. Scroll to launch. Click the sky for a shooting star.',
    tags: ['full-stack', 'Kuala Lumpur'],
    scene: 'home',
    variant: 0,
    style: 'raw',
    palette: 'nocturne',
    out: 'zoom',
  },
  {
    id: 'signal',
    kicker: 'Full burn',
    title: 'Six years of shipping',
    body: 'Six years of shipping software, and it still feels like this. Move the pointer to steer; the faster you scroll, the longer the starlines.',
    tags: ['6 yrs shipping', 'backend', 'infra', 'frontend'],
    scene: 'warp',
    variant: 0,
    style: 'ascii',
    palette: 'nocturne',
    out: 'swallow',
  },
  {
    id: 'brief',
    kicker: 'Noah, in brief',
    title: 'Everything orbits the fro',
    body: 'A developer with a keen eye for design and a love for efficient, scalable solutions. Pragmatic systems, design-conscious interfaces, and a lot of curiosity pulled into one orbit.',
    tags: ['design-conscious', 'pragmatic', 'curious'],
    scene: 'afroHole',
    variant: 0,
    style: 'raw',
    palette: 'solar',
    out: 'glitch',
  },
  {
    id: 'ai',
    kicker: 'AI',
    title: 'Teaching machines',
    body: 'Senior AI Engineer at MerchantSpring since 2026, building marketplace analytics. Before that, five years at Supa on data-labeling and AI training-data tooling, plus LLM evaluation tools like the open-source LLM Comparison app.',
    tags: ['MerchantSpring', 'Supa', 'LLM evals', 'Langfuse', 'OpenRouter'],
    scene: 'neural',
    variant: 0,
    style: 'porthole',
    palette: 'nocturne',
    out: 'dissolve',
  },
  {
    id: 'print',
    kicker: '3D printing',
    title: 'Layer by layer',
    body: 'CAD Designer and 3D Printing Engineer with Bowiq since 2023: FDM printing with high-end materials and machines. Scroll and the part prints.',
    tags: ['Bowiq', 'CAD', 'FDM', 'high-end materials'],
    scene: 'printer',
    variant: 0,
    style: 'raw',
    palette: 'ember',
    out: 'print',
  },
  {
    id: 'works',
    kicker: 'The toolbox',
    title: 'Machine works',
    body: 'Ruby, Python and TypeScript. Rails and Next.js. Docker, Terraform and AWS, with PostgreSQL and Redis underneath. Parts that mesh and keep turning.',
    tags: ['Ruby', 'Python', 'TypeScript', 'Docker', 'Terraform', 'PostgreSQL'],
    scene: 'gears',
    variant: 0,
    style: 'wire',
    palette: 'kente',
    out: 'zoom',
  },
  {
    id: 'rig',
    kicker: 'The rig',
    title: 'A homelab the size of a city',
    body: 'Self-hosts on Proxmox and Unraid, on a Linux base of Debian and Ubuntu. Leans toward self-hosting, Docker, and systems he can open up and understand.',
    tags: ['Proxmox', 'Unraid', 'Debian', 'self-hosted'],
    scene: 'city',
    variant: 0,
    style: 'pixel',
    palette: 'synth',
    out: 'print',
  },
  {
    id: 'lab',
    kicker: 'Experiments',
    title: 'What happens if',
    body: 'A benchmark that raced seven models through this site’s own Story pipeline. Moodify, which lets an album cover repaint the page. An image cutout tool built on Segment Anything.',
    tags: ['Story Model Benchmark', 'Moodify', 'AI Image Cutout', 'Ask-Me'],
    scene: 'flask',
    variant: 0,
    style: 'wire',
    palette: 'phosphor',
    out: 'fade',
  },
  {
    id: 'next',
    kicker: 'Still forming',
    title: 'The next thing is condensing',
    body: 'Ideas start as gas. Move through the cloud: your cursor is a protostar, and it lights whatever it gets close to.',
    tags: ['ask about any of it'],
    scene: 'nebula',
    variant: 0,
    style: 'raw',
    palette: 'synth',
    out: 'swallow',
  },
  {
    id: 'hi',
    kicker: 'Contact',
    title: 'Say hi',
    body: 'Got a project, a role, or a question about anything on this page? The inbox is open.',
    tags: ['open inbox'],
    scene: 'astro',
    variant: 0,
    style: 'dots',
    palette: 'solar',
    out: 'fade',
  },
];

/** A Cut is one way of dressing the same story. */
export interface Cut {
  id: string;
  label: string;
  blurb: string;
  /** Force one style on every chapter. */
  style?: StyleId;
  /** Force one palette on every chapter. */
  palette?: string;
}

export const CUTS: Cut[] = [
  { id: 'mixed', label: 'Mixed media', blurb: 'Every chapter changes style and palette.' },
  { id: 'cinema', label: 'Cinematic', blurb: 'All 3D, Nocturne throughout.', style: 'raw', palette: 'nocturne' },
  { id: 'terminal', label: 'Terminal', blurb: 'All ASCII on green phosphor.', style: 'ascii', palette: 'phosphor' },
  { id: 'arcade', label: '8-bit', blurb: 'All pixels, KL Neon.', style: 'pixel', palette: 'synth' },
  { id: 'drafting', label: 'Drafting table', blurb: 'All blueprint line art, Kente.', style: 'wire', palette: 'kente' },
  { id: 'porthole', label: 'Porthole', blurb: 'Hybrid 3D, pixel and ASCII at once, Solar Fro.', style: 'porthole', palette: 'solar' },
];

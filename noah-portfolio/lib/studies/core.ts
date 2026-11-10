/**
 * Studies — shared runtime for a set of small, quiet generative pieces.
 *
 * A Study is a self-contained drawing: it gets a canvas and a Frame each tick
 * (time, size, pointer, scroll, palette, variant) and paints. The runtime owns
 * the loop, resizing, pointer tracking, an idle "autopilot" pointer so pieces
 * stay alive on touch screens, and reduced-motion handling.
 */

export type RGB = [number, number, number];

export interface Palette {
  id: string;
  label: string;
  bg: string;
  ink: string;
  /** Four stops, dark to light on dark palettes, the reverse on light ones. */
  stops: [string, string, string, string];
  light: boolean;
}

export const PALETTES: Palette[] = [
  { id: 'dusk', label: 'Dusk', bg: '#0a0913', ink: '#efeaff', stops: ['#2b1d78', '#7a5cff', '#ff7eb6', '#ffe1b0'], light: false },
  { id: 'tide', label: 'Tide', bg: '#04101a', ink: '#e8fbff', stops: ['#0b3f6a', '#1aa3c4', '#7df0d2', '#f4fff9'], light: false },
  { id: 'ember', label: 'Ember', bg: '#0e0807', ink: '#fff1e2', stops: ['#5c1233', '#e2452b', '#ff9a3c', '#ffecc0'], light: false },
  { id: 'kente', label: 'Kente', bg: '#0a0905', ink: '#fff6d6', stops: ['#b5262b', '#f5b82e', '#2fae66', '#fff3b8'], light: false },
  { id: 'bone', label: 'Bone', bg: '#09090b', ink: '#f4f2ee', stops: ['#34343c', '#8a8a96', '#d9d6cf', '#ffffff'], light: false },
  { id: 'paper', label: 'Paper', bg: '#f1ece2', ink: '#1b1922', stops: ['#1b1922', '#4a3fb0', '#e0553a', '#f0b23c'], light: true },
];

export const hexToRgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Smooth colour ramp through a palette's four stops; t in 0..1. */
export function ramp(p: Palette, t: number): RGB {
  const x = Math.max(0, Math.min(1, t)) * 3;
  const i = Math.min(2, Math.floor(x));
  let f = x - i;
  f = f * f * (3 - 2 * f);
  const a = hexToRgb(p.stops[i]);
  const b = hexToRgb(p.stops[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const rgba = (c: RGB, a = 1) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

export interface Click {
  x: number;
  y: number;
  /** Seconds since the click. */
  age: number;
}

export interface Frame {
  /** Seconds. */
  t: number;
  dt: number;
  /** Canvas size in device pixels. */
  w: number;
  h: number;
  dpr: number;
  /** Pointer, 0..1 from the top-left. Raw, and eased. */
  px: number;
  py: number;
  sx: number;
  sy: number;
  /** Pointer movement this frame, in 0..1 units. */
  dx: number;
  dy: number;
  down: boolean;
  /** True while a real pointer is over the piece (false = autopilot). */
  hover: boolean;
  clicks: Click[];
  /** 0 when the piece enters from below, 0.5 centred, 1 when it has left. */
  scroll: number;
  pal: Palette;
  variant: number;
}

export interface Instance {
  frame(f: Frame): void;
  destroy?(): void;
}

export interface Study {
  id: string;
  title: string;
  line: string;
  hint: string;
  variants: string[];
  /** Cap on device pixel ratio; heavy pieces ask for less. */
  maxDpr?: number;
  create(canvas: HTMLCanvasElement): Instance | null;
}

export interface Mounted {
  set(patch: { pal?: Palette; variant?: number }): void;
  destroy(): void;
}

export function mountStudy(canvas: HTMLCanvasElement, study: Study, pal: Palette, variant = 0): Mounted | null {
  const inst = study.create(canvas);
  if (!inst) return null;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const f: Frame = {
    t: 0, dt: 0, w: 2, h: 2, dpr: 1,
    px: 0.5, py: 0.5, sx: 0.5, sy: 0.5, dx: 0, dy: 0,
    down: false, hover: false, clicks: [], scroll: 0.5, pal, variant,
  };
  let raf = 0;
  let last = 0;
  let visible = true;
  let frames = 0;
  let lastMove = -10;
  let rx = 0.5;
  let ry = 0.5;

  const rel = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r };
  };
  const onMove = (e: PointerEvent) => {
    const { x, y } = rel(e);
    const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    f.hover = inside && e.pointerType !== 'touch' ? true : inside && f.down;
    if (!inside) return;
    rx = x;
    ry = y;
    lastMove = f.t;
    frames = Math.min(frames, 60);
  };
  const onDown = (e: PointerEvent) => {
    const { x, y } = rel(e);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (e.target instanceof Element && e.target.closest('a,button,input,[data-ui]')) return;
    f.down = true;
    f.hover = true;
    rx = x;
    ry = y;
    lastMove = f.t;
    f.clicks.push({ x, y, age: 0 });
    if (f.clicks.length > 6) f.clicks.shift();
    frames = 0;
  };
  const onUp = () => {
    f.down = false;
  };
  const onLeave = () => {
    f.hover = false;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  const io = new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    if (visible) frames = 0;
  });
  io.observe(canvas);

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) {
      last = 0;
      return;
    }
    // Reduced motion: settle for a moment, then hold still until touched.
    if (reduced && frames > 90) return;
    frames++;
    const s = now / 1000;
    f.dt = last ? Math.min(0.05, s - last) : 0.016;
    last = s;
    f.t += f.dt;

    f.dpr = Math.min(window.devicePixelRatio || 1, study.maxDpr ?? 2);
    const w = Math.max(2, Math.round(canvas.clientWidth * f.dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * f.dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    f.w = w;
    f.h = h;

    // When nobody is steering, a slow figure wanders the canvas instead.
    const idle = !f.hover || f.t - lastMove > 4;
    const tx = idle ? 0.5 + 0.28 * Math.cos(f.t * 0.31) + 0.08 * Math.cos(f.t * 0.83) : rx;
    const ty = idle ? 0.5 + 0.22 * Math.sin(f.t * 0.43) + 0.06 * Math.sin(f.t * 1.07) : ry;
    const ox = f.px;
    const oy = f.py;
    const k = idle ? Math.min(1, f.dt * 2) : 1;
    f.px += (tx - f.px) * k;
    f.py += (ty - f.py) * k;
    f.dx = f.px - ox;
    f.dy = f.py - oy;
    const e = Math.min(1, f.dt * 5);
    f.sx += (f.px - f.sx) * e;
    f.sy += (f.py - f.sy) * e;

    const r = canvas.getBoundingClientRect();
    f.scroll = Math.max(0, Math.min(1, 1 - (r.top + r.height) / (window.innerHeight + r.height)));
    for (const c of f.clicks) c.age += f.dt;
    f.clicks = f.clicks.filter((c) => c.age < 6);
    inst.frame(f);
  };
  raf = requestAnimationFrame(tick);

  return {
    set(patch) {
      if (patch.pal) f.pal = patch.pal;
      if (patch.variant !== undefined) f.variant = patch.variant;
      frames = 0;
    },
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('pointerleave', onLeave);
      inst.destroy?.();
    },
  };
}

/* ---- WebGL helpers ---------------------------------------------------------- */

export const FULLSCREEN_VS = `#version 300 es
out vec2 v_uv;
void main(){
  vec2 v=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  v_uv=v;
  gl_Position=vec4(v*2.-1.,0.,1.);
}`;

/** GLSL: palette uniforms and a smooth ramp through the four stops. */
export const GLSL_PALETTE = `
uniform vec3 u_bg;
uniform vec3 u_ink;
uniform vec3 u_s[4];
uniform float u_light;
vec3 ramp(float t){
  t=clamp(t,0.,1.)*3.;
  int i=int(min(floor(t),2.));
  float f=t-float(i);f=f*f*(3.-2.*f);
  return mix(u_s[i],u_s[i+1],f);
}`;

export interface Prog {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

export function getGL(canvas: HTMLCanvasElement, attrs: WebGLContextAttributes = {}): WebGL2RenderingContext | null {
  try {
    return canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, ...attrs });
  } catch {
    return null;
  }
}

export function program(gl: WebGL2RenderingContext, vs: string, fs: string, name = 'study'): Prog | null {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(`[studies] ${name}: ${gl.getShaderInfoLog(s)}`);
      return null;
    }
    return s;
  };
  const v = sh(gl.VERTEX_SHADER, vs);
  const fr = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !fr) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, fr);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn(`[studies] ${name}: ${gl.getProgramInfoLog(p)}`);
    return null;
  }
  const u: Prog['u'] = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (info) u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export function setPalette(gl: WebGL2RenderingContext, pr: Prog, pal: Palette) {
  gl.uniform3fv(pr.u.u_bg, hexToRgb(pal.bg));
  gl.uniform3fv(pr.u.u_ink, hexToRgb(pal.ink));
  gl.uniform3fv(pr.u.u_s, pal.stops.flatMap(hexToRgb));
  gl.uniform1f(pr.u.u_light, pal.light ? 1 : 0);
}

export const loseContext = (gl: WebGL2RenderingContext) => gl.getExtension('WEBGL_lose_context')?.loseContext();

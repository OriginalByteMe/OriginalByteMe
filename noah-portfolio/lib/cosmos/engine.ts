/**
 * CosmosEngine — one WebGL2 canvas that draws any scene in any style and can
 * blend between two of them. No dependencies.
 *
 *   scene A ─┐
 *            ├─ composite (transition) ─ post (render style) ─ screen
 *   scene B ─┘
 *
 * Scenes render into reduced-resolution framebuffers; the post pass runs at
 * full resolution, so pixel, ASCII and halftone cells stay crisp while the
 * raymarched scenes stay cheap.
 */
import {
  PALETTES,
  styleIndex,
  transitionIndex,
  type Palette,
  type SceneId,
  type StyleId,
  type TransitionId,
} from './config';
import { COMPOSITE, GLYPH_RAMP, POST } from './shaders/post';
import { VERT, sceneSource } from './shaders/scenes';

export interface CosmosFrame {
  a: SceneId;
  b: SceneId;
  /** 0 = all A, 1 = all B. */
  mix: number;
  transition: TransitionId;
  styleA: StyleId;
  styleB: StyleId;
  /** Chapter progress 0..1. A negative value means "loop on its own". */
  progA: number;
  progB: number;
  varA: number;
  varB: number;
  palette: Palette;
}

export interface CosmosOptions {
  /** Cap on scene-buffer pixels. Lower is faster. */
  maxScenePixels?: number;
  /** Freeze time and only redraw when the frame changes. */
  reducedMotion?: boolean;
  /** Follow the pointer for parallax and eye tracking. */
  pointer?: boolean;
}

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
}

const FROZEN_TIME = 7.3;

export const defaultFrame = (): CosmosFrame => ({
  a: 'afroHole',
  b: 'afroHole',
  mix: 0,
  transition: 'fade',
  styleA: 'raw',
  styleB: 'raw',
  progA: -1,
  progB: -1,
  varA: 0,
  varB: 0,
  palette: PALETTES[0],
});

export function supportsCosmos(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

export class CosmosEngine {
  readonly canvas: HTMLCanvasElement;
  frame: CosmosFrame = defaultFrame();
  /** False when WebGL2 is missing; the canvas is then left untouched. */
  readonly ok: boolean;

  private gl: WebGL2RenderingContext | null = null;
  private scenes = new Map<SceneId, Program | null>();
  private composite: Program | null = null;
  private post: Program | null = null;
  private targets: Target[] = [];
  private glyph: WebGLTexture | null = null;
  private sw = 0;
  private sh = 0;
  private raf = 0;
  private running = false;
  private visible = true;
  private time = 0;
  private last = 0;
  private dirty = true;
  private lastKey = '';
  private mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  /** Click position (-1..1) and the time it happened. */
  private click = { x: 0, y: 0, at: -99 };
  private energy = 0;
  private spin = 0;
  private moved = 0;
  private io: IntersectionObserver | null = null;
  private opts: Required<CosmosOptions>;
  private cleanup: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, opts: CosmosOptions = {}) {
    this.canvas = canvas;
    this.opts = {
      maxScenePixels: opts.maxScenePixels ?? 520_000,
      reducedMotion: opts.reducedMotion ?? false,
      pointer: opts.pointer ?? true,
    };
    this.ok = this.init();
    if (!this.ok) return;

    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(this.raf);
    };
    const onRestored = () => {
      this.scenes.clear();
      this.targets = [];
      this.sw = this.sh = 0;
      if (this.init() && this.running) this.loop();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    this.cleanup.push(() => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    });

    if (this.opts.pointer) {
      const onMove = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        const ny = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
        this.moved += Math.hypot(nx - this.mouse.tx, ny - this.mouse.ty);
        this.mouse.tx = nx;
        this.mouse.ty = ny;
        this.dirty = true;
      };
      const onDown = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        const inside =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        const el = e.target instanceof Element ? e.target : null;
        if (!inside || el?.closest('a,button,input,select,textarea,label,[data-cosmos-ui]')) return;
        this.click = {
          x: ((e.clientX - r.left) / r.width) * 2 - 1,
          y: -(((e.clientY - r.top) / r.height) * 2 - 1),
          at: this.time,
        };
        this.energy = Math.min(1, this.energy + 0.6);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      this.cleanup.push(() => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerdown', onDown);
      });
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
        if (this.visible) this.dirty = true;
      });
      this.io.observe(canvas);
    }
  }

  setReducedMotion(on: boolean) {
    this.opts.reducedMotion = on;
    this.dirty = true;
  }

  /** Compile a scene ahead of the scroll reaching it. */
  warm(id: SceneId) {
    if (this.ok) this.sceneProgram(id);
  }

  start() {
    if (!this.ok || this.running) return;
    this.running = true;
    this.last = 0;
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.io?.disconnect();
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }

  /** Draw the current frame once, at an explicit time, and copy it out. */
  snapshot(target: CanvasRenderingContext2D, time = FROZEN_TIME) {
    if (!this.ok) return;
    this.draw(time);
    target.drawImage(this.canvas, 0, 0, target.canvas.width, target.canvas.height);
  }

  /* ---- internals ---------------------------------------------------------- */

  private init(): boolean {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = this.canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch {
      gl = null;
    }
    if (!gl) return false;
    this.gl = gl;
    this.composite = this.build(COMPOSITE, 'composite');
    this.post = this.build(POST, 'post');
    this.glyph = this.buildGlyphs();
    return Boolean(this.composite && this.post);
  }

  private build(fragSrc: string, name: string): Program | null {
    const gl = this.gl;
    if (!gl) return null;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn(`[cosmos] ${name} shader failed to compile:\n${gl.getShaderInfoLog(sh)}`);
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn(`[cosmos] ${name} program failed to link:\n${gl.getProgramInfoLog(prog)}`);
      return null;
    }
    const u: Program['u'] = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) u[info.name] = gl.getUniformLocation(prog, info.name);
    }
    return { prog, u };
  }

  private sceneProgram(id: SceneId): Program | null {
    if (!this.scenes.has(id)) this.scenes.set(id, this.build(sceneSource(id), id));
    return this.scenes.get(id) ?? null;
  }

  private buildGlyphs(): WebGLTexture | null {
    const gl = this.gl;
    if (!gl) return null;
    const gw = 32;
    const gh = 56;
    const c = document.createElement('canvas');
    c.width = gw * GLYPH_RAMP.length;
    c.height = gh;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${gh * 0.82}px ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < GLYPH_RAMP.length; i++) {
      ctx.fillText(GLYPH_RAMP[i], gw * (i + 0.5), gh * 0.52);
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private resize() {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }
    const scale = Math.min(1, Math.sqrt(this.opts.maxScenePixels / (w * h)));
    const sw = Math.max(2, Math.round(w * scale));
    const sh = Math.max(2, Math.round(h * scale));
    if (sw === this.sw && sh === this.sh && this.targets.length === 3) return;
    this.sw = sw;
    this.sh = sh;
    for (const t of this.targets) {
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.tex);
    }
    this.targets = [];
    for (let i = 0; i < 3; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, i === 2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      this.targets.push({ fbo, tex });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) {
      this.last = 0;
      return;
    }
    const now = performance.now() / 1000;
    const dt = this.last ? Math.min(0.1, now - this.last) : 0;
    this.last = now;

    const f = this.frame;
    const key = `${f.a}|${f.b}|${f.mix.toFixed(4)}|${f.transition}|${f.styleA}|${f.styleB}|${f.progA.toFixed(4)}|${f.progB.toFixed(4)}|${f.varA}|${f.varB}|${f.palette.bg}|${f.palette.c1}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.dirty = true;
    }
    if (this.opts.reducedMotion) {
      this.mouse.x = this.mouse.tx = 0;
      this.mouse.y = this.mouse.ty = 0;
      if (!this.dirty && this.canvas.width === Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))) return;
      this.draw(FROZEN_TIME);
    } else {
      this.time += dt;
      this.energy += (Math.min(1, this.moved * 6) - this.energy) * Math.min(1, dt * 5);
      this.energy *= Math.exp(-dt * 1.2);
      this.moved = 0;
      this.spin += this.energy * dt;
      this.mouse.x += (this.mouse.tx - this.mouse.x) * Math.min(1, dt * 4);
      this.mouse.y += (this.mouse.ty - this.mouse.y) * Math.min(1, dt * 4);
      this.draw(this.time);
    }
    this.dirty = false;
  };

  private autoProg(p: number, time: number) {
    if (p >= 0) return Math.min(1, p);
    return this.opts.reducedMotion ? 0.7 : 0.5 - 0.5 * Math.cos(time * 0.3);
  }

  private drawScene(id: SceneId, target: Target, time: number, prog: number, variant: number) {
    const gl = this.gl!;
    const p = this.sceneProgram(id);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, this.sw, this.sh);
    const pal = this.frame.palette;
    if (!p) {
      gl.clearColor(pal.bg[0], pal.bg[1], pal.bg[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    gl.useProgram(p.prog);
    gl.uniform2f(p.u.u_res, this.sw, this.sh);
    gl.uniform1f(p.u.u_time, time);
    gl.uniform1f(p.u.u_prog, this.autoProg(prog, time));
    gl.uniform1f(p.u.u_var, variant);
    gl.uniform2f(p.u.u_mouse, this.mouse.x, this.mouse.y);
    // Scene space: y in [-1, 1], x scaled by aspect, zoomed out on narrow screens.
    const asp = this.sw / this.sh;
    const fit = Math.min(1, asp / 0.9);
    gl.uniform2f(p.u.u_ptr, (this.mouse.x * asp) / fit, this.mouse.y / fit);
    gl.uniform3f(p.u.u_click, (this.click.x * asp) / fit, this.click.y / fit, this.clickAge(time));
    gl.uniform1f(p.u.u_energy, this.energy);
    gl.uniform1f(p.u.u_spin, this.spin);
    this.palette(p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private clickAge(time: number) {
    return this.opts.reducedMotion ? 99 : Math.min(99, Math.max(0, time - this.click.at));
  }

  private palette(p: Program) {
    const gl = this.gl!;
    const pal = this.frame.palette;
    gl.uniform3fv(p.u.u_bg, pal.bg);
    gl.uniform3fv(p.u.u_c1, pal.c1);
    gl.uniform3fv(p.u.u_c2, pal.c2);
    gl.uniform3fv(p.u.u_c3, pal.c3);
    gl.uniform3fv(p.u.u_hot, pal.hot);
  }

  private draw(time: number) {
    const gl = this.gl;
    if (!gl || !this.composite || !this.post) return;
    this.resize();
    if (this.targets.length !== 3) return;
    const f = this.frame;
    const [ta, tb, tc] = this.targets;
    const mix = Math.max(0, Math.min(1, f.mix));

    if (mix < 1) this.drawScene(f.a, ta, time, f.progA, f.varA);
    if (mix > 0) this.drawScene(f.b, tb, time, f.progB, f.varB);

    const c = this.composite;
    gl.bindFramebuffer(gl.FRAMEBUFFER, tc.fbo);
    gl.viewport(0, 0, this.sw, this.sh);
    gl.useProgram(c.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ta.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tb.tex);
    gl.uniform1i(c.u.u_a, 0);
    gl.uniform1i(c.u.u_b, 1);
    gl.uniform1f(c.u.u_mix, mix);
    gl.uniform1i(c.u.u_trans, transitionIndex(f.transition));
    gl.uniform2f(c.u.u_res, this.sw, this.sh);
    gl.uniform1f(c.u.u_time, time);
    gl.uniform3fv(c.u.u_hot, f.palette.hot);
    gl.uniform3fv(c.u.u_bg, f.palette.bg);
    gl.uniform3f(c.u.u_click, this.click.x * 0.5 + 0.5, this.click.y * 0.5 + 0.5, this.clickAge(time));
    gl.uniform2f(c.u.u_cur, this.mouse.x * 0.5 + 0.5, this.mouse.y * 0.5 + 0.5);
    gl.uniform1f(c.u.u_energy, this.opts.pointer && !this.opts.reducedMotion ? this.energy : -0.5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Mipmaps of the composite feed the bloom in the post pass.
    gl.bindTexture(gl.TEXTURE_2D, tc.tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    const p = this.post;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(p.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tc.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.glyph);
    gl.uniform1i(p.u.u_tex, 0);
    gl.uniform1i(p.u.u_glyph, 1);
    gl.uniform2f(p.u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(p.u.u_dpr, Math.max(1, this.canvas.width / Math.max(1, this.canvas.clientWidth)));
    gl.uniform1f(p.u.u_time, time);
    gl.uniform1i(p.u.u_sa, styleIndex(f.styleA));
    gl.uniform1i(p.u.u_sb, styleIndex(f.styleB));
    gl.uniform2f(p.u.u_mouse, this.mouse.x, this.mouse.y);
    this.palette(p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

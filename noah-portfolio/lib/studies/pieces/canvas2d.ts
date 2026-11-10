import { hexToRgb, ramp, rgba, type Study } from '../core';

/* ---- small noise for the 2D pieces ---- */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

/**
 * Silk — a few thousand threads following an invisible current. They leave
 * faint trails, so the picture is the history of where they have been.
 */
export const silk: Study = {
  id: 'silk',
  title: 'Silk',
  line: 'Thousands of threads following a current you cannot see. The picture is where they have been.',
  hint: 'Your pointer is a whirlpool. Click to scatter.',
  variants: ['Current', 'Orbit', 'Strata'],
  maxDpr: 1.5,
  create(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const COUNT = 2600;
    const pts = new Float32Array(COUNT * 4);
    let w = 0, h = 0, key = '';
    const seed = (i: number) => {
      pts[i * 4] = Math.random() * w;
      pts[i * 4 + 1] = Math.random() * h;
      pts[i * 4 + 2] = Math.random();
      pts[i * 4 + 3] = 40 + Math.random() * 260;
    };
    return {
      frame(f) {
        const k = `${f.w}x${f.h}|${f.pal.id}|${f.variant}`;
        if (k !== key) {
          key = k; w = f.w; h = f.h;
          for (let i = 0; i < COUNT; i++) seed(i);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = f.pal.bg;
          ctx.fillRect(0, 0, w, h);
        }
        const light = f.pal.light;
        // Fade toward the background a hair each frame so old paths sink away.
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(hexToRgb(f.pal.bg), 0.022);
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
        ctx.lineWidth = Math.max(1, f.dpr * 0.9);
        const sc = 1.6 / Math.min(w, h);
        const mx = f.px * w, my = f.py * h;
        const burst = f.clicks.filter((c) => c.age < 0.6);
        const step = Math.min(w, h) * 0.0032 * (f.dt * 60);
        const cols: string[] = [];
        for (let b = 0; b < 12; b++) cols.push(rgba(ramp(f.pal, light ? b / 11 * 0.9 : 0.12 + b / 11 * 0.88), light ? 0.2 : 0.26));
        for (let b = 0; b < 12; b++) {
          ctx.strokeStyle = cols[b];
          ctx.beginPath();
          for (let i = b; i < COUNT; i += 12) {
            const o = i * 4;
            const x = pts[o], y = pts[o + 1];
            let a: number;
            if (f.variant === 1) {
              a = Math.atan2(y - h / 2, x - w / 2) + Math.PI / 2 + (noise(x * sc * 2, y * sc * 2 + f.t * 0.05) - 0.5) * 1.6;
            } else if (f.variant === 2) {
              a = (noise(x * sc * 0.7, y * sc * 3 + f.t * 0.03) - 0.5) * 1.5;
            } else {
              a = noise(x * sc + 3, y * sc + f.t * 0.04) * Math.PI * 4;
            }
            let vx = Math.cos(a), vy = Math.sin(a);
            const dx = x - mx, dy = y - my;
            const d2 = (dx * dx + dy * dy) / (Math.min(w, h) ** 2);
            const pull = Math.exp(-d2 * 14) * 2.4;
            const dl = Math.hypot(dx, dy) + 1;
            vx += (-dy / dl) * pull - (dx / dl) * pull * 0.25;
            vy += (dx / dl) * pull - (dy / dl) * pull * 0.25;
            for (const c of burst) {
              const bx = x - c.x * w, by = y - c.y * h;
              const bl = Math.hypot(bx, by) + 1;
              const e = Math.exp(-((bl / Math.min(w, h)) ** 2) * 10) * (1 - c.age / 0.6) * 7;
              vx += (bx / bl) * e;
              vy += (by / bl) * e;
            }
            const nx = x + vx * step, ny = y + vy * step;
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            pts[o] = nx; pts[o + 1] = ny;
            if (--pts[o + 3] < 0 || nx < -20 || ny < -20 || nx > w + 20 || ny > h + 20) seed(i);
          }
          ctx.stroke();
        }
      },
    };
  },
};

/** Tide — a sheet of characters behaving like water. */
export const tide: Study = {
  id: 'tide',
  title: 'Tide',
  line: 'A sheet of plain characters that behaves like water.',
  hint: 'Move to make a wake. Click to drop a stone.',
  variants: ['Glyphs', 'Binary', 'Braille', 'Portrait'],
  create(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const RAMPS = [' ..:-=+*#%@', ' 0011', ' ⠁⠃⠇⠏⠟⠿⡿⣿', ' ..:-=+*#%@'];
    let imgV = -1;
    let pix: ImageData | null = null;
    return {
      frame(f) {
        const { w, h } = f;
        ctx.fillStyle = f.pal.bg;
        ctx.fillRect(0, 0, w, h);
        if (imgV !== f.imgV) {
          imgV = f.imgV;
          pix = f.img ? (f.img.getContext('2d')?.getImageData(0, 0, f.img.width, f.img.height) ?? null) : null;
        }
        const pic = f.variant === 3 ? pix : null;
        // Map a canvas position onto the picture, cover or contain.
        const ia = pic ? pic.width / pic.height : 1;
        const ca = w / h;
        const wide = ca > ia;
        const sx = (f.cover ? (wide ? 1 : ca / ia) : wide ? ca / ia : 1) / f.imgScale;
        const sy = (f.cover ? (wide ? ia / ca : 1) : wide ? 1 : ia / ca) / f.imgScale;
        const fs = Math.max(6, Math.round((13 * f.dpr) / f.density));
        const cw = fs * 0.66, ch = fs * 1.45;
        ctx.font = `${fs}px ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const chars = RAMPS[f.variant] ?? RAMPS[0];
        const cols = Math.ceil(w / cw), rows = Math.ceil(h / ch);
        const m = Math.min(w, h);
        const mx = f.sx * w, my = f.sy * h;
        const buckets: Array<Array<[string, number, number]>> = Array.from({ length: 8 }, () => []);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = (c + 0.5) * cw, y = (r + 0.5) * ch;
            const u = x / m, v = y / m;
            let val = 0.5 + 0.28 * Math.sin(u * 5.2 + v * 2.1 + f.t * 0.7) * Math.cos(v * 4.3 - f.t * 0.45) + 0.22 * (noise(u * 2.2 + f.t * 0.08, v * 2.2) - 0.5);
            const d = Math.hypot(x - mx, y - my) / m;
            val += 0.42 * Math.exp(-d * d * 22) + 0.16 * Math.sin(d * 34 - f.t * 5) * Math.exp(-d * 5.5);
            for (const cl of f.clicks) {
              const dd = Math.hypot(x - cl.x * w, y - cl.y * h) / m;
              val += 0.5 * Math.sin((dd - cl.age * 0.42) * 38) * Math.exp(-Math.abs(dd - cl.age * 0.42) * 7) * Math.exp(-cl.age * 0.8);
            }
            if (pic) {
              const qx = (x / w - 0.5) * sx + 0.5, qy = (y / h - 0.5) * sy + 0.5;
              let lum = 0;
              if (qx >= 0 && qx < 1 && qy >= 0 && qy < 1) {
                const o = (Math.floor(qy * pic.height) * pic.width + Math.floor(qx * pic.width)) * 4;
                const l = (pic.data[o] * 0.299 + pic.data[o + 1] * 0.587 + pic.data[o + 2] * 0.114) / 255;
                lum = (f.pal.light ? 1 - l : l) * (pic.data[o + 3] / 255);
              }
              // The picture rises out of the water; the water still moves through it.
              val = 0.43 + lum * 0.5 + (val - 0.5) * 0.5;
            }
            val = Math.max(0, Math.min(0.999, (val - 0.3) * 1.5));
            const chr = chars[Math.floor(val * chars.length)];
            if (chr === ' ') continue;
            buckets[Math.min(7, Math.floor(val * 8))].push([chr, x, y]);
          }
        }
        buckets.forEach((b, i) => {
          const t = i / 7;
          ctx.fillStyle = rgba(ramp(f.pal, f.pal.light ? t * 0.85 : 0.15 + t * 0.85), 0.35 + 0.65 * t);
          for (const [chr, x, y] of b) ctx.fillText(chr, x, y);
        });
      },
    };
  },
};

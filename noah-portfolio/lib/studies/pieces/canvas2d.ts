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

/**
 * Pulsar — stacked traces, each hiding the one behind it. The form echoes how
 * the first pulsar signals were plotted.
 */
export const pulsar: Study = {
  id: 'pulsar',
  title: 'Pulsar',
  line: 'Stacked traces of one signal, each hiding the one behind, the way the first pulsars were plotted.',
  hint: 'The peaks follow your pointer. Click to send a pulse.',
  variants: ['Signal', 'Dunes', 'Wide'],
  create(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return {
      frame(f) {
        const { w, h } = f;
        ctx.fillStyle = f.pal.bg;
        ctx.fillRect(0, 0, w, h);
        const wide = f.variant === 2;
        const dunes = f.variant === 1;
        const rows = dunes ? 34 : 58;
        const colW = wide ? w * 0.94 : Math.min(w * 0.86, Math.max(h * 0.62, 300 * f.dpr));
        const x0 = (w - colW) / 2;
        const top = h * 0.2, bottom = h * 0.86;
        const amp = (bottom - top) * (dunes ? 0.2 : 0.16);
        const cx = (f.sx * w - x0) / colW;
        const STEPS = wide ? 220 : 150;
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, f.dpr * 1.1);
        for (let r = 0; r < rows; r++) {
          const fr = r / (rows - 1);
          const y = top + (bottom - top) * fr;
          ctx.beginPath();
          for (let s = 0; s <= STEPS; s++) {
            const u = s / STEPS;
            const env = Math.exp(-(((u - cx) / (wide ? 0.16 : 0.2)) ** 2)) * (0.35 + 0.65 * Math.exp(-(((u - 0.5) / 0.42) ** 2)));
            let v: number;
            if (dunes) {
              v = (0.5 + 0.5 * Math.sin(u * 9 + r * 0.45 + f.t * 0.5)) * noise(u * 3 + r * 0.21, f.t * 0.12 + r * 0.3);
            } else {
              const n = noise(u * 16 + r * 7.3, f.t * 0.45 + r * 0.17);
              v = Math.pow(n, 3) * 2.2 + noise(u * 60, r * 3.1 + f.t * 0.6) * 0.07;
            }
            let pulse = 0;
            for (const c of f.clicks) {
              const cu = (c.x * w - x0) / colW;
              const front = fr - (c.y * h - top) / (bottom - top);
              pulse += Math.exp(-(((Math.abs(front) - c.age * 0.45) * 9) ** 2)) * Math.exp(-(((u - cu) / 0.25) ** 2)) * Math.exp(-c.age * 0.9) * 1.4;
            }
            const yy = y - (v * env + pulse) * amp - (dunes ? 0 : noise(u * 40 + r, f.t) * 1.2 * f.dpr);
            if (s === 0) ctx.moveTo(x0, yy);
            else ctx.lineTo(x0 + u * colW, yy);
          }
          ctx.strokeStyle = rgba(ramp(f.pal, f.pal.light ? fr * 0.8 : 0.25 + (1 - fr) * 0.75), 0.95);
          ctx.stroke();
          // Occlude everything behind this trace.
          ctx.lineTo(x0 + colW, y + amp * 0.2);
          ctx.lineTo(x0, y + amp * 0.2);
          ctx.closePath();
          ctx.fillStyle = f.pal.bg;
          ctx.fill();
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
  variants: ['Glyphs', 'Binary', 'Braille'],
  create(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const RAMPS = [' ..:-=+*#%@', ' 0011', ' ⠁⠃⠇⠏⠟⠿⡿⣿'];
    return {
      frame(f) {
        const { w, h } = f;
        ctx.fillStyle = f.pal.bg;
        ctx.fillRect(0, 0, w, h);
        const fs = Math.round(13 * f.dpr);
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

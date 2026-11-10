import { describe, expect, it } from 'vitest';

import {
  CHAPTERS,
  CUTS,
  PALETTES,
  SCENES,
  STYLES,
  TRANSITIONS,
  mixPalette,
  paletteById,
} from '../config';
import { COMPOSITE, GLYPH_RAMP, POST } from '../shaders/post';
import { sceneSource } from '../shaders/scenes';

const sceneIds = SCENES.map((s) => s.id);
const styleIds = STYLES.map((s) => s.id);
const paletteIds = PALETTES.map((p) => p.id);
const transitionIds = TRANSITIONS.map((t) => t.id);

describe('cosmos catalogue', () => {
  it('has unique ids in every list', () => {
    for (const ids of [sceneIds, styleIds, paletteIds, transitionIds, CHAPTERS.map((c) => c.id), CUTS.map((c) => c.id)]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('only lets chapters reference things that exist', () => {
    for (const ch of CHAPTERS) {
      expect(sceneIds).toContain(ch.scene);
      expect(styleIds).toContain(ch.style);
      expect(paletteIds).toContain(ch.palette);
      expect(transitionIds).toContain(ch.out);
      const scene = SCENES.find((s) => s.id === ch.scene)!;
      expect(ch.variant).toBeLessThan(scene.variants.length);
    }
  });

  it('only lets cuts force styles and palettes that exist', () => {
    for (const cut of CUTS) {
      if (cut.style) expect(styleIds).toContain(cut.style);
      if (cut.palette) expect(paletteIds).toContain(cut.palette);
    }
  });

  it('keeps palette channels in range', () => {
    for (const p of PALETTES) {
      for (const c of [p.bg, p.c1, p.c2, p.c3, p.hot]) {
        expect(c).toHaveLength(3);
        c.forEach((v) => {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        });
      }
    }
  });

  it('mixes palettes from one end to the other', () => {
    const [a, b] = PALETTES;
    expect(mixPalette(a, b, 0).c1).toEqual(a.c1);
    mixPalette(a, b, 1).c1.forEach((v, i) => expect(v).toBeCloseTo(b.c1[i]));
    const mid = mixPalette(a, b, 0.5).bg;
    mid.forEach((v, i) => expect(v).toBeCloseTo((a.bg[i] + b.bg[i]) / 2));
  });

  it('falls back to the first palette for an unknown id', () => {
    expect(paletteById('nope')).toBe(PALETTES[0]);
  });
});

describe('cosmos shaders', () => {
  it('builds a complete fragment shader for every scene', () => {
    for (const id of sceneIds) {
      const src = sceneSource(id);
      expect(src.startsWith('#version 300 es')).toBe(true);
      expect(src).toContain('vec3 scene(vec2 p)');
      expect(src).toContain('void main()');
    }
  });

  it('handles every transition and style index in the passes', () => {
    transitionIds.forEach((_, i) => {
      if (i > 0) expect(COMPOSITE).toContain(`u_trans==${i}`);
    });
    styleIds.forEach((_, i) => {
      if (i > 0) expect(POST).toContain(`s==${i}`);
    });
    expect(POST).toContain(`const float NG=${GLYPH_RAMP.length}.;`);
  });

  it('never calls smoothstep with literal edges in the wrong order', () => {
    const sources = [...sceneIds.map(sceneSource), COMPOSITE, POST];
    const re = /smoothstep\((-?\d*\.?\d+),(-?\d*\.?\d+),/g;
    for (const src of sources) {
      for (const m of src.matchAll(re)) {
        expect(Number(m[1]), m[0]).toBeLessThan(Number(m[2]));
      }
    }
  });
});

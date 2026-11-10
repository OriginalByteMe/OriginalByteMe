import { describe, expect, it } from 'vitest';

import { PALETTES, hexToRgb, ramp } from '../core';
import { STUDIES } from '../list';

describe('studies', () => {
  it('gives every study a unique id, copy and at least one variation', () => {
    const ids = STUDIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STUDIES) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.line.length).toBeGreaterThan(0);
      expect(s.hint.length).toBeGreaterThan(0);
      expect(s.variants.length).toBeGreaterThan(0);
    }
  });

  it('defines palettes as valid hex with four stops', () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PALETTES) {
      for (const c of [p.bg, p.ink, ...p.stops]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.stops).toHaveLength(4);
    }
  });

  it('ramps from the first stop to the last', () => {
    const p = PALETTES[0];
    ramp(p, 0).forEach((v, i) => expect(v).toBeCloseTo(hexToRgb(p.stops[0])[i]));
    ramp(p, 1).forEach((v, i) => expect(v).toBeCloseTo(hexToRgb(p.stops[3])[i]));
    ramp(p, 5).forEach((v, i) => expect(v).toBeCloseTo(hexToRgb(p.stops[3])[i]));
  });

});

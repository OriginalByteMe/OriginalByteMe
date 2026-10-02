import { describe, expect, it } from 'vitest';
import { characterCameraDistance, shouldCancelOnPointerLeave } from '../input';

describe('character input and framing', () => {
  it('preserves a touch destination through the pointerup → pointerleave sequence', () => {
    let destination: string | null = 'tapped floor';
    if (shouldCancelOnPointerLeave('touch')) destination = null;
    expect(destination).toBe('tapped floor');
    expect(shouldCancelOnPointerLeave('mouse')).toBe(true);
    expect(shouldCancelOnPointerLeave('pen')).toBe(true);
  });
  it('gives narrow screens extra camera clearance', () => {
    expect(characterCameraDistance(.58)).toBeGreaterThan(15);
    expect(characterCameraDistance(.8)).toBe(11.5);
    expect(Number.isFinite(characterCameraDistance(0))).toBe(true);
  });
});

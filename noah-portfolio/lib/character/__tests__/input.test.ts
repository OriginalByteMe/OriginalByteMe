import { describe, expect, it } from 'vitest';
import { CharacterClickInput, rayHitsSphere } from '../input';
const event = (overrides = {}) => ({ pointerId: 1, clientX: 100, clientY: 100, button: 0, isPrimary: true, ...overrides });
describe('click-to-move input', () => {
  it('needs a completed primary click, then consumes it once', () => {
    const input = new CharacterClickInput();
    expect(input.up(event())).toBe(false);
    input.down(event()); expect(input.up(event())).toBe(true); expect(input.up(event())).toBe(false);
  });
  it('copies inherited browser event accessors rather than spreading the event', () => {
    const input = new CharacterClickInput();
    const nativeLike = Object.create(event());
    expect(Object.keys(nativeLike)).toEqual([]);
    input.down(nativeLike); expect(input.up(nativeLike)).toBe(true);
  });
  it('does not turn a drag or touch scroll into a destination', () => {
    const input = new CharacterClickInput(); input.down(event());
    expect(input.up(event({ clientY: 120 }))).toBe(false);
    input.down(event()); input.cancel(); expect(input.up(event())).toBe(false);
  });
  it('ignores either end of UI interactions and nonprimary contacts', () => {
    const input = new CharacterClickInput();
    input.down(event(), true); expect(input.up(event())).toBe(false);
    input.down(event()); expect(input.up(event(), true)).toBe(false);
    input.down(event({ button: 2 })); expect(input.up(event({ button: 2 }))).toBe(false);
    input.down(event({ isPrimary: false })); expect(input.up(event())).toBe(false);
    input.down(event()); expect(input.up(event({ pointerId: 2 }))).toBe(false);
  });
  it.each([
    ['straight at the centre', { x: 0, y: 2, z: 10 }, { x: 0, y: 0, z: -1 }, true],
    ['grazing just inside the rim', { x: .59, y: 2, z: 10 }, { x: 0, y: 0, z: -1 }, true],
    ['passing just outside the rim', { x: .61, y: 2, z: 10 }, { x: 0, y: 0, z: -1 }, false],
    ['pointing away from it', { x: 0, y: 2, z: 10 }, { x: 0, y: 0, z: 1 }, false],
    ['starting inside it', { x: 0, y: 2.3, z: 0 }, { x: 1, y: 0, z: 0 }, true],
    ['with an unnormalized direction', { x: 0, y: 2, z: 10 }, { x: 0, y: 0, z: -5 }, true],
    ['diagonally from a raised camera', { x: 0, y: 10, z: 10 }, { x: 0, y: -8, z: -10 }, true],
  ])('tests a ray against the afro sphere: %s', (_, origin, direction, hit) => {
    expect(rayHitsSphere(origin, direction, { center: { x: 0, y: 2, z: 0 }, radius: .6 })).toBe(hit);
  });
});

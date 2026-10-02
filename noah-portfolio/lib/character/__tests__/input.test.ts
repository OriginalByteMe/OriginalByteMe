import { describe, expect, it } from 'vitest';
import { CharacterClickInput, characterCameraDistance } from '../input';
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
  it('retains conservative camera framing', () => {
    expect(characterCameraDistance(.58)).toBeGreaterThan(16);
    expect(characterCameraDistance(.8)).toBe(12.875);
    expect(Number.isFinite(characterCameraDistance(0))).toBe(true);
  });
});

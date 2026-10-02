import { describe, expect, it } from 'vitest';
import { ACTIVITY_PROP_LAYOUT } from '../activity-props';
import { ACTIVITY_STATIONS } from '../activities';
import { CHARACTER_CONFIG, createCharacterState, stepCharacter, resolveCharacterTarget } from '../controller';

const props = [
  { x: -1.35, z: -.45, radius: .34 }, { x: 1.3, z: -1.15, radius: .38 },
  { x: .65, z: 1.4, radius: .25 }, { x: -3.4, z: 1.1, radius: .42 }, { x: 3.6, z: -.25, radius: .46 },
  { ...ACTIVITY_PROP_LAYOUT.ball, radius: .23 }, { ...ACTIVITY_PROP_LAYOUT.book, radius: .22 },
];
describe('immersive hero world movement', () => {
  it('stores reachable click destinations, including prop centers, so commands finish', () => {
    const bounds = { minX: -2.3, maxX: 2.3, minZ: -2, maxZ: 2.2 };
    for (const original of [...props, ...Object.values(ACTIVITY_STATIONS)]) {
      const state = createCharacterState({ x: .8, z: .42 });
      const destination = resolveCharacterTarget(state.position, original, props, bounds);
      for (let frame = 0; frame < 1200; frame++) stepCharacter(state, destination, 1 / 60, props, bounds);
      expect(Math.hypot(state.position.x - destination.x, state.position.z - destination.z)).toBeLessThan(.13);
      expect(state.speed).toBeLessThan(.08);
    }
  });
  it.each([2.3, 3.74])('arrives without penetrating props in a half-width %s world', (halfWidth) => {
    const bounds = { minX: -halfWidth, maxX: halfWidth, minZ: -2, maxZ: 2.2 };
    for (const x of [-halfWidth + .3, -halfWidth / 2, 0, halfWidth / 2, halfWidth - .3]) {
      for (const z of [-1.5, .4, 1.8]) {
        if (props.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + CHARACTER_CONFIG.radius + .1)) continue;
        const state = createCharacterState({ x: Math.min(2.6, halfWidth * .65) * .55, z: .42 });
        for (let frame = 0; frame < 900; frame++) {
          stepCharacter(state, { x, z }, 1 / 60, props, bounds);
          for (const prop of props) expect(Math.hypot(state.position.x - prop.x, state.position.z - prop.z)).toBeGreaterThanOrEqual(prop.radius + CHARACTER_CONFIG.radius - .001);
        }
        expect(Math.hypot(state.position.x - x, state.position.z - z)).toBeLessThan(.12);
      }
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAbout } from '@/components/character/world/about';
import { createBedroom } from '@/components/character/world/bedroom';
import { createGarage } from '@/components/character/world/garage';
import { createHall } from '@/components/character/world/hall';
import { createLab } from '@/components/character/world/lab';
import { createPostoffice } from '@/components/character/world/postoffice';
import { createToolshed } from '@/components/character/world/toolshed';
import { lotOrigin } from '@/components/character/world/town';
import type { AreaBuilder } from '@/components/character/world/types';
import { corpus } from '@/lib/corpus';
import { CHARACTER_CONFIG, createCharacterState, stepCharacter, type Vec2 } from '../controller';
import { worldContent } from '../world-content';
import { stubCanvas2d } from './canvas-stub';

afterEach(() => { vi.restoreAllMocks(); });

describe.each<[string, AreaBuilder]>([
  ['home', createBedroom], ['hall', createHall], ['workshop', createLab], ['toolshed', createToolshed],
  ['gallery', createAbout], ['garage', createGarage], ['postoffice', createPostoffice],
])('walking around the %s lot', (_, build) => {
  it('gets from where he walks in to every station, between every pair of stations and back out, without entering furniture', () => {
    stubCanvas2d();
    const area = build(lotOrigin(0), worldContent(corpus));
    area.dispose();
    const { obstacles, bounds } = area;
    const places: [string, Vec2][] = [['entry', area.entry], ...area.stations.map((station): [string, Vec2] => [station.id, station.stand])];
    for (const [fromId, from] of places) {
      for (const [toId, to] of places) {
        if (fromId === toId) continue;
        const state = createCharacterState(from);
        let clearance = Infinity;
        for (let frame = 0; frame < 60 * 20; frame += 1) {
          stepCharacter(state, to, 1 / 60, obstacles, bounds);
          for (const obstacle of obstacles) clearance = Math.min(clearance, Math.hypot(state.position.x - obstacle.x, state.position.z - obstacle.z) - obstacle.radius - CHARACTER_CONFIG.radius);
        }
        expect(Math.hypot(state.position.x - to.x, state.position.z - to.z), `${fromId} -> ${toId}`).toBeLessThan(.13);
        expect(state.speed, `${fromId} -> ${toId}`).toBeLessThan(.1);
        expect(clearance, `${fromId} -> ${toId}`).toBeGreaterThanOrEqual(-.001);
      }
    }
  });
});

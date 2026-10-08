import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAbout } from '@/components/character/world/about';
import { createBedroom } from '@/components/character/world/bedroom';
import { createLab } from '@/components/character/world/lab';
import type { AreaBuilder } from '@/components/character/world/types';
import { corpus } from '@/lib/corpus';
import { CHARACTER_CONFIG, createCharacterState, resolveCharacterTarget, stepCharacter, type Vec2 } from '../controller';
import { worldContent } from '../world-content';
import { stubCanvas2d } from './canvas-stub';

afterEach(() => { vi.restoreAllMocks(); });

describe.each<[string, AreaBuilder, number]>([['bedroom', createBedroom, 0], ['lab', createLab, -18], ['about', createAbout, -36]])('walking around the %s', (_, build, y) => {
  it('gets from the landing hop-down to every station and the exit, and between every pair of stations, without entering furniture', () => {
    stubCanvas2d();
    const area = build(new THREE.Vector3(0, y, 0), worldContent(corpus));
    area.dispose();
    const { obstacles, bounds, landing } = area;
    // The scene hops him down 0.9 in front of the landing object.
    const hop = resolveCharacterTarget(landing, { x: landing.x, z: landing.z + .9 }, obstacles, bounds);
    const places: [string, Vec2][] = [['hop-down', hop], ...area.stations.map((station): [string, Vec2] => [station.id, station.stand]), ['exit', area.exit]];
    for (const [fromId, from] of places) {
      for (const [toId, to] of places) {
        if (fromId === toId || toId === 'hop-down' || fromId === 'exit') continue;
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

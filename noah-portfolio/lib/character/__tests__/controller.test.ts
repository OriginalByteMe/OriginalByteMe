import { describe, expect, it } from "vitest";
import {
  CHARACTER_CONFIG as CONFIG,
  DEFAULT_WORLD_BOUNDS as BOUNDS,
  createCharacterState,
  stepCharacter,
  type CharacterState,
  type CircleObstacle,
  type Vec2,
} from "@/lib/character/controller";

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
function simulate(state: CharacterState, target: Vec2 | null, seconds: number, fps = 60, obstacles: CircleObstacle[] = []) {
  for (let index = 0; index < seconds * fps; index += 1) stepCharacter(state, target, 1 / fps, obstacles);
  return state;
}
function expectClear(state: CharacterState, obstacles: CircleObstacle[]) {
  expect(state.position.x).toBeGreaterThanOrEqual(BOUNDS.minX + CONFIG.radius - 1e-6);
  expect(state.position.x).toBeLessThanOrEqual(BOUNDS.maxX - CONFIG.radius + 1e-6);
  expect(state.position.z).toBeGreaterThanOrEqual(BOUNDS.minZ + CONFIG.radius - 1e-6);
  expect(state.position.z).toBeLessThanOrEqual(BOUNDS.maxZ - CONFIG.radius + 1e-6);
  for (const obstacle of obstacles) expect(distance(state.position, obstacle)).toBeGreaterThanOrEqual(obstacle.radius + CONFIG.radius - 1e-6);
}

describe("character locomotion", () => {
  it("mutates only its state and converges to an idle arrival without jitter", () => {
    const start = { x: -1.8, z: 0.8 };
    const goal = Object.freeze({ x: 1.8, z: -0.8 });
    const state = createCharacterState(start);
    expect(stepCharacter(state, goal, 1 / 60)).toBe(state);
    simulate(state, goal, 8);
    expect(distance(state.position, goal)).toBeLessThanOrEqual(CONFIG.arrivalRadius + 0.002);
    expect(state.motion).toBe("idle");
    expect(state.speed).toBe(0);
    const arrived = { ...state.position };
    simulate(state, goal, 3);
    expect(state.position).toEqual(arrived);
    expect(start).toEqual({ x: -1.8, z: 0.8 });
  });

  it("accelerates through walk and run with bounded speed, then decelerates", () => {
    const state = createCharacterState({ x: -2.4, z: 0 });
    const motions = new Set<string>();
    for (let index = 0; index < 120; index += 1) {
      const previousSpeed = state.speed;
      stepCharacter(state, { x: 2.4, z: 0 }, 1 / 120);
      motions.add(state.motion);
      expect(state.speed).toBeLessThanOrEqual(CONFIG.runSpeed + 1e-9);
      expect(state.speed - previousSpeed).toBeLessThanOrEqual(CONFIG.acceleration / 120 + 1e-9);
    }
    expect(motions.has("walk")).toBe(true);
    expect(motions.has("run")).toBe(true);
    const previousSpeed = state.speed;
    stepCharacter(state, null, 1 / 60);
    expect(state.speed).toBeLessThan(previousSpeed);
    expect(state.speed).toBeGreaterThan(0);
    simulate(state, null, 1);
    expect(state.speed).toBe(0);
    expect(state.motion).toBe("idle");
  });

  it("takes the shortest turn across the -pi/+pi boundary", () => {
    const heading = Math.PI - 0.03;
    const state = createCharacterState({ x: 0, z: 0 }, heading);
    stepCharacter(state, { x: -0.04, z: -1.4 }, 1 / 120);
    const change = Math.atan2(Math.sin(state.heading - heading), Math.cos(state.heading - heading));
    expect(change).toBeGreaterThan(0);
    expect(change).toBeLessThanOrEqual(CONFIG.turnSpeed / 120 + 1e-9);
  });

  it("produces matching paths at 30, 60, and 120 fps", () => {
    const states = [30, 60, 120].map((fps) => simulate(createCharacterState({ x: -2.2, z: 0.7 }), { x: 2.2, z: -0.9 }, 1.4, fps));
    for (const state of states.slice(1)) {
      expect(distance(state.position, states[0].position)).toBeLessThan(1e-8);
      expect(distance(state.velocity, states[0].velocity)).toBeLessThan(1e-8);
      expect(state.heading).toBeCloseTo(states[0].heading, 8);
    }
  });

  it("caps resume spikes, ignores invalid deltas and malformed pointer coordinates", () => {
    const state = simulate(createCharacterState({ x: -2, z: 0 }), { x: 2.3, z: 0 }, 0.5);
    const previous = { ...state.position };
    stepCharacter(state, { x: 2.3, z: 0 }, 1000);
    expect(distance(state.position, previous)).toBeLessThanOrEqual(CONFIG.runSpeed * CONFIG.maxDelta + 1e-6);
    const before = { ...state.position };
    for (const delta of [NaN, Infinity, -1, 0]) stepCharacter(state, { x: 2.3, z: 0 }, delta);
    expect(state.position).toEqual(before);
    stepCharacter(state, { x: NaN, z: Infinity }, 1 / 60);
    expect(Object.values(state.position).every(Number.isFinite)).toBe(true);
    expect(Object.values(state.velocity).every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(state.heading)).toBe(true);
  });

  it("keeps the whole character in bounds and settles at unreachable pointer positions", () => {
    const state = simulate(createCharacterState(), { x: 100, z: -100 }, 10);
    expectClear(state, []);
    expect(state.motion).toBe("idle");
    expect(distance(state.position, { x: BOUNDS.maxX - CONFIG.radius, z: BOUNDS.minZ + CONFIG.radius })).toBeLessThan(CONFIG.arrivalRadius + 0.002);
  });
});

describe("character circle collisions", () => {
  it("bumps a real head-on contact, slides around it, and reaches the far-side goal", () => {
    const obstacles = [{ x: 0, z: 0, radius: 0.34 }];
    const target = { x: 2.1, z: 0 };
    const state = createCharacterState({ x: -2.1, z: 0 });
    let showedBump = false;
    for (let index = 0; index < 60 * 12; index += 1) {
      stepCharacter(state, target, 1 / 60, obstacles);
      expectClear(state, obstacles);
      showedBump ||= state.motion === "bump";
    }
    expect(showedBump).toBe(true);
    expect(state.bumpCount).toBeGreaterThan(0);
    expect(state.bumpCount).toBeLessThan(4);
    expect(distance(state.position, target)).toBeLessThan(CONFIG.arrivalRadius + 0.002);
    expect(state.motion).toBe("idle");
  });

  it("chooses the open side when a large prop is close to the narrower stage edge", () => {
    const bounds = { minX: -2.3, maxX: 2.3, minZ: -1.25, maxZ: 1.1 };
    for (const z of [-0.55, 0.45]) {
      const obstacles = [{ x: 0, z, radius: 0.4 }];
      const target = { x: 1.7, z };
      const state = createCharacterState({ x: -1.7, z });
      for (let index = 0; index < 60 * 12; index += 1) {
        stepCharacter(state, target, 1 / 60, obstacles, bounds);
        expect(distance(state.position, obstacles[0])).toBeGreaterThanOrEqual(obstacles[0].radius + CONFIG.radius - 1e-6);
        expect(state.position.z).toBeGreaterThanOrEqual(bounds.minZ + CONFIG.radius - 1e-6);
        expect(state.position.z).toBeLessThanOrEqual(bounds.maxZ - CONFIG.radius + 1e-6);
      }
      expect(distance(state.position, target)).toBeLessThan(CONFIG.arrivalRadius + 0.002);
      expect(state.bumpCount).toBe(1);
      expect(state.motion).toBe("idle");
    }
  });

  it("routes through the combined hero layout without choosing closed wall-side arcs", () => {
    const bounds = { minX: -2.3, maxX: 2.3, minZ: -1.25, maxZ: 1.1 };
    const obstacles = [
      { id: "coral", x: -1.35, z: 0.15, radius: 0.34 },
      { id: "violet", x: 1.2, z: -0.45, radius: 0.38 },
      { id: "sage", x: 0.65, z: 0.95, radius: 0.25 },
    ];
    const routes = [
      [{ x: -2, z: -1 }, { x: 2, z: -1 }],
      [{ x: 2, z: -1 }, { x: -2, z: -1 }],
      [{ x: 1.6, z: -1 }, { x: -2, z: 0.5 }],
      [{ x: -0.4, z: -0.4 }, { x: 1.2, z: 0.8 }],
      [{ x: 1.2, z: 0.8 }, { x: -0.4, z: -0.4 }],
    ];
    for (const [start, target] of routes) {
      const state = createCharacterState(start);
      for (let index = 0; index < 60 * 20; index += 1) {
        stepCharacter(state, target, 1 / 60, obstacles, bounds);
        expectClear(state, obstacles);
      }
      expect(distance(state.position, target)).toBeLessThan(CONFIG.arrivalRadius + 0.002);
      expect(state.bumpCount).toBeLessThan(4);
      expect(state.motion).toBe("idle");
    }
  });

  it("routes round the open end of furniture built from overlapping circles against a wall", () => {
    // The about room's couch: two overlapping circles, the left one nearly touching the wall.
    const bounds = { minX: -4.5, maxX: 4.5, minZ: -2.6, maxZ: 2.6 };
    const obstacles = [{ id: "couch-left", x: -3.75, z: 1.2, radius: 0.55 }, { id: "couch-right", x: -2.85, z: 1.2, radius: 0.55 }];
    const target = { x: -2.9, z: -2.15 };
    const state = createCharacterState({ x: -3, z: 2.2 });
    for (let index = 0; index < 60 * 20; index += 1) {
      stepCharacter(state, target, 1 / 60, obstacles, bounds);
      for (const obstacle of obstacles) expect(distance(state.position, obstacle)).toBeGreaterThanOrEqual(obstacle.radius + CONFIG.radius - 1e-6);
    }
    expect(distance(state.position, target)).toBeLessThan(CONFIG.arrivalRadius + 0.002);
  });

  it("does not retrigger bump events every frame during sustained contact", () => {
    const obstacles = [{ x: 0, z: 0, radius: 0.34 }];
    const state = createCharacterState({ x: -0.58, z: 0 });
    state.velocity.x = CONFIG.runSpeed;
    stepCharacter(state, { x: 2, z: 0 }, 1 / 60, obstacles);
    expect(state.bumpCount).toBe(1);
    expect(state.bumpRemaining).toBeGreaterThan(0);
    simulate(state, { x: 2, z: 0 }, CONFIG.bumpCooldown - 0.05, 120, obstacles);
    expect(state.bumpCount).toBe(1);
  });

  it.each([{ x: 0, z: 0 }, { x: 0.2, z: 0.08 }])("settles safely when a target lies inside a prop: %j", (target) => {
    const obstacles = [{ x: 0, z: 0, radius: 0.36 }];
    const state = createCharacterState({ x: -1.8, z: 0.2 });
    for (let index = 0; index < 60 * 10; index += 1) {
      stepCharacter(state, target, 1 / 60, obstacles);
      expectClear(state, obstacles);
    }
    expect(state.motion).toBe("idle");
    expect(state.speed).toBe(0);
  });

  it("recovers finite, non-penetrating positions from exact-centre and overlapping spawns", () => {
    const scenes = [
      [{ x: 0, z: 0, radius: 0.4 }],
      [{ x: 0, z: 0, radius: 0.3 }, { x: 0, z: 0, radius: 0.5 }],
      [{ x: -0.2, z: 0, radius: 0.4 }, { x: 0.2, z: 0, radius: 0.4 }],
    ];
    for (const obstacles of scenes) {
      const state = createCharacterState({ x: 0, z: 0 });
      for (let index = 0; index < 360; index += 1) {
        stepCharacter(state, { x: 1.8, z: -0.9 }, 1 / 60, obstacles);
        expectClear(state, obstacles);
        expect(Number.isFinite(state.heading)).toBe(true);
      }
    }
  });

  it("cannot tunnel through a prop during a large frame spike", () => {
    const obstacles = [{ x: 0, z: 0, radius: 0.06 }];
    const state = createCharacterState({ x: -0.4, z: 0 });
    state.velocity.x = CONFIG.runSpeed;
    stepCharacter(state, { x: 2, z: 0 }, 5, obstacles);
    expectClear(state, obstacles);
    expect(state.position.x).toBeLessThan(0);
    expect(state.bumpCount).toBe(1);
  });

  it("is frame-independent during a collision and avoids repeatedly headbutting a prop", () => {
    const obstacles = [{ x: 0, z: 0, radius: 0.34 }];
    const states = [30, 60, 120].map((fps) => simulate(createCharacterState({ x: -2, z: 0 }), { x: 2, z: 0 }, 3, fps, obstacles));
    for (const state of states.slice(1)) {
      expect(distance(state.position, states[0].position)).toBeLessThan(1e-8);
      expect(state.bumpCount).toBe(states[0].bumpCount);
    }
  });
});

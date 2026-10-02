/** Pure, mutable XZ-plane locomotion. Heading 0 faces +Z; all units are seconds/metres. */
export type Vec2 = { x: number; z: number };
export type CircleObstacle = Vec2 & { radius: number; id?: string };
export type WorldBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type CharacterMotion = "idle" | "walk" | "run" | "bump";

export const DEFAULT_WORLD_BOUNDS: Readonly<WorldBounds> = {
  minX: -2.8, maxX: 2.8, minZ: -1.8, maxZ: 1.4,
};

export const CHARACTER_CONFIG = {
  radius: 0.22,
  walkSpeed: 0.85,
  runSpeed: 2.15,
  runDistance: 1.1,
  acceleration: 7.5,
  deceleration: 9,
  turnSpeed: 9,
  arrivalRadius: 0.055,
  bumpDuration: 0.28,
  bumpCooldown: 0.65,
  maxDelta: 0.1,
  maxSubstep: 1 / 120,
} as const;

export type CharacterState = {
  position: Vec2;
  velocity: Vec2;
  heading: number;
  speed: number;
  motion: CharacterMotion;
  bumpRemaining: number;
  bumpCooldown: number;
  bumpCount: number;
  distanceTravelled: number;
  /** Navigation memory; callers should leave it alone. Cleared when the route is open. */
  avoidance: { obstacle: CircleObstacle; side: 1 | -1 } | null;
};

const EPSILON = 1e-6;
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const length = (value: Vec2) => Math.hypot(value.x, value.z);
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (x: number, z: number): Vec2 => {
  const size = Math.hypot(x, z);
  return size > EPSILON ? { x: x / size, z: z / size } : { x: 0, z: 1 };
};
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function createCharacterState(position: Vec2 = { x: 0, z: 0.65 }, heading = 0): CharacterState {
  return {
    position: { x: finite(position.x), z: finite(position.z) },
    velocity: { x: 0, z: 0 },
    heading: wrapAngle(finite(heading)),
    speed: 0,
    motion: "idle",
    bumpRemaining: 0,
    bumpCooldown: 0,
    bumpCount: 0,
    distanceTravelled: 0,
    avoidance: null,
  };
}

function confine(point: Vec2, bounds: WorldBounds): void {
  const r = CHARACTER_CONFIG.radius;
  point.x = clamp(point.x, bounds.minX + r, bounds.maxX - r);
  point.z = clamp(point.z, bounds.minZ + r, bounds.maxZ - r);
}

function isOutside(point: Vec2, obstacles: readonly CircleObstacle[]): boolean {
  return obstacles.every((obstacle) => distance(point, obstacle) >= obstacle.radius + CHARACTER_CONFIG.radius - EPSILON);
}

/** Resolve overlaps, including a spawn exactly at a circle's centre. */
function depenetrate(point: Vec2, obstacles: readonly CircleObstacle[], bounds: WorldBounds): void {
  confine(point, bounds);
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    for (const obstacle of obstacles) {
      const radius = obstacle.radius + CHARACTER_CONFIG.radius;
      const d = distance(point, obstacle);
      if (d < radius - EPSILON) {
        const normal = unit(point.x - obstacle.x, point.z - obstacle.z);
        point.x = obstacle.x + normal.x * (radius + EPSILON);
        point.z = obstacle.z + normal.z * (radius + EPSILON);
        confine(point, bounds);
        moved = true;
      }
    }
    if (!moved || isOutside(point, obstacles)) return;
  }
  // Intersecting circles or a wall can trap iterative projection. Pick the nearest
  // valid boundary sample instead. Scenes must leave at least one walkable area.
  let nearest: Vec2 | null = null;
  let nearestDistance = Infinity;
  for (const obstacle of obstacles) {
    const radius = obstacle.radius + CHARACTER_CONFIG.radius + EPSILON * 2;
    for (let index = 0; index < 64; index += 1) {
      const angle = index * Math.PI / 32;
      const candidate = { x: obstacle.x + Math.sin(angle) * radius, z: obstacle.z + Math.cos(angle) * radius };
      const before = { ...candidate };
      confine(candidate, bounds);
      if (distance(before, candidate) > EPSILON || !isOutside(candidate, obstacles)) continue;
      const d = distance(point, candidate);
      if (d < nearestDistance) { nearest = candidate; nearestDistance = d; }
    }
  }
  if (nearest) { point.x = nearest.x; point.z = nearest.z; }
}

function blocksSegment(from: Vec2, to: Vec2, obstacle: CircleObstacle, clearance = 0.03): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const squared = dx * dx + dz * dz;
  if (squared < EPSILON) return false;
  const t = clamp(((obstacle.x - from.x) * dx + (obstacle.z - from.z) * dz) / squared, 0, 1);
  return Math.hypot(from.x + t * dx - obstacle.x, from.z + t * dz - obstacle.z)
    < obstacle.radius + CHARACTER_CONFIG.radius + clearance;
}

function chooseSide(position: Vec2, goal: Vec2, obstacle: CircleObstacle, bounds: WorldBounds): 1 | -1 {
  const normal = unit(position.x - obstacle.x, position.z - obstacle.z);
  const startAngle = Math.atan2(normal.z, normal.x);
  const radius = obstacle.radius + CHARACTER_CONFIG.radius + 0.085;
  const candidates = ([1, -1] as const).map((side) => {
    let cost = 0;
    // Score the whole arc until line-of-sight opens, not just its first tangent.
    // A prop can overlap the inset stage boundary and close one route entirely.
    for (let index = 1; index <= 72; index += 1) {
      const arc = index * Math.PI / 36;
      const angle = startAngle + side * arc;
      const waypoint = { x: obstacle.x + Math.cos(angle) * radius, z: obstacle.z + Math.sin(angle) * radius };
      const bounded = { ...waypoint };
      confine(bounded, bounds);
      cost += distance(waypoint, bounded) * 100;
      if (!blocksSegment(waypoint, goal, obstacle)) {
        cost += arc * radius + distance(waypoint, goal);
        break;
      }
    }
    return { side, cost };
  });
  return candidates[0].cost <= candidates[1].cost ? 1 : -1;
}

function moveVelocity(velocity: Vec2, desired: Vec2, maximumChange: number): void {
  const dx = desired.x - velocity.x;
  const dz = desired.z - velocity.z;
  const change = Math.hypot(dx, dz);
  const scale = change > maximumChange ? maximumChange / change : 1;
  velocity.x += dx * scale;
  velocity.z += dz * scale;
}

function substep(state: CharacterState, target: Vec2 | null, dt: number, obstacles: readonly CircleObstacle[], bounds: WorldBounds): void {
  const config = CHARACTER_CONFIG;
  state.bumpRemaining = Math.max(0, state.bumpRemaining - dt);
  state.bumpCooldown = Math.max(0, state.bumpCooldown - dt);
  let goal: Vec2 | null = target ? { ...target } : null;
  if (goal) {
    confine(goal, bounds);
    // A pointer can land inside a solid prop. Seek its reachable near surface.
    for (const obstacle of obstacles) {
      if (distance(goal, obstacle) < obstacle.radius + config.radius) {
        const normal = unit(state.position.x - obstacle.x, state.position.z - obstacle.z);
        goal = { x: obstacle.x + normal.x * (obstacle.radius + config.radius + EPSILON), z: obstacle.z + normal.z * (obstacle.radius + config.radius + EPSILON) };
      }
    }
    depenetrate(goal, obstacles, bounds);
  }

  let direction = goal ? unit(goal.x - state.position.x, goal.z - state.position.z) : { x: 0, z: 0 };
  const remaining = goal ? distance(state.position, goal) : 0;
  let routeDistance = remaining;
  if (state.avoidance && (!goal || !obstacles.includes(state.avoidance.obstacle)
    || !blocksSegment(state.position, goal, state.avoidance.obstacle))) state.avoidance = null;
  if (state.avoidance && goal && remaining > config.arrivalRadius) {
    const { obstacle, side } = state.avoidance;
    const normal = unit(state.position.x - obstacle.x, state.position.z - obstacle.z);
    const gap = obstacle.radius + config.radius + 0.085 - distance(state.position, obstacle);
    // Persistent tangent direction breaks the head-on symmetry and slides round
    // the prop; a small outward correction keeps the route clear of its skin.
    direction = unit(-normal.z * side + normal.x * gap * 7, normal.x * side + normal.z * gap * 7);
    routeDistance = Math.max(remaining, 0.5);
  }

  const moving = !!goal && remaining > config.arrivalRadius;
  const cruisingSpeed = routeDistance > config.runDistance ? config.runSpeed : config.walkSpeed;
  const brakingSpeed = Math.sqrt(2 * config.deceleration * Math.max(0, routeDistance - config.arrivalRadius));
  const targetSpeed = moving ? Math.min(cruisingSpeed, brakingSpeed, routeDistance * 3.6) * (state.bumpRemaining > 0 ? 0.42 : 1) : 0;
  const desired = { x: direction.x * targetSpeed, z: direction.z * targetSpeed };
  const acceleration = targetSpeed < length(state.velocity) ? config.deceleration : config.acceleration;
  moveVelocity(state.velocity, desired, acceleration * dt);
  if (!moving && length(state.velocity) < 0.015) { state.velocity.x = 0; state.velocity.z = 0; }

  const previous = { ...state.position };
  state.position.x += state.velocity.x * dt;
  state.position.z += state.velocity.z * dt;
  for (const obstacle of obstacles) {
    const radius = obstacle.radius + config.radius;
    if (distance(state.position, obstacle) >= radius) continue;
    const normal = unit(state.position.x - obstacle.x, state.position.z - obstacle.z);
    const impact = -(state.velocity.x * normal.x + state.velocity.z * normal.z);
    state.position.x = obstacle.x + normal.x * (radius + EPSILON);
    state.position.z = obstacle.z + normal.z * (radius + EPSILON);
    if (impact > 0) {
      state.velocity.x += normal.x * impact;
      state.velocity.z += normal.z * impact;
    }
    if (impact > 0.18 && state.bumpCooldown <= 0) {
      state.bumpCount += 1;
      state.bumpRemaining = config.bumpDuration;
      state.bumpCooldown = config.bumpCooldown;
      state.velocity.x += normal.x * 0.12;
      state.velocity.z += normal.z * 0.12;
    }
    if (goal && !state.avoidance && distance(goal, obstacle) > radius + 0.02) {
      state.avoidance = { obstacle, side: chooseSide(state.position, goal, obstacle, bounds) };
    }
  }
  const unconstrained = { ...state.position };
  depenetrate(state.position, obstacles, bounds);
  if (Math.abs(unconstrained.x - state.position.x) > EPSILON && (state.position.x <= bounds.minX + config.radius + EPSILON || state.position.x >= bounds.maxX - config.radius - EPSILON)) state.velocity.x = 0;
  if (Math.abs(unconstrained.z - state.position.z) > EPSILON && (state.position.z <= bounds.minZ + config.radius + EPSILON || state.position.z >= bounds.maxZ - config.radius - EPSILON)) state.velocity.z = 0;
  state.speed = length(state.velocity);
  if (state.speed > config.runSpeed) {
    state.velocity.x *= config.runSpeed / state.speed;
    state.velocity.z *= config.runSpeed / state.speed;
    state.speed = config.runSpeed;
  }
  if (state.speed > 0.025) {
    const desiredHeading = Math.atan2(state.velocity.x, state.velocity.z);
    state.heading = wrapAngle(state.heading + clamp(wrapAngle(desiredHeading - state.heading), -config.turnSpeed * dt, config.turnSpeed * dt));
  }
  state.distanceTravelled += distance(previous, state.position);
  state.motion = state.bumpRemaining > 0 ? "bump" : state.speed < 0.04 ? "idle" : state.speed > config.walkSpeed + 0.15 ? "run" : "walk";
}

/**
 * Mutates and returns `state`; target=null smoothly brakes. Neither target,
 * obstacles nor bounds are mutated. Pass render-loop delta in SECONDS.
 * At most 100ms is simulated per frame (tab-resume spikes are discarded), in
 * <=1/120s slices. Keep circle objects stable to retain avoidance memory.
 * Obstacles should leave a connected, walkable region inside the bounds.
 */
export function stepCharacter(
  state: CharacterState,
  target: Vec2 | null,
  dt: number,
  obstacles: readonly CircleObstacle[] = [],
  bounds: WorldBounds = DEFAULT_WORLD_BOUNDS,
): CharacterState {
  state.position.x = finite(state.position.x);
  state.position.z = finite(state.position.z);
  state.velocity.x = finite(state.velocity.x);
  state.velocity.z = finite(state.velocity.z);
  state.heading = wrapAngle(finite(state.heading));
  const validObstacles = obstacles.filter((obstacle) => Number.isFinite(obstacle.x) && Number.isFinite(obstacle.z) && Number.isFinite(obstacle.radius) && obstacle.radius > 0);
  depenetrate(state.position, validObstacles, bounds);
  const validTarget = target && Number.isFinite(target.x) && Number.isFinite(target.z) ? target : null;
  const delta = clamp(finite(dt), 0, CHARACTER_CONFIG.maxDelta);
  if (delta === 0) return state;
  const steps = Math.ceil(delta / CHARACTER_CONFIG.maxSubstep);
  for (let index = 0; index < steps; index += 1) substep(state, validTarget, delta / steps, validObstacles, bounds);
  return state;
}

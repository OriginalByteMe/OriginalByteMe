import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STATION_LINES, type CharacterLine } from '@/lib/character/narrative';
import { skillStationId } from '@/lib/character/world-content';
import { SAME_ORIGIN, type AreaBuilder, type Obstacle, type Station, type WorldArea } from './types';

type V3 = [number, number, number];
/**
 * Poses a project machine's moving parts. `run` is the machine's own clock and only ticks while it runs, `energy` eases
 * from 0 to 1 as he starts and back as he leaves, `progress` is his presentation's. Energy 0 is the rest pose.
 */
type Animate = (run: number, energy: number, progress: number) => void;
type Kit = {
  /** The machine's own frame, scaled up as a whole: floor under its middle. Static parts go in `parts` and become one mesh. */
  root: THREE.Group;
  parts: THREE.BufferGeometry[];
  /** A rigid moving part: the pieces merged into one mesh under `parent` (the root by default) at `at`. */
  solid: (pieces: THREE.BufferGeometry[], at?: V3, parent?: THREE.Object3D, material?: THREE.Material) => THREE.Mesh;
  /** One shape repeated, a tint per copy; the shape's own colours multiply the tint. */
  copies: (pieces: THREE.BufferGeometry[], tints: number[]) => THREE.InstancedMesh;
  glow: THREE.Material;
  laser: THREE.Material;
};
/** A project's machine and the lines he adds about it, each a fact from the project's corpus file. */
type Machine = { build: (kit: Kit) => Animate; lines: string[] };
/** One frame of a skill group's machine: `energy` is 0 at rest and eases to 1 while he is at its station. */
type Tick = (time: number, energy: number) => void;
/** Moving copies of one shape, one colour each; `bright` ones ignore the lights, for things that glow. */
type Instanced = (geometry: THREE.BufferGeometry, colors: number[], bright?: boolean) => THREE.InstancedMesh;
/** Builds a skill group's machine on the bench (origin on the bench top, +z toward the camera): static parts go into `fixed`, merged into one mesh; returns its animation. */
type SkillMachine = (fixed: THREE.BufferGeometry[], instanced: Instanced) => Tick;

// The islands room.
const SHELL = 0xf4ecdf, LILAC = 0xb39bc3, PLUM = 0x72509c, CORAL = 0xeb9a84, SAGE = 0xa6b4a0, PEACH = 0xe8b38b;
// The town machines.
const WALNUT = 0x7a4b2c, TEAL_SOFT = 0x5f9e93, CREAM = 0xfff3dd, TOMATO = 0xe4573d, MUSTARD = 0xf4b63f, SKY = 0x58a8de, MINT = 0x7fe0bd, PINK = 0xf27fa5;
const GRAPE = 0x7a5cc7, LAVENDER = 0xb79cf2, VIOLET = 0x8e6bd6, INK = 0x2b2630, DARK = 0x3a3440, SLATE = 0x2f3747, STEEL = 0xb7c0c7, WHITE = 0xffffff;
const PEG = 0xe8c597, HOLE = 0x9c7a55, CABINET = 0x9b6a3f, BENCH = 0xc99a63;
const ACCENTS = [TOMATO, SKY, MUSTARD, PINK, MINT];
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const TAU = Math.PI * 2;
const SKILLS = 'content/about-me/skills.md';
const COUNTS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const WALL_Z = -3.55; // back wall front face
const WALL_H = 6.1;
/** The skills bench along the back wall; its front is also the walkable floor's back edge. */
const BENCH_TOP = .95, BENCH_FRONT = WALL_Z + .8;
/** Every stand sits on this lane, clear of all machines, consoles and the beanbag, so walks between stations are straight lines without bumps. */
const LANE_Z = WALL_Z + 1.2;
const BOUNDS = { minX: -8.6, maxX: 8.6, minZ: BENCH_FRONT, maxZ: 1.9 };
const EXIT = { x: 3.4, z: 1.6 };
const FLOOR = { width: 17.7, back: WALL_Z - .26, front: BOUNDS.maxZ + .42 };
/**
 * Bays share x in [-8.5, 8.5], left to right: a bay per project, the beanbag nook, a bay per skill group. Ten bays fit at
 * PITCH; more shrink together, their scale following the pitch, while consoles, the bench and the lane keep his height.
 */
const SPAN = 17, PITCH = 1.53, NOOK = 1.7;
/** Project machines are modelled about a metre wide and drawn this much bigger; two circles either side of the middle cover the footprint. */
const MACHINE_SCALE = 1.05, MACHINE_HALF = .13, MACHINE_RADIUS = .42, MACHINE_Z = WALL_Z + .45;
/** From a machine's middle: its console at the front right, its button his reach; he stands in front right of that. */
const CONSOLE = { x: .76, z: LANE_Z - .4 - MACHINE_Z };
/** Floating pictures: the town card at this size, offset left of its machine, and a little per-card variety. */
const CARD = .74, CARD_X = -.1, CARD_Y = 3.25, PICTURE_Z = WALL_Z + .3, LIFT = [.1, -.02, 0, -.03, .08], DEPTH = [.06, -.06, .03, -.03, .07], TILT = [.04, -.03, .02, -.04, .03];
/** The picture window on a 512 by 440 card canvas; the title goes underneath. */
const PHOTO = { x: 26, y: 26, width: 460, height: 304 };
/** Pegboards: icons only in the band above his afro as he stands at the bench, the group's sign over the board. */
const PEG_Y = 3.25, PEG_H = 2.5, ICON_Y = 3.72, ICON_H = 1.42, TILE_Z = WALL_Z + .13, SIGN_Y = 4.82;
const TAP = 2 * Math.PI / 9; // his tinker poke period (activity-props.ts): each poke pops the next icon
const TITLE_Y = 5.55; // the TECH LAB sign over the nook, clear of the first skill group's sign
const BEANBAG_Z = WALL_Z + .5;
const SCREEN_OFF = new THREE.Color(0x24324a), SCREEN_ON = new THREE.Color(0x9ff0ff), LIT = new THREE.Color(WHITE);
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3(), color: new THREE.Color(), glow: new THREE.Color() };
const { lerp, smoothstep, clamp } = THREE.MathUtils;

/** A box, with rounded edges unless radius is 0. */
const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => radius > 0
  ? new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 2, height / 2, depth / 2))
  : new THREE.BoxGeometry(width, height, depth);
const cylinder = (top: number, bottom: number, height: number, segments = 14) => new THREE.CylinderGeometry(top, bottom, height, segments);
const ball = (radius: number) => new THREE.SphereGeometry(radius, 10, 6);
const mix = (from: V3, to: V3, amount: number): V3 => [lerp(from[0], to[0], amount), lerp(from[1], to[1], amount), lerp(from[2], to[2], amount)];

/** Bakes transform and a flat vertex colour so static and rigid parts merge into one draw call with the shared toy material. Non-indexed because RoundedBoxGeometry is. */
function piece(source: THREE.BufferGeometry, color: THREE.ColorRepresentation, at: V3 = [0, 0, 0], turn: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  const { matrix, position, rotation, euler } = scratch;
  geometry.applyMatrix4(matrix.compose(position.set(...at), rotation.setFromEuler(euler.set(...turn)), scratch.scale.set(...scale)));
  const tint = new THREE.Color(color), count = geometry.attributes.position.count, colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) tint.toArray(colors, index * 3);
  return geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** One geometry from parts, the parts disposed. */
function fuse(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
}

/** Sets one copy of an instanced part; `size` is uniform or per axis. */
function place(mesh: THREE.InstancedMesh, index: number, at: V3, turn: V3, size: number | V3) {
  const { matrix, position, rotation, euler, scale } = scratch;
  mesh.setMatrixAt(index, matrix.compose(position.set(...at), rotation.setFromEuler(euler.set(...turn)), typeof size === 'number' ? scale.setScalar(size) : scale.set(...size)));
  mesh.instanceMatrix.needsUpdate = true;
  // Raycasts, culling and Box3 recompute these from the new matrices.
  mesh.boundingBox = mesh.boundingSphere = null;
}

/** A toothed gear facing +z, centred on the origin. */
function gear(radius: number, teeth: number, tint: number) {
  return [
    piece(cylinder(radius, radius, .05, 18), tint, [0, 0, 0], [Math.PI / 2, 0, 0]),
    piece(cylinder(radius * .35, radius * .35, .07, 10), DARK, [0, 0, 0], [Math.PI / 2, 0, 0]),
    ...Array.from({ length: teeth }, (_, tooth) => {
      const angle = tooth / teeth * TAU;
      return piece(rounded(.05, .05, .045, 0), tint, [Math.cos(angle) * radius, Math.sin(angle) * radius, 0], [0, 0, angle]);
    }),
  ];
}

/** Shrinks, wrapping on spaces, until every line fits the box; lines are centred on (x, y). */
function fitText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, size: number) {
  let lines: string[] = [];
  for (;; size -= 2) {
    context.font = `800 ${size}px ${FONT}`;
    lines = text.split(/\s+/).reduce<string[]>((rows, word) => {
      const joined = rows.length ? `${rows[rows.length - 1]} ${word}` : word;
      if (rows.length && context.measureText(joined).width <= width) rows[rows.length - 1] = joined;
      else rows.push(word);
      return rows;
    }, []);
    if (size <= 12 || (lines.length * size * 1.15 <= height && lines.every((line) => context.measureText(line).width <= width))) break;
  }
  lines.forEach((line, index) => context.fillText(line, x, y + (index - (lines.length - 1) / 2) * size * 1.15, width));
}

function paint(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** AI Image Cutout: a laser traces the person in a photo, then the sticker hops off it, flips and lands again. */
const cutout: Machine['build'] = ({ root, parts, solid, laser }) => {
  parts.push(
    piece(rounded(1, .62, .7, .06), TOMATO, [0, .31, 0]),
    piece(rounded(1.04, .05, .74, .02), CREAM, [0, .645, 0]),
    ...[-.23, .23].flatMap((x) => [piece(rounded(.42, .18, .02, .01), 0xf3836b, [x, .44, .355]), piece(ball(.025), CREAM, [x, .44, .37])]),
    piece(rounded(.9, .16, .02, .01), 0xf3836b, [0, .2, .355]),
    ...[-.3, .3].map((x) => piece(cylinder(.025, .025, .42, 8), STEEL, [x, .84, -.14])),
    piece(rounded(.26, .04, .16, .015), CREAM, [.33, .69, .22]),
    ...[PINK, SKY, MINT].map((tint, index) => piece(cylinder(.04, .04, .012, 10), tint, [.26 + index * .07, .717, .22])),
  );
  // The photo on a tilted board, its gantry riding two rails.
  const board = new THREE.Group();
  board.position.set(0, 1.08, -.12); board.rotation.x = -.32; board.updateMatrix();
  root.add(board);
  parts.push(...[
    piece(rounded(.94, .72, .05, .02), WALNUT),
    piece(rounded(.86, .4, .01, 0), 0x9fd3f2, [0, .13, .03]),
    piece(rounded(.86, .24, .01, 0), 0x8fcf7a, [0, -.19, .03]),
    piece(cylinder(.07, .07, .01, 14), MUSTARD, [-.3, .22, .037], [Math.PI / 2, 0, 0]),
    piece(ball(.12), 0x6fb35e, [.3, -.07, .03], [0, 0, 0], [1.5, .6, .15]),
    ...[-1, 1].map((side) => piece(rounded(.03, .7, .24, .01), STEEL, [side * .46, 0, .14])),
  ].map((geometry) => geometry.applyMatrix4(board.matrix)));
  const sticker = solid([
    piece(cylinder(.125, .125, .008, 18), WHITE, [0, .09, 0], [Math.PI / 2, 0, 0]),
    piece(rounded(.27, .2, .008, .004), WHITE, [0, -.08, 0]),
    piece(cylinder(.105, .105, .008, 18), 0x3b2618, [0, .1, .004], [Math.PI / 2, 0, 0]),
    piece(cylinder(.06, .06, .008, 14), 0xe9b48a, [0, .07, .008], [Math.PI / 2, 0, 0]),
    piece(rounded(.2, .15, .008, .004), TOMATO, [0, -.08, .004]),
  ], [.08, -.03, .04], board);
  const bar = solid([piece(rounded(.96, .04, .04, .01), STEEL)], [0, .3, .26], board);
  const head = solid([piece(rounded(.1, .08, .08, .02), DARK), piece(cylinder(.02, .02, .05, 8), TOMATO, [0, 0, -.06], [Math.PI / 2, 0, 0])], [.32, 0, 0], bar);
  const beam = solid([piece(cylinder(.018, .018, .13, 6), WHITE, [0, 0, -.15], [Math.PI / 2, 0, 0]), piece(new THREE.OctahedronGeometry(.05), WHITE, [0, 0, -.21])], [0, 0, 0], head, laser);
  return (run, energy) => {
    const cycle = (run * .35) % 1, angle = Math.min(1, cycle / .7) * TAU, hop = cycle < .7 ? 0 : Math.sin(Math.PI * (cycle - .7) / .3);
    // Parked top right; running, it follows the sticker's outline.
    bar.position.y = lerp(.3, .21 * Math.cos(angle), energy);
    head.position.x = lerp(.32, .08 + .17 * Math.sin(angle), energy);
    beam.visible = energy > .05 && cycle < .7;
    beam.scale.set(1 + .4 * Math.sin(run * 40), 1 + .4 * Math.sin(run * 40), 1);
    sticker.position.z = .04 + energy * hop * .28;
    sticker.rotation.y = energy * hop * Math.PI;
    sticker.scale.setScalar(1 + energy * hop * .3);
  };
};

/** Ask-Me Portfolio: questions drop into the hopper, the gears turn and story pages built from blocks print out the front. */
const press: Machine['build'] = ({ root, parts, solid, copies }) => {
  parts.push(
    ...[-1, 1].flatMap((x) => [-1, 1].map((z) => piece(cylinder(.04, .05, .16, 8), DARK, [x * .36, .08, z * .24]))),
    piece(rounded(.9, .78, .64, .08), SKY, [0, .55, 0]),
    piece(rounded(.8, .52, .03, .03), CREAM, [0, .6, .32]),
    piece(rounded(.46, .26, .02, .02), DARK, [.12, .72, .335]),
    piece(rounded(.54, .05, .04, .02), INK, [0, .33, .33]),
    piece(rounded(.5, .025, .16, .01), STEEL, [0, .28, .4]),
    piece(cylinder(.32, .13, .3, 16), MUSTARD, [0, 1.08, -.02]),
    piece(new THREE.TorusGeometry(.31, .03, 6, 20), TOMATO, [0, 1.23, -.02], [Math.PI / 2, 0, 0]),
    piece(cylinder(.29, .29, .01, 16), INK, [0, 1.225, -.02]),
    piece(cylinder(.05, .05, .42, 10), STEEL, [.33, 1.08, -.2]),
    piece(cylinder(.075, .06, .06, 10), DARK, [.33, 1.31, -.2]),
    ...[-.3, -.1, .1, .3].map((x) => piece(ball(.02), CREAM, [x, .9, .335])),
  );
  const screenMaterial = new THREE.MeshBasicMaterial({ color: SCREEN_OFF, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.4, .2), screenMaterial);
  screen.position.set(.12, .72, .347);
  root.add(screen);
  const gears = [solid(gear(.12, 8, MUSTARD), [-.24, .76, .36]), solid(gear(.07, 6, TOMATO), [-.24, .5, .36])];
  const questions = copies([
    piece(new THREE.TorusGeometry(.06, .022, 6, 14, Math.PI * 1.5), WHITE, [0, .06, 0], [0, 0, -Math.PI / 2]),
    piece(cylinder(.022, .022, .07, 8), WHITE, [0, -.035, 0]),
    piece(ball(.027), WHITE, [0, -.12, 0]),
  ], [MUSTARD, PINK, MINT]);
  const pages = copies([
    piece(rounded(.3, .01, .22, 0), WHITE),
    piece(rounded(.24, .012, .04, 0), MUSTARD, [0, .002, -.07]),
    piece(rounded(.09, .012, .09, 0), SKY, [-.07, .002, .02]),
    ...[-.01, .02, .05].map((z) => piece(rounded(.11, .012, .015, 0), DARK, [.06, .002, z])),
  ], [WHITE, WHITE, WHITE]);
  return (run, energy) => {
    screenMaterial.color.copy(SCREEN_OFF).lerp(SCREEN_ON, energy * (.6 + .4 * Math.sin(run * 7)));
    gears[0].rotation.z = run * 2.2;
    gears[1].rotation.z = -run * 3.8;
    for (let index = 0; index < 3; index++) {
      // Each question arcs in from the left and shrinks into the hopper.
      const fall = (run * .5 + index / 3) % 1;
      place(questions, index, mix([(index - 1) * .2, 1.55, -.02], [-.6 + .6 * fall, 1.2 + .6 * (1 - fall * fall), -.02], energy), [0, energy * fall * TAU, 0], lerp(1, fall < .75 ? 1 : (1 - fall) / .25, energy));
      // Each page slides out onto the tray, then stands up facing out and fans away. At rest one lies on the tray.
      const cycle = (run * .32 + index / 3) % 1, out = Math.min(1, cycle / .35), rise = smoothstep(cycle, .35, 1);
      const rest: V3 = index ? [0, .3, .15] : [0, .305, .4];
      place(pages, index, mix(rest, [(index - 1) * .3 * rise, .305 + .75 * rise, lerp(.15, .4, out) + .05 * rise], energy), [energy * rise * Math.PI / 2, 0, energy * (index - 1) * .2 * rise], lerp(index ? .001 : 1, rise > .85 ? (1 - rise) / .15 : 1, energy));
    }
  };
};

/** LLM Comparison: two robots take turns answering while their score bars climb, and a star pops over the winner. */
const duel: Machine['build'] = ({ root, parts, solid, copies, glow }) => {
  parts.push(
    piece(rounded(1.06, .28, .76, .06), GRAPE, [0, .14, 0]),
    piece(rounded(1.1, .04, .8, .02), CREAM, [0, .3, 0]),
    ...[[-.03, .42, .5], [.01, .53, -1.2], [.03, .64, .5]].map(([x, y, turn]) => piece(rounded(.05, .14, .04, 0), MUSTARD, [x, y, .12], [0, 0, turn])),
    ...[-1, 1].map((side) => piece(rounded(.04, 1.12, .04, 0), DARK, [side * .44, .86, -.3])),
    piece(rounded(.94, .54, .05, .03), WALNUT, [0, 1.17, -.32]),
    piece(rounded(.84, .44, .01, 0), DARK, [0, 1.17, -.29]),
    ...[-1, 1].map((side) => piece(ball(.045), side < 0 ? TOMATO : SKY, [side * .44, 1.47, -.3])),
  );
  const robots = [TOMATO, SKY].map((tint, index) => solid([
    piece(rounded(.24, .05, .18, .02), DARK, [0, .025, 0]),
    piece(rounded(.26, .26, .2, .05), tint, [0, .18, 0]),
    piece(ball(.03), MUSTARD, [0, .2, .1]),
    ...[-1, 1].map((arm) => piece(cylinder(.03, .03, .2, 8), tint, [arm * .16, .2, 0], [0, 0, arm * .35])),
    piece(rounded(.3, .22, .22, .06), tint, [0, .43, 0]),
    piece(rounded(.24, .1, .02, .01), INK, [0, .44, .11]),
    ...[-1, 1].map((eye) => piece(ball(.025), MINT, [eye * .06, .44, .12])),
    piece(cylinder(.01, .01, .1, 6), DARK, [0, .59, 0]),
    piece(ball(.035), MUSTARD, [0, .66, 0]),
  ], [(index ? 1 : -1) * .27, .32, .05]));
  const bars = copies([piece(rounded(.16, 1, .02, 0), WHITE, [0, .5, 0])], [TOMATO, SKY]);
  const bubbles = copies([
    piece(ball(.12), WHITE, [0, 0, 0], [0, 0, 0], [1.3, .9, .5]),
    piece(cylinder(0, .05, .1, 8), WHITE, [0, -.11, 0], [0, 0, Math.PI]),
    ...[-1, 0, 1].map((dot) => piece(ball(.02), DARK, [dot * .06, 0, .06])),
  ], [WHITE, WHITE]);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(.08), glow);
  root.add(star);
  return (run, energy, progress) => {
    const beat = run * 1.3, talker = Math.floor(beat) % 2, talk = Math.sin(Math.PI * (beat % 1));
    const heights = [.62, 1].map((share, index) => .03 + energy * Math.min(.38, .08 + .32 * share * Math.min(1, progress * 1.3) + .02 * Math.sin(run * 6 + index)));
    robots.forEach((robot, index) => {
      const side = index ? 1 : -1, speaking = index === talker ? talk : 0;
      robot.position.y = .32 + energy * .06 * speaking * Math.abs(Math.sin(run * 14));
      robot.rotation.set(0, -side * energy * .35, -side * energy * .12 * speaking);
      place(bubbles, index, [side * .47, 1.06, .12], [0, 0, 0], .001 + energy * speaking);
      place(bars, index, [side * .18, .97, -.283], [0, 0, 0], [1, heights[index], 1]);
    });
    const win = energy * smoothstep(progress, .55, .75);
    star.visible = win > .01;
    star.position.set(.18, .97 + heights[1] + .1, -.27);
    star.rotation.y = run * 3;
    star.scale.setScalar(.001 + win);
  };
};

/** Moodify: the record spins, the album cover twirls on its post and splashes its colours across the floor. */
const turntable: Machine['build'] = ({ parts, solid, copies }) => {
  parts.push(
    piece(rounded(1, .56, .72, .06), WALNUT, [0, .28, 0]),
    piece(rounded(1.04, .04, .76, .02), 0x9a6a44, [0, .58, 0]),
    ...[-1, 1].flatMap((side) => [
      piece(cylinder(.14, .14, .02, 18), DARK, [side * .26, .3, .36], [Math.PI / 2, 0, 0]),
      piece(new THREE.TorusGeometry(.14, .015, 6, 18), STEEL, [side * .26, .3, .37]),
    ]),
    piece(cylinder(.31, .31, .04, 24), STEEL, [-.12, .62, .06]),
    piece(cylinder(.04, .04, .08, 8), STEEL, [.36, .64, -.2]),
    piece(rounded(.02, .02, .36, .008), STEEL, [.27, .69, -.05], [0, .55, 0]),
    piece(rounded(.06, .03, .07, .01), DARK, [.17, .69, .1], [0, .55, 0]),
    piece(cylinder(.018, .018, .34, 8), DARK, [.3, .77, -.26]),
    ...[MUSTARD, MINT].map((tint, index) => piece(ball(.03), tint, [.4 - index * .09, .61, .3])),
  );
  const record = solid([
    piece(cylinder(.28, .28, .012, 28), INK),
    piece(new THREE.TorusGeometry(.2, .004, 4, 28), DARK, [0, .007, 0], [Math.PI / 2, 0, 0]),
    piece(cylinder(.1, .1, .014, 16), PINK),
    piece(rounded(.06, .016, .02, 0), CREAM, [.05, .008, 0]),
    piece(cylinder(.014, .014, .03, 6), CREAM),
  ], [-.12, .65, .06]);
  const art = (facing: number) => [
    piece(rounded(.5, .5, .01, 0), GRAPE, [0, 0, facing * .006]),
    piece(cylinder(.15, .15, .01, 20), PINK, [-.06, .05, facing * .014], [Math.PI / 2, 0, 0]),
    piece(rounded(.5, .08, .01, 0), MUSTARD, [0, -.16, facing * .014]),
    piece(rounded(.12, .12, .01, 0), MINT, [.14, .15, facing * .018]),
  ];
  const cover = solid([...art(1), ...art(-1)], [.3, 1.19, -.26]);
  const palette = [PINK, MUSTARD, MINT, GRAPE, SKY, TOMATO, 0xffb3d1];
  const splashes = copies([piece(new THREE.CircleGeometry(.26, 20), WHITE, [0, 0, 0], [-Math.PI / 2, 0, 0])], palette);
  const speakers = copies([piece(cylinder(.1, .05, .06, 14), DARK, [0, 0, 0], [Math.PI / 2, 0, 0])], [WHITE, WHITE]);
  return (run, energy) => {
    record.rotation.y = -run * 7;
    cover.rotation.y = run * 2.4;
    cover.position.y = 1.19 + energy * .05 * Math.sin(run * 3);
    palette.forEach((_, index) => {
      // Each splash slides out across the floor in front, growing, then fades as the next one starts.
      const spread = (run * .4 + index * .37) % 1, angle = (.15 + .7 * index / (palette.length - 1)) * Math.PI, distance = lerp(.2, .55 + 1.5 * spread, energy);
      place(splashes, index, [Math.cos(angle) * distance, .015 + index * .002, .2 + Math.sin(angle) * distance], [0, 0, 0], .001 + energy * Math.sin(Math.PI * spread) * (.7 + .9 * spread));
    });
    [-1, 1].forEach((side, index) => place(speakers, index, [side * .26, .3, .39], [0, 0, 0], [1, 1, 1 + energy * .8 * Math.abs(Math.sin(run * 12 + index))]));
  };
};

/** Story Model Benchmark: three model cars race down their lanes while the score bars grow, and the winner gets the star. */
const race: Machine['build'] = ({ root, parts, solid, copies, glow }) => {
  const START = -.36, FINISH = .33, SPEEDS = [1.7, 1.4, 1.15], SCORES = [1, .76, .55], TINTS = [MINT, LAVENDER, MUSTARD];
  parts.push(
    piece(rounded(1.06, .68, .74, .06), GRAPE, [0, .34, 0]),
    ...[.44, .54].map((y) => piece(rounded(.92, .04, .02, 0), MUSTARD, [0, y, .37])),
    piece(cylinder(.1, .1, .02, 16), MUSTARD, [-.3, .24, .375], [Math.PI / 2, 0, 0]),
    piece(rounded(.012, .08, .01, 0), INK, [-.28, .27, .388], [0, 0, -.6]),
    piece(rounded(1.08, .05, .78, .02), 0x45404d, [0, .705, 0]),
    ...[-.12, .12].map((z) => piece(rounded(.94, .006, .014, 0), CREAM, [0, .733, z])),
    piece(rounded(.02, .006, .72, 0), CREAM, [START - .08, .733, 0]),
    ...Array.from({ length: 14 }, (_, index) => piece(rounded(.05, .006, .1, 0), (index % 7 + Math.floor(index / 7)) % 2 ? INK : CREAM, [.42 + Math.floor(index / 7) * .05, .734, -.3 + (index % 7) * .1])),
    piece(cylinder(.012, .012, .62, 6), STEEL, [.47, 1.03, -.34]),
    ...[-1, 1].map((side) => piece(rounded(.04, .66, .04, 0), DARK, [-.08 + side * .38, 1.04, -.36])),
    piece(rounded(.82, .48, .04, .03), WALNUT, [-.08, 1.3, -.37]),
    piece(rounded(.74, .4, .01, 0), DARK, [-.08, 1.3, -.345]),
  );
  const cars = copies([
    piece(rounded(.2, .06, .11, .02), WHITE, [0, .05, 0]),
    piece(rounded(.09, .05, .08, .02), WHITE, [-.02, .095, 0]),
    piece(rounded(.012, .035, .07, 0), DARK, [.03, .095, 0]),
    ...[-1, 1].flatMap((x) => [-1, 1].map((z) => piece(cylinder(.026, .026, .02, 10), INK, [x * .065, .026, z * .06], [Math.PI / 2, 0, 0]))),
  ], TINTS);
  const bars = copies([piece(rounded(.14, 1, .02, 0), WHITE, [0, .5, 0])], TINTS);
  const flag = solid([
    piece(rounded(.18, .11, .006, 0), CREAM, [.09, 0, 0]),
    ...[0, 1, 2, 3].map((square) => piece(rounded(.045, .055, .008, 0), INK, [.0225 + square * .045, square % 2 ? -.0275 : .0275, 0])),
  ], [.47, 1.27, -.34]);
  const trophy = new THREE.Mesh(new THREE.OctahedronGeometry(.07), glow);
  root.add(trophy);
  return (run, energy, progress) => {
    SPEEDS.forEach((speed, index) => {
      const done = Math.min(1, progress * speed);
      place(cars, index, [START + energy * done * (FINISH - START), .73 + (done < 1 ? energy * .012 * Math.abs(Math.sin(run * 22 + index)) : 0), (index - 1) * .24], [0, 0, 0], 1);
      place(bars, index, [-.28 + index * .2, 1.12, -.335], [0, 0, 0], [1, .03 + energy * .3 * SCORES[index] * done, 1]);
    });
    flag.rotation.y = energy * .45 * Math.sin(run * 6);
    const win = energy * smoothstep(progress * SPEEDS[0], 1, 1.15);
    trophy.visible = win > .01;
    trophy.position.set(-.28, 1.25 + .3 * SCORES[0] * energy, -.32);
    trophy.rotation.y = run * 3;
    trophy.scale.setScalar(.001 + win);
  };
};

/** Any other project: a cabinet whose gears turn and whose bulb pulses. */
const gizmo: Machine['build'] = ({ root, parts, solid, glow }) => {
  parts.push(
    piece(rounded(.9, .9, .66, .08), TEAL_SOFT, [0, .45, 0]),
    piece(rounded(.7, .5, .02, .03), CREAM, [0, .5, .33]),
    piece(cylinder(.06, .08, .1, 10), STEEL, [0, .95, 0]),
  );
  const gears = [solid(gear(.15, 9, MUSTARD), [-.12, .5, .36]), solid(gear(.09, 7, TOMATO), [.18, .6, .36])];
  const bulb = new THREE.Mesh(ball(.1), glow);
  bulb.position.set(0, 1.08, 0);
  root.add(bulb);
  return (run, energy) => {
    gears[0].rotation.z = run * 2;
    gears[1].rotation.z = -run * 3.3;
    bulb.scale.setScalar(1 + energy * .25 * Math.sin(run * 9));
  };
};

const MACHINES: Record<string, Machine> = {
  'ai-image-cutout': { build: cutout, lines: ['Segment Anything finds the people and objects, then snip!'] },
  'ask-me-portfolio': { build: press, lines: ['Each answer is a JSON spec, built from a catalog of components.', 'And it all sits over a WebGL shader backdrop.'] },
  'llm-comparison': { build: duel, lines: ["It's open source, so anyone can stage a matchup!"] },
  moodify: { build: turntable, lines: ['Search your favourite tune and its album colours take over the page.', "The same palette trick recolours this site's hero dither!"] },
  'story-model-benchmark': { build: race, lines: ['Five fixed questions go through the real Story pipeline.', 'It scores validity, repetition, speed, tokens and cost.'] },
};

/** Programming Languages: lines of code fly in and click into place on an editor, a cursor blinking after the last one. */
const LINES: [indent: number, width: number][] = [[0, .5], [.1, .36], [.1, .44], [.2, .3], [0, .22]];
const codeBlocks: SkillMachine = (fixed, instanced) => {
  fixed.push(
    piece(rounded(.62, .05, .3, .02), SLATE, [0, .025, -.1]),
    piece(rounded(.88, .66, .05, .03), SLATE, [0, .38, -.2]),
    piece(rounded(.88, .07, .054, .02), 0x404b5e, [0, .68, -.2]),
    ...[TOMATO, MUSTARD, MINT].map((color, index) => piece(ball(.018), color, [-.38 + index * .055, .68, -.17])),
    ...LINES.map((_, index) => piece(new THREE.BoxGeometry(.035, .035, .01), 0x6b778c, [-.37, .58 - index * .1, -.172])),
  );
  const blocks = instanced(rounded(1, 1, 1, .2), [TOMATO, MUSTARD, SKY, MINT, VIOLET]);
  const cursor = instanced(new THREE.BoxGeometry(.025, .07, .02), [CREAM], true);
  return (time, energy) => {
    const t = time % 2.6 / 2.6;
    LINES.forEach(([indent, width], index) => {
      const arrive = .08 + index * .12;
      const away = energy * (1 - smoothstep(t, arrive, arrive + .1) * (1 - smoothstep(t, .86, .96)));
      const snap = 1 + energy * .3 * Math.sin(Math.PI * clamp((t - arrive - .1) / .07, 0, 1));
      place(blocks, index, [-.3 + indent + width / 2 + away * .5, .58 - index * .1 + away * .4, -.155 + away * .3], [0, 0, away * 1.4], [width * snap, .07 / snap, .05]);
    });
    place(cursor, 0, [-.05, .18, -.155], [0, 0, 0], [1, Math.sin(time * 5) > 0 ? 1 : .15, 1]);
  };
};

/** AI & LLM Tooling: a little neural net; a pulse lights it up layer by layer, sparks running along the links. */
const LAYERS = [3, 4, 2];
const neuralNet: SkillMachine = (fixed, instanced) => {
  const nodes = LAYERS.flatMap((count, layer) => Array.from({ length: count }, (_, index) => ({ layer, x: -.3 + layer * .3, y: .4 + (index - (count - 1) / 2) * .15 })));
  const links = nodes.flatMap((a) => nodes.filter((b) => b.layer === a.layer + 1).map((b) => ({ a, b })));
  fixed.push(
    piece(rounded(.84, .05, .4, .02), 0x3a2f5c, [0, .025, -.08]),
    ...[-1, 1].map((side) => piece(rounded(.04, .72, .04, .015), 0x3a2f5c, [side * .42, .38, -.14])),
    piece(rounded(.88, .04, .04, .015), 0x3a2f5c, [0, .74, -.14]),
    ...links.map(({ a, b }) => piece(cylinder(.006, .006, Math.hypot(b.x - a.x, b.y - a.y), 4), 0xb9a8e8, [(a.x + b.x) / 2, (a.y + b.y) / 2, -.14], [0, 0, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2])),
  );
  const lights = instanced(ball(.045), nodes.map(() => 0x5b4a8f), true);
  const sparks = instanced(new THREE.IcosahedronGeometry(.022, 0), links.map(() => 0xffe680), true);
  return (time, energy) => {
    const pulse = time * 1.5 % 3.4 - .2;
    nodes.forEach(({ layer, x, y }, index) => {
      const lit = clamp(energy * (1 - Math.abs(pulse - layer) * 1.4) + .15 * (.5 + .5 * Math.sin(time * 1.7 + index * 1.3)), 0, 1);
      place(lights, index, [x, y, -.14], [0, 0, 0], 1 + .4 * lit);
      lights.setColorAt(index, scratch.color.setHex(0x5b4a8f).lerp(scratch.glow.setHex(0xffe27a), lit));
    });
    links.forEach(({ a, b }, index) => {
      const along = clamp(pulse - a.layer, 0, 1);
      place(sparks, index, [a.x + (b.x - a.x) * along, a.y + (b.y - a.y) * along, -.12], [0, 0, 0], along > 0 && along < 1 ? energy : 0);
    });
    lights.instanceColor!.needsUpdate = true;
  };
};

/** Frontend Frameworks: a page assembles itself in a little browser window, then its button gets clicked. */
const PANELS: [x: number, y: number, width: number, height: number, color: number][] = [
  [0, .585, .7, .06, SKY], [-.27, .38, .14, .3, VIOLET], [-.06, .46, .2, .12, TOMATO], [.2, .46, .26, .12, MUSTARD], [0, .28, .26, .06, MINT], [.24, .28, .14, .07, 0xff8a65],
];
const webPage: SkillMachine = (fixed, instanced) => {
  fixed.push(
    piece(rounded(.36, .03, .22, .01), SLATE, [0, .015, -.1]),
    piece(rounded(.06, .14, .04, .01), SLATE, [0, .1, -.13]),
    piece(rounded(.84, .56, .05, .03), SLATE, [0, .43, -.12]),
    piece(rounded(.78, .5, .01, .005), 0xf6f1e7, [0, .43, -.092]),
    piece(rounded(.78, .05, .012, .005), 0xdde3ea, [0, .655, -.09]),
    ...[TOMATO, MUSTARD, MINT].map((color, index) => piece(ball(.014), color, [-.36 + index * .04, .655, -.083])),
  );
  const panels = instanced(rounded(1, 1, 1, .15), PANELS.map(([, , , , color]) => color));
  return (time, energy) => {
    const t = time % 3 / 3;
    PANELS.forEach(([x, y, width, height], index) => {
      const arrive = .06 + index * .1;
      const away = energy * (1 - smoothstep(t, arrive, arrive + .1) * (1 - smoothstep(t, .88, .96)));
      const click = index === PANELS.length - 1 ? 1 + .06 * Math.sin(time * 2.2) - energy * .3 * Math.sin(Math.PI * clamp((t - .7) / .08, 0, 1)) : 1;
      const size = (1 - .6 * away) * click;
      place(panels, index, [x, y + away * .35, -.075 + away * .15], [0, 0, 0], [width * size, height * size, .02]);
    });
  };
};

/** Infrastructure & DevOps: a little crane lowers containers onto a dock, one by one, into a stack. */
const STACK: [x: number, y: number][] = [[-.2, .115], [.12, .115], [-.04, .245], [-.04, .375]];
const containers: SkillMachine = (fixed, instanced) => {
  fixed.push(
    piece(rounded(.9, .05, .46, .02), 0x44505c, [0, .025, -.06]),
    ...Array.from({ length: 6 }, (_, index) => piece(new THREE.BoxGeometry(.12, .012, .02), index % 2 ? INK : MUSTARD, [-.375 + index * .15, .05, .16])),
    piece(rounded(.06, .8, .06, .015), MUSTARD, [.38, .425, -.06]),
    piece(rounded(.74, .05, .05, .015), MUSTARD, [.05, .8, -.06]),
    piece(rounded(.12, .1, .1, .02), 0x44505c, [.36, .72, -.06]),
  );
  const crates = instanced(fuse([piece(rounded(.3, .13, .17, .015), WHITE), ...[-.09, -.03, .03, .09].map((x) => piece(new THREE.BoxGeometry(.012, .136, .176), WHITE, [x, 0, 0]))]), [TOMATO, SKY, MINT, VIOLET]);
  const rigging = instanced(new THREE.BoxGeometry(1, 1, 1), [INK, MUSTARD, INK]);
  return (time, energy) => {
    const t = time % 3.4 / 3.4;
    let hookX = -.26 + .03 * Math.sin(time * 1.3), hookY = .55 + .03 * Math.sin(time * 1.9);
    STACK.forEach(([x, y], index) => {
      const start = .05 + index * .18, gone = smoothstep(t, .9, .98);
      const lift = energy * ((1 - smoothstep(t, start, start + .14)) * .45 + gone * .3);
      place(crates, index, [x, y + lift, -.06], [0, 0, 0], 1 - energy * (t < start ? 1 : gone));
      if (t >= start && t < start + .16) { hookX += (x - hookX) * energy; hookY += (y + lift + .09 - hookY) * energy; }
    });
    place(rigging, 0, [hookX, (.78 + hookY) / 2, -.06], [0, 0, 0], [.012, .78 - hookY, .012]);
    place(rigging, 1, [hookX, hookY, -.06], [0, 0, 0], [.09, .04, .09]);
    place(rigging, 2, [hookX, .77, -.06], [0, 0, 0], [.08, .05, .08]);
  };
};

/** Databases: rows hop off a tray into a database drum, its bands lighting up as each one is stored. */
const DRUM_X = .16, ROWS = 4;
const database: SkillMachine = (fixed, instanced) => {
  fixed.push(
    piece(rounded(.86, .05, .44, .02), 0x2f4a48, [0, .025, -.06]),
    ...[.13, .29, .45].map((y, index) => piece(cylinder(.2, .2, .13, 20), index % 2 ? 0x52c29f : MINT, [DRUM_X, y, -.06])),
    piece(cylinder(.19, .19, .01, 20), 0x9be6cb, [DRUM_X, .52, -.06]),
    piece(rounded(.28, .02, .2, .01), CABINET, [-.24, .3, -.06]),
    piece(rounded(.03, .27, .03, .01), 0x2f4a48, [-.24, .15, -.06]),
  );
  const rows = instanced(rounded(.16, .022, .11, .008), Array.from({ length: ROWS }, (_, index) => index % 2 ? 0xffd7a8 : CREAM));
  const bands = instanced(cylinder(.205, .205, .03, 20), [0x2d7d66, 0x2d7d66, 0x2d7d66], true);
  return (time, energy) => {
    const cycle = time / .6, flying = ROWS - 1 - Math.floor(cycle) % ROWS, u = cycle % 1;
    const along = smoothstep(u, 0, .7), sink = smoothstep(u, .7, 1);
    for (let index = 0; index < ROWS; index++) {
      const fly = index === flying ? energy : 0, restY = .32 + index * .026;
      const x = -.24 + (DRUM_X + .24) * along * fly, y = restY + ((.62 - restY) * along + Math.sin(Math.PI * along) * .18 - sink * .12) * fly;
      place(rows, index, [x, y, -.06], [0, 0, 0], 1 - fly * sink);
    }
    for (let band = 0; band < 3; band++) {
      const lit = clamp(energy * (1 - Math.abs((u - .7) * 10 - (2.5 - band))) + .12 * (.5 + .5 * Math.sin(time * 1.4 + band * 1.1)), 0, 1);
      place(bands, band, [DRUM_X, .21 + band * .16, -.06], [0, 0, 0], 1);
      bands.setColorAt(band, scratch.color.setHex(0x2d7d66).lerp(scratch.glow.setHex(0xb8ffe6), lit));
    }
    bands.instanceColor!.needsUpdate = true;
  };
};

/** Any other skill group: a cog on a stand that spins up while he is there. */
const cog: SkillMachine = (fixed, instanced) => {
  fixed.push(piece(rounded(.5, .05, .3, .02), SLATE, [0, .025, -.06]), piece(rounded(.06, .4, .06, .015), SLATE, [0, .22, -.1]));
  const teeth = Array.from({ length: 8 }, (_, index) => piece(new THREE.BoxGeometry(.08, .07, .05), WHITE, [Math.cos(index * Math.PI / 4) * .2, Math.sin(index * Math.PI / 4) * .2, 0], [0, 0, index * Math.PI / 4]));
  const wheel = instanced(fuse([piece(cylinder(.17, .17, .05, 16), WHITE, [0, 0, 0], [Math.PI / 2, 0, 0]), ...teeth]), [MUSTARD]);
  return (time, energy) => place(wheel, 0, [0, .42, -.06], [0, 0, time * (.4 + 4 * energy)], 1);
};

/** Per skill group of skills.md: its short sign, colour, what he says about its machine, and the machine. */
const GROUPS: Record<string, { sign: string; color: number; says: ((count: string) => string) | null; machine: SkillMachine }> = {
  'Programming Languages': { sign: 'Languages', color: TOMATO, says: (count) => `${count} languages, clicking together like building blocks!`, machine: codeBlocks },
  'AI & LLM Tooling': { sign: 'AI & LLMs', color: VIOLET, says: (count) => `${count} AI tools. Watch the little network light up!`, machine: neuralNet },
  'Frontend Frameworks': { sign: 'Frontend', color: SKY, says: (count) => `${count} frameworks to snap a page together!`, machine: webPage },
  'Infrastructure & DevOps': { sign: 'Infra & DevOps', color: MUSTARD, says: (count) => `${count} tools to stack the containers and ship them!`, machine: containers },
  Databases: { sign: 'Databases', color: MINT, says: (count) => `${count} databases, filing every row away!`, machine: database },
};

/**
 * Tech Lab: along the back wall a bay per project (its machine on the floor, its picture floating above), a beanbag nook
 * under the TECH LAB sign where he lands, and a bay per skill group (its machine on the bench, a pegboard of its icons
 * above). He presents a project at its console and a skill group from its bench, all from one lane in front; the open
 * floor runs to a toolbox at the front edge that he trips over on the way down.
 */
export const createLab: AreaBuilder = (origin, content, onImage) => {
  const group = new THREE.Group();
  group.name = 'lab';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
  const laser = new THREE.MeshBasicMaterial({ color: 0xff3d5a, toneMapped: false });
  const solidColor = new THREE.MeshStandardMaterial({ roughness: .55 });
  const brightColor = new THREE.MeshBasicMaterial({ toneMapped: false });
  const iconPlane = new THREE.PlaneGeometry(1, 1), tileShape = rounded(1, 1, 1, .12);
  const solid = (pieces: THREE.BufferGeometry[], parent: THREE.Object3D, at: V3 = [0, 0, 0], material: THREE.Material = toy) => {
    const mesh = new THREE.Mesh(fuse(pieces), material);
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  const obstacles: Obstacle[] = [];
  const stations: Station[] = [];
  const pictureLoader = new THREE.ImageLoader(), iconLoader = new THREE.TextureLoader();
  const loaded: THREE.Texture[] = [];
  let disposed = false;

  const { projects, skills: groups } = content;
  const pitch = Math.min(PITCH, (SPAN - NOOK) / Math.max(1, projects.length + groups.length)), k = pitch / PITCH;
  const start = -(pitch * (projects.length + groups.length) + NOOK) / 2, nookX = start + pitch * projects.length + NOOK / 2;
  const benchLeft = nookX + NOOK / 2, benchWidth = pitch * groups.length;
  /** An accent washed toward cream, for rugs and empty picture windows. */
  const pale = (accent: number) => scratch.color.set(accent).lerp(new THREE.Color(CREAM), .55).getHex();

  // Room shell, rugs, the bench top, the beanbag, a shelf, the toolbox at the exit and its cable: one static draw call.
  const sideZ = (FLOOR.back + .4) / 2;
  solid([
    piece(rounded(FLOOR.width, .5, FLOOR.front - FLOOR.back, .18, 3), SHELL, [0, -.25, (FLOOR.front + FLOOR.back) / 2]),
    piece(rounded(FLOOR.width - .4, .4, FLOOR.front - FLOOR.back - .4, .18, 2), LILAC, [0, -.66, (FLOOR.front + FLOOR.back) / 2]),
    piece(rounded(FLOOR.width, WALL_H, .26, .08, 2), 0xebe1f0, [0, WALL_H / 2, WALL_Z - .13]),
    piece(rounded(.26, WALL_H, .4 - FLOOR.back, .08, 2), 0xdfd0ea, [-8.78, WALL_H / 2, sideZ]),
    piece(rounded(FLOOR.width + .1, .14, .34, .05), PLUM, [0, WALL_H, WALL_Z - .13]),
    piece(rounded(.34, .14, .45 - FLOOR.back, .05), PLUM, [-8.78, WALL_H, sideZ]),
    piece(rounded(FLOOR.width, .16, .3, .04), SAGE, [0, .08, WALL_Z]),
    piece(rounded(.3, .16, .4 - FLOOR.back, .04), SAGE, [-8.63, .08, sideZ]),
    ...[[1.7, 0xe6dcef], [1.35, 0xd9cdea], [.95, PEACH]].map(([radius, color], index) => piece(cylinder(radius, radius, .012 + index * .002, 32), color, [0, .006, -.25])),
    ...projects.map((_, index) => piece(rounded(pitch - .14, .012, 1.3, .006), pale(ACCENTS[index % ACCENTS.length]), [start + pitch * (index + .5), .006, WALL_Z + .7])),
    ...(groups.length ? [piece(rounded(benchWidth + .04, .08, .8, .03), BENCH, [benchLeft + benchWidth / 2, BENCH_TOP - .04, WALL_Z + .4])] : []),
    piece(new THREE.SphereGeometry(.62, 18, 12), CORAL, [nookX, .24, BEANBAG_Z], [0, 0, 0], [1, .58, 1]),
    piece(rounded(2.6, .66, .08, .04), PLUM, [nookX, TITLE_Y, WALL_Z + .04]),
    piece(rounded(.34, .05, 1.7, .02), PEACH, [-8.48, 2.7, -1.4]),
    ...[CORAL, SAGE, LILAC].map((color, index) => piece(rounded(.26, .2, .34, .04), color, [-8.5, 2.825, -2 + index * .55])),
    piece(rounded(.56, .26, .3, .04), CORAL, [EXIT.x, .13, EXIT.z + .48]),
    piece(rounded(.58, .06, .32, .02), PLUM, [EXIT.x, .29, EXIT.z + .48]),
    piece(new THREE.TorusGeometry(.09, .02, 6, 12, Math.PI), INK, [EXIT.x, .32, EXIT.z + .48]),
    piece(rounded(.08, .05, .02, .01), CREAM, [EXIT.x, .22, EXIT.z + .64]),
    piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[.25, .2, .48], [.5, .03, .56], [.75, .03, .65], [.95, -.08, .74], [1.05, -.5, .76]]
      .map(([x, y, z]) => new THREE.Vector3(EXIT.x + x, y, EXIT.z + z))), 40, .025, 6), INK),
  ], group);

  const titleMaterial = new THREE.MeshBasicMaterial({
    map: paint(512, 128, (context) => {
      context.strokeStyle = '#eb9a84'; context.lineWidth = 6;
      context.beginPath(); context.roundRect(10, 10, 492, 108, 40); context.stroke();
      context.shadowColor = '#ff8fa8'; context.shadowBlur = 18; context.fillStyle = '#fff1f4';
      fitText(context, 'TECH LAB', 256, 64, 440, 96, 84);
    }),
    transparent: true, toneMapped: false,
  });
  const title = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .6), titleMaterial);
  title.position.set(nookX, TITLE_Y, WALL_Z + .085);
  group.add(title);

  // Project bays: the town workshop's machines and floating pictures.
  const exhibits = projects.map((project, index) => {
    const id = `project:${project.slug}`, accent = ACCENTS[index % ACCENTS.length], machine = MACHINES[project.slug] ?? { build: gizmo, lines: [] };
    const x = start + pitch * (index + .5), consoleX = CONSOLE.x * k;
    const bay = new THREE.Group();
    bay.name = bay.userData.station = id;
    group.add(bay);

    // The machine with its console; he stands in front of the console, so the machine shows beside him.
    const root = new THREE.Group();
    root.name = `${id}:machine`;
    root.position.set(x, 0, MACHINE_Z);
    bay.add(root);
    const body = new THREE.Group();
    body.scale.setScalar(MACHINE_SCALE * k);
    root.add(body);
    const light = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
    const button = new THREE.Mesh(cylinder(.06, .065, .05, 16), light);
    button.position.set(consoleX - .04 * k, .92, CONSOLE.z + .03);
    button.scale.set(k, 1, k);
    root.add(button);
    const lever = solid([piece(cylinder(.014, .014, .2, 6), STEEL, [0, .1, 0]), piece(ball(.04), TOMATO, [0, .2, 0])], root, [consoleX + .08 * k, .9, CONSOLE.z - .07]);
    const parts: THREE.BufferGeometry[] = [];
    const animate = machine.build({
      root: body, parts, glow, laser,
      solid: (pieces, at, parent = body, material) => solid(pieces, parent, at, material),
      copies: (pieces, tints) => {
        const mesh = new THREE.InstancedMesh(fuse(pieces), toy, tints.length);
        tints.forEach((tint, copy) => mesh.setColorAt(copy, scratch.color.set(tint)));
        body.add(mesh);
        return mesh;
      },
    });
    const enlarge = new THREE.Matrix4().makeScale(MACHINE_SCALE * k, MACHINE_SCALE * k, MACHINE_SCALE * k);
    solid([
      ...parts.map((part) => part.applyMatrix4(enlarge)),
      piece(cylinder(.14, .16, .06, 16), DARK, [consoleX, .03, CONSOLE.z], [0, 0, 0], [k, 1, k]),
      piece(cylinder(.05, .065, .74, 10), STEEL, [consoleX, .43, CONSOLE.z], [0, 0, 0], [k, 1, k]),
      piece(rounded(.28, .12, .26, .04), accent, [consoleX, .84, CONSOLE.z], [0, 0, 0], [k, 1, k]),
      piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-.04, .03, -.12], [-.1, .02, -.3], [-.2, .05, -.4]]
        .map(([px, py, pz]) => new THREE.Vector3(consoleX + px, py, CONSOLE.z + pz))), 10, .02, 5), INK),
    ], root);
    animate(0, 0, 0);

    // Its picture, floating above: a titled card that paints the project image in once it loads.
    const picture = new THREE.Group();
    picture.name = `${id}:picture`;
    bay.add(picture);
    const face = paint(512, 440, (context) => {
      context.fillStyle = '#fff6e6'; context.fillRect(0, 0, 512, 440);
      context.fillStyle = `#${pale(accent).toString(16).padStart(6, '0')}`;
      context.beginPath(); context.roundRect(PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height, 18); context.fill();
      context.fillStyle = '#2b2630';
      fitText(context, project.title, 256, 386, 460, 86, 56);
    });
    solid([piece(rounded(1.84, 1.6, .06, .05), accent, [0, 0, -.035]), piece(rounded(1.92, 1.68, .03, .04), WALNUT, [0, 0, -.07]), piece(ball(.055), TOMATO, [0, .8, .02])], picture);
    picture.add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.461), new THREE.MeshBasicMaterial({ map: face, toneMapped: false })));
    if (SAME_ORIGIN.test(project.image)) pictureLoader.load(project.image, (image) => {
      if (disposed) return;
      const context = (face.image as HTMLCanvasElement).getContext('2d')!, width = image.naturalWidth, height = image.naturalHeight;
      context.save();
      context.beginPath(); context.roundRect(PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height, 18); context.clip();
      // Pictures are cover-cropped to the window. An SVG without its own size (the covers are 3:2) gets a made-up size
      // that source rectangles do not match, so it is drawn whole into the window.
      const crop = Math.min(width / PHOTO.width, height / PHOTO.height);
      if (crop > 0 && !project.image.endsWith('.svg')) context.drawImage(image, (width - PHOTO.width * crop) / 2, (height - PHOTO.height * crop) / 2, PHOTO.width * crop, PHOTO.height * crop, PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height);
      else context.drawImage(image, PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height);
      context.restore();
      face.needsUpdate = true; onImage?.();
    }, undefined, () => {});
    const variety = index % LIFT.length;

    // He opens with the narrative's exhibit line, adds the machine's lines, then what it is built with.
    const source = `content/about-me/projects/${project.slug}.md` as const, tech = project.tech.map(({ name }) => name);
    const lines: CharacterLine[] = [
      ...(STATION_LINES[id] ?? [{ id: `project-${project.slug}-about`, line: project.description.replace(/([.!?])\s[\s\S]*$/, '$1'), source }]),
      ...machine.lines.map((line, number) => ({ id: `project-${project.slug}-${number + 1}`, line, source })),
      ...(tech.length ? [{ id: `project-${project.slug}-tech`, line: `Built with ${tech.length > 1 ? `${tech.slice(0, -1).join(', ')} and ${tech.at(-1)}` : tech[0]}.`, source }] : []),
    ];
    const reach = { x: x + consoleX, y: .95, z: MACHINE_Z + CONSOLE.z }, stand = { x: reach.x + .3, z: LANE_Z };
    obstacles.push(
      ...[-1, 1].map((side) => ({ id: `${id}:machine`, x: x + side * MACHINE_HALF * k, z: MACHINE_Z, radius: MACHINE_RADIUS * k })),
      { id: `${id}:console`, x: reach.x, z: reach.z, radius: .14 * k },
    );
    stations.push({
      id, kind: 'play', label: `${project.title} exhibit`, stand, heading: Math.atan2(reach.x - stand.x, reach.z - stand.z), reach,
      present: { lines, ...(project.url ? { url: project.url, linkLabel: `Visit ${project.title}` } : {}) },
    });
    return {
      id, accent, energy: 0, run: 0, progress: 0, animate, button, light, lever, picture,
      float: [x + CARD_X * k, CARD_Y + LIFT[variety], PICTURE_Z + DEPTH[variety]] as V3, tilt: TILT[variety], phase: index * 1.7,
    };
  });

  // Skill bays: the town toolshed's pegboards and machines, one sign each from a shared atlas.
  const specs = groups.map((skillGroup, index) => GROUPS[skillGroup.category] ?? { sign: skillGroup.category, color: ACCENTS[index % ACCENTS.length], says: null, machine: cog });
  const signMaterial = groups.length ? new THREE.MeshBasicMaterial({
    map: paint(512, 128 * groups.length, (context) => specs.forEach((spec, row) => {
      context.fillStyle = '#2b2630';
      fitText(context, spec.sign, 256, 128 * row + 66, 460, 104, 84);
    })),
    transparent: true, toneMapped: false,
  }) : null;
  const benches = groups.map((skillGroup, index) => {
    const spec = specs[index], id = skillStationId(skillGroup.category), x = benchLeft + pitch * (index + .5);
    const bay = new THREE.Group();
    bay.name = bay.userData.station = id;
    group.add(bay);
    const pegWidth = pitch - .17, signWidth = Math.min(1.3, pitch - .3);
    const count = skillGroup.skills.length, columns = count <= 4 ? 2 : 3, rows = Math.ceil(count / columns);
    const spacing = Math.min(.68, (pegWidth - .2) / columns, (ICON_H - .1) / rows), tile = spacing * .84, picture = tile * .8;
    const slots = skillGroup.skills.map((_, slot) => {
      const row = Math.floor(slot / columns), inRow = Math.min(columns, count - row * columns);
      return { x: x + (slot % columns - (inRow - 1) / 2) * spacing, y: ICON_Y + ((rows - 1) / 2 - row) * spacing, width: picture, height: picture };
    });
    const holes = Math.floor((pegWidth - .2) / .2), holeRows = Math.floor((PEG_H - .1) / .2);
    const doorWidth = (pitch - .5) / 2;
    const reach = { x: x - .38 * k, y: BENCH_TOP + .07, z: BENCH_FRONT - .1 }, stand = { x: x - .5 * k, z: LANE_Z };
    solid([
      piece(rounded(pegWidth, PEG_H + .1, .03, .02), spec.color, [x, PEG_Y, WALL_Z + .015]),
      piece(rounded(pegWidth - .1, PEG_H, .05, .03), PEG, [x, PEG_Y, WALL_Z + .035]),
      ...Array.from({ length: holes * holeRows }, (_, hole) => piece(new THREE.CircleGeometry(.018, 4), HOLE,
        [x + (hole % holes - (holes - 1) / 2) * .2, PEG_Y + (Math.floor(hole / holes) - (holeRows - 1) / 2) * .2, WALL_Z + .062])),
      ...slots.map((slot) => piece(cylinder(.014, .014, .1, 5), STEEL, [slot.x, slot.y + tile / 2 + .04, WALL_Z + .1], [Math.PI / 2, 0, 0])),
      piece(rounded(signWidth + .16, signWidth / 4 + .16, .05, .04), spec.color, [x, SIGN_Y, WALL_Z + .025]),
      piece(rounded(signWidth + .04, signWidth / 4 + .06, .04, .03), CREAM, [x, SIGN_Y, WALL_Z + .05]),
      piece(rounded(pitch - .12, BENCH_TOP - .08, .74, .04), CABINET, [x, (BENCH_TOP - .08) / 2, WALL_Z + .38]),
      ...[-1, 1].map((side) => piece(rounded(doorWidth, .3, .03, .02), spec.color, [x + side * (doorWidth / 2 + .03), .62, WALL_Z + .765])),
      piece(rounded(pitch - .44, .3, .03, .02), spec.color, [x, .24, WALL_Z + .765]),
      ...[[-1, .62], [1, .62], [0, .24]].map(([side, y]) => piece(ball(.03), CREAM, [x + side * (doorWidth / 2 + .03), y, WALL_Z + .79])),
      piece(cylinder(.08, .09, .04, 14), SLATE, [reach.x, BENCH_TOP + .02, reach.z]),
      piece(cylinder(.06, .06, .04, 14), spec.color, [reach.x, BENCH_TOP + .05, reach.z]),
    ], bay);
    const quad = new THREE.PlaneGeometry(signWidth, signWidth / 4), uv = quad.attributes.uv;
    for (let vertex = 0; vertex < uv.count; vertex++) uv.setY(vertex, 1 - (index + 1 - uv.getY(vertex)) / groups.length);
    const sign = new THREE.Mesh(quad, signMaterial!);
    sign.position.set(x, SIGN_Y, WALL_Z + .076);
    bay.add(sign);

    const rig = new THREE.Group();
    rig.name = `${id}:machine`;
    rig.position.set(x + .36 * k, BENCH_TOP, WALL_Z + .42);
    rig.scale.setScalar(k);
    bay.add(rig);
    const fixed: THREE.BufferGeometry[] = [];
    const tick = spec.machine(fixed, (geometry, colors, bright = false) => {
      const mesh = new THREE.InstancedMesh(geometry, bright ? brightColor : solidColor, colors.length);
      colors.forEach((color, at) => mesh.setColorAt(at, scratch.color.setHex(color)));
      rig.add(mesh);
      return mesh;
    });
    solid(fixed, rig);
    tick(0, 0);

    const tiles = new THREE.InstancedMesh(tileShape, solidColor, count);
    for (let at = 0; at < count; at++) tiles.setColorAt(at, scratch.color.setHex(CREAM).lerp(scratch.glow.setHex(spec.color), .18));
    bay.add(tiles);
    const icons = skillGroup.skills.map((skill, at) => {
      const material = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      const icon = new THREE.Mesh(iconPlane, material);
      icon.name = `icon:${skill.name}`;
      icon.visible = false;
      bay.add(icon);
      if (SAME_ORIGIN.test(skill.icon)) loaded.push(iconLoader.load(skill.icon, (texture) => {
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
        const { width, height } = texture.image, aspect = width && height ? width / height : 1;
        slots[at].width = aspect >= 1 ? picture : picture * aspect; slots[at].height = aspect >= 1 ? picture / aspect : picture;
        icon.scale.set(slots[at].width, slots[at].height, 1);
        material.map = texture; material.needsUpdate = true; icon.visible = true; onImage?.();
      }));
      return icon;
    });
    // Each poke of his pops the next icon off the board.
    const lay = (time: number, energy: number) => {
      const turn = Math.floor(time / TAP), beat = time / TAP - turn;
      slots.forEach((slot, at) => {
        const pop = at === turn % count ? energy * Math.sin(Math.PI * beat) : 0, grow = 1 + .4 * pop, spin = pop * .18 * Math.sin(time * 18), lift = pop * .14;
        place(tiles, at, [slot.x, slot.y, TILE_Z + lift], [0, 0, spin], [tile * grow, tile * grow, .06]);
        icons[at].position.set(slot.x, slot.y, TILE_Z + .036 + lift);
        icons[at].scale.set(slot.width * grow, slot.height * grow, 1);
        icons[at].rotation.z = spin;
      });
    };
    lay(0, 0);

    const names = skillGroup.skills.map((skill) => skill.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
    const lines: CharacterLine[] = [{ id: `${id}-skills`, line: `${skillGroup.category}: ${list}.`, source: SKILLS }];
    if (spec.says) lines.unshift({ id: `${id}-machine`, line: spec.says(COUNTS[count] ?? String(count)), source: SKILLS });
    stations.push({ id, kind: 'tinker', label: `${skillGroup.category} pegboard`, stand, heading: Math.atan2(reach.x - stand.x, reach.z - stand.z), reach, present: { lines } });
    return { id, tick, lay, energy: 0, resting: true };
  });
  obstacles.push({ id: 'beanbag', x: nookX, z: BEANBAG_Z, radius: .4 });

  const update: WorldArea['update'] = (dt, elapsed, activity) => {
    for (const bay of exhibits) {
      const active = bay.id === activity.stationId;
      bay.energy = clamp(bay.energy + (active ? 2.5 : -2) * dt, 0, 1);
      if (active) bay.progress = activity.progress;
      else if (bay.energy === 0) bay.progress = 0;
      bay.run += dt * bay.energy;
      bay.animate(bay.run, bay.energy, bay.progress);
      bay.button.position.y = .92 - bay.energy * .015 * (.5 + .5 * Math.sin(bay.run * 10));
      bay.light.color.set(bay.accent).lerp(LIT, bay.energy * (.35 + .3 * Math.sin(bay.run * 9)));
      bay.lever.rotation.z = bay.energy * .6 * Math.sin(bay.run * 3);
      // Pictures always drift; the one he presents grows a little and turns to face the visitor.
      const [floatX, floatY, floatZ] = bay.float;
      bay.picture.position.set(floatX, floatY + .07 * Math.sin(elapsed * 1.1 + bay.phase), floatZ);
      bay.picture.rotation.set(0, .08 * Math.sin(elapsed * .6 + bay.phase) * (1 - bay.energy), bay.tilt + .025 * Math.sin(elapsed * .8 + bay.phase));
      bay.picture.scale.setScalar(CARD * k * (1 + .1 * bay.energy));
    }
    for (const bench of benches) {
      bench.energy = clamp(bench.energy + (bench.id === activity.stationId ? 4 : -3) * dt, 0, 1);
      bench.tick(elapsed, bench.energy);
      if (bench.energy > 0 || !bench.resting) { bench.lay(elapsed, bench.energy); bench.resting = bench.energy === 0; }
    }
    // The neon sign flickers now and then.
    const noise = Math.abs(Math.sin(Math.floor(elapsed * 8) * 91.7) * 4375.85 % 1);
    titleMaterial.opacity = noise > .93 ? .35 : noise > .88 ? .75 : 1;
  };
  update(0, 0, { stationId: null, progress: 0 });
  group.updateMatrixWorld(true);

  return {
    id: 'lab',
    group,
    bounds: { ...BOUNDS },
    obstacles,
    stations,
    exit: { ...EXIT },
    landing: { x: nookX, y: .6, z: BEANBAG_Z },
    view: { center: { x: 0, y: 2.7, z: -.6 } },
    pick: (raycaster) => {
      group.updateWorldMatrix(true, true);
      for (let node: THREE.Object3D | null = raycaster.intersectObject(group, true)[0]?.object ?? null; node; node = node.parent) {
        if (typeof node.userData.station === 'string') return node.userData.station;
      }
      return null;
    },
    update,
    dispose: () => {
      disposed = true;
      const materials = new Set<THREE.Material>([toy, glow, laser, solidColor, brightColor]);
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) materials.add(material);
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
      for (const material of materials) {
        if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
        material.dispose();
      }
      iconPlane.dispose(); tileShape.dispose();
      loaded.forEach((texture) => texture.dispose());
    },
  };
};

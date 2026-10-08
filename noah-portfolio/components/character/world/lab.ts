import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STATION_LINES, type CharacterLine } from '@/lib/character/narrative';
import type { AreaBuilder, Obstacle, Station, WorldArea } from './types';

type V3 = [number, number, number];
/**
 * Poses a machine's moving parts. `run` is the machine's own clock and only ticks while it runs, `energy` eases
 * from 0 to 1 as he starts and back as he leaves, `progress` is his presentation's. Energy 0 is the rest pose.
 */
type Animate = (run: number, energy: number, progress: number) => void;
type Kit = {
  /** The machine's own frame, scaled up as a whole: floor under its middle, its console off to +x. Static parts go in `parts` and become one mesh. */
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

const WOOD = 0xd59c62, PLANK = 0xb07a48, WALNUT = 0x7a4b2c, TEAL = 0x2f6e6b, TEAL_SOFT = 0x5f9e93, SIDE = 0x3a7d78;
const CREAM = 0xfff3dd, TOMATO = 0xe4573d, MUSTARD = 0xf4b63f, SKY = 0x58a8de, MINT = 0x7fe0bd, PINK = 0xf27fa5, GRAPE = 0x7a5cc7;
const LAVENDER = 0xb79cf2, INK = 0x2b2630, DARK = 0x3a3440, STEEL = 0xb7c0c7, CORK = 0xdcb27c, LEAF = 0x6cbf5a, WHITE = 0xffffff;
const ACCENTS = [TOMATO, SKY, MUSTARD, PINK, MINT];
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const TAU = Math.PI * 2;
/** The back edge stops just behind the machines' row, so he cannot wander into the gaps between them and the bench. */
const BOUNDS = { minX: -6.2, maxX: 6.2, minZ: -2.22, maxZ: 3.6 };
/** Bays: up to five a row along the back, each a machine with its console and his spot in front of it, its picture floating above. */
const PITCH = 2.5, PER_ROW = 5, BAY_Z = -2.1, ROW_GAP = 2.5;
/** Machines are modelled about a metre wide and drawn this much bigger, so they read from the street camera; two circles either side of the middle cover the footprint. */
const MACHINE_SCALE = 1.35, MACHINE_HALF = .17, MACHINE_RADIUS = .54;
/**
 * From a machine's middle: its console at the front right corner, and his spot in front of that. Every spot sits on one
 * lane clear of all machines and consoles, so walks between exhibits are straight lines without bumps, and the machine
 * shows beside him rather than behind his afro.
 */
const CONSOLE = { x: .95, z: .38 }, STAND = { x: 1.3, z: .78 };
/** Floating pictures: offset from their machine, height, how far behind it they hang, and a little per-card variety. */
const CARD_X = .3, CARD_Y = 3.45, CARD_BACK = 1.15, LIFT = [.1, -.02, 0, -.03, .08], DEPTH = [.1, -.1, .05, -.05, .12], TILT = [.04, -.03, .02, -.04, .03];
/** The picture window on a 512 by 440 card canvas; the title goes underneath. */
const PHOTO = { x: 26, y: 26, width: 460, height: 304 };
const SCREEN_OFF = new THREE.Color(0x24324a), SCREEN_ON = new THREE.Color(0x9ff0ff), LIT = new THREE.Color(WHITE);
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3(), color: new THREE.Color() };
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

/** Things I've built: a workshop with a machine per project, each showing what it does while he presents it under its floating picture. */
export const createLab: AreaBuilder = (origin, content) => {
  const group = new THREE.Group();
  group.name = 'workshop';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
  const laser = new THREE.MeshBasicMaterial({ color: 0xff3d5a, toneMapped: false });
  const solid = (pieces: THREE.BufferGeometry[], parent: THREE.Object3D, at: V3 = [0, 0, 0], material: THREE.Material = toy) => {
    const mesh = new THREE.Mesh(mergeGeometries(pieces), material);
    pieces.forEach((part) => part.dispose());
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  const obstacles: Obstacle[] = [
    { id: 'crates', x: -5.8, z: 2.95, radius: .48 }, { id: 'crate', x: -5, z: 3.35, radius: .38 },
    { id: 'tool-chest', x: -5.95, z: 1.3, radius: .48 }, { id: 'cable-spool', x: 6, z: 1.2, radius: .4 }, { id: 'plant', x: 6.05, z: 3.4, radius: .28 },
  ];
  const stations: Station[] = [];
  const bays: {
    id: string; accent: number; energy: number; run: number; progress: number; animate: Animate;
    button: THREE.Mesh; light: THREE.MeshBasicMaterial; lever: THREE.Mesh; picture: THREE.Group; float: V3; tilt: number; phase: number;
  }[] = [];
  const loader = new THREE.ImageLoader();
  let disposed = false;

  const count = content.projects.length, rows = Math.ceil(count / PER_ROW), perRow = Math.ceil(count / Math.max(1, rows));
  const machineX = (index: number) => {
    const row = Math.floor(index / perRow), inRow = Math.min(perRow, count - row * perRow);
    return (index % perRow - (inRow - 1) / 2) * PITCH - .5;
  };

  // Room, back bench, pegboard and tools, lamps, string-light cable, front clutter and rugs: one static draw call.
  const tools: ((x: number) => THREE.BufferGeometry[])[] = [
    (x) => [piece(rounded(.05, .48, .03, .01), WALNUT, [x, 1.85, -3.84]), piece(rounded(.24, .08, .06, .02), STEEL, [x, 2.12, -3.83])],
    (x) => [piece(rounded(.05, .46, .02, .01), STEEL, [x, 1.86, -3.85]), piece(new THREE.TorusGeometry(.06, .02, 6, 12, Math.PI * 1.6), STEEL, [x, 2.12, -3.85], [0, 0, -.3 * Math.PI])],
    (x) => [piece(rounded(.46, .14, .01, 0), STEEL, [x + .05, 1.95, -3.85]), piece(rounded(.14, .16, .04, .03), TOMATO, [x - .22, 1.97, -3.84])],
    (x) => [TOMATO, SKY, MUSTARD].flatMap((tint, index) => [piece(cylinder(.028, .028, .14, 8), tint, [x - .14 + index * .14, 2.1, -3.83]), piece(cylinder(.008, .008, .2, 6), STEEL, [x - .14 + index * .14, 1.93, -3.84])]),
    (x) => [-1, 1].flatMap((side) => [piece(rounded(.035, .3, .02, .01), TOMATO, [x + side * .04, 1.8, -3.84], [0, 0, -side * .12]), piece(rounded(.03, .14, .02, .01), STEEL, [x + side * .015, 2.01, -3.84], [0, 0, side * .1])]),
  ];
  const clutter: ((x: number) => THREE.BufferGeometry[])[] = [
    (x) => [piece(rounded(.3, .12, .2, .02), STEEL, [x, 1.04, -3.45]), piece(rounded(.3, .1, .05, .02), DARK, [x, 1.13, -3.36]), piece(cylinder(.012, .012, .3, 6), STEEL, [x, 1.1, -3.3], [0, 0, Math.PI / 2])],
    (x) => [
      ...[MUSTARD, TOMATO, MINT].flatMap((tint, index) => [piece(cylinder(.07, .07, .17, 12), 0xa8dfe9, [x - .15 + index * .15, 1.065, -3.5]), piece(cylinder(.072, .072, .03, 12), tint, [x - .15 + index * .15, 1.165, -3.5])]),
      piece(cylinder(.05, .045, .1, 12), CREAM, [x + .3, 1.03, -3.35]), piece(new THREE.TorusGeometry(.03, .01, 4, 10), CREAM, [x + .35, 1.03, -3.35]),
    ],
    (x) => [piece(cylinder(.09, .1, .03, 12), SKY, [x, .995, -3.45]), piece(cylinder(.015, .015, .22, 6), STEEL, [x, 1.1, -3.45]), piece(ball(.06), SKY, [x, 1.22, -3.5]), piece(new THREE.TorusGeometry(.16, .01, 4, 24), STEEL, [x, 1.22, -3.42])],
    (x) => [
      piece(rounded(.38, .22, .15, .04), TOMATO, [x, 1.09, -3.5]), piece(cylinder(.06, .06, .02, 14), DARK, [x - .08, 1.09, -3.42], [Math.PI / 2, 0, 0]),
      piece(cylinder(.03, .03, .02, 10), CREAM, [x + .1, 1.12, -3.42], [Math.PI / 2, 0, 0]), piece(cylinder(.006, .006, .3, 4), STEEL, [x + .2, 1.3, -3.52], [0, 0, -.5]),
    ],
    (x) => [
      piece(cylinder(.1, .1, .16, 14), TOMATO, [x, 1.06, -3.5]), piece(cylinder(.1, .1, .16, 14), SKY, [x, 1.22, -3.5]), piece(cylinder(.085, .085, .14, 14), MINT, [x + .24, 1.05, -3.45]),
      piece(rounded(.03, .22, .02, .01), WALNUT, [x - .22, 1.06, -3.38], [0, 0, .4]), piece(rounded(.06, .07, .03, .01), MUSTARD, [x - .26, .95, -3.38], [0, 0, .4]),
    ],
  ];
  // Fairy lights scalloped along the back wall under the sign; the bulbs are instanced so they can twinkle.
  const hooks = 8, bulbsPerSwag = 4, swag = (x: number) => 4.12 - .14 * Math.sin(Math.PI * ((x + 6.3) / (12.6 / hooks) % 1));
  const bulbSpots = Array.from({ length: hooks * bulbsPerSwag }, (_, index): V3 => {
    const x = -6.3 + (Math.floor(index / bulbsPerSwag) + (index % bulbsPerSwag + 1) / (bulbsPerSwag + 1)) * 12.6 / hooks;
    return [x, swag(x) - .06, -3.78];
  });
  const firstRow = Math.min(count, perRow);
  const lamps = Array.from({ length: Math.max(0, firstRow - 1) }, (_, index) => machineX(index) + CARD_X + PITCH / 2);
  /** An accent washed toward cream, for rugs and empty picture windows. */
  const pale = (accent: number) => scratch.color.set(accent).lerp(new THREE.Color(CREAM), .55).getHex();
  solid([
    // Thin, since the street's ground hides anything below it and the camera frames the whole box.
    piece(rounded(13.6, .14, 8.4, .05), WOOD, [0, -.07, 0]),
    ...Array.from({ length: 16 }, (_, index) => piece(rounded(.025, .01, 8.1, 0), PLANK, [-6.375 + index * .85, .004, 0])),
    piece(rounded(13.6, 5.35, .3, .08), TEAL, [0, 2.675, -4.05]),
    piece(rounded(13.1, 1.15, .05, 0), TEAL_SOFT, [0, .62, -3.875]),
    piece(rounded(13.6, .22, .5, .06), TOMATO, [0, 5.45, -4]),
    ...[-1, 1].flatMap((side) => [
      piece(rounded(.3, 5.35, 4.5, .08), SIDE, [side * 6.65, 2.675, -1.95]),
      piece(rounded(.05, 1.15, 4.2, 0), TEAL_SOFT, [side * 6.475, .62, -1.85]),
      piece(rounded(.4, .22, 4.7, .05), TOMATO, [side * 6.65, 5.45, -1.95]),
      piece(rounded(.38, 5.35, .38, .08), TOMATO, [side * 6.65, 2.675, .3]),
      piece(rounded(.36, 4.2, .36, .08), TOMATO, [side * 6.6, 2.1, 3.9]),
      piece(ball(.28), MUSTARD, [side * 6.6, 4.45, 3.9]),
    ]),
    // Sign board.
    piece(rounded(5.4, 1.08, .14, .06), TOMATO, [0, 4.78, -3.84]),
    piece(rounded(5.16, .86, .05, 0), MUSTARD, [0, 4.78, -3.77]),
    // Workbench along the back wall, with a shelf of bins underneath.
    piece(rounded(12.7, .1, .66, .03), 0xa86f42, [0, .93, -3.55]),
    piece(rounded(12.5, .05, .52, 0), WALNUT, [0, .3, -3.55]),
    ...[-6.2, -2.1, 2.1, 6.2].flatMap((x) => [-3.82, -3.28].map((z) => piece(rounded(.08, .9, .08, 0), WALNUT, [x, .45, z]))),
    ...Array.from({ length: 9 }, (_, index) => piece(rounded(.62, .26, .4, .04), ACCENTS[index % ACCENTS.length], [-5.8 + index * 1.45, .455, -3.55])),
    // Pegboard with its holes, and a tool hanging in each gap between the pictures.
    piece(rounded(12.8, 1.12, .04, 0), CORK, [0, 1.92, -3.88]),
    ...[1.34, 2.5].map((y) => piece(rounded(12.9, .06, .06, 0), WALNUT, [0, y, -3.87])),
    ...Array.from({ length: 64 * 5 }, (_, index) => piece(new THREE.CircleGeometry(.02, 4), 0x9a7650, [-6.3 + (index % 64) * .2, 1.52 + Math.floor(index / 64) * .2, -3.858])),
    ...[-4.3, -1.85, .6, 3.05, 5.5].flatMap((x, index) => [...tools[index](x), ...clutter[index](x), piece(cylinder(.07, .07, .05, 14), MUSTARD, [x + .32, 1.65, -3.84], [Math.PI / 2, 0, 0])]),
    // Lamps hanging between the pictures.
    ...lamps.flatMap((x) => [
      piece(rounded(.04, .04, .4, 0), DARK, [x, 2.95, -3.7]),
      piece(cylinder(.008, .008, .3, 4), INK, [x, 2.8, -3.5]),
      piece(cylinder(.07, .2, .18, 14), MUSTARD, [x, 2.6, -3.5]),
    ]),
    piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: hooks * 8 + 1 }, (_, index) => {
      const x = -6.3 + index * 12.6 / (hooks * 8);
      return new THREE.Vector3(x, swag(x), -3.8);
    })), 96, .012, 3), INK),
    // Front corners: crates and a tool chest on the left, a cable spool and a plant on the right.
    piece(rounded(.62, .62, .62, .04), 0xc58a52, [-5.8, .31, 2.95]),
    ...[.15, .45].map((y) => piece(rounded(.64, .06, .64, 0), WALNUT, [-5.8, y, 2.95])),
    piece(rounded(.5, .5, .5, .04), 0xd8a066, [-5.72, .87, 2.92], [0, .35, 0]),
    piece(rounded(.5, .44, .5, .04), 0xc58a52, [-5, .22, 3.35], [0, -.2, 0]),
    piece(rounded(.72, .86, .5, .05), TOMATO, [-5.95, .5, 1.3]),
    piece(rounded(.76, .05, .54, .02), DARK, [-5.95, .955, 1.3]),
    ...[.3, .5, .7].flatMap((y) => [piece(rounded(.6, .015, .02, 0), 0xb83f2a, [-5.95, y + .09, 1.56]), piece(rounded(.16, .03, .03, .01), STEEL, [-5.95, y, 1.57])]),
    ...[-1, 1].flatMap((x) => [-1, 1].map((z) => piece(ball(.05), DARK, [-5.95 + x * .3, .05, 1.3 + z * .2]))),
    ...[-1, 1].map((side) => piece(cylinder(.34, .34, .05, 18), 0xc58a52, [6 + side * .15, .34, 1.2], [0, 0, Math.PI / 2])),
    piece(cylinder(.24, .24, .26, 14), TOMATO, [6, .34, 1.2], [0, 0, Math.PI / 2]),
    piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[6, .58, 1.2], [5.7, .3, 1.45], [5.3, .015, 1.5], [4.6, .015, 1.1], [4.1, .015, .2]].map(([x, y, z]) => new THREE.Vector3(x, y, z))), 24, .02, 5), TOMATO),
    piece(cylinder(.2, .15, .32, 14), TOMATO, [6.05, .16, 3.4]),
    ...[[0, .55, 0, .2], [-.12, .45, .08, .14], [.12, .48, -.06, .15], [.02, .7, -.02, .12]].map(([x, y, z, radius]) => piece(ball(radius), LEAF, [6.05 + x, y, 3.4 + z])),
    // A big round rug in the open floor, and a rug under every bay.
    ...[[1.6, CREAM], [1.3, MUSTARD], [.9, TOMATO]].map(([radius, color], index) => piece(cylinder(radius, radius, .012 + index * .002, 32), color, [0, .006, 1.3])),
    ...content.projects.map((_, index) => piece(rounded(2.4, .012, 1.9, .006), pale(ACCENTS[index % ACCENTS.length]), [machineX(index) + .35, .006, BAY_Z + Math.floor(index / perRow) * ROW_GAP + .3])),
  ], group);
  if (lamps.length) solid(lamps.map((x) => piece(ball(.065), WHITE, [x, 2.5, -3.5])), group, [0, 0, 0], glow);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.055, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbSpots.length);
  bulbSpots.forEach((spot, index) => { place(bulbs, index, spot, [0, 0, 0], 1); bulbs.setColorAt(index, scratch.color.set(ACCENTS[index % ACCENTS.length])); });
  group.add(bulbs);
  const fan = solid([
    ...[0, 1, 2].map((blade) => piece(rounded(.05, .13, .006, 0), CREAM, [-Math.sin(blade * TAU / 3) * .075, Math.cos(blade * TAU / 3) * .075, 0], [0, 0, blade * TAU / 3])),
    piece(ball(.03), TOMATO),
  ], group, [.6, 1.22, -3.43]);

  const signTexture = paint(1024, 172, (context) => {
    context.fillStyle = '#2b2630';
    fitText(context, 'WORKSHOP', 512, 92, 900, 150, 128);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, .84), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false }));
  sign.position.set(0, 4.78, -3.74);
  group.add(sign);

  content.projects.forEach((project, index) => {
    const id = `project:${project.slug}`, accent = ACCENTS[index % ACCENTS.length], machine = MACHINES[project.slug] ?? { build: gizmo, lines: [] };
    const x = machineX(index), z = BAY_Z + Math.floor(index / perRow) * ROW_GAP;
    const bay = new THREE.Group();
    bay.name = bay.userData.station = id;
    group.add(bay);

    // The machine with its console; he stands in front of the console, so the machine shows beside him.
    const root = new THREE.Group();
    root.name = `${id}:machine`;
    root.position.set(x, 0, z);
    bay.add(root);
    const body = new THREE.Group();
    body.scale.setScalar(MACHINE_SCALE);
    root.add(body);
    const light = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
    const button = new THREE.Mesh(cylinder(.07, .075, .05, 16), light);
    button.position.set(CONSOLE.x - .05, .92, CONSOLE.z + .04);
    root.add(button);
    const lever = solid([piece(cylinder(.014, .014, .2, 6), STEEL, [0, .1, 0]), piece(ball(.04), TOMATO, [0, .2, 0])], root, [CONSOLE.x + .09, .9, CONSOLE.z - .07]);
    const parts: THREE.BufferGeometry[] = [];
    const animate = machine.build({
      root: body, parts, glow, laser,
      solid: (pieces, at, parent = body, material) => solid(pieces, parent, at, material),
      copies: (pieces, tints) => {
        const mesh = new THREE.InstancedMesh(mergeGeometries(pieces), toy, tints.length);
        pieces.forEach((part) => part.dispose());
        tints.forEach((tint, copy) => mesh.setColorAt(copy, scratch.color.set(tint)));
        body.add(mesh);
        return mesh;
      },
    });
    const enlarge = new THREE.Matrix4().makeScale(MACHINE_SCALE, MACHINE_SCALE, MACHINE_SCALE);
    solid([
      ...parts.map((part) => part.applyMatrix4(enlarge)),
      piece(cylinder(.17, .2, .06, 16), DARK, [CONSOLE.x, .03, CONSOLE.z]),
      piece(cylinder(.06, .08, .74, 10), STEEL, [CONSOLE.x, .43, CONSOLE.z]),
      piece(rounded(.34, .12, .3, .04), accent, [CONSOLE.x, .84, CONSOLE.z]),
      piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[CONSOLE.x - .05, .03, CONSOLE.z - .14], [.8, .02, .05], [.62, .05, -.05]].map(([px, py, pz]) => new THREE.Vector3(px, py, pz))), 10, .02, 5), INK),
    ], root);
    animate(0, 0, 0);

    // Its picture, floating above and behind: a titled card that paints the project image in once it loads.
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
    if (project.image) loader.load(project.image, (image) => {
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
      face.needsUpdate = true;
    }, undefined, () => {});
    const variety = index % LIFT.length;
    bays.push({
      id, accent, energy: 0, run: 0, progress: 0, animate, button, light, lever, picture,
      float: [x + CARD_X, CARD_Y + LIFT[variety], z - CARD_BACK + DEPTH[variety]], tilt: TILT[variety], phase: index * 1.7,
    });

    // He opens with the narrative's exhibit line, adds the machine's lines, then what it is built with.
    const source = `content/about-me/projects/${project.slug}.md` as const, tech = project.tech.map(({ name }) => name);
    const lines: CharacterLine[] = [
      ...(STATION_LINES[id] ?? [{ id: `project-${project.slug}-about`, line: project.description.replace(/([.!?])\s[\s\S]*$/, '$1'), source }]),
      ...machine.lines.map((line, number) => ({ id: `project-${project.slug}-${number + 1}`, line, source })),
      ...(tech.length ? [{ id: `project-${project.slug}-tech`, line: `Built with ${tech.length > 1 ? `${tech.slice(0, -1).join(', ')} and ${tech.at(-1)}` : tech[0]}.`, source }] : []),
    ];
    obstacles.push(
      ...[-1, 1].map((side) => ({ id: `${id}:machine`, x: x + side * MACHINE_HALF, z, radius: MACHINE_RADIUS })),
      { id: `${id}:console`, x: x + CONSOLE.x, z: z + CONSOLE.z, radius: .18 },
    );
    stations.push({
      id, kind: 'play', label: `${project.title} exhibit`, stand: { x: x + STAND.x, z: z + STAND.z }, heading: Math.atan2(CONSOLE.x - STAND.x, CONSOLE.z - STAND.z),
      reach: { x: x + CONSOLE.x, y: .95, z: z + CONSOLE.z },
      present: { lines, url: project.url || undefined, linkLabel: `Visit ${project.title}` },
    });
  });

  const update: WorldArea['update'] = (dt, elapsed, activity) => {
    for (const bay of bays) {
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
      bay.picture.scale.setScalar(1 + .1 * bay.energy);
    }
    bulbSpots.forEach((_, index) => bulbs.setColorAt(index, scratch.color.set(ACCENTS[index % ACCENTS.length]).multiplyScalar(.55 + .45 * (.5 + .5 * Math.sin(elapsed * 2.2 + index * 1.9)))));
    bulbs.instanceColor!.needsUpdate = true;
    fan.rotation.z = -elapsed * 9;
  };
  update(0, 0, { stationId: null, progress: 0 });
  group.updateMatrixWorld(true);

  return {
    id: 'workshop',
    group,
    bounds: { ...BOUNDS },
    obstacles,
    stations,
    // Front, left of the middle: clear of the speech bubble on wide screens and of the stations he presents at.
    entry: { x: -1.1, z: 3.25 },
    view: { center: { x: 0, y: 2.1, z: -.4 } },
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
      toy.dispose(); glow.dispose(); laser.dispose();
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) {
          if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
          material.dispose();
        }
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
    },
  };
};

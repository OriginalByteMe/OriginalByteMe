import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STATION_LINES, type CharacterLine } from '@/lib/character/narrative';
import type { AreaBuilder, Obstacle, Station, WorldArea } from './types';

type V3 = [number, number, number];
/** Animates one station's machine from the clock, its 0..1 energy and the presentation's progress. */
type Animate = (time: number, energy: number, progress: number, dt: number, active: boolean) => void;
/** Builds a fun fact's machine on `stage` (its plinth top, y = 0, scaled up): static parts into `parts`, moving ones through `solid`. */
type Machine = (stage: THREE.Group, parts: THREE.BufferGeometry[], solid: (parts: THREE.BufferGeometry[], at: V3) => THREE.Mesh) => Animate;
type Label = { parent: THREE.Object3D; size: [number, number]; at: V3; draw: (context: CanvasRenderingContext2D, width: number, height: number) => void };

// A Peranakan shophouse in Kuala Lumpur colours: jade walls, encaustic tiles, cobalt and hot pink, a mustard timeline.
const TEAL = 0x0e968c, JADE = 0x0a6a66, PINK = 0xf2457f, BLUSH = 0xffb7cb, COBALT = 0x2a4fc4, SKY = 0xa6e1ff, MUSTARD = 0xffb81f, TANGERINE = 0xff6a2b;
const CREAM = 0xfff2d8, INK = 0x24203d, LEAF = 0x2e9e4a, FERN = 0x1c6f37, RED = 0xe62e3d, GOLD = 0xe3a43a, CLAY = 0xc8603a, VIOLET = 0x7a4ee0, STEEL = 0xd9dcea;
const ACCENTS = [PINK, COBALT, TANGERINE, VIOLET, TEAL];
const BULBS = [PINK, MUSTARD, SKY, TANGERINE, 0x8cf2b0, 0xc9a2ff];
const CAREER = 'content/about-me/career.md', FUN = 'content/about-me/fun-facts.md';
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const WHITE = new THREE.Color(0xffffff);
const WALL_Z = -3.9; // back wall front face
const WALL_TOP = 4.8;
const SIDE_X = -6.5; // left wall inner face
const BOUNDS = { minX: -6.2, maxX: 6.2, minZ: -3.4, maxZ: 3.6 };
const IMAGE = { width: 2.3 * 1408 / 1926, height: 2.3 }; // /hero.png aspect
const BORDER = .2;
const FRAME = { width: IMAGE.width + 2 * BORDER, height: IMAGE.height + 2 * BORDER, bottom: 1.5 };
const NAIL_Y = FRAME.bottom + FRAME.height + .2;
/** The career timeline: a mustard runner across the front of the room, one signpost per job behind it, oldest on the left; out front its cards sit below the back of the room on screen, so they hide neither the fun facts nor him at them. */
const RUNNER = { z: 2.4, half: 5 }, POST_Z = 1.7, CARD_Y = 1.9, STOP_SPAN = 3.8, PLANK = { width: 1.3, height: .6, y: 1 };
const MONSTERA = { x: -5.75, z: 3.2 }, LAMP = { x: 5.85, z: 3.25 };
/** The skyline model sits on a round table, built small and scaled up so its parts stay readable from the street. */
const SKYLINE = { x: 2.9, z: -2.55, top: .86, radius: 1.02, scale: 1.3 };
/** Fun-fact pedestals along the back left, tall enough that their machines show above the career cards; the corner holds three. */
const FACT = { z: -2.95, top: 1.2, first: -5.75, room: 3.5, most: 3, scale: 1.45 };
/** Euler order YXZ: a part tips about its own x before it turns about y, so leaves and fronds point outward. */
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(0, 0, 0, 'YXZ'), scale: new THREE.Vector3(), color: new THREE.Color() };

const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, radius);
const cylinder = (top: number, bottom: number, height: number, segments = 14) => new THREE.CylinderGeometry(top, bottom, height, segments);
const ball = (radius: number) => new THREE.SphereGeometry(radius, 10, 6);
const smooth = (value: number) => THREE.MathUtils.smoothstep(value, 0, 1);

/** Bakes transform and a flat vertex colour so static and rigid parts merge into one draw call with a shared vertex-coloured material. */
function piece(source: THREE.BufferGeometry, color: THREE.ColorRepresentation, at: V3 = [0, 0, 0], turn: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  const { matrix, position, rotation, euler } = scratch;
  geometry.applyMatrix4(matrix.compose(position.set(...at), rotation.setFromEuler(euler.set(...turn)), scratch.scale.set(...scale)));
  const tint = new THREE.Color(color), count = geometry.attributes.position.count, colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) tint.toArray(colors, index * 3);
  return geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** One encaustic tile: a square, an inset diamond and a dot, each lifted a step along `lift` so they never fight for depth. */
function tile(parts: THREE.BufferGeometry[], size: number, at: V3, turn: V3, lift: V3, [base, diamond, dot]: number[]) {
  const layer = (step: number): V3 => [at[0] + lift[0] * step, at[1] + lift[1] * step, at[2] + lift[2] * step];
  parts.push(
    piece(new THREE.PlaneGeometry(size * .94, size * .94), base, layer(0), turn),
    piece(new THREE.CircleGeometry(size * .4, 4), diamond, layer(1), turn),
    piece(new THREE.CircleGeometry(size * .1, 8), dot, layer(2), turn),
  );
}

/** Shrinks, wrapping on spaces, until every line fits the box; lines are centred on (x, y). */
function fitText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, size: number, weight = 700) {
  let lines: string[] = [];
  for (;; size -= 2) {
    context.font = `${weight} ${size}px ${FONT}`;
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

/** Spoken period, e.g. "2026 - Present" → "2026 to now". */
const spokenPeriod = (period: string) => period.replace(/\s*[-–]\s*/, ' to ').replace(/present/i, 'now');
const sentence = (text: string) => /[.!?]$/.test(text) ? text : `${text}.`;
/** "Supa (formerly Supahands)" → "Supa". */
const shortName = (company: string) => company.replace(/\s*\(.*\)\s*/, '').trim() || company;

/** A mini FDM printer: the vase on its bed is printed again, layer by layer, while he presents it. */
const printer: Machine = (stage, parts, solid) => {
  const bed = .08, height = .3;
  parts.push(
    piece(rounded(.56, .05, .46, .02), TANGERINE, [0, .025, 0]),
    ...[-1, 1].map((side) => piece(rounded(.045, .68, .045, .015), INK, [side * .25, .37, -.17])),
    piece(rounded(.58, .06, .07, .02), INK, [0, .7, -.17]),
    piece(rounded(.4, .03, .34, .01), TEAL, [0, bed - .015, .02]),
    piece(cylinder(.012, .012, .16, 6), INK, [.18, .79, -.17], [Math.PI / 2, 0, 0]),
  );
  const vase = new THREE.LatheGeometry([[0, 0], [.07, 0], [.095, .06], [.1, .12], [.072, .2], [.058, .24], [.075, .29], [.08, height], [0, height]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
  const print = solid([piece(vase, PINK)], [0, bed, .02]);
  const head = solid([piece(rounded(.12, .08, .1, .02), MUSTARD, [0, .07, 0]), piece(new THREE.ConeGeometry(.025, .05, 8), INK, [0, .015, 0], [Math.PI, 0, 0])], [0, 0, 0]);
  const spool = solid([
    piece(new THREE.TorusGeometry(.075, .03, 6, 18), PINK),
    piece(cylinder(.05, .05, .04, 12), CREAM, [0, 0, 0], [Math.PI / 2, 0, 0]),
    piece(rounded(.15, .02, .02, .005), INK),
  ], [.18, .79, -.12]);
  return (time, energy, progress) => {
    // Ambient: the finished vase, the head parked. Presenting: it prints again from the first layer.
    const level = THREE.MathUtils.lerp(1, .04 + .96 * smooth(progress / .85), energy);
    print.scale.y = level;
    const angle = time * 5;
    head.position.set(THREE.MathUtils.lerp(-.17, .11 * Math.cos(angle), energy), bed + height * level + .01, THREE.MathUtils.lerp(-.1, .02 + .11 * Math.sin(angle), energy));
    spool.rotation.z = -level * Math.PI * 4;
  };
};

/** A home server under its own little cloud: presenting, the cloud comes down to live in the rack and the lights race. */
const server: Machine = (stage, parts, solid) => {
  const units = [0, 1, 2, 3].map((index) => .14 + index * .13);
  parts.push(
    piece(rounded(.38, .6, .34, .04), COBALT, [0, .3, 0]),
    ...units.map((y) => piece(rounded(.31, .1, .02, .01), INK, [0, y, .17])),
    ...[-1, 1].map((side) => piece(rounded(.06, .03, .3, .01), STEEL, [side * .14, .015, 0])),
  );
  const leds = new THREE.InstancedMesh(rounded(.035, .035, .02, .008), new THREE.MeshBasicMaterial({ toneMapped: false }), units.length * 3);
  units.forEach((y, unit) => [0, 1, 2].forEach((column) => leds.setMatrixAt(unit * 3 + column, scratch.matrix.makeTranslation(.04 + column * .045, y, .185))));
  stage.add(leds);
  const cloud = solid([piece(ball(.13), CREAM, [-.14, 0, 0]), piece(ball(.18), CREAM, [0, .07, 0]), piece(ball(.14), CREAM, [.15, .01, 0]), piece(ball(.11), CREAM, [.04, -.05, .08])], [0, 0, 0]);
  const idle = new THREE.Color(0x46e08a), dark = new THREE.Color(0x2b2f52), race = new THREE.Color(TANGERINE);
  return (time, energy, progress) => {
    const home = energy * smooth(progress / .6);
    cloud.position.set(.04 * Math.sin(time * .9), 1 + .04 * Math.sin(time * 1.4) - .26 * home, 0);
    cloud.scale.setScalar(1 - .2 * home);
    for (let index = 0; index < leds.count; index++) {
      const blink = Math.sin(time * 1.7 + index * 2.3) > .2 ? idle : dark;
      const chase = ((Math.floor(time * 14) - index) % leds.count + leds.count) % leds.count;
      leds.setColorAt(index, scratch.color.copy(blink).lerp(chase < 3 ? race : dark, energy));
    }
    if (leds.instanceColor) leds.instanceColor.needsUpdate = true;
  };
};

/** Any other fun fact: a big bulb that lights up with rays. */
const bulb: Machine = (stage, parts, solid) => {
  parts.push(piece(cylinder(.1, .12, .08), INK, [0, .04, 0]), piece(cylinder(.07, .08, .14), STEEL, [0, .15, 0]));
  const glass = solid([piece(ball(.19), 0xfff0a0, [0, .2, 0]), piece(cylinder(.08, .1, .1), 0xfff0a0, [0, .04, 0])], [0, .2, 0]);
  const rays = solid(Array.from({ length: 8 }, (_, index) => piece(rounded(.03, .14, .02, .01), MUSTARD, [Math.sin(index * Math.PI / 4) * .32, Math.cos(index * Math.PI / 4) * .32, 0], [0, 0, -index * Math.PI / 4])), [0, .4, 0]);
  return (time, energy) => {
    glass.scale.setScalar(1 + .08 * energy * Math.sin(time * 6));
    rays.scale.setScalar(Math.max(.001, energy));
    rays.rotation.z = time * 1.2;
  };
};

const FACT_THEMES: { match: RegExp; label: string; lines: string[]; machine: Machine }[] = [
  { match: /3d print|\bcad\b/i, label: '3D printer fun fact', lines: ["Fun fact: I'm into 3D printing and CAD!", 'FDM printing, with high-end materials.'], machine: printer },
  { match: /self-host|proxmox|unraid/i, label: 'Home server fun fact', lines: ['Fun fact: I self-host on Proxmox and Unraid!'], machine: server },
];

/** Gallery lot (#about, "About me and where I've been"): a Peranakan shophouse gallery with Noah's portrait, a walkable career timeline, fun-fact machines and a Kuala Lumpur skyline model. */
export const createAbout: AreaBuilder = (origin, content) => {
  const group = new THREE.Group();
  group.name = 'gallery';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const painted: THREE.Texture[] = [], loaded: THREE.Texture[] = [];
  let disposed = false;
  const solid = (parts: THREE.BufferGeometry[], parent: THREE.Object3D, at: V3 = [0, 0, 0], material: THREE.Material = toy) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts), material);
    parts.forEach((part) => part.dispose());
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  const station = (id: string, x = 0, z = 0) => {
    const root = new THREE.Group();
    root.userData.station = id; root.position.set(x, 0, z); group.add(root);
    return root;
  };
  const labels: Label[] = [];
  const label = (parent: THREE.Object3D, size: [number, number], at: V3, draw: Label['draw']) => { labels.push({ parent, size, at, draw }); };
  const loader = new THREE.TextureLoader();
  const load = (url: string, onLoad: (texture: THREE.Texture) => void) => {
    const texture = loader.load(url, (done) => { if (disposed) done.dispose(); else onLoad(done); }, undefined, () => {});
    texture.colorSpace = THREE.SRGBColorSpace; loaded.push(texture);
  };
  const obstacles: Obstacle[] = [];
  const stations: Station[] = [];
  const reactives: { id: string; energy: number; animate: Animate }[] = [];
  const room: THREE.BufferGeometry[] = [], lit: THREE.BufferGeometry[] = [];

  // Floor: a cobalt slab under encaustic tiles, a star medallion in the middle.
  room.push(piece(rounded(13.6, .5, 8.4, .18), COBALT, [0, -.25, 0]), piece(rounded(13.2, .4, 8, .18), JADE, [0, -.66, 0]));
  for (let column = 0; column < 16; column++) {
    for (let row = 0; row < 10; row++) {
      const odd = (column + row) % 2;
      tile(room, .8, [-6 + column * .8, .01, -3.5 + row * .8], [-Math.PI / 2, 0, 0], [0, .01, 0], [odd ? BLUSH : CREAM, odd ? 0x6fd0c3 : 0xff97b8, MUSTARD]);
    }
  }
  for (let column = 0; column <= 16; column++) for (let row = 0; row <= 10; row++) room.push(piece(new THREE.CircleGeometry(.07, 4), TANGERINE, [-6.4 + column * .8, .02, -3.9 + row * .8], [-Math.PI / 2, 0, 0]));
  room.push(
    piece(new THREE.CircleGeometry(1.15, 32), TEAL, [0, .04, -.6], [-Math.PI / 2, 0, 0]),
    piece(new THREE.RingGeometry(.95, 1.05, 32), MUSTARD, [0, .05, -.6], [-Math.PI / 2, 0, 0]),
    ...[0, Math.PI / 4].map((spin) => piece(new THREE.CircleGeometry(.8, 4), PINK, [0, .06, -.6], [-Math.PI / 2, 0, spin])),
    piece(new THREE.CircleGeometry(.2, 16), CREAM, [0, .07, -.6], [-Math.PI / 2, 0, 0]),
  );

  // Back wall: jade above a tiled wainscot, a mustard lattice, a scalloped cornice and a pediment with the sign.
  room.push(
    piece(rounded(13.6, WALL_TOP, .3, .06), TEAL, [0, WALL_TOP / 2, WALL_Z - .15]),
    piece(rounded(13.3, 1.1, .06, .02), CREAM, [.15, .7, WALL_Z + .03]),
    piece(rounded(13.3, .1, .14, .03), MUSTARD, [.15, 1.3, WALL_Z + .07]),
    piece(rounded(13.3, .16, .1, .03), JADE, [.15, .08, WALL_Z + .05]),
    piece(rounded(13.8, .24, .46, .05), PINK, [0, WALL_TOP - .02, WALL_Z - .02]),
    piece(rounded(4.6, .5, .3, .05), PINK, [0, WALL_TOP + .23, WALL_Z - .05]),
    piece(new THREE.CircleGeometry(.55, 20, 0, Math.PI), PINK, [0, WALL_TOP + .45, WALL_Z + .105], [0, 0, 0], [4, 1, 1]),
    piece(rounded(3.34, .7, .04, .05), GOLD, [0, WALL_TOP + .46, WALL_Z + .13]),
    piece(rounded(3.2, .56, .06, .04), COBALT, [0, WALL_TOP + .46, WALL_Z + .15]),
    ...[-1, 1].map((side) => piece(ball(.13), MUSTARD, [side * 2.25, WALL_TOP + .6, WALL_Z - .05])),
    piece(rounded(.36, WALL_TOP, .36, .06), JADE, [6.62, WALL_TOP / 2, WALL_Z - .05]),
  );
  for (let index = 0; index < 26; index++) {
    for (const [row, y] of [.45, .95].entries()) tile(room, .48, [-6.25 + index * .5, y, WALL_Z + .07], [0, 0, 0], [0, 0, .008], [(index + row) % 2 ? SKY : BLUSH, [COBALT, PINK, TEAL][(index + row) % 3], MUSTARD]);
  }
  for (let x = -6.6; x <= 6.61; x += .3) room.push(piece(new THREE.CircleGeometry(.15, 8, Math.PI, Math.PI), CREAM, [x, WALL_TOP - .14, WALL_Z + .215]));
  for (let row = 0; row < 6; row++) {
    for (let x = -6.2 + (row % 2) * .275; x < 6.5; x += .55) {
      const y = 1.75 + row * .55;
      if (Math.abs(x) < 1.4 || (Math.abs(Math.abs(x) - 3.95) < .85 && y < 4.5)) continue;
      room.push(piece(new THREE.CircleGeometry(.08, 4), MUSTARD, [x, y, WALL_Z + .01]));
    }
  }
  label(group, [3, .5], [0, WALL_TOP + .46, WALL_Z + .19], (context, width, height) => {
    context.fillStyle = '#fff2d8'; fitText(context, 'ABOUT ME', width / 2, height / 2, width * .92, height * .9, height * .8, 800);
  });

  // Arched shuttered windows either side of the portrait, flower boxes under them.
  for (const side of [-1, 1]) {
    const x = side * 3.95, y = 2.6, swing = .85;
    room.push(
      piece(rounded(1.5, 2, .1, .04), COBALT, [x, y, WALL_Z + .05]),
      piece(new THREE.CircleGeometry(.75, 20, 0, Math.PI), COBALT, [x, y + 1, WALL_Z + .101]),
      piece(rounded(.06, 2.5, .05, .02), CREAM, [x, y + .25, WALL_Z + .14]),
      piece(rounded(1.3, .06, .05, .02), CREAM, [x, y + .88, WALL_Z + .14]),
      piece(rounded(1.7, .12, .3, .03), CREAM, [x, y - 1.06, WALL_Z + .15]),
      piece(rounded(1.5, .26, .3, .05), side < 0 ? TANGERINE : VIOLET, [x, y - 1.28, WALL_Z + .2]),
      ...Array.from({ length: 7 }, (_, index) => piece(ball(.09), index % 2 ? LEAF : [RED, PINK, MUSTARD, BLUSH][index % 4], [x - .6 + index * .2, y - 1.1 + (index % 2) * .03, WALL_Z + .22 + (index % 3) * .04])),
    );
    lit.push(
      piece(new THREE.PlaneGeometry(1.26, 1.76), SKY, [x, y, WALL_Z + .11]),
      piece(new THREE.CircleGeometry(.6, 20, 0, Math.PI), SKY, [x, y + .88, WALL_Z + .115]),
    );
    for (const hinge of [-1, 1]) {
      const turn: V3 = [0, -hinge * swing, 0], across = hinge * Math.cos(swing), out = Math.sin(swing);
      const cx = x + hinge * .75 + across * .32, cz = WALL_Z + .1 + out * .32, nx = -hinge * Math.sin(swing) * .035, nz = Math.cos(swing) * .035;
      room.push(piece(rounded(.62, 1.9, .05, .02), JADE, [cx, y, cz], turn));
      for (let slat = 0; slat < 7; slat++) room.push(piece(rounded(.5, .05, .03, .01), MUSTARD, [cx + nx, y - .75 + slat * .25, cz + nz], turn));
    }
  }

  // Left wall: blush with pink stripes and the same tiled wainscot.
  room.push(piece(rounded(.3, WALL_TOP, 5.2, .06), BLUSH, [SIDE_X - .15, WALL_TOP / 2, -1.6]), piece(rounded(.46, .24, 5.3, .05), PINK, [SIDE_X - .13, WALL_TOP - .02, -1.6]));
  for (let z = -3.7; z < .9; z += .45) room.push(piece(new THREE.PlaneGeometry(.18, WALL_TOP - 1.6), PINK, [SIDE_X + .005, 1.35 + (WALL_TOP - 1.6) / 2, z], [0, Math.PI / 2, 0]));
  for (let index = 0; index < 10; index++) {
    for (const [row, y] of [.45, .95].entries()) tile(room, .48, [SIDE_X + .01, y, -3.65 + index * .5], [0, Math.PI / 2, 0], [.008, 0, 0], [(index + row) % 2 ? CREAM : SKY, [PINK, COBALT][(index + row) % 2], TANGERINE]);
  }
  room.push(piece(rounded(.1, .1, 4.9, .03), MUSTARD, [SIDE_X + .05, 1.3, -1.6]));

  // Front corner posts with lantern arms; string lights swagged along the cornice either side of the pediment.
  for (const side of [-1, 1]) {
    room.push(
      piece(rounded(.36, 4.1, .36, .06), JADE, [side * 6.6, 2.05, 3.9]),
      piece(rounded(.48, .12, .48, .04), MUSTARD, [side * 6.6, 4.16, 3.9]),
      piece(ball(.2), PINK, [side * 6.6, 4.4, 3.9]),
      piece(rounded(.62, .07, .07, .02), INK, [side * 6.3, 3.75, 3.9]),
    );
  }
  const swags = [[-6.3, -4.6], [-4.6, -2.7], [2.7, 4.6], [4.6, 6.3]], perSwag = 7;
  const bulbs = new THREE.InstancedMesh(ball(.055), new THREE.MeshBasicMaterial({ toneMapped: false }), swags.length * perSwag);
  const sag = (from: number, to: number, t: number): V3 => [from + (to - from) * t, 4.6 - .32 * 4 * t * (1 - t), WALL_Z + .3];
  swags.forEach(([from, to], index) => {
    room.push(piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, step) => new THREE.Vector3(...sag(from, to, step / 8)))), 16, .012, 4), INK));
    for (let bulb = 0; bulb < perSwag; bulb++) {
      const [x, y, z] = sag(from, to, (bulb + .5) / perSwag);
      bulbs.setMatrixAt(index * perSwag + bulb, scratch.matrix.makeTranslation(x, y - .06, z));
    }
  });
  group.add(bulbs);
  const lanterns = [-1, 1].map((side) => solid([
    piece(cylinder(.008, .008, .3, 5), INK, [0, -.15, 0]),
    piece(cylinder(.11, .11, .06, 12), GOLD, [0, -.32, 0]),
    piece(new THREE.SphereGeometry(.27, 14, 10), RED, [0, -.58, 0], [0, 0, 0], [1, .85, 1]),
    piece(cylinder(.11, .11, .06, 12), GOLD, [0, -.84, 0]),
    piece(cylinder(.02, .045, .26, 6), MUSTARD, [0, -1, 0]),
  ], group, [side * 6.02, 3.72, 3.9], glow));

  // Plants: a monstera at the front left, an areca palm in the back right corner, and a floor lamp at the front right.
  room.push(
    piece(cylinder(.4, .3, .55, 18), CLAY, [MONSTERA.x, .275, MONSTERA.z]),
    piece(new THREE.TorusGeometry(.4, .04, 6, 24), TANGERINE, [MONSTERA.x, .55, MONSTERA.z], [Math.PI / 2, 0, 0]),
    piece(cylinder(.36, .36, .02, 18), 0x4a2f22, [MONSTERA.x, .54, MONSTERA.z]),
    piece(cylinder(.32, .26, .5, 16), COBALT, [5.7, .25, -3.2]),
    ...[.15, .35].map((y) => piece(new THREE.TorusGeometry(.3, .025, 6, 20), MUSTARD, [5.7, y, -3.2], [Math.PI / 2, 0, 0])),
    piece(cylinder(.22, .25, .05, 16), INK, [LAMP.x, .025, LAMP.z]),
    piece(cylinder(.03, .03, 1.75, 8), INK, [LAMP.x, .9, LAMP.z]),
  );
  lit.push(piece(cylinder(.2, .3, .34, 16), 0xffe2a0, [LAMP.x, 1.9, LAMP.z]));
  const monstera = solid(Array.from({ length: 7 }, (_, index) => {
    const around = index * 2.4, out = .18 + (index % 3) * .08, lift = .55 + (index % 3) * .3;
    return piece(ball(1), index % 2 ? LEAF : FERN, [Math.sin(around) * out, lift, Math.cos(around) * out], [-.45, around, 0], [.32, .03, .4]);
  }).concat(Array.from({ length: 7 }, (_, index) => piece(cylinder(.012, .012, .55 + (index % 3) * .3, 5), FERN, [Math.sin(index * 2.4) * .08, (.55 + (index % 3) * .3) / 2, Math.cos(index * 2.4) * .08]))), group, [MONSTERA.x, .55, MONSTERA.z]);
  const stems = [-.12, 0, .12].map((lean, index) => ({ lean, height: 1.5 + index * .2 }));
  const palm = solid([
    ...stems.map(({ lean, height }) => piece(cylinder(.025, .03, height, 6), 0x7a5a3a, [Math.sin(lean) * height / 2, Math.cos(lean) * height / 2, 0], [0, 0, -lean])),
    ...Array.from({ length: 15 }, (_, index) => {
      const { lean, height } = stems[index % 3], around = index * 1.3;
      return piece(ball(1), index % 2 ? LEAF : FERN, [Math.sin(lean) * height + Math.sin(around) * .3, Math.cos(lean) * height - .05, Math.cos(around) * .3], [.6, around, 0], [.06, .02, .42]);
    }),
  ], group, [5.7, .5, -3.2]);
  obstacles.push({ id: 'monstera', ...MONSTERA, radius: .5 }, { id: 'palm', x: 5.7, z: -3.2, radius: .4 }, { id: 'lamp', ...LAMP, radius: .3 });

  // Portrait: a gold frame hanging from a nail, a picture light on top; the pivot sits at the nail so a tilt swings like a real picture.
  const portrait = station('portrait');
  solid([piece(ball(.045), GOLD, [0, NAIL_Y, WALL_Z + .04])], portrait);
  const pivot = new THREE.Group(); pivot.position.set(0, NAIL_Y, WALL_Z); portrait.add(pivot);
  const centerY = FRAME.bottom + FRAME.height / 2 - NAIL_Y, frameTop = centerY + FRAME.height / 2;
  solid([
    piece(rounded(FRAME.width, FRAME.height, .08, .03), INK, [0, centerY, .06]),
    ...[-1, 1].flatMap((side) => {
      const corner = new THREE.Vector2(side * FRAME.width * .3, frameTop);
      return [
        piece(rounded(FRAME.width, BORDER, .16, .04), GOLD, [0, centerY + side * (FRAME.height - BORDER) / 2, .1]),
        piece(rounded(BORDER, FRAME.height - 2 * BORDER, .16, .04), GOLD, [side * (FRAME.width - BORDER) / 2, centerY, .1]),
        piece(rounded(IMAGE.width + .06, .04, .05, .01), PINK, [0, centerY + side * (IMAGE.height + .04) / 2, .14]),
        piece(rounded(.04, IMAGE.height + .06, .05, .01), PINK, [side * (IMAGE.width + .04) / 2, centerY, .14]),
        ...[-1, 1].map((end) => piece(ball(.07), TANGERINE, [side * (FRAME.width - BORDER) / 2, centerY + end * (FRAME.height - BORDER) / 2, .19])),
        piece(cylinder(.008, .008, corner.length(), 5), INK, [corner.x / 2, corner.y / 2, .03], [0, 0, Math.atan2(-corner.x, corner.y)]),
      ];
    }),
    piece(cylinder(.018, .018, .32, 6), GOLD, [0, frameTop + .06, .3], [Math.PI / 2 - .3, 0, 0]),
    piece(rounded(1, .08, .16, .03), GOLD, [0, frameTop + .12, .44]),
  ], pivot);
  const pictureLight = new THREE.Mesh(new THREE.PlaneGeometry(.88, .07), new THREE.MeshBasicMaterial({ color: 0xfff1c4, toneMapped: false }));
  pictureLight.position.set(0, frameTop + .04, .47); pictureLight.rotation.x = Math.PI / 4; pivot.add(pictureLight);
  const placeholder = paint(128, 176, (context) => {
    const wash = context.createLinearGradient(0, 0, 0, 176);
    wash.addColorStop(0, '#bfeee8'); wash.addColorStop(1, '#ffd3df');
    context.fillStyle = wash; context.fillRect(0, 0, 128, 176);
    context.fillStyle = 'rgba(14,150,140,0.28)';
    context.beginPath(); context.arc(64, 70, 38, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.ellipse(64, 176, 50, 46, 0, 0, Math.PI * 2); context.fill();
  });
  painted.push(placeholder);
  const image = new THREE.Mesh(new THREE.PlaneGeometry(IMAGE.width, IMAGE.height), new THREE.MeshBasicMaterial({ map: placeholder, toneMapped: false }));
  image.position.set(0, centerY, .11); pivot.add(image);
  load('/hero.png', (texture) => { image.material.map = texture; image.material.needsUpdate = true; });
  const sparkleSpots: V3[] = [[1.3, 3.95, WALL_Z + .4], [1.5, 3.5, WALL_Z + .45], [-1.35, 3.75, WALL_Z + .4], [-1.2, 4.15, WALL_Z + .35]];
  const sparkles = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.08), new THREE.MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }), sparkleSpots.length);
  sparkles.visible = false; portrait.add(sparkles);
  let tilt = 0, swing = 0;
  reactives.push({ id: 'portrait', energy: 0, animate: (time, energy, progress, dt, active) => {
    // Damped pendulum: he knocks the frame crooked for the first part of the visit, then it swings back straight.
    const step = Math.min(dt, .05), target = active && progress < .45 ? .16 : 0;
    swing += (-40 * (tilt - target) - 2.3 * swing) * step; tilt += swing * step;
    pivot.rotation.z = tilt;
    sparkles.visible = energy > 0;
    if (!sparkles.visible) return;
    const { matrix, position, rotation, euler } = scratch;
    sparkleSpots.forEach((spot, index) => sparkles.setMatrixAt(index, matrix.compose(position.set(...spot), rotation.setFromEuler(euler.set(0, time * 2 + index, 0)), scratch.scale.setScalar(energy * (.4 + .6 * Math.abs(Math.sin(time * 4 + index * 2.1)))))));
    sparkles.instanceMatrix.needsUpdate = true;
  } });
  const portraitReach = { x: (FRAME.width - BORDER) / 2, y: FRAME.bottom + BORDER / 2, z: WALL_Z + .18 }, portraitStand = { x: 1.45, z: -3.05 };
  stations.push({ id: 'portrait', kind: 'admire', label: "Noah's portrait", stand: portraitStand, heading: Math.atan2(portraitReach.x - portraitStand.x, portraitReach.z - portraitStand.z), reach: portraitReach });

  // Kuala Lumpur skyline on a round table: Petronas Twin Towers with their skybridge, KL Tower, blocks, the river and an LRT loop, built at model scale.
  const skyline = station('skyline', SKYLINE.x, SKYLINE.z);
  solid([
    piece(cylinder(SKYLINE.radius, SKYLINE.radius, .06, 32), CREAM, [0, SKYLINE.top - .03, 0]),
    piece(new THREE.TorusGeometry(SKYLINE.radius, .03, 6, 40), PINK, [0, SKYLINE.top - .03, 0], [Math.PI / 2, 0, 0]),
    piece(cylinder(.08, .12, SKYLINE.top - .06), JADE, [0, (SKYLINE.top - .06) / 2, 0]),
    piece(cylinder(.45, .5, .05, 24), JADE, [0, .025, 0]),
  ], skyline);
  const model = new THREE.Group(); model.position.y = SKYLINE.top; model.scale.setScalar(SKYLINE.scale); skyline.add(model);
  const ground = .03;
  const city: THREE.BufferGeometry[] = [
    piece(cylinder(.76, .76, .03, 32), 0x7fd08c, [0, .015, 0]),
    piece(rounded(1.12, .012, .1, .005), 0x4fb7f0, [0, ground + .006, .2], [0, -.2, 0]),
    piece(new THREE.TorusGeometry(.66, .016, 4, 48), INK, [0, ground + .03, 0], [Math.PI / 2, 0, 0]),
  ];
  const plaque = new THREE.Group(); plaque.position.set(0, ground + .09, .73); plaque.rotation.x = -.35; model.add(plaque);
  solid([piece(rounded(.56, .14, .03, .015), INK)], plaque);
  label(plaque, [.52, .11], [0, 0, .022], (context, width, height) => {
    context.fillStyle = '#fff2d8'; fitText(context, content.location.split(',')[0].toUpperCase(), width / 2, height / 2, width * .9, height * .8, height * .7, 800);
  });
  const windows: THREE.BufferGeometry[] = [];
  const towerTops: V3[] = [];
  for (const side of [-1, 1]) {
    const x = -.1 + side * .15, z = -.2;
    let y = ground;
    for (const [index, [radius, height]] of [[.1, .3], [.093, .22], [.084, .17], [.074, .13], [.06, .1], [.045, .07]].entries()) {
      city.push(piece(new THREE.CylinderGeometry(radius, radius, height, 8), STEEL, [x, y + height / 2, z]));
      windows.push(piece(new THREE.CylinderGeometry(radius + .004, radius + .004, .03, 8), index % 2 ? SKY : 0xfff1c9, [x, y + height / 2, z]));
      y += height;
    }
    city.push(piece(new THREE.ConeGeometry(.02, .26, 6), STEEL, [x, y + .13, z]));
    towerTops.push([x, y + .02, z]);
  }
  city.push(piece(rounded(.16, .03, .035, .01), STEEL, [-.1, ground + .46, -.2]));
  city.push(
    piece(cylinder(.05, .065, .08, 10), STEEL, [.4, ground + .04, .05]),
    piece(cylinder(.02, .03, .72, 10), STEEL, [.4, ground + .42, .05]),
    piece(new THREE.SphereGeometry(.075, 12, 8), PINK, [.4, ground + .76, .05], [0, 0, 0], [1, .7, 1]),
    piece(cylinder(.007, .007, .26, 5), STEEL, [.4, ground + .93, .05]),
  );
  windows.push(piece(cylinder(.079, .079, .018, 12), 0xfff1c9, [.4, ground + .76, .05]));
  for (const [index, [x, z, width, height, color]] of ([
    [-.45, .1, .2, .3, PINK], [-.32, -.34, .16, .42, MUSTARD], [.1, -.42, .22, .26, COBALT], [.36, -.28, .16, .36, TANGERINE], [.15, .32, .18, .18, VIOLET], [-.2, .38, .2, .14, TEAL],
  ] as const).entries()) {
    city.push(piece(rounded(width, height, width, .015), color, [x, ground + height / 2, z]));
    for (let floor = 0; .07 + floor * .08 < height - .03; floor++) windows.push(piece(new THREE.PlaneGeometry(width * .7, .025), (index + floor) % 2 ? SKY : 0xfff1c9, [x, ground + .07 + floor * .08, z + width / 2 + .008]));
  }
  for (const [x, z] of [[.48, .3], [-.05, .52], [.3, .48], [-.52, -.12], [.55, -.05]]) city.push(piece(cylinder(.008, .008, .06, 4), 0x7a5a3a, [x, ground + .03, z]), piece(ball(.045), LEAF, [x, ground + .08, z]));
  solid(city, model);
  const windowGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  solid(windows, model, [0, 0, 0], windowGlow);
  const loop = new THREE.Group(); loop.position.set(0, ground + .07, 0); model.add(loop);
  solid([0, 1, 2].flatMap((car) => {
    const angle = -car * .21, at: V3 = [Math.cos(angle) * .66, 0, -Math.sin(angle) * .66], turn: V3 = [0, angle + Math.PI / 2, 0];
    return [piece(rounded(.13, .07, .07, .02), CREAM, at, turn), piece(rounded(.135, .02, .075, .005), TEAL, at, turn)];
  }), loop);
  const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beamShape = new THREE.ConeGeometry(.16, 1.5, 14, 1, true).rotateX(Math.PI).translate(0, .75, 0);
  const beams = towerTops.map((top, index) => {
    const sweep = new THREE.Group(); sweep.position.set(...top); model.add(sweep);
    const beam = new THREE.Mesh(beamShape, beamMaterial);
    beam.rotation.z = (index ? -1 : 1) * .45; beam.visible = false; sweep.add(beam);
    return beam;
  });
  reactives.push({ id: 'skyline', energy: 0, animate: (time, energy) => {
    windowGlow.color.setScalar(.72 + .06 * Math.sin(time * .8) + .28 * energy * (.5 + .5 * Math.sin(time * 9)));
    beamMaterial.opacity = .3 * energy;
    beams.forEach((beam, index) => { beam.visible = energy > 0; beam.parent!.rotation.y = Math.sin(time * 1.3 + index * 2) * 1.1; });
  } });
  obstacles.push({ id: 'skyline-table', x: SKYLINE.x, z: SKYLINE.z, radius: SKYLINE.radius + .05 });
  const skylineStand = { x: SKYLINE.x - 1.35, z: SKYLINE.z + .5 };
  const skylineReach = { x: SKYLINE.x - .55 * SKYLINE.scale, y: SKYLINE.top + ground * SKYLINE.scale, z: SKYLINE.z + .3 * SKYLINE.scale };
  stations.push({
    id: 'skyline', kind: 'watch', label: `Skyline model of ${content.location}`, stand: skylineStand, heading: Math.atan2(skylineReach.x - skylineStand.x, skylineReach.z - skylineStand.z),
    reach: skylineReach, present: { lines: STATION_LINES.skyline },
  });

  // Career timeline: a mustard runner with an arrow toward now; per job a signpost with role and years and its logo card floating above.
  room.push(
    piece(rounded(2 * RUNNER.half, .04, .9, .02), MUSTARD, [0, .03, RUNNER.z]),
    ...[-1, 1].map((side) => piece(rounded(2 * RUNNER.half, .02, .06, .01), INK, [0, .055, RUNNER.z + side * .4])),
    piece(new THREE.CircleGeometry(.48, 24), MUSTARD, [-RUNNER.half, .07, RUNNER.z], [-Math.PI / 2, 0, 0]),
    piece(new THREE.CircleGeometry(.62, 3), MUSTARD, [RUNNER.half, .07, RUNNER.z], [-Math.PI / 2, 0, 0]),
    ...Array.from({ length: 17 }, (_, index) => piece(rounded(.24, .012, .05, .005), CREAM, [-4.48 + index * .56, .056, RUNNER.z])),
  );
  const jobs = [...content.career].sort((a, b) => Number(a.period.match(/\d{4}/)?.[0] ?? 0) - Number(b.period.match(/\d{4}/)?.[0] ?? 0));
  jobs.forEach((job, index) => {
    const x = jobs.length > 1 ? -STOP_SPAN + index * 2 * STOP_SPAN / (jobs.length - 1) : 0, accent = ACCENTS[index % ACCENTS.length], ink = `#${accent.toString(16).padStart(6, '0')}`;
    const slug = shortName(job.company).toLowerCase().replace(/[^a-z0-9]+/g, '-'), id = `career:${slug}`;
    const root = station(id, x);
    solid([
      piece(cylinder(.32, .36, .08, 20), accent, [0, .04, POST_Z]),
      piece(cylinder(.05, .05, 1.3, 8), INK, [0, .65, POST_Z - .03]),
      piece(rounded(PLANK.width + .06, PLANK.height + .06, .04, .03), accent, [0, PLANK.y, POST_Z + .035]),
      piece(rounded(PLANK.width, PLANK.height, .06, .03), CREAM, [0, PLANK.y, POST_Z + .07]),
      piece(new THREE.CircleGeometry(.36, 24), accent, [0, .075, RUNNER.z], [-Math.PI / 2, 0, 0]),
      piece(new THREE.CircleGeometry(.2, 5), CREAM, [0, .085, RUNNER.z], [-Math.PI / 2, 0, Math.PI / 2]),
    ], root);
    label(root, [PLANK.width - .06, PLANK.height - .04], [0, PLANK.y, POST_Z + .11], (context, width, height) => {
      context.fillStyle = '#24203d'; fitText(context, job.role, width / 2, height * .32, width * .92, height * .5, height * .26);
      context.fillStyle = ink; fitText(context, job.period, width / 2, height * .78, width * .92, height * .32, height * .28, 800);
    });
    const card = new THREE.Group(); card.position.set(0, CARD_Y, POST_Z); root.add(card);
    solid([piece(rounded(.98, .98, .04, .12), accent, [0, 0, -.01]), piece(rounded(.9, .9, .06, .1), CREAM, [0, 0, 0])], card);
    if (job.logo.startsWith('/')) {
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
      logo.position.z = .04; logo.visible = false; card.add(logo);
      load(job.logo, (texture) => {
        const { width, height } = texture.image as { width: number; height: number };
        const aspect = width / height || 1;
        logo.scale.set(Math.min(.72, .72 * aspect), Math.min(.72, .72 / aspect), 1);
        logo.material.map = texture; logo.material.needsUpdate = true; logo.visible = true;
      });
    } else {
      label(card, [.7, .7], [0, 0, .04], (context, width, height) => { context.fillStyle = ink; fitText(context, shortName(job.company)[0].toUpperCase(), width / 2, height / 2, width, height, height * .8, 800); });
    }
    const halo = solid([piece(new THREE.TorusGeometry(.26, .03, 6, 24), MUSTARD, [0, 0, 0], [Math.PI / 2, 0, 0])], root, [0, CARD_Y - .55, POST_Z], glow);
    let spin = 0;
    reactives.push({ id, energy: 0, animate: (time, energy, progress, dt, active) => {
      // The card rises and turns once to show off its logo; afterwards it settles on the nearest whole turn.
      card.position.y = CARD_Y + .04 * Math.sin(time * 1.6 + index * 1.3) + .24 * energy;
      const goal = active ? Math.PI * 2 * smooth(Math.min(1, progress * 2.5)) : Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
      spin += (goal - spin) * Math.min(1, dt * 6);
      if (!active && Math.abs(goal - spin) < 1e-3) spin = 0;
      card.rotation.y = spin;
      halo.scale.setScalar(1 + energy * (.4 + .25 * Math.sin(time * 8)));
      halo.position.y = CARD_Y - .55 + .12 * energy;
    } });
    obstacles.push({ id: `${id}-sign`, x, z: POST_Z + .05, radius: PLANK.width / 2 + .05 });
    const stand = { x: x + 1.1, z: RUNNER.z - .1 }, reach = { x: x + .55, y: PLANK.y, z: POST_Z + .1 };
    const company = shortName(job.company);
    stations.push({
      id, kind: 'watch', label: `${company} career stop`, stand, heading: Math.atan2(reach.x - stand.x, reach.z - stand.z), reach,
      present: {
        lines: [
          { id: `${id}-role`, line: `${job.role} at ${job.company}, ${spokenPeriod(job.period)}.`, source: CAREER },
          ...job.highlights.slice(0, 2).map((text, line): CharacterLine => ({ id: `${id}-${line + 1}`, line: sentence(text), source: CAREER })),
        ],
        ...(job.url ? { url: job.url, linkLabel: `Visit ${company}` } : {}),
      },
    });
  });

  // Fun facts: one pedestal each along the back left, its machine on top.
  const facts = content.funFacts.slice(0, FACT.most);
  const pitch = facts.length > 1 ? Math.min(2.4, FACT.room / (facts.length - 1)) : 0;
  facts.forEach((text, index) => {
    const x = FACT.first + index * pitch, id = `fact:${index + 1}`;
    const theme = FACT_THEMES.find(({ match }) => match.test(text)) ?? { label: 'Fun fact', lines: [`Fun fact: ${sentence(text)}`], machine: bulb };
    const root = station(id, x, FACT.z);
    solid([
      piece(rounded(.8, FACT.top - .06, .8, .05), VIOLET, [0, (FACT.top - .06) / 2, 0]),
      ...[.25, .55].map((y) => piece(rounded(.82, .06, .82, .02), MUSTARD, [0, y, 0])),
      piece(rounded(.9, .06, .9, .03), CREAM, [0, FACT.top - .03, 0]),
      piece(rounded(.62, .18, .03, .02), PINK, [0, .85, .41]),
    ], root);
    label(root, [.58, .14], [0, .85, .435], (context, width, height) => { context.fillStyle = '#fff2d8'; fitText(context, 'FUN FACT', width / 2, height / 2, width * .9, height * .8, height * .7, 800); });
    const stage = new THREE.Group(); stage.position.y = FACT.top; stage.scale.setScalar(FACT.scale); root.add(stage);
    const parts: THREE.BufferGeometry[] = [];
    reactives.push({ id, energy: 0, animate: theme.machine(stage, parts, (moving, at) => solid(moving, stage, at)) });
    solid(parts, stage);
    obstacles.push({ id, x, z: FACT.z, radius: .62 });
    const stand = { x: x + 1, z: FACT.z + .45 }, reach = { x: x + .42, y: FACT.top, z: FACT.z + .38 };
    stations.push({
      id, kind: 'play', label: theme.label, stand, heading: Math.atan2(reach.x - stand.x, reach.z - stand.z), reach,
      present: { lines: theme.lines.map((line, number): CharacterLine => ({ id: `${id}-${number + 1}`, line, source: FUN })) },
    });
  });

  solid(room, group);
  solid(lit, group, [0, 0, 0], glow);

  // Every sign's text in one atlas: one texture and one draw call per parent.
  const columns = 1024, perUnit = 320;
  let cursorX = 0, cursorY = 0, rowHeight = 0;
  const cells = labels.map(({ size: [width, height] }) => {
    const scale = Math.min(perUnit, (columns - 8) / width), cell = { x: 0, y: 0, width: Math.round(width * scale), height: Math.round(height * scale) };
    if (cursorX + cell.width + 8 > columns) { cursorX = 0; cursorY += rowHeight; rowHeight = 0; }
    cell.x = cursorX + 4; cell.y = cursorY + 4; cursorX += cell.width + 8; rowHeight = Math.max(rowHeight, cell.height + 8);
    return cell;
  });
  const atlasHeight = Math.max(4, cursorY + rowHeight);
  const atlas = paint(columns, atlasHeight, (context) => labels.forEach(({ draw }, index) => {
    const cell = cells[index];
    context.save(); context.translate(cell.x, cell.y); draw(context, cell.width, cell.height); context.restore();
  }));
  painted.push(atlas);
  const labelMaterial = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, toneMapped: false });
  const quads = new Map<THREE.Object3D, THREE.BufferGeometry[]>();
  labels.forEach(({ parent, size, at }, index) => {
    const quad = new THREE.PlaneGeometry(...size), uv = quad.attributes.uv, cell = cells[index];
    for (let vertex = 0; vertex < uv.count; vertex++) uv.setXY(vertex, (cell.x + uv.getX(vertex) * cell.width) / columns, 1 - (cell.y + (1 - uv.getY(vertex)) * cell.height) / atlasHeight);
    quad.translate(...at);
    quads.set(parent, [...quads.get(parent) ?? [], quad]);
  });
  for (const [parent, parts] of quads) solid(parts, parent, [0, 0, 0], labelMaterial);
  const update: WorldArea['update'] = (dt, elapsed, { stationId, progress }) => {
    for (const reactive of reactives) {
      const active = reactive.id === stationId;
      reactive.energy = THREE.MathUtils.clamp(reactive.energy + (active ? 4 : -3) * dt, 0, 1);
      reactive.animate(elapsed, reactive.energy, active ? progress : 0, dt, active);
    }
    // Ambient life: twinkling string lights, swaying lanterns and plants, the LRT going round.
    for (let index = 0; index < bulbs.count; index++) bulbs.setColorAt(index, scratch.color.set(BULBS[index % BULBS.length]).lerp(WHITE, .25 + .25 * Math.sin(elapsed * 2.2 + index * 1.7)).multiplyScalar(.7 + .3 * Math.sin(elapsed * 3.1 + index * 2.9)));
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    lanterns.forEach((each, index) => { each.rotation.z = .06 * Math.sin(elapsed * 1.1 + index * 1.9); each.rotation.x = .04 * Math.sin(elapsed * .8 + index); });
    monstera.rotation.z = .03 * Math.sin(elapsed * 1.2); monstera.rotation.x = .02 * Math.sin(elapsed * .9 + 1);
    palm.rotation.z = .025 * Math.sin(elapsed * .95 + 2);
    loop.rotation.y = elapsed * .55;
  };
  // Place every moving part at rest before the first frame.
  update(0, 0, { stationId: null, progress: 0 });
  group.updateMatrixWorld(true);

  return {
    id: 'gallery',
    group,
    bounds: { ...BOUNDS },
    obstacles,
    stations,
    entry: { x: 1.95, z: 3.2 },
    view: { center: { x: 0, y: 2.1, z: -.4 } },
    pick: (raycaster) => {
      const hit = raycaster.intersectObject(group, true).find((candidate) => candidate.object.visible);
      for (let node = hit?.object ?? null; node && node !== group; node = node.parent) if (typeof node.userData.station === 'string') return node.userData.station;
      return null;
    },
    update,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) material.dispose();
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
      for (const texture of [...painted, ...loaded]) texture.dispose();
    },
  };
};

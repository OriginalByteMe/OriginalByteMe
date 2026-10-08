import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterLine } from '@/lib/character/narrative';
import type { AreaBuilder, Obstacle, Station } from './types';

type V3 = [number, number, number];
/** One frame of a machine: `energy` is 0 at rest and eases to 1 while he is at its station. */
type Animate = (time: number, energy: number) => void;
/** Moving copies of one shape, one colour each; `bright` ones ignore the lights, for things that glow. */
type Instanced = (geometry: THREE.BufferGeometry, colors: number[], bright?: boolean) => THREE.InstancedMesh;
/** Builds a skill group's machine on the bench (origin on the bench top, +z toward the camera): static parts go into `fixed`, merged into one mesh; returns its animation. */
type Machine = (fixed: THREE.BufferGeometry[], instanced: Instanced) => Animate;

const PLANK = 0xcf9a62, SEAM = 0xa8764a, WALL = 0x6f9f86, BOARD = 0x5d8b73, TRIM = 0x3d5c4a, ROOF = 0xb5523b, SHINGLE = 0x8e3d2c;
const PEG = 0xe8c597, HOLE = 0x9c7a55, CABINET = 0x9b6a3f, BENCH = 0xc99a63, CREAM = 0xfff4de, INK = 0x2b2a33, SLATE = 0x2f3747, LEAF = 0x5d9b55;
const TOMATO = 0xe4613f, MUSTARD = 0xf2b134, SKY = 0x4fa3d9, MINT = 0x3fae8e, VIOLET = 0x8e6bd6;
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const SKILLS = 'content/about-me/skills.md';
const COUNTS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

const HALF = 6.7; // floor half-width; the side walls stand on its edges
const EAVE = 4.9, PEAK = 6.3; // back wall top and gable peak
const WALL_Z = -3.9; // back wall front face
const BENCH_TOP = .95, BENCH_Z = -3.47; // the workbench along the back wall, its front at -3.05
const PEG_Y = 3.02, PEG_H = 2.12; // pegboard centre and height, its icons clear of his afro from the camera
const TILE_Z = -3.77;
const SIGN_Y = 4.42;
const SPAN = 12.4; // the bays share x in [-6.2, 6.2]
const STAND_Z = -2.72;
const TAP = 2 * Math.PI / 9; // his tinker poke period (activity-props.ts): each poke pops the next icon
const BOUNDS = { minX: -6.15, maxX: 6.15, minZ: -3, maxZ: 3.9 };
const ENTRY = { x: 1.1, z: 3.35 };
const BARREL = { x: -5.5, z: 2.5 }, SAWHORSE = { x: 5.05, z: 1.7 }, BUCKET = { x: 5.8, z: 2.75 };
const OBSTACLES: Obstacle[] = [
  { id: 'barrel', ...BARREL, radius: .45 }, { id: 'sawhorse', ...SAWHORSE, radius: .62 }, { id: 'bucket', ...BUCKET, radius: .25 },
  { id: 'plant', x: -6, z: 4, radius: .3 }, { id: 'plant', x: 6, z: 4, radius: .3 },
];
const { clamp, smoothstep } = THREE.MathUtils;
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3(), color: new THREE.Color(), glow: new THREE.Color() };

const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, radius);
const cylinder = (top: number, bottom: number, height: number, segments = 12) => new THREE.CylinderGeometry(top, bottom, height, segments);
const ball = (radius: number) => new THREE.SphereGeometry(radius, 8, 6);

/** Bakes transform and a flat vertex colour so static parts merge into one draw call with the shared toy material. Non-indexed because RoundedBoxGeometry is. */
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

/** Writes one instance's transform from plain numbers: it runs every frame. */
function place(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, spin = 0) {
  const { matrix, position, rotation, euler, scale } = scratch;
  mesh.setMatrixAt(index, matrix.compose(position.set(x, y, z), rotation.setFromEuler(euler.set(0, 0, spin)), scale.set(sx, sy, sz)));
}

/** Programming Languages: lines of code fly in and click into place on an editor, a cursor blinking after the last one. */
const LINES: [indent: number, width: number][] = [[0, .5], [.1, .36], [.1, .44], [.2, .3], [0, .22]];
const codeBlocks: Machine = (fixed, instanced) => {
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
      place(blocks, index, -.3 + indent + width / 2 + away * .5, .58 - index * .1 + away * .4, -.155 + away * .3, width * snap, .07 / snap, .05, away * 1.4);
    });
    place(cursor, 0, -.05, .18, -.155, 1, Math.sin(time * 5) > 0 ? 1 : .15, 1);
    blocks.instanceMatrix.needsUpdate = cursor.instanceMatrix.needsUpdate = true;
  };
};

/** AI & LLM Tooling: a little neural net; a pulse lights it up layer by layer, sparks running along the links. */
const LAYERS = [3, 4, 2];
const neuralNet: Machine = (fixed, instanced) => {
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
      place(lights, index, x, y, -.14, 1 + .4 * lit);
      lights.setColorAt(index, scratch.color.setHex(0x5b4a8f).lerp(scratch.glow.setHex(0xffe27a), lit));
    });
    links.forEach(({ a, b }, index) => {
      const along = clamp(pulse - a.layer, 0, 1);
      place(sparks, index, a.x + (b.x - a.x) * along, a.y + (b.y - a.y) * along, -.12, along > 0 && along < 1 ? energy : 0);
    });
    lights.instanceMatrix.needsUpdate = sparks.instanceMatrix.needsUpdate = lights.instanceColor!.needsUpdate = true;
  };
};

/** Frontend Frameworks: a page assembles itself in a little browser window, then its button gets clicked. */
const PANELS: [x: number, y: number, width: number, height: number, color: number][] = [
  [0, .585, .7, .06, SKY], [-.27, .38, .14, .3, VIOLET], [-.06, .46, .2, .12, TOMATO], [.2, .46, .26, .12, MUSTARD], [0, .28, .26, .06, MINT], [.24, .28, .14, .07, 0xff8a65],
];
const webPage: Machine = (fixed, instanced) => {
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
      place(panels, index, x, y + away * .35, -.075 + away * .15, width * size, height * size, .02);
    });
    panels.instanceMatrix.needsUpdate = true;
  };
};

/** Infrastructure & DevOps: a little crane lowers containers onto a dock, one by one, into a stack. */
const STACK: [x: number, y: number][] = [[-.2, .115], [.12, .115], [-.04, .245], [-.04, .375]];
const containers: Machine = (fixed, instanced) => {
  fixed.push(
    piece(rounded(.9, .05, .46, .02), 0x44505c, [0, .025, -.06]),
    ...Array.from({ length: 6 }, (_, index) => piece(new THREE.BoxGeometry(.12, .012, .02), index % 2 ? INK : MUSTARD, [-.375 + index * .15, .05, .16])),
    piece(rounded(.06, .8, .06, .015), MUSTARD, [.38, .425, -.06]),
    piece(rounded(.74, .05, .05, .015), MUSTARD, [.05, .8, -.06]),
    piece(rounded(.12, .1, .1, .02), 0x44505c, [.36, .72, -.06]),
  );
  const crates = instanced(fuse([piece(rounded(.3, .13, .17, .015), 0xffffff), ...[-.09, -.03, .03, .09].map((x) => piece(new THREE.BoxGeometry(.012, .136, .176), 0xffffff, [x, 0, 0]))]), [TOMATO, SKY, MINT, VIOLET]);
  const rigging = instanced(new THREE.BoxGeometry(1, 1, 1), [INK, MUSTARD, INK]);
  return (time, energy) => {
    const t = time % 3.4 / 3.4;
    let hookX = -.26 + .03 * Math.sin(time * 1.3), hookY = .55 + .03 * Math.sin(time * 1.9);
    STACK.forEach(([x, y], index) => {
      const start = .05 + index * .18, gone = smoothstep(t, .9, .98);
      const lift = energy * ((1 - smoothstep(t, start, start + .14)) * .45 + gone * .3);
      place(crates, index, x, y + lift, -.06, 1 - energy * (t < start ? 1 : gone));
      if (t >= start && t < start + .16) { hookX += (x - hookX) * energy; hookY += (y + lift + .09 - hookY) * energy; }
    });
    place(rigging, 0, hookX, (.78 + hookY) / 2, -.06, .012, .78 - hookY, .012);
    place(rigging, 1, hookX, hookY, -.06, .09, .04, .09);
    place(rigging, 2, hookX, .77, -.06, .08, .05, .08);
    crates.instanceMatrix.needsUpdate = rigging.instanceMatrix.needsUpdate = true;
  };
};

/** Databases: rows hop off a tray into a database drum, its bands lighting up as each one is stored. */
const DRUM_X = .16, ROWS = 4;
const database: Machine = (fixed, instanced) => {
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
      place(rows, index, x, y, -.06, 1 - fly * sink);
    }
    for (let band = 0; band < 3; band++) {
      const lit = clamp(energy * (1 - Math.abs((u - .7) * 10 - (2.5 - band))) + .12 * (.5 + .5 * Math.sin(time * 1.4 + band * 1.1)), 0, 1);
      place(bands, band, DRUM_X, .21 + band * .16, -.06);
      bands.setColorAt(band, scratch.color.setHex(0x2d7d66).lerp(scratch.glow.setHex(0xb8ffe6), lit));
    }
    rows.instanceMatrix.needsUpdate = bands.instanceMatrix.needsUpdate = bands.instanceColor!.needsUpdate = true;
  };
};

/** Any other skill group: a cog on a stand that spins up while he is there. */
const cog: Machine = (fixed, instanced) => {
  fixed.push(piece(rounded(.5, .05, .3, .02), SLATE, [0, .025, -.06]), piece(rounded(.06, .4, .06, .015), SLATE, [0, .22, -.1]));
  const teeth = Array.from({ length: 8 }, (_, index) => piece(new THREE.BoxGeometry(.08, .07, .05), 0xffffff, [Math.cos(index * Math.PI / 4) * .2, Math.sin(index * Math.PI / 4) * .2, 0], [0, 0, index * Math.PI / 4]));
  const wheel = instanced(fuse([piece(cylinder(.17, .17, .05, 16), 0xffffff, [0, 0, 0], [Math.PI / 2, 0, 0]), ...teeth]), [MUSTARD]);
  return (time, energy) => {
    place(wheel, 0, 0, .42, -.06, 1, 1, 1, time * (.4 + 4 * energy));
    wheel.instanceMatrix.needsUpdate = true;
  };
};

/** Per skill group of skills.md: its short sign, colour, what he says about its machine, and the machine. */
const GROUPS: Record<string, { sign: string; color: number; says: (count: string) => string; machine: Machine }> = {
  'Programming Languages': { sign: 'Languages', color: TOMATO, says: (count) => `${count} languages, clicking together like building blocks!`, machine: codeBlocks },
  'AI & LLM Tooling': { sign: 'AI & LLMs', color: VIOLET, says: (count) => `${count} AI tools. Watch the little network light up!`, machine: neuralNet },
  'Frontend Frameworks': { sign: 'Frontend', color: SKY, says: (count) => `${count} frameworks to snap a page together!`, machine: webPage },
  'Infrastructure & DevOps': { sign: 'Infra & DevOps', color: MUSTARD, says: (count) => `${count} tools to stack the containers and ship them!`, machine: containers },
  Databases: { sign: 'Databases', color: MINT, says: (count) => `${count} databases, filing every row away!`, machine: database },
};
const SPARE_COLORS = [TOMATO, VIOLET, SKY, MUSTARD, MINT];

/**
 * The toolshed, "The toolbox" lot: an open-front shed with one pegboard bay per skill group of skills.md.
 * Each bay hangs its skills as icon tiles under a short sign and runs a small machine on the workbench
 * that shows what the group is about; he presents a group from its bay and its icons pop as he taps.
 */
export const createToolshed: AreaBuilder = (origin, content) => {
  const group = new THREE.Group();
  group.name = 'toolshed';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffe3a3, toneMapped: false });
  const solidColor = new THREE.MeshStandardMaterial({ roughness: .55 });
  const brightColor = new THREE.MeshBasicMaterial({ toneMapped: false });
  const iconPlane = new THREE.PlaneGeometry(1, 1);
  const tileShape = rounded(1, 1, 1, .12);
  const loader = new THREE.TextureLoader();
  const loaded: THREE.Texture[] = [];
  let disposed = false;
  const solid = (parts: THREE.BufferGeometry[], parent: THREE.Object3D) => parent.add(new THREE.Mesh(fuse(parts), toy));

  const groups = content.skills;
  // Bays share the bench width, one per group, in skills.md order.
  const bayWidth = SPAN / Math.max(1, groups.length);
  const specs = groups.map((skillGroup, index) => GROUPS[skillGroup.category] ?? { sign: skillGroup.category, color: SPARE_COLORS[index % SPARE_COLORS.length], says: null, machine: cog });

  // Signs: one canvas, a row per bay plus the gable's name board.
  const signRows = groups.length + 1, signs = [...specs.map((spec) => spec.sign), 'The toolbox'];
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128 * signRows;
  const context = canvas.getContext('2d')!;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  signs.forEach((text, row) => {
    let size = 84;
    context.font = `800 ${size}px ${FONT}`;
    while (size > 28 && context.measureText(text).width > 460) context.font = `800 ${size -= 4}px ${FONT}`;
    context.fillStyle = row === groups.length ? '#fff4de' : '#2b2a33';
    context.fillText(text, 256, 128 * row + 66);
  });
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const signMaterial = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, toneMapped: false });
  const sign = (row: number, width: number, height: number, at: V3, parent: THREE.Object3D) => {
    const quad = new THREE.PlaneGeometry(width, height), uv = quad.attributes.uv;
    for (let vertex = 0; vertex < uv.count; vertex++) uv.setY(vertex, 1 - (row + 1 - uv.getY(vertex)) / signRows);
    const mesh = new THREE.Mesh(quad, signMaterial);
    mesh.position.set(...at); parent.add(mesh);
  };

  // The shed: plank floor, board walls, gable and roof edge, string lights, lamps, a window, shelves and clutter.
  const roofAngle = Math.atan2(PEAK - EAVE, HALF), roofLength = Math.hypot(HALF, PEAK - EAVE) + .45;
  // String lights scalloped under the roof edge.
  const bulbs = Array.from({ length: 27 }, (_, index) => {
    const x = -6.3 + index * 12.6 / 26;
    return new THREE.Vector3(x, EAVE + (PEAK - EAVE) * (1 - Math.abs(x) / HALF) - .12 - .12 * Math.abs(Math.sin(index * Math.PI / 3)), -3.22);
  });
  const lamps = groups.slice(1).map((_, index) => -SPAN / 2 + bayWidth * (index + 1));
  solid([
    piece(rounded(2 * HALF, .5, 8.4, .18), PLANK, [0, -.25, 0]),
    piece(rounded(2 * HALF - .4, .4, 8, .18), TRIM, [0, -.66, 0]),
    ...Array.from({ length: 16 }, (_, index) => piece(new THREE.BoxGeometry(2 * HALF - .2, .006, .025), SEAM, [0, .003, -3.6 + index * .5])),
    piece(rounded(2 * HALF, EAVE, .3, .06), WALL, [0, EAVE / 2, -4.05]),
    ...Array.from({ length: 16 }, (_, index) => piece(new THREE.BoxGeometry(.03, EAVE - .1, .012), BOARD, [-6.375 + index * .85, EAVE / 2, WALL_Z + .006])),
    piece(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-HALF, 0), new THREE.Vector2(HALF, 0), new THREE.Vector2(0, PEAK - EAVE)]), { depth: .3, bevelEnabled: false }), WALL, [0, EAVE, -4.2]),
    piece(rounded(2 * HALF + .2, .16, .42, .04), TRIM, [0, EAVE, -3.98]),
    ...[-1, 1].flatMap((side) => [
      piece(rounded(roofLength, .18, 1.1, .05), ROOF, [side * HALF / 2, (EAVE + PEAK) / 2 + .1, -3.85], [0, 0, -side * roofAngle]),
      piece(rounded(roofLength, .07, 1.18, .03), SHINGLE, [side * HALF / 2, (EAVE + PEAK) / 2 + .22, -3.85], [0, 0, -side * roofAngle]),
      piece(rounded(.3, EAVE, 5, .06), WALL, [side * 6.55, EAVE / 2, -1.7]),
      piece(rounded(.42, .16, 5.1, .04), TRIM, [side * 6.55, EAVE, -1.7]),
      piece(rounded(.36, EAVE + .05, .36, .06), TRIM, [side * 6.55, EAVE / 2, .85]),
      piece(rounded(.28, 3, .28, .06), TRIM, [side * 6.55, 1.5, 3.95]),
      piece(rounded(.26, .3, .26, .04), INK, [side * 6.55, 3.17, 3.95]),
      piece(cylinder(.17, .02, .14, 8), INK, [side * 6.55, 3.38, 3.95]),
      // Potted plants either side of the open front.
      piece(cylinder(.22, .17, .36), ROOF, [side * 6, .18, 4]),
      piece(ball(.2), LEAF, [side * 6, .46, 4]), piece(ball(.15), 0x77b36a, [side * 6.1, .62, 3.95]), piece(ball(.12), LEAF, [side * 5.9, .66, 4.05]),
    ]),
    piece(rounded(.3, .16, 1.15, .04), SHINGLE, [0, PEAK + .14, -3.85]),
    piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bulbs.map((bulb) => bulb.clone().setY(bulb.y + .07))), 48, .012, 4), INK),
    // Gable name board.
    piece(rounded(2.5, .72, .06, .04), SHINGLE, [0, 5.45, -3.86]),
    piece(rounded(2.36, .58, .06, .03), CABINET, [0, 5.45, -3.84]),
    // Workbench top, the bays' cabinets carry it.
    piece(rounded(SPAN + .3, .08, .9, .03), BENCH, [0, BENCH_TOP - .04, BENCH_Z]),
    // Lamps between the bays, shining on the pegboards.
    ...lamps.flatMap((x) => [
      piece(rounded(.12, .12, .04, .02), INK, [x, 4.42, WALL_Z + .02]),
      piece(cylinder(.016, .016, .3, 6), INK, [x, 4.47, WALL_Z + .17], [Math.PI / 2, 0, 0]),
      piece(cylinder(.07, .16, .16, 12), TRIM, [x, 4.44, WALL_Z + .34]),
    ]),
    // Left wall: window with a flower box, tools on hooks below it.
    piece(rounded(.07, 1.2, 1.5, .03), TRIM, [-6.38, 3, -1.4]),
    piece(rounded(.04, 1.02, 1.32, .02), 0xbfe3f2, [-6.36, 3, -1.4]),
    piece(new THREE.BoxGeometry(.05, 1.02, .04), TRIM, [-6.34, 3, -1.4]), piece(new THREE.BoxGeometry(.05, .04, 1.32), TRIM, [-6.34, 3, -1.4]),
    piece(rounded(.2, .16, 1.4, .03), ROOF, [-6.3, 2.33, -1.4]),
    ...[TOMATO, MUSTARD, VIOLET, 0xff8fb1, TOMATO].map((color, index) => piece(ball(.08), color, [-6.28, 2.48, -1.95 + index * .28])),
    piece(new THREE.BoxGeometry(.04, .42, .05), CABINET, [-6.36, 1.5, -2.4]), piece(new THREE.BoxGeometry(.06, .09, .2), SLATE, [-6.35, 1.72, -2.4]),
    piece(new THREE.BoxGeometry(.03, .36, .06), 0xb7bcc6, [-6.36, 1.5, -1.9]), piece(new THREE.TorusGeometry(.06, .02, 6, 12), 0xb7bcc6, [-6.36, 1.72, -1.9], [0, Math.PI / 2, 0]),
    piece(new THREE.BoxGeometry(.02, .14, .55), 0xb7bcc6, [-6.37, 1.55, -1.2]), piece(rounded(.05, .14, .12, .02), TOMATO, [-6.36, 1.6, -.88]),
    // Right wall: a shelf of paint tins and a coiled hose.
    piece(rounded(.32, .05, 2.4, .02), BENCH, [6.24, 2.75, -1.6]),
    ...[TOMATO, SKY, MUSTARD, MINT, VIOLET].map((color, index) => piece(cylinder(.09, .09, .18), color, [6.25, 2.875, -2.6 + index * .45])),
    piece(new THREE.TorusGeometry(.22, .045, 6, 16), MINT, [6.36, 1.8, -.6], [0, Math.PI / 2, 0]),
    // Rug, doormat, a barrel of garden tools, a sawhorse with a plank and a paint bucket.
    piece(rounded(5.4, .012, 2.6, .006), MUSTARD, [0, .006, .3]),
    piece(rounded(5.2, .016, 2.4, .008), 0x4a7f8c, [0, .009, .3]),
    piece(rounded(1.1, .02, .6, .01), SHINGLE, [ENTRY.x, .01, ENTRY.z + .2]),
    piece(rounded(.9, .024, .1, .01), MUSTARD, [ENTRY.x, .012, ENTRY.z + .2]),
    piece(cylinder(.36, .32, .78, 14), CABINET, [BARREL.x, .39, BARREL.z]),
    ...[.15, .63].map((y) => piece(cylinder(.37, .37, .04, 14), TRIM, [BARREL.x, y, BARREL.z])),
    piece(cylinder(.025, .025, 1.5, 6), BENCH, [BARREL.x - .1, 1.1, BARREL.z], [0, 0, .12]),
    piece(rounded(.3, .28, .08, .03), MUSTARD, [BARREL.x - .19, 1.88, BARREL.z], [0, 0, .12]),
    piece(cylinder(.025, .025, 1.4, 6), BENCH, [BARREL.x + .12, 1.05, BARREL.z + .05], [0, 0, -.15]),
    piece(new THREE.BoxGeometry(.42, .05, .05), SLATE, [BARREL.x + .23, 1.74, BARREL.z + .05], [0, 0, -.15]),
    piece(cylinder(.12, .14, .3, 10), 0xb7bcc6, [BARREL.x + .03, 1.05, BARREL.z - .1]),
    piece(rounded(1.2, .08, .1, .02), CABINET, [SAWHORSE.x, .62, SAWHORSE.z]),
    ...[-1, 1].flatMap((x) => [-1, 1].map((z) => piece(new THREE.BoxGeometry(.06, .68, .06), CABINET, [SAWHORSE.x + x * .45, .3, SAWHORSE.z + z * .13], [z * .22, 0, 0]))),
    piece(rounded(1.6, .04, .3, .01), BENCH, [SAWHORSE.x - .1, .68, SAWHORSE.z + .02], [0, .12, 0]),
    piece(cylinder(.2, .17, .3), MINT, [BUCKET.x, .15, BUCKET.z]),
    piece(new THREE.TorusGeometry(.19, .012, 4, 16, Math.PI), INK, [BUCKET.x, .3, BUCKET.z]),
    piece(cylinder(.17, .17, .01), 0xf6f1e7, [BUCKET.x, .29, BUCKET.z]),
  ], group);
  sign(groups.length, 2.2, .55, [0, 5.45, -3.805], group);
  group.add(new THREE.Mesh(fuse([
    ...lamps.map((x) => piece(ball(.06), 0xffffff, [x, 4.39, WALL_Z + .34])),
    ...[-1, 1].map((side) => piece(ball(.08), 0xffffff, [side * 6.55, 3.17, 3.95])),
  ]), glow));
  const twinkle = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.05, 0), brightColor, bulbs.length);
  const bulbColors = [TOMATO, MUSTARD, SKY, MINT, VIOLET, 0xff8fb1];
  bulbs.forEach((bulb, index) => place(twinkle, index, bulb.x, bulb.y, bulb.z));
  group.add(twinkle);

  // One bay per skill group: pegboard of icons, sign, cabinet and button, and its machine on the bench.
  const bays = groups.map((skillGroup, index) => {
    const spec = specs[index], x = -SPAN / 2 + bayWidth * (index + .5), id = `toolbox:${skillGroup.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const bay = new THREE.Group();
    bay.name = bay.userData.station = id;
    group.add(bay);
    const pegWidth = bayWidth - .3, signWidth = Math.min(1.9, bayWidth - .55);
    const count = skillGroup.skills.length, columns = count <= 4 ? 2 : 3, rows = Math.ceil(count / columns);
    const pitch = Math.min(.68, (pegWidth - .16) / columns, (PEG_H - .2) / rows), tile = pitch * .84, picture = tile * .8;
    const slots = skillGroup.skills.map((_, slot) => {
      const row = Math.floor(slot / columns), inRow = Math.min(columns, count - row * columns);
      return { x: x + (slot % columns - (inRow - 1) / 2) * pitch, y: PEG_Y + .08 + ((rows - 1) / 2 - row) * pitch, width: picture, height: picture };
    });
    const holes = Math.floor((pegWidth - .1) / .2), holeRows = Math.floor((PEG_H - .1) / .2);
    solid([
      piece(rounded(pegWidth + .12, PEG_H + .12, .03, .02), spec.color, [x, PEG_Y, WALL_Z + .015]),
      piece(rounded(pegWidth, PEG_H, .05, .03), PEG, [x, PEG_Y, WALL_Z + .035]),
      ...Array.from({ length: holes * holeRows }, (_, hole) => piece(new THREE.CircleGeometry(.018, 4), HOLE,
        [x + (hole % holes - (holes - 1) / 2) * .2, PEG_Y + (Math.floor(hole / holes) - (holeRows - 1) / 2) * .2, WALL_Z + .062])),
      ...slots.map((slot) => piece(cylinder(.014, .014, .1, 5), 0xb7bcc6, [slot.x, slot.y + tile / 2 + .04, WALL_Z + .1], [Math.PI / 2, 0, 0])),
      piece(rounded(signWidth + .16, .6, .05, .04), spec.color, [x, SIGN_Y, WALL_Z + .025]),
      piece(rounded(signWidth + .04, .5, .04, .03), CREAM, [x, SIGN_Y, WALL_Z + .05]),
      piece(rounded(bayWidth - .12, BENCH_TOP - .08, .78, .04), CABINET, [x, (BENCH_TOP - .08) / 2, BENCH_Z - .03]),
      ...[-1, 1].map((side) => piece(rounded((bayWidth - .5) / 2, .3, .03, .02), spec.color, [x + side * (bayWidth - .5) / 4 + side * .03, .62, -3.09])),
      piece(rounded(bayWidth - .44, .3, .03, .02), spec.color, [x, .24, -3.09]),
      ...[[-1, .62], [1, .62], [0, .24]].map(([side, y]) => piece(ball(.03), CREAM, [x + side * ((bayWidth - .5) / 4 + .03), y, -3.06])),
      piece(cylinder(.1, .11, .04, 14), SLATE, [x - .4, BENCH_TOP + .02, -3.22]),
      piece(cylinder(.07, .07, .04, 14), spec.color, [x - .4, BENCH_TOP + .05, -3.22]),
    ], bay);
    sign(index, signWidth, signWidth / 4, [x, SIGN_Y, WALL_Z + .076], bay);

    const rig = new THREE.Group();
    rig.name = 'machine';
    rig.position.set(x + .5, BENCH_TOP, -3.42);
    rig.scale.setScalar(1.35);
    bay.add(rig);
    const fixed: THREE.BufferGeometry[] = [];
    const animate = spec.machine(fixed, (geometry, colors, bright = false) => {
      const mesh = new THREE.InstancedMesh(geometry, bright ? brightColor : solidColor, colors.length);
      colors.forEach((color, at) => mesh.setColorAt(at, scratch.color.setHex(color)));
      mesh.frustumCulled = false;
      rig.add(mesh);
      return mesh;
    });
    solid(fixed, rig);
    animate(0, 0);

    const tiles = new THREE.InstancedMesh(tileShape, solidColor, count);
    for (let at = 0; at < count; at++) tiles.setColorAt(at, scratch.color.setHex(CREAM).lerp(scratch.glow.setHex(spec.color), .18));
    bay.add(tiles);
    const icons = skillGroup.skills.map((skill, at) => {
      const material = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      const icon = new THREE.Mesh(iconPlane, material);
      icon.name = `icon:${skill.name}`;
      icon.visible = false;
      bay.add(icon);
      loaded.push(loader.load(skill.icon, (texture) => {
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
        const { width, height } = texture.image, aspect = width && height ? width / height : 1;
        slots[at].width = aspect >= 1 ? picture : picture * aspect; slots[at].height = aspect >= 1 ? picture / aspect : picture;
        icon.scale.set(slots[at].width, slots[at].height, 1);
        material.map = texture; material.needsUpdate = true; icon.visible = true;
      }));
      return icon;
    });
    // Each poke of his pops the next icon off the board.
    const lay = (time: number, energy: number) => {
      const turn = Math.floor(time / TAP), beat = time / TAP - turn;
      slots.forEach((slot, at) => {
        const pop = at === turn % count ? energy * Math.sin(Math.PI * beat) : 0, grow = 1 + .4 * pop, spin = pop * .18 * Math.sin(time * 18), lift = pop * .14;
        place(tiles, at, slot.x, slot.y, TILE_Z + lift, tile * grow, tile * grow, .06, spin);
        icons[at].position.set(slot.x, slot.y, TILE_Z + .036 + lift);
        icons[at].scale.set(slot.width * grow, slot.height * grow, 1);
        icons[at].rotation.z = spin;
      });
      tiles.instanceMatrix.needsUpdate = true;
    };
    lay(0, 0);

    const names = skillGroup.skills.map((skill) => skill.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
    const lines: CharacterLine[] = [{ id: `${id}-skills`, line: `${skillGroup.category}: ${list}.`, source: SKILLS }];
    if (spec.says) lines.unshift({ id: `${id}-machine`, line: spec.says(COUNTS[count] ?? String(count)), source: SKILLS });
    const stand = { x: x - .62, z: STAND_Z }, reach = { x: x - .4, y: BENCH_TOP + .07, z: -3.22 };
    const station: Station = {
      id, kind: 'tinker', label: `${skillGroup.category} wall`, stand, heading: Math.atan2(reach.x - stand.x, reach.z - stand.z), reach, present: { lines },
    };
    return { station, animate, lay, energy: 0, resting: true };
  });
  group.updateMatrixWorld(true);

  return {
    id: 'toolshed',
    group,
    bounds: { ...BOUNDS },
    obstacles: OBSTACLES.map((obstacle) => ({ ...obstacle })),
    stations: bays.map((bay) => bay.station),
    entry: { ...ENTRY },
    view: { center: { x: 0, y: 2.4, z: -.6 } },
    pick: (raycaster) => {
      group.updateWorldMatrix(true, true);
      for (let node: THREE.Object3D | null = raycaster.intersectObject(group, true)[0]?.object ?? null; node; node = node.parent) {
        if (typeof node.userData.station === 'string') return node.userData.station;
      }
      return null;
    },
    update: (dt, elapsed, activity) => {
      for (const bay of bays) {
        bay.energy = clamp(bay.energy + (bay.station.id === activity.stationId ? 4 : -3) * dt, 0, 1);
        bay.animate(elapsed, bay.energy);
        if (bay.energy > 0 || !bay.resting) { bay.lay(elapsed, bay.energy); bay.resting = bay.energy === 0; }
      }
      bulbs.forEach((_, index) => twinkle.setColorAt(index, scratch.color.setHex(bulbColors[index % bulbColors.length]).lerp(scratch.glow.setHex(0xffffff), .45 * Math.max(0, Math.sin(elapsed * 2.1 + index * 1.7)) ** 3)));
      twinkle.instanceColor!.needsUpdate = true;
    },
    dispose: () => {
      disposed = true;
      const materials = new Set<THREE.Material>();
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) materials.add(material);
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
      materials.forEach((material) => material.dispose());
      atlas.dispose();
      loaded.forEach((texture) => texture.dispose());
    },
  };
};

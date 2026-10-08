import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterLine } from '@/lib/character/narrative';
import type { AreaBuilder, Obstacle, Station } from './types';

type V3 = [number, number, number];
/** x, y, width, height in the label atlas. */
type Cell = [number, number, number, number];

// Kuala Lumpur civic: brick-and-cream arcades, verdigris onion domes, marigold trim and bunting.
const BRICK = 0xd8603f, CREAM = 0xfff0d4, SAND = 0xf4e1bb, SAND_DEEP = 0xe2c38f, TEAL = 0x2fa89c, TEAL_DEEP = 0x1d7873;
const MARIGOLD = 0xf6b230, PINK = 0xf27a9c, NAVY = 0x27386a, SKY = 0x8fd4f2, LEAF = 0x67bb57, WATER = 0x6fd0ee;
const VERDIGRIS = 0x63b8a4, VERDIGRIS_DEEP = 0x438f80;
const FLAGS = [PINK, MARIGOLD, TEAL, SKY, LEAF];
const WHITE = new THREE.Color(0xffffff);
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const TAU = Math.PI * 2;
const WALL_Z = -3.9; // back wall front face
const BOUNDS = { minX: -6.1, maxX: 6.1, minZ: -3.4, maxZ: 3.6 };
const STATUE = { x: -3.9, z: -2.5 }, GLOBE = { x: 4.15, z: -2.5 }, PODIUM = { x: 0, z: -1.85 }, POST = { x: 5.35, z: -3 };
const FOUNTAIN = { x: -3.4, z: 1.3 }, BENCH = { x: 3.5, z: 1.8 }, LAMP_X = 5.9, LAMP_Z = 3.1;
const BOARD_Y = 3.12, DIGIT_Y = 3.32, TILE = { width: .62, height: .88 };
const BUST_Y = 1.2, GLOBE_Y = 1.48, GLOBE_R = .55;
/** Kuala Lumpur, latitude and longitude in degrees. */
const KL = [3.1, 101.7] as const;
const ATLAS = 1024;
const CELLS: Record<'title' | 'headline' | 'caption' | 'place' | 'suffix', Cell> = {
  title: [0, 0, 1024, 176], headline: [0, 176, 1024, 128], caption: [0, 304, 1024, 128], place: [0, 432, 768, 192], suffix: [768, 432, 256, 192],
};
const digitCell = (digit: number): Cell => [digit * 102.4, 880, 102.4, 144];
const ONION = [[.001, 0], [.85, 0], [1, .18], [.96, .4], [.72, .66], [.38, .88], [.12, 1.02], [.001, 1.18]];
const BIO = 'content/about-me/bio.md', CAREER = 'content/about-me/career.md';
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3(), color: new THREE.Color() };

const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 2, height / 2, depth / 2));
const cylinder = (top: number, bottom: number, height: number, segments = 14) => new THREE.CylinderGeometry(top, bottom, height, segments);
const ball = (radius: number) => new THREE.SphereGeometry(radius, 10, 6);
const onion = (radius: number, height: number) => new THREE.LatheGeometry(ONION.map(([x, y]) => new THREE.Vector2(x * radius, y * height)), 12);
/** Unit vector to a latitude and longitude in degrees; longitude 0 faces +z. */
const surface = (lat: number, lon: number) => new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - lat), THREE.MathUtils.degToRad(lon));
/** Eases a spin back to its nearest rest turn. */
const settle = (angle: number, dt: number) => angle + (Math.round(angle / TAU) * TAU - angle) * (1 - Math.exp(-dt * 3));

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

/** Points a plane's UVs at one atlas cell. */
function mapCell(geometry: THREE.PlaneGeometry, [x, y, width, height]: Cell) {
  const uv = geometry.attributes.uv;
  for (let vertex = 0; vertex < 4; vertex++) uv.setXY(vertex, (x + (vertex % 2) * width) / ATLAS, 1 - (y + (vertex < 2 ? 0 : height)) / ATLAS);
  uv.needsUpdate = true;
}

/** Every sign in the hall in one texture: title, headline, stat caption and unit, the city, four bio icons and the flip-board digits. */
function paintAtlas(title: string, headline: string, caption: string, suffix: string, city: string, country: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS;
  const context = canvas.getContext('2d')!;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#fff4dc';
  fitText(context, title, 512, 90, 960, 150, 128);
  fitText(context, headline, 512, 240, 980, 110, 92);
  fitText(context, caption, 512, 368, 980, 110, 84);
  fitText(context, suffix, 896, 528, 220, 150, 120);
  context.fillStyle = '#27386a';
  fitText(context, city, 384, 494, 740, 124, 120);
  fitText(context, country, 384, 592, 720, 46, 44);

  // Bio icons, each centred in its 256 cell: an eye for design, a bolt for efficient, stacked layers for scalable, and code.
  context.fillStyle = context.strokeStyle = '#27386a'; context.lineWidth = 16; context.lineJoin = 'round';
  context.beginPath(); context.moveTo(38, 752); context.quadraticCurveTo(128, 662, 218, 752); context.quadraticCurveTo(128, 842, 38, 752); context.stroke();
  context.beginPath(); context.arc(128, 752, 34, 0, TAU); context.fill();
  context.beginPath();
  for (const [x, y] of [[404, 656], [326, 768], [380, 768], [356, 848], [442, 726], [388, 726]]) context.lineTo(x, y);
  context.closePath(); context.fill();
  for (let layer = 2; layer >= 0; layer--) {
    const y = 712 + layer * 36;
    context.fillStyle = layer === 1 ? '#2fa89c' : '#27386a';
    context.beginPath(); context.moveTo(540, y); context.lineTo(640, y - 44); context.lineTo(740, y); context.lineTo(640, y + 44); context.closePath(); context.fill();
  }
  context.fillStyle = '#27386a';
  fitText(context, '</>', 896, 752, 210, 160, 120);

  for (let digit = 0; digit < 10; digit++) {
    const [x, y, width, height] = digitCell(digit);
    context.fillStyle = '#1d7873';
    context.beginPath(); context.roundRect(x + 4, y + 4, width - 8, height - 8, 14); context.fill();
    context.fillStyle = '#fff4dc';
    fitText(context, String(digit), x + width / 2, y + height / 2 + 4, width - 20, height - 16, 120);
    context.fillStyle = '#14203f';
    context.fillRect(x + 4, y + height / 2 - 2, width - 8, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/**
 * Lot 2, "Noah, in brief" (#brief): a little Kuala Lumpur town hall and plaza. A verdigris bust of
 * him under his headline and four bio icons, a flip board that counts up the Chapter 01 stat from a
 * podium, and a globe that turns to a pin on Kuala Lumpur beside a twin-tower mural. A fountain,
 * pigeons, bunting and a clock keep it alive.
 */
export const createHall: AreaBuilder = (origin, content) => {
  const group = new THREE.Group();
  group.name = 'hall';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
  const solid = (parts: THREE.BufferGeometry[], parent: THREE.Object3D, at: V3 = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts), toy);
    parts.forEach((part) => part.dispose());
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  const station = (id: string) => {
    const root = new THREE.Group();
    root.name = root.userData.station = id;
    group.add(root);
    return root;
  };
  const [stat] = content.stats;
  const [city, ...rest] = content.location.split(',');
  const ink = new THREE.MeshBasicMaterial({
    map: paintAtlas('Noah, in brief', content.headline, stat.caption, stat.suffix.trim(), city.trim(), rest.join(',').trim()),
    transparent: true, toneMapped: false,
  });
  const label = (cell: Cell, width: number, at: V3, parent: THREE.Object3D) => {
    const geometry = new THREE.PlaneGeometry(width, width * cell[3] / cell[2]);
    mapCell(geometry, cell);
    const mesh = new THREE.Mesh(geometry, ink);
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  /** Decorations that move but are not clickable. */
  const ambient = <T extends THREE.InstancedMesh>(mesh: T) => {
    mesh.raycast = () => {};
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };

  /** A point along one side's bunting string, from the clock tower out to a corner tower, sagging in the middle. */
  const sag = (side: number, along: number) => new THREE.Vector3(side * THREE.MathUtils.lerp(1.05, 6.35, along), THREE.MathUtils.lerp(5.8, 5.3, along) - .38 * Math.sin(Math.PI * along), -3.14);
  const bunting = [-1, 1].flatMap((side) => Array.from({ length: 9 }, (_, index) => sag(side, (index + .5) / 9)));
  const strings = [-1, 1].map((side) => new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, index) => sag(side, index / 12))));
  // The plaza, arcade, towers, mural, fountain, bench, lamps and bunting strings: one static draw call.
  solid([
    piece(rounded(13.6, .5, 8.4, .18, 2), SAND_DEEP, [0, -.25, 0]),
    piece(rounded(13.2, .4, 8, .18, 2), TEAL_DEEP, [0, -.66, 0]),
    ...Array.from({ length: 13 * 8 }, (_, index) => {
      const column = index % 13, row = Math.floor(index / 13), ring = Math.abs(column - 6) + Math.abs(row - 4);
      const color = ring === 0 ? MARIGOLD : ring === 2 ? 0x9fdccf : ring === 4 ? 0xf6c1cf : (column + row) % 2 ? SAND : 0xfaedd5;
      return piece(new THREE.PlaneGeometry(.96, .96), color, [-6 + column, .005, -3.55 + row], [-Math.PI / 2, 0, 0]);
    }),
    // Back wall: brick with cream bands, a seven-arch arcade along the bottom.
    piece(rounded(13.2, 5, .3, .06), BRICK, [0, 2.5, -4.05]),
    piece(rounded(13.24, .2, .38), CREAM, [0, .1, -4.03]),
    piece(rounded(13.24, .12, .34), CREAM, [0, 2.2, -4.03]),
    piece(rounded(13.5, .2, .5, .05), CREAM, [0, 4.98, -4]),
    ...[-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4].flatMap((x) => [
      piece(rounded(1, 1.35, .04, .01), NAVY, [x, .875, WALL_Z + .01]),
      piece(new THREE.CircleGeometry(.5, 12, 0, Math.PI), NAVY, [x, 1.55, WALL_Z + .012]),
      piece(new THREE.TorusGeometry(.56, .07, 6, 14, Math.PI), CREAM, [x, 1.55, WALL_Z + .04]),
      ...[-1, 1].map((side) => piece(rounded(.14, 1.4, .12), CREAM, [x + side * .56, .85, WALL_Z + .04])),
    ]),
    ...[-1, 1].flatMap((side) => [
      piece(rounded(.4, .36, .3, .06), PINK, [side * 5.4, .38, -3.66]),
      piece(ball(.24), LEAF, [side * 5.4, .66, -3.66], [0, 0, 0], [1, .8, 1]),
      ...[0, 1, 2].map((index) => piece(new THREE.IcosahedronGeometry(.06), [MARIGOLD, CREAM, PINK][index], [side * 5.4 + (index - 1) * .13, .8 + .04 * (index % 2), -3.56])),
    ]),
    // Corner towers and the clock tower, each under a verdigris onion dome.
    ...[-1, 1].flatMap((side) => [
      piece(rounded(.9, 5.3, .9, .06), BRICK, [side * 6.35, 2.65, -3.75]),
      ...[.1, 2.2, 4.98].map((y) => piece(rounded(.96, .14, .96), CREAM, [side * 6.35, y, -3.75])),
      piece(rounded(1, .16, 1), CREAM, [side * 6.35, 5.38, -3.75]),
      piece(onion(.48, .7), TEAL, [side * 6.35, 5.46, -3.75]),
      piece(ball(.06), MARIGOLD, [side * 6.35, 6.33, -3.75]),
    ]),
    piece(rounded(2, .98, 1, .06), BRICK, [0, 5.49, -3.75]),
    piece(rounded(2.16, .12, 1.12), CREAM, [0, 5.98, -3.75]),
    piece(onion(.7, .62), TEAL, [0, 6.02, -3.75]),
    piece(ball(.07), MARIGOLD, [0, 6.8, -3.75]),
    piece(cylinder(0, .025, .1, 6), MARIGOLD, [0, 6.91, -3.75]),
    piece(new THREE.CircleGeometry(.36, 20), CREAM, [0, 5.49, -3.24]),
    piece(new THREE.TorusGeometry(.38, .04, 6, 20), NAVY, [0, 5.49, -3.23]),
    ...[0, 1, 2, 3].map((index) => piece(rounded(.04, .08, .02, .01), NAVY, [Math.sin(index * Math.PI / 2) * .29, 5.49 + Math.cos(index * Math.PI / 2) * .29, -3.23], [0, 0, -index * Math.PI / 2])),
    ...Array.from({ length: 10 }, (_, index) => piece(ball(.09), CREAM, [(index < 5 ? -5.6 : 1.6) + (index % 5) * 1, 5.17, -3.84])),
    // Title banner.
    piece(rounded(4.7, .88, .08, .05), MARIGOLD, [0, 4.45, WALL_Z + .04]),
    piece(rounded(4.5, .72, .1, .05), NAVY, [0, 4.45, WALL_Z + .07]),
    // Kuala Lumpur mural: a sky panel with the twin towers, a skybridge, the sun and a cloud.
    piece(rounded(2.75, 2.55, .03), CREAM, [GLOBE.x, 3.47, WALL_Z + .015]),
    piece(rounded(2.6, 2.4, .04), SKY, [GLOBE.x, 3.47, WALL_Z + .03]),
    ...[-1, 1].flatMap((side) => {
      let y = 2.32;
      return [[.4, .95], [.34, .45], [.28, .32], [.2, .22], [.12, .14]].map(([width, height]) => {
        const part = piece(rounded(width, height, .08, .02), 0xdfeaf3, [GLOBE.x + side * .4, y + height / 2, WALL_Z + .08]);
        y += height;
        return part;
      }).concat(piece(cylinder(.008, .025, .35, 6), 0xdfeaf3, [GLOBE.x + side * .4, y + .17, WALL_Z + .08]));
    }),
    ...[-1, 1].flatMap((side) => [2.7, 3.05].map((y) => piece(rounded(.3, .025, .01, .005), 0x9fb7cc, [GLOBE.x + side * .4, y, WALL_Z + .125]))),
    piece(rounded(.46, .07, .06, .02), NAVY, [GLOBE.x, 3.12, WALL_Z + .08]),
    piece(new THREE.CircleGeometry(.3, 20), MARIGOLD, [GLOBE.x + .95, 4.25, WALL_Z + .06]),
    ...[[-.18, 0, .16], [0, .06, .2], [.2, 0, .15]].map(([x, y, radius]) => piece(ball(radius), 0xffffff, [GLOBE.x - .85 + x, 3.6 + y, WALL_Z + .08], [0, 0, 0], [1, .7, .4])),
    // Side colonnades.
    ...[-1, 1].flatMap((side) => [
      ...[-1.6, .9].flatMap((z) => [
        piece(cylinder(.13, .15, 3.3, 10), CREAM, [side * 6.55, 1.65, z]),
        piece(rounded(.38, .16, .38), TEAL, [side * 6.55, .08, z]),
        piece(rounded(.4, .16, .4), TEAL, [side * 6.55, 3.38, z]),
      ]),
      piece(rounded(.36, .3, 5.2, .05), BRICK, [side * 6.55, 3.6, -1]),
      piece(rounded(.38, .08, 5.24, .03), CREAM, [side * 6.55, 3.5, -1]),
    ]),
    // Fountain.
    piece(cylinder(1, 1.06, .42, 8), CREAM, [FOUNTAIN.x, .21, FOUNTAIN.z]),
    piece(cylinder(1.05, 1.05, .06, 8), TEAL, [FOUNTAIN.x, .44, FOUNTAIN.z]),
    piece(cylinder(.9, .9, .03, 8), WATER, [FOUNTAIN.x, .45, FOUNTAIN.z]),
    piece(cylinder(.12, .16, .75, 8), TEAL, [FOUNTAIN.x, .8, FOUNTAIN.z]),
    piece(cylinder(.42, .16, .18, 8), CREAM, [FOUNTAIN.x, 1.12, FOUNTAIN.z]),
    piece(cylinder(.37, .37, .02, 8), WATER, [FOUNTAIN.x, 1.2, FOUNTAIN.z]),
    piece(cylinder(.03, .05, .14, 8), WATER, [FOUNTAIN.x, 1.27, FOUNTAIN.z]),
    piece(ball(.07), 0xbdeefc, [FOUNTAIN.x, 1.36, FOUNTAIN.z]),
    // Bench facing the street.
    piece(rounded(1.7, .08, .5, .03), TEAL, [BENCH.x, .3, BENCH.z]),
    piece(rounded(1.7, .4, .07, .03), TEAL, [BENCH.x, .62, BENCH.z - .24]),
    ...[-1, 1].flatMap((side) => [
      piece(rounded(.08, .3, .44, .02), MARIGOLD, [BENCH.x + side * .74, .15, BENCH.z]),
      piece(rounded(.08, .06, .44, .02), MARIGOLD, [BENCH.x + side * .8, .5, BENCH.z]),
      piece(rounded(.06, .2, .06, .02), MARIGOLD, [BENCH.x + side * .8, .38, BENCH.z + .18]),
    ]),
    // Street lamps in flower planters.
    ...[-1, 1].flatMap((side) => [
      piece(cylinder(.42, .36, .3, 10), TEAL_DEEP, [side * LAMP_X, .15, LAMP_Z]),
      piece(cylinder(.37, .37, .02, 10), 0x7a4a2c, [side * LAMP_X, .3, LAMP_Z]),
      ...Array.from({ length: 8 }, (_, index) => piece(new THREE.IcosahedronGeometry(index % 2 ? .07 : .09), index % 2 ? LEAF : [PINK, MARIGOLD, CREAM, PINK][index / 2], [side * LAMP_X + Math.cos(index * TAU / 8) * .24, .36, LAMP_Z + Math.sin(index * TAU / 8) * .24])),
      piece(cylinder(.05, .07, 2.6, 8), NAVY, [side * LAMP_X, 1.3, LAMP_Z]),
      ...[2.58, 2.92].map((y) => piece(rounded(.3, .05, .3, .02), NAVY, [side * LAMP_X, y, LAMP_Z])),
      piece(cylinder(0, .22, .18, 4), TEAL, [side * LAMP_X, 3.03, LAMP_Z], [0, Math.PI / 4, 0]),
      piece(ball(.05), MARIGOLD, [side * LAMP_X, 3.15, LAMP_Z]),
    ]),
    ...strings.map((curve) => piece(new THREE.TubeGeometry(curve, 24, .012, 4), NAVY)),
  ], group);
  label(CELLS.title, 4.25, [0, 4.45, WALL_Z + .125], group);

  const lanterns = new THREE.Mesh(mergeGeometries([-1, 1].map((side) => rounded(.2, .28, .2, .04).translate(side * LAMP_X, 2.75, LAMP_Z))), glow);
  group.add(lanterns);
  const hands = [[.04, .2], [.03, .28]].map(([width, length]) => solid([piece(rounded(width, length, .02, .01), NAVY, [0, length / 2 - .03, 0])], group, [0, 5.49, -3.2]));

  const flags = ambient(new THREE.InstancedMesh(new THREE.CircleGeometry(.16, 3).rotateZ(-Math.PI / 2).translate(0, -.08, 0), new THREE.MeshStandardMaterial({ roughness: .8, side: THREE.DoubleSide }), bunting.length));
  bunting.forEach((_, index) => flags.setColorAt(index, scratch.color.set(FLAGS[index % FLAGS.length])));
  const drops = ambient(new THREE.InstancedMesh(new THREE.SphereGeometry(.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0xbdeefc, toneMapped: false }), 16));
  // Pigeons: one on the bust's afro, two on the fountain rim, one on the bench back. Feet at the origin, facing +z.
  const perches = [
    { x: STATUE.x + .04, y: 2.36, z: STATUE.z - .04, yaw: .4 },
    { x: FOUNTAIN.x + Math.cos(.5) * .97, y: .47, z: FOUNTAIN.z + Math.sin(.5) * .97, yaw: 1.2 },
    { x: FOUNTAIN.x + Math.cos(2.5) * .97, y: .47, z: FOUNTAIN.z + Math.sin(2.5) * .97, yaw: -.9 },
    { x: BENCH.x - .45, y: .82, z: BENCH.z - .24, yaw: .3 },
  ];
  const pigeonParts = [
    piece(ball(1), 0x9aa4b8, [0, .12, 0], [0, 0, 0], [.11, .09, .15]),
    piece(ball(1), 0xa98bbb, [0, .14, .08], [0, 0, 0], [.08, .07, .07]),
    piece(ball(.065), 0x7d879f, [0, .22, .12]),
    piece(cylinder(0, .018, .05, 6), MARIGOLD, [0, .22, .2], [Math.PI / 2, 0, 0]),
    piece(rounded(.09, .02, .13, .008), 0x6f7890, [0, .13, -.17], [-.3, 0, 0]),
    ...[-1, 1].map((side) => piece(cylinder(.008, .008, .06, 4), PINK, [side * .03, .03, 0])),
  ];
  const pigeons = ambient(new THREE.InstancedMesh(mergeGeometries(pigeonParts), toy, perches.length));
  pigeonParts.forEach((part) => part.dispose());
  const confetti = ambient(new THREE.InstancedMesh(new THREE.PlaneGeometry(.08, .12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), 28));
  for (let index = 0; index < confetti.count; index++) confetti.setColorAt(index, scratch.color.set(FLAGS[index % FLAGS.length]));

  // Statue station: plinth, the verdigris bust that turns, his headline on a ribbon and four bio medallions.
  const statue = station('hall:statue');
  solid([
    piece(rounded(1, .22, 1, .05), MARIGOLD, [STATUE.x, .11, STATUE.z]),
    piece(rounded(.8, .82, .8, .05), CREAM, [STATUE.x, .63, STATUE.z]),
    piece(rounded(1, .16, 1, .05), MARIGOLD, [STATUE.x, 1.12, STATUE.z]),
    piece(rounded(.46, .2, .03, .01), TEAL, [STATUE.x, .66, STATUE.z + .41]),
    piece(new THREE.CircleGeometry(.07, 5), MARIGOLD, [STATUE.x, .66, STATUE.z + .43]),
    piece(rounded(2.95, .56, .08, .04), PINK, [STATUE.x, 2.78, WALL_Z + .05]),
    ...[-1, 1].map((side) => piece(new THREE.CircleGeometry(.3, 3), 0xd65a7f, [STATUE.x + side * 1.52, 2.78, WALL_Z + .03], [0, 0, side > 0 ? 0 : Math.PI])),
  ], statue);
  label(CELLS.headline, 2.7, [STATUE.x, 2.78, WALL_Z + .1], statue);
  const bust = solid([
    piece(rounded(.7, .25, .4, .12), VERDIGRIS, [0, .1, 0]),
    piece(ball(1), VERDIGRIS, [0, .22, 0], [0, 0, 0], [.46, .2, .28]),
    piece(cylinder(.1, .12, .18, 10), VERDIGRIS, [0, .38, 0]),
    piece(ball(.25), VERDIGRIS, [0, .62, 0], [0, 0, 0], [1, 1.1, 1]),
    ...[-1, 1].map((side) => piece(ball(.06), VERDIGRIS, [side * .24, .62, 0])),
    piece(ball(.05), VERDIGRIS, [0, .63, .25]),
    piece(ball(1), VERDIGRIS_DEEP, [0, .5, .08], [0, 0, 0], [.22, .17, .17]),
    piece(ball(.32), VERDIGRIS_DEEP, [0, .86, -.04]),
    ...Array.from({ length: 8 }, (_, index) => piece(ball(.17), VERDIGRIS_DEEP, [Math.cos(index * TAU / 8) * .27, .8 + .08 * Math.sin(index * 1.7), -.04 + Math.sin(index * TAU / 8) * .2])),
  ], statue, [STATUE.x, BUST_Y, STATUE.z]);
  const medallions = [TEAL, MARIGOLD, SKY, LEAF].map((color, index) => {
    const medallion = new THREE.Group();
    medallion.position.set(STATUE.x + (index - 1.5) * .78, 3.72, WALL_Z + .1);
    statue.add(medallion);
    solid([piece(cylinder(.32, .32, .07, 20), color, [0, 0, 0], [Math.PI / 2, 0, 0]), piece(cylinder(.27, .27, .08, 20), CREAM, [0, 0, .005], [Math.PI / 2, 0, 0])], medallion);
    label([index * 256, 624, 256, 256], .44, [0, 0, .05], medallion);
    return medallion;
  });
  const spins = { bust: 0, medallions: [0, 0, 0, 0] };

  // Stat station: a flip board on the wall that counts up from the podium in front of it.
  const board = station('hall:stat');
  const digits = String(stat.value).length, total = digits * .7 + .66, left = -total / 2;
  const bulbs = [
    ...Array.from({ length: 12 }, (_, index) => [-1.43 + index * 2.86 / 11, BOARD_Y + .75]),
    ...Array.from({ length: 3 }, (_, index) => [1.54, BOARD_Y + .38 - index * .38]),
    ...Array.from({ length: 12 }, (_, index) => [1.43 - index * 2.86 / 11, BOARD_Y - .75]),
    ...Array.from({ length: 3 }, (_, index) => [-1.54, BOARD_Y - .38 + index * .38]),
  ];
  solid([
    piece(rounded(3.2, 1.62, .14, .06), NAVY, [0, BOARD_Y, WALL_Z + .07]),
    piece(rounded(2.96, 1.38, .04, .03), 0x1c2b55, [0, BOARD_Y, WALL_Z + .15]),
    ...Array.from({ length: digits }, (_, index) => piece(rounded(.66, .92, .04, .02), 0x14203f, [left + .35 + index * .7, DIGIT_Y, WALL_Z + .18])),
    piece(rounded(digits * .7 - .04, .04, .04, .015), MARIGOLD, [left + digits * .35, DIGIT_Y + TILE.height / 2 + .03, WALL_Z + .22]),
  ], board);
  solid([
    piece(rounded(.7, 1, .5, .05), NAVY, [PODIUM.x, .5, PODIUM.z]),
    piece(rounded(.82, .08, .6, .03), MARIGOLD, [PODIUM.x, 1.04, PODIUM.z]),
    piece(new THREE.CircleGeometry(.17, 5), MARIGOLD, [PODIUM.x, .62, PODIUM.z + .255]),
    piece(new THREE.TorusGeometry(.2, .025, 6, 20), CREAM, [PODIUM.x, .62, PODIUM.z + .255]),
    piece(cylinder(.012, .012, .3, 6), NAVY, [PODIUM.x - .24, 1.2, PODIUM.z - .1], [.35, 0, 0]),
    piece(ball(.045), 0x3a3f4f, [PODIUM.x - .24, 1.35, PODIUM.z - .05]),
  ], board);
  const flaps = Array.from({ length: digits }, (_, index) => {
    const hinge = new THREE.Group();
    hinge.position.set(left + .35 + index * .7, DIGIT_Y + TILE.height / 2, WALL_Z + .22);
    board.add(hinge);
    const flap = label(digitCell(0), TILE.width, [0, -TILE.height / 2, 0], hinge);
    return { hinge, geometry: flap.geometry as THREE.PlaneGeometry, digit: -1, turn: 1 };
  });
  const showStat = (value: number) => String(value).padStart(digits, '0').slice(-digits).split('').forEach((character, index) => {
    const flap = flaps[index], digit = Number(character);
    if (flap.digit === digit) return;
    if (flap.digit >= 0) flap.turn = 0;
    flap.digit = digit;
    mapCell(flap.geometry, digitCell(digit));
  });
  showStat(stat.value);
  label(CELLS.suffix, .6, [left + digits * .7 + .33, DIGIT_Y - .14, WALL_Z + .2], board);
  label(CELLS.caption, 2.5, [0, 2.62, WALL_Z + .18], board);
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(.045, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbs.length);
  bulbs.forEach(([x, y], index) => {
    lights.setMatrixAt(index, scratch.matrix.makeTranslation(x, y, WALL_Z + .16));
    lights.setColorAt(index, scratch.color.set([MARIGOLD, PINK, SKY][index % 3]));
  });
  board.add(lights);
  const buttonLight = new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false });
  const button = new THREE.Mesh(cylinder(.08, .09, .05, 16), buttonLight);
  button.position.set(PODIUM.x, 1.105, PODIUM.z - .18);
  board.add(button);

  // Globe station: a tilted globe on a brass stand with a pin on Kuala Lumpur, and a signpost to the city.
  const globe = station('hall:globe');
  solid([
    piece(cylinder(.4, .46, .12, 16), NAVY, [GLOBE.x, .06, GLOBE.z]),
    piece(cylinder(.04, .06, .82, 10), MARIGOLD, [GLOBE.x, .53, GLOBE.z]),
    piece(new THREE.TorusGeometry(.63, .025, 6, 24, Math.PI), MARIGOLD, [GLOBE.x, GLOBE_Y, GLOBE.z], [0, 0, -Math.PI / 2]),
    piece(rounded(.24, .1, .24, .03), NAVY, [POST.x, .05, POST.z]),
    piece(cylinder(.05, .06, 2.5, 8), NAVY, [POST.x, 1.25, POST.z]),
    piece(ball(.08), MARIGOLD, [POST.x, 2.55, POST.z]),
  ], globe);
  const tilt = new THREE.Group();
  tilt.position.set(GLOBE.x, GLOBE_Y, GLOBE.z); tilt.rotation.z = -.41;
  const earth = new THREE.Group();
  tilt.add(earth); globe.add(tilt);
  solid([
    piece(new THREE.SphereGeometry(GLOBE_R, 24, 16), 0x3b9fd8),
    ...[[45, -100, .26, .2], [-15, -60, .14, .24], [72, -40, .09, .07], [52, 15, .13, .09], [5, 20, .2, .24], [48, 90, .32, .18], [20, 78, .09, .1], [KL[0], KL[1], .06, .09], [-3, 115, .12, .05], [-25, 134, .16, .11]].map(([lat, lon, width, height], index) => {
      const normal = surface(lat, lon), turn = scratch.euler.setFromQuaternion(scratch.rotation.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal));
      return piece(ball(1), index === 9 ? MARIGOLD : LEAF, normal.multiplyScalar(GLOBE_R - .02).toArray(), [turn.x, turn.y, turn.z], [width, height, .05]);
    }),
  ], earth);
  const pin = new THREE.Group();
  pin.position.copy(surface(...KL).multiplyScalar(GLOBE_R));
  pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface(...KL));
  earth.add(pin);
  const pinHead = solid([piece(cylinder(.012, .012, .2, 6), NAVY, [0, .1, 0]), piece(ball(.055), PINK, [0, .22, 0])], pin);
  const pulse = solid([piece(new THREE.TorusGeometry(.08, .014, 6, 18), PINK, [0, 0, 0], [Math.PI / 2, 0, 0])], pin, [0, .01, 0]);
  const signBoard = new THREE.Group();
  signBoard.position.set(POST.x, 2.3, POST.z + .07);
  globe.add(signBoard);
  solid([
    piece(rounded(2.1, .6, .06, .05), MARIGOLD, [-.7, 0, 0]),
    piece(new THREE.CircleGeometry(.3, 3), MARIGOLD, [-1.75, 0, 0], [0, 0, Math.PI]),
    piece(rounded(1.98, .5, .02, .04), CREAM, [-.7, 0, .03]),
  ], signBoard);
  label(CELLS.place, 1.92, [-.7, 0, .045], signBoard);
  let earthSpin = 0;

  const energy: Record<string, number> = { 'hall:statue': 0, 'hall:stat': 0, 'hall:globe': 0 };
  const layPigeons = (time: number) => {
    const { matrix, position, rotation, euler, scale } = scratch;
    perches.forEach((perch, index) => {
      const peck = .55 * Math.max(0, Math.sin(time * 2.3 + index * 1.7)) ** 6;
      position.set(perch.x, perch.y + .03 * Math.max(0, Math.sin(time * 1.1 + index * 2)) ** 12, perch.z);
      let yaw = perch.yaw + .3 * Math.sin(time * .7 + index);
      if (index === 0) {
        // Startled off the bust while he presents it, circling until he is done.
        const lift = energy['hall:statue'], angle = time * 2.2;
        position.x += lift * Math.cos(angle) * .7; position.y += lift * (.6 + .1 * Math.sin(time * 9)); position.z += lift * Math.sin(angle) * .5;
        yaw = THREE.MathUtils.lerp(yaw, -angle, lift);
      }
      pigeons.setMatrixAt(index, matrix.compose(position, rotation.setFromEuler(euler.set(peck, yaw, 0)), scale.set(1, 1, 1)));
    });
    pigeons.instanceMatrix.needsUpdate = true;
  };
  layPigeons(0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let index = 0; index < confetti.count; index++) confetti.setMatrixAt(index, zero);
  let confettiShown = false;
  // His first job's start year, for the stat's second line.
  const start = Math.min(...content.career.map((job) => Number(/\d{4}/.exec(job.period)?.[0] ?? Infinity)));
  const first = content.career.find((job) => job.period.includes(String(start)));

  const stations: Station[] = [
    {
      id: 'hall:statue', kind: 'admire', label: 'Statue of Noah', stand: { x: -2.98, z: -2.05 }, heading: 0, reach: { x: -3.45, y: 1.12, z: -2.25 },
      present: {
        lines: [
          { id: 'hall-headline', line: `${content.headline}, that's me!`, source: BIO },
          { id: 'hall-design', line: 'I have a keen eye for design and a love for efficient, scalable solutions.', source: BIO },
          { id: 'hall-code', line: 'Front end or back end, I bring ideas to life through code.', source: BIO },
        ] satisfies CharacterLine[],
      },
    },
    {
      id: 'hall:stat', kind: 'tinker', label: `${stat.value}${stat.suffix} ${stat.caption} flip board`, stand: { x: PODIUM.x, z: PODIUM.z - .72 }, heading: 0, reach: { x: PODIUM.x, y: 1.1, z: PODIUM.z - .18 },
      present: {
        lines: [
          { id: 'hall-stat', line: `${stat.value}${stat.suffix} ${stat.caption}, and counting!`, source: CAREER },
          ...(first ? [{ id: 'hall-stat-start', line: `It started in ${start} at ${first.company}.`, source: CAREER } satisfies CharacterLine] : []),
        ] satisfies CharacterLine[],
      },
    },
    {
      id: 'hall:globe', kind: 'play', label: `${content.location} globe`, stand: { x: 2.95, z: -2 }, heading: 0, reach: { x: 3.6, y: 1.3, z: -2.3 },
      present: {
        lines: [
          { id: 'hall-location', line: `Home base: ${content.location}!`, source: BIO },
          { id: 'hall-location-work', line: `From ${city.trim()} I work across backend, infra and frontend.`, source: CAREER },
        ] satisfies CharacterLine[],
      },
    },
  ];
  for (const entry of stations) entry.heading = Math.atan2(entry.reach.x - entry.stand.x, entry.reach.z - entry.stand.z);
  group.updateMatrixWorld(true);

  return {
    id: 'hall',
    group,
    bounds: { ...BOUNDS },
    obstacles: [
      { id: 'statue', x: STATUE.x, z: STATUE.z, radius: .62 },
      { id: 'globe', x: GLOBE.x, z: GLOBE.z, radius: .62 },
      { id: 'signpost', x: POST.x, z: POST.z, radius: .15 },
      { id: 'podium', x: PODIUM.x, z: PODIUM.z, radius: .38 },
      { id: 'fountain', x: FOUNTAIN.x, z: FOUNTAIN.z, radius: 1.08 },
      ...[-1, 1].map((side): Obstacle => ({ id: `bench-${side}`, x: BENCH.x + side * .4, z: BENCH.z, radius: .45 })),
      ...[-1, 1].flatMap((side): Obstacle[] => [{ id: `lamp-${side}`, x: side * LAMP_X, z: LAMP_Z, radius: .42 }, { id: `tower-${side}`, x: side * 6.35, z: -3.75, radius: .62 }]),
    ],
    stations,
    entry: { x: 1.6, z: 3.1 },
    view: { center: { x: 0, y: 2.4, z: -.4 } },
    pick: (raycaster) => {
      group.updateWorldMatrix(true, true);
      for (let node: THREE.Object3D | null = raycaster.intersectObject(group, true)[0]?.object ?? null; node; node = node.parent) {
        if (typeof node.userData.station === 'string') return node.userData.station;
      }
      return null;
    },
    update: (dt, elapsed, activity) => {
      for (const id of Object.keys(energy)) energy[id] = THREE.MathUtils.clamp(energy[id] + (activity.stationId === id ? 4 : -3) * dt, 0, 1);
      const { matrix, position, rotation, euler, scale, color } = scratch;

      // Ambient: clock, lanterns, bunting, fountain, pigeons.
      hands[0].rotation.z = -elapsed * TAU / 720; hands[1].rotation.z = -elapsed * TAU / 60;
      glow.color.set(0xffd27a).multiplyScalar(.88 + .12 * Math.sin(elapsed * 7.3) * Math.sin(elapsed * 3.1));
      bunting.forEach((point, index) => flags.setMatrixAt(index, matrix.compose(point, rotation.setFromEuler(euler.set(.3 * Math.sin(elapsed * 2.2 + index * .7), 0, .08 * Math.sin(elapsed * 1.6 + index))), scale.set(1, 1, 1))));
      flags.instanceMatrix.needsUpdate = true;
      for (let index = 0; index < drops.count; index++) {
        const angle = index * TAU / 4 + Math.floor(index / 4) * .4, t = (elapsed * .8 + index * .29) % 1, reach = .38 + t * .42;
        drops.setMatrixAt(index, matrix.makeTranslation(FOUNTAIN.x + Math.cos(angle) * reach, 1.2 + .52 * t - 1.27 * t * t, FOUNTAIN.z + Math.sin(angle) * reach));
      }
      drops.instanceMatrix.needsUpdate = true;
      layPigeons(elapsed);

      // Statue: the bust turns, the medallions spin out and confetti falls while he presents it.
      const lift = energy['hall:statue'];
      spins.bust = lift > 0 ? spins.bust + dt * lift * 2.6 : settle(spins.bust, dt);
      bust.rotation.y = spins.bust + .08 * Math.sin(elapsed * .6);
      bust.position.y = BUST_Y + lift * .08 * Math.abs(Math.sin(elapsed * 5));
      medallions.forEach((medallion, index) => {
        spins.medallions[index] = lift > 0 ? spins.medallions[index] + dt * lift * (3 + index) : settle(spins.medallions[index], dt);
        medallion.rotation.y = spins.medallions[index] + .15 * Math.sin(elapsed * 1.1 + index);
        medallion.position.z = WALL_Z + .1 + lift * .2;
        medallion.scale.setScalar(1 + lift * .18 * (.5 + .5 * Math.sin(elapsed * 6 + index)));
      });
      if (lift > 0 || confettiShown) {
        for (let index = 0; index < confetti.count; index++) {
          const t = (elapsed * .55 + index * .618) % 1, spread = .35 + t * .5;
          position.set(STATUE.x + Math.sin(index * 2.4) * spread, 3.1 - t * 2, STATUE.z + Math.cos(index * 2.4) * spread * .7);
          confetti.setMatrixAt(index, matrix.compose(position, rotation.setFromEuler(euler.set(t * 9 + index, t * 7, index)), scale.setScalar(lift)));
        }
        confetti.instanceMatrix.needsUpdate = true;
        confettiShown = lift > 0;
      }

      // Stat: counts up with the presentation; the bulbs chase and the podium button flashes.
      const count = energy['hall:stat'];
      showStat(activity.stationId === 'hall:stat' ? Math.round(stat.value * THREE.MathUtils.smoothstep(activity.progress, .05, .55)) : stat.value);
      for (const flap of flaps) {
        flap.turn = Math.min(1, flap.turn + dt * 6);
        flap.hinge.rotation.x = -((1 - flap.turn) ** 2) * Math.PI / 2;
      }
      bulbs.forEach((_, index) => {
        const twinkle = Math.max(0, Math.sin(elapsed * 2 + index * 1.3)), chase = Math.max(0, Math.sin(elapsed * 10 - index * .8)) ** 4;
        lights.setColorAt(index, color.set([MARIGOLD, PINK, SKY][index % 3]).lerp(WHITE, .25 * twinkle + count * .7 * chase));
      });
      if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
      buttonLight.color.set(PINK).lerp(WHITE, count * (.5 + .5 * Math.sin(elapsed * 12)));
      button.position.y = 1.105 - count * .02 * (.5 + .5 * Math.sin(elapsed * 12));

      // Globe: idles round; while he presents it, it turns Kuala Lumpur to the front and the pin bounces.
      const turn = energy['hall:globe'];
      earthSpin += dt * .35 * (1 - turn);
      if (turn > 0) {
        const front = -THREE.MathUtils.degToRad(KL[1]);
        earthSpin += (front + Math.round((earthSpin - front) / TAU) * TAU - earthSpin) * (1 - Math.exp(-dt * 4 * turn));
      }
      earth.rotation.y = earthSpin;
      pinHead.position.y = turn * .08 * Math.abs(Math.sin(elapsed * 6));
      pinHead.scale.setScalar(1 + turn * .5);
      pulse.scale.setScalar(.9 + .1 * Math.sin(elapsed * 2) + turn * 2.2 * ((elapsed * 1.4) % 1));
      signBoard.rotation.z = .04 * Math.sin(elapsed * 1.3) + turn * .1 * Math.sin(elapsed * 6);
    },
    dispose: () => {
      const owned = new Set<{ dispose: () => void }>();
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        owned.add(node.geometry);
        for (const material of [node.material].flat()) {
          owned.add(material);
          if ('map' in material && material.map instanceof THREE.Texture) owned.add(material.map);
        }
        if (node instanceof THREE.InstancedMesh) owned.add(node);
      });
      owned.forEach((resource) => resource.dispose());
    },
  };
};

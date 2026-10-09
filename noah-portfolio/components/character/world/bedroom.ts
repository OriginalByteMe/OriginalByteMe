import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AreaBuilder, Obstacle, Station, WorldArea } from './types';

const COLOR = {
  cream: 0xf4ecdf, plum: 0x72509c, lilac: 0xb39bc3, coral: 0xeb9a84, sage: 0xa6b4a0, peach: 0xe8b38b,
  mauve: 0x9681b8, paper: 0xfffaf3, floor: 0xe6c9a3, plank: 0xd2ad84, wall: 0xfbeed6, sideWall: 0xeee3ec, mintWall: 0xe1f0e6,
  rug: 0xd8c8e3, ink: 0x4b4458, steel: 0x6d6380, slate: 0x5c5470, night: 0x2b2738, silver: 0xcfd2da, leaf: 0x8fae86,
  brass: 0xd8a14a, terracotta: 0xd58f6f, bulb: 0xfff1c9, mint: 0xa9d8c0, butter: 0xf6dc8c, rose: 0xf2b5c4, sky: 0x9fd3f0,
};
type Piece = [color: number, geometry: THREE.BufferGeometry];

// Area-local layout. Back wall at z -4.1 with the back door centred on x = 0, side walls at x = ±6.6, the open
// front at z 4.2. The corridor |x| <= 0.8 from the stoop behind the door to the front stays clear: the intro runs
// him down it. The desk sits at 45 degrees in the back-left corner, its local +z toward the chair, so the MacBook
// screen faces the camera side of the room.
const DESK = new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(-5.6, 0, -3.12);
const LID = DESK.clone().multiply(new THREE.Matrix4().makeRotationX(-.26).setPosition(0, .804, .06));
const PRINTER = new THREE.Matrix4().makeTranslation(2.8, .75, -3.65);
const RACK = new THREE.Matrix4().makeTranslation(5.75, 0, -3.55);
const ARMCHAIR = new THREE.Matrix4().makeRotationY(-.7).setPosition(5.2, 0, 2.55);
const deskPoint = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(DESK);
/** Desk chair and bed: his hip is at 0.59, so his feet stay on the floor. */
const SEAT = .33;
const BALL_REST = { x: -2.5, y: .6, z: 1.375 }; // on the toy basket lid
const BOOK_REST = { x: -2.25, y: .3675, z: -2.92 }; // on the blanket beside the bed seat
const ROW = [-.28, -.22, -.16, -.1];
const PORTS = Array.from({ length: 8 }, (_, i) => -.26 + i * .07);
const FANS = [[.22, .79], [.22, 1.07], [.2, 2.02]];
const LED_SPOTS = [...[-.25, -.1, .05, .2].map((x) => [x, .19]), ...[.79, 1.07, 1.31].flatMap((y) => ROW.map((x) => [x, y])), ...PORTS.map((x) => [x, 1.555])];
// The rack's network cable runs along the floor round the dining table and the armchair, past the exit and over the front edge toward the lab below.
const CABLE = [[5.45, .3, -3.12], [5.45, .03, -2.92], [5.35, .03, -2.5], [5.25, .03, -1.6], [5.2, .03, -.4], [5.1, .03, .9], [4.4, .03, 1.6], [3.4, .03, 2.3],
  [2.7, .03, 2.95], [2.25, .03, 3.7], [2.22, .03, 4.08], [2.2, 0, 4.16], [2.19, -.12, 4.22], [2.18, -.46, 4.24]];
// Four drapes of fairy lights along the top of the back wall, seven bulbs each.
const DRAPES = [-6.3, -3.15, 0, 3.15, 6.3];
const sag = (x: number) => {
  const drape = Math.min(3, Math.floor((x - DRAPES[0]) / 3.15));
  return 3.85 - .28 * Math.sin(Math.PI * (x - DRAPES[drape]) / 3.15);
};
const BULBS = Array.from({ length: 28 }, (_, i) => DRAPES[0] + (Math.floor(i / 7) + (i % 7 + .5) / 7) * 3.15);
const deskStand = deskPoint(0, 0, .605);
const STATIONS: Station[] = [
  // The sit clip puts the pelvis 0.15 behind the stand point, so seats sit directly under it.
  { id: 'desk', kind: 'type', label: 'MacBook', stand: { x: deskStand.x, z: deskStand.z }, heading: -3 * Math.PI / 4, reach: deskPoint(0, .807, .2), seat: SEAT },
  // Printer and rack stands sit to one side so he does not hide the machine from the front camera.
  { id: 'printer', kind: 'watch', label: '3D printer', stand: { x: 3.6, z: -3 }, heading: Math.atan2(3 - 3.6, -3.36 + 3), reach: { x: 3, y: .8, z: -3.36 } },
  { id: 'rack', kind: 'tinker', label: 'Server rack', stand: { x: 5.05, z: -2.85 }, heading: Math.atan2(5.7 - 5.05, -3.12 + 2.85), reach: { x: 5.7, y: 1.31, z: -3.12 } },
  { id: 'ball', kind: 'ball', label: 'Ball', stand: { x: -2.2, z: 1 }, heading: 0, reach: BALL_REST },
  { id: 'bed', kind: 'read', label: 'Bed', stand: { x: -2.7, z: -2.62 }, heading: 0, reach: BOOK_REST, seat: SEAT },
];
const OBSTACLES: Obstacle[] = [
  // Desk-local circles: the desk front stops 0.23 short of the stand point; the chair is parked off his path.
  ...[{ id: 'desk', x: 0, z: -.07, radius: .44 }, { id: 'desk', x: -.42, z: -.07, radius: .45 }, { id: 'desk', x: .42, z: -.07, radius: .45 },
    { id: 'desk', x: -.62, z: .12, radius: .3 }, { id: 'desk', x: .62, z: .12, radius: .3 }, { id: 'chair', x: -.62, z: 1, radius: .3 }]
    .map(({ id, x, z, radius }) => { const point = deskPoint(x, 0, z); return { id, x: point.x, z: point.z, radius }; }),
  ...[-4.15, -3.65, -3.15, -2.65, -2.15].map((x) => ({ id: 'bed', x, z: -3.4, radius: .55 })),
  { id: 'bed', x: -4.25, z: -2.95, radius: .25 }, { id: 'bed', x: -2.05, z: -2.95, radius: .25 },
  { id: 'plant', x: -1.35, z: -3.6, radius: .3 },
  { id: 'bench', x: 1.5, z: -3.75, radius: .3 },
  { id: 'printer', x: 2.6, z: -3.65, radius: .42 }, { id: 'printer', x: 3.2, z: -3.65, radius: .42 },
  { id: 'rack', x: 5.75, z: -3.55, radius: .58 },
  { id: 'toybox', x: BALL_REST.x, z: BALL_REST.z, radius: .25 },
  ...[-.7, -.2, .3].map((z) => ({ id: 'bookcase', x: -6.15, z, radius: .35 })),
  { id: 'beanbag', x: -4.7, z: 1.7, radius: .55 },
  { id: 'plant', x: -5.9, z: 3.45, radius: .4 },
  ...[-1.55, -1.05, -.55, -.05].map((z) => ({ id: 'kitchen', x: 6.15, z, radius: .35 })),
  { id: 'fridge', x: 6.1, z: .75, radius: .45 },
  { id: 'plant', x: 6.05, z: 1.7, radius: .3 },
  // One circle round the table and both stools: a cluster of touching circles traps the walk.
  { id: 'table', x: 3.3, z: -.6, radius: 1.2 },
  { id: 'armchair', x: 5.2, z: 2.55, radius: .55 },
  { id: 'lamp', x: 6.05, z: 3.6, radius: .25 },
];

const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, radius);
const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => new THREE.BoxGeometry(width, height, depth).translate(x, y, z);
/** Every piece carries its colour per vertex, so static furniture merges into one draw call per station. */
const tinted = (geometry: THREE.BufferGeometry, hex: number) => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const color = new THREE.Color(hex);
  const colors = new Float32Array(flat.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return flat;
};
const shape = (pieces: Piece[]) => {
  const parts = pieces.map(([hex, geometry]) => tinted(geometry, hex));
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
};
/** Stable per-LED, per-step coin flip: blinking stays deterministic without Math.random. */
const noise = (index: number, step: number) => {
  let h = Math.imul(index + 1, 374761393) ^ Math.imul(step + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** A potted leafy plant standing on the floor at (x, z). */
const plant = (x: number, z: number, scale: number, pot: number): Piece[] => [
  [pot, new THREE.CylinderGeometry(.22 * scale, .17 * scale, .42 * scale, 16).translate(x, .21 * scale, z)],
  [COLOR.night, new THREE.CylinderGeometry(.2 * scale, .2 * scale, .02, 16).translate(x, .41 * scale, z)],
  ...[[0, .85, 0, .26], [-.2, .7, .1, .2], [.21, .72, .1, .2], [-.1, 1.1, -.05, .2], [.13, 1.05, 0, .18], [0, 1.3, -.02, .16]]
    .map(([dx, y, dz, radius], i): Piece => [i % 2 ? COLOR.sage : COLOR.leaf, new THREE.SphereGeometry(radius * scale, 10, 8).translate(x + dx * scale, y * scale, z + dz * scale)]),
];

/** Noah's house, the top island: an open-front cutaway with his corner desk and MacBook, bed, 3D printer, homelab rack, kitchenette and a back door the intro runs him through from the stoop behind it. */
export const createBedroom: AreaBuilder = (origin) => {
  const group = new THREE.Group();
  group.name = 'bedroom';
  group.position.copy(origin);
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const pickables: THREE.Object3D[] = [];
  const buckets = new Map<string, { station: string | null; lit: boolean; pieces: Piece[] }>();
  const place = (station: string | null, frame: THREE.Matrix4 | null, pieces: Piece[], lit = false) => {
    const key = `${station}:${lit}`;
    const bucket = buckets.get(key) ?? buckets.set(key, { station, lit, pieces: [] }).get(key)!;
    for (const [hex, geometry] of pieces) bucket.pieces.push([hex, frame ? geometry.applyMatrix4(frame) : geometry]);
  };
  const mesh = <T extends THREE.Mesh>(node: T, name: string, station: string | null, parent: THREE.Object3D = group) => {
    node.name = name; parent.add(node);
    if (station) { node.userData.station = station; pickables.push(node); }
    return node;
  };

  // House shell: island slab, plank floor, back wall around the window and door openings, gable, roof edge, chimney, side walls and posts.
  const gable = new THREE.Shape([new THREE.Vector2(-6.725, 0), new THREE.Vector2(6.725, 0), new THREE.Vector2(0, 1.2)]);
  const pitch = Math.atan2(1.2, 6.725);
  place(null, null, [
    [COLOR.lilac, rounded(13.6, .58, 8.65, .22, 2).translate(0, -.31, -.125)],
    // The stoop behind the back door: the island juts out under it, its paving flush with the floor.
    [COLOR.lilac, rounded(2.6, .58, 2.1, .22, 2).translate(0, -.31, -5.05)],
    [COLOR.peach, box(2.4, .1, 1.8, 0, -.05, -5)],
    [COLOR.floor, box(13.2, .1, 8.3, 0, -.05, .05)],
    ...Array.from({ length: 21 }, (_, i): Piece => [COLOR.plank, box(.025, .004, 8.2, -6 + i * .6, .002, .05)]),
    [COLOR.wall, box(3.125, 4, .3, -5.1625, 2, -4.1)],
    [COLOR.wall, box(1.2, 1.4, .3, -3, .7, -4.1)],
    [COLOR.wall, box(1.2, 1.4, .3, -3, 3.3, -4.1)],
    [COLOR.wall, box(1.7, 4, .3, -1.55, 2, -4.1)],
    [COLOR.wall, box(1.4, 1, .3, 0, 3.5, -4.1)],
    [COLOR.wall, box(6.025, 4, .3, 3.7125, 2, -4.1)],
    [COLOR.peach, new THREE.ExtrudeGeometry(gable, { depth: .3, bevelEnabled: false }).translate(0, 4, -4.25)],
    [COLOR.paper, new THREE.TorusGeometry(.32, .05, 6, 24).translate(0, 4.45, -3.94)],
    [COLOR.sky, new THREE.CircleGeometry(.3, 24).translate(0, 4.45, -3.945)],
    ...[-1, 1].map((side): Piece => [COLOR.terracotta, rounded(Math.hypot(6.725, 1.2) + .35, .22, .6, .06).rotateZ(-side * pitch).translate(side * 3.3625, 4.72, -4.15)]),
    [COLOR.terracotta, rounded(.55, 1, .55, .04).translate(4.3, 4.95, -4.15)],
    [COLOR.paper, rounded(.65, .1, .65, .03).translate(4.3, 5.48, -4.15)],
    [COLOR.sideWall, box(.25, 4, 8.35, -6.6, 2, -.075)],
    [COLOR.mintWall, box(.25, 4, 8.35, 6.6, 2, -.075)],
    ...[-1, 1].flatMap((side): Piece[] => [
      [COLOR.plum, rounded(.4, .14, 8.45, .05).translate(side * 6.6, 4.07, -.075)],
      [COLOR.coral, rounded(.42, 4.2, .42, .06).translate(side * 6.6, 2.1, 3.95)],
      [COLOR.butter, new THREE.SphereGeometry(.26, 14, 10).translate(side * 6.6, 4.45, 3.95)],
      // Lilac wainscot with a paper rail on the back and side walls.
      [COLOR.lilac, box(5.775, 1.15, .02, side * 3.5875, .575, -3.94)],
      [COLOR.paper, rounded(5.8, .06, .06, .02).translate(side * 3.5875, 1.17, -3.93)],
      [COLOR.lilac, box(.02, 1.15, 8.05, side * 6.465, .575, .075)],
      [COLOR.paper, rounded(.06, .06, 8.05, .02).translate(side * 6.455, 1.17, .075)],
    ]),
    // Back door frame, doormat and runner inside, a sconce above.
    ...[-1, 1].map((side): Piece => [COLOR.paper, box(.1, 3.05, .36, side * .75, 1.525, -4.1)]),
    [COLOR.paper, box(1.6, .12, .36, 0, 3.06, -4.1)],
    [COLOR.sage, box(1.1, .025, .55, 0, .0125, -3.6)],
    [COLOR.coral, box(1, .02, 2.6, 0, .01, -1.75)],
    ...[-2.8, -2.25, -1.75, -1.25, -.7].map((z): Piece => [COLOR.paper, box(1, .022, .08, 0, .011, z)]),
    [COLOR.brass, rounded(.2, .12, .08, .02).translate(0, 3.3, -3.91)],
    // Window above the bed: frame, sill, mullions, curtains on a rod.
    [COLOR.paper, rounded(1.36, .08, .32, .02).translate(-3, 2.64, -4.07)],
    [COLOR.paper, rounded(1.5, .08, .42, .02).translate(-3, 1.36, -4)],
    [COLOR.paper, rounded(.08, 1.2, .32, .02).translate(-3.64, 2, -4.07)],
    [COLOR.paper, rounded(.08, 1.2, .32, .02).translate(-2.36, 2, -4.07)],
    [COLOR.paper, box(.04, 1.2, .04, -3, 2, -4.07)],
    [COLOR.paper, box(1.2, .04, .04, -3, 2, -4.07)],
    [COLOR.brass, new THREE.CylinderGeometry(.015, .015, 1.9, 6).rotateZ(Math.PI / 2).translate(-3, 2.72, -3.86)],
    ...[-3.82, -2.18].map((x): Piece => [COLOR.rose, rounded(.32, 1.5, .06, .025).translate(x, 1.95, -3.86)]),
    // Reading lamp on the wall beside the window.
    [COLOR.brass, box(.04, .04, .25, -4.25, 1.75, -3.83)],
    [COLOR.sage, new THREE.ConeGeometry(.13, .18, 14).translate(-4.2, 1.66, -3.68)],
    // Landscape poster above the desk.
    [COLOR.plum, box(1, .8, .02, -5, 2.55, -3.94)],
    [COLOR.paper, box(.92, .72, .01, -5, 2.55, -3.925)],
    [COLOR.butter, new THREE.CircleGeometry(.1, 16).translate(-4.75, 2.72, -3.918)],
    [COLOR.sage, new THREE.CircleGeometry(.36, 3).rotateZ(Math.PI / 2).translate(-5.15, 2.38, -3.917)],
    [COLOR.lilac, new THREE.CircleGeometry(.28, 3).rotateZ(Math.PI / 2).translate(-4.8, 2.34, -3.916)],
    // Shoe bench and coat hooks right of the door.
    [COLOR.peach, rounded(1, .38, .36, .04).translate(1.5, .19, -3.75)],
    ...[[1.22, COLOR.coral], [1.36, COLOR.coral], [1.66, COLOR.sky], [1.8, COLOR.sky]].map(([x, hex]): Piece => [hex, rounded(.12, .1, .26, .04).translate(x, .43, -3.72)]),
    [COLOR.paper, box(1, .08, .06, 1.5, 2.2, -3.92)],
    ...[1.2, 1.5, 1.8].map((x): Piece => [COLOR.brass, new THREE.SphereGeometry(.03, 6, 4).translate(x, 2.18, -3.87)]),
    [COLOR.sage, rounded(.45, .8, .1, .05).translate(1.22, 1.75, -3.86)],
    [COLOR.rose, rounded(.12, .9, .06, .03).translate(1.8, 1.7, -3.88)],
    // Wire of the fairy lights.
    [COLOR.ink, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 81 }, (_, i) => {
      const x = DRAPES[0] + i * (DRAPES[4] - DRAPES[0]) / 80;
      return new THREE.Vector3(x, sag(x), -3.88);
    })), 160, .01, 4)],
    // Left wall: bookcase full of books with a trailing plant, clock face and a framed print.
    ...[-1.05, .45].map((z): Piece => [COLOR.coral, box(.38, 2, .04, -6.285, 1, z)]),
    [COLOR.coral, box(.02, 2, 1.5, -6.465, 1, -.3)],
    ...[.02, .52, 1.02, 1.52, 2].map((y): Piece => [COLOR.butter, box(.38, .04, 1.5, -6.285, y, -.3)]),
    ...[.04, .54, 1.04, 1.54].flatMap((base, level) => {
      const books: Piece[] = [];
      const inks = [COLOR.plum, COLOR.coral, COLOR.sage, COLOR.sky, COLOR.butter, COLOR.rose, COLOR.mauve, COLOR.mint];
      for (let z = -1, i = 0; z < .35; i++) {
        const width = .07 + noise(level * 40 + i, 1) * .06; const height = .28 + noise(level * 40 + i, 2) * .14;
        if (noise(level * 40 + i, 3) > .12) books.push([inks[(level * 3 + i) % inks.length], box(.26, height, width * .9, -6.32, base + height / 2, z + width / 2)]);
        z += width;
      }
      return books;
    }),
    [COLOR.terracotta, new THREE.CylinderGeometry(.1, .08, .16, 12).translate(-6.28, 2.1, -.3)],
    ...[[2.24, -.3, .13], [2.15, -.16, .09], [1.98, -.1, .06], [1.84, -.08, .05], [1.7, -.07, .045]]
      .map(([y, z, radius]): Piece => [COLOR.leaf, new THREE.SphereGeometry(radius, 8, 6).translate(-6.22, y, z)]),
    [COLOR.coral, new THREE.CylinderGeometry(.33, .33, .03, 24).rotateZ(Math.PI / 2).translate(-6.46, 2.9, 1.4)],
    [COLOR.paper, new THREE.CylinderGeometry(.29, .29, .04, 24).rotateZ(Math.PI / 2).translate(-6.455, 2.9, 1.4)],
    [COLOR.plum, box(.01, .03, .15, -6.43, 2.9, 1.465)],
    [COLOR.peach, box(.03, .9, .72, -6.46, 2.2, 2.7)],
    [COLOR.sage, box(.02, .8, .62, -6.445, 2.2, 2.7)],
    [COLOR.cream, new THREE.CircleGeometry(.16, 20).rotateY(Math.PI / 2).translate(-6.433, 2.32, 2.7)],
    [COLOR.coral, new THREE.CircleGeometry(.09, 3).rotateY(Math.PI / 2).translate(-6.432, 1.98, 2.55)],
    // Round rug, bean bag and plants on the left; the plant by the door.
    [COLOR.rug, new THREE.CylinderGeometry(1.5, 1.5, .03, 40).translate(-3.4, .015, 1.1)],
    [COLOR.coral, new THREE.RingGeometry(1.05, 1.17, 40).rotateX(-Math.PI / 2).translate(-3.4, .032, 1.1)],
    [COLOR.paper, new THREE.RingGeometry(.55, .65, 32).rotateX(-Math.PI / 2).translate(-3.4, .032, 1.1)],
    [COLOR.mauve, new THREE.SphereGeometry(.55, 16, 12).scale(1, .55, 1).translate(-4.7, .3, 1.7)],
    [COLOR.butter, rounded(.36, .12, .3, .05).rotateZ(.3).translate(-4.55, .6, 1.62)],
    ...plant(-1.35, -3.6, 1, COLOR.terracotta),
    ...plant(-5.9, 3.45, 1.35, COLOR.rose),
    ...plant(6.05, 1.7, .85, COLOR.sky),
    // Kitchenette on the right wall: counter, sink, kettle, mugs, jar shelf and a window, then the fridge.
    [COLOR.mint, rounded(.6, .86, 2, .04).translate(6.17, .43, -.8)],
    [COLOR.paper, rounded(.66, .06, 2.06, .02).translate(6.15, .89, -.8)],
    ...[-1.55, -1.05, -.55, -.05].flatMap((z): Piece[] => [
      [COLOR.butter, box(.02, .6, .44, 5.86, .43, z)],
      [COLOR.plum, new THREE.SphereGeometry(.025, 6, 4).translate(5.845, .62, z + .15)],
    ]),
    [COLOR.night, box(.4, .02, .5, 6.15, .915, -1.3)],
    [COLOR.silver, box(.03, .25, .03, 6.38, 1.04, -1.3)],
    [COLOR.silver, box(.18, .03, .03, 6.3, 1.16, -1.3)],
    [COLOR.coral, new THREE.CylinderGeometry(.1, .12, .18, 14).translate(6.15, 1.01, -.4)],
    [COLOR.plum, new THREE.SphereGeometry(.03, 6, 4).translate(6.15, 1.11, -.4)],
    [COLOR.coral, new THREE.ConeGeometry(.03, .14, 8).rotateZ(Math.PI / 2.6).translate(6.01, 1.04, -.4)],
    [COLOR.rose, new THREE.CylinderGeometry(.05, .05, .1, 12).translate(6.1, .97, 0)],
    [COLOR.sky, new THREE.CylinderGeometry(.05, .05, .1, 12).translate(6.25, .97, -.12)],
    [COLOR.peach, rounded(.28, .04, 1.6, .015).translate(6.33, 1.95, -.8)],
    ...[[-1.4, COLOR.sage], [-1, COLOR.butter], [-.6, COLOR.rose], [-.25, COLOR.lilac]].flatMap(([z, hex]): Piece[] => [
      [hex, new THREE.CylinderGeometry(.07, .07, .2, 12).translate(6.33, 2.07, z)],
      [COLOR.paper, new THREE.CylinderGeometry(.075, .075, .03, 12).translate(6.33, 2.185, z)],
    ]),
    [COLOR.paper, box(.04, .9, 1.1, 6.46, 2.95, -.8)],
    [COLOR.sky, box(.02, .78, .98, 6.44, 2.95, -.8)],
    [COLOR.paper, box(.03, .78, .04, 6.43, 2.95, -.8)],
    [COLOR.paper, box(.03, .04, .98, 6.43, 2.95, -.8)],
    [COLOR.sky, rounded(.7, 1.9, .75, .08).translate(6.1, .95, .75)],
    [COLOR.paper, box(.01, .02, .7, 5.745, 1.25, .75)],
    ...[1.45, .9].map((y): Piece => [COLOR.paper, box(.04, .3, .04, 5.73, y, .45)]),
    ...[[1.6, .95, COLOR.coral], [1.55, 1.05, COLOR.butter], [1.05, .85, COLOR.lilac]].map(([y, z, hex]): Piece => [hex, box(.02, .08, .08, 5.742, y, z)]),
    // Dining table with flowers and two stools on a striped rug.
    [COLOR.butter, box(3, .02, 2, 3.3, .01, -.6)],
    ...[-1.5, .3].map((z): Piece => [COLOR.rose, box(3, .022, .12, 3.3, .011, z)]),
    ...[1.9, 4.7].map((x): Piece => [COLOR.rose, box(.12, .022, 2, x, .011, -.6)]),
    [COLOR.peach, new THREE.CylinderGeometry(.6, .6, .06, 24).translate(3.3, .72, -.6)],
    [COLOR.plum, new THREE.CylinderGeometry(.06, .08, .66, 10).translate(3.3, .36, -.6)],
    [COLOR.plum, new THREE.CylinderGeometry(.3, .32, .05, 16).translate(3.3, .025, -.6)],
    [COLOR.sky, new THREE.CylinderGeometry(.07, .09, .22, 12).translate(3.3, .86, -.6)],
    ...[[3.25, 1.02, -.6, COLOR.rose], [3.36, 1.05, -.55, COLOR.butter], [3.3, 1, -.68, COLOR.coral]]
      .map(([x, y, z, hex]): Piece => [hex, new THREE.SphereGeometry(.07, 8, 6).translate(x, y, z)]),
    ...[[2.35, COLOR.butter], [4.25, COLOR.mint]].flatMap(([x, hex]): Piece[] => [
      [hex, new THREE.CylinderGeometry(.22, .22, .07, 16).translate(x, .45, -.6)],
      [COLOR.ink, new THREE.CylinderGeometry(.04, .04, .42, 8).translate(x, .21, -.6)],
      [COLOR.ink, new THREE.CylinderGeometry(.16, .17, .03, 12).translate(x, .015, -.6)],
    ]),
    // Floor lamp in the front-right corner.
    [COLOR.ink, new THREE.CylinderGeometry(.18, .2, .04, 14).translate(6.05, .02, 3.6)],
    [COLOR.ink, new THREE.CylinderGeometry(.02, .02, 1.7, 6).translate(6.05, .87, 3.6)],
    [COLOR.butter, new THREE.CylinderGeometry(.16, .26, .32, 16).translate(6.05, 1.75, 3.6)],
  ]);
  // Shelf of printed figurines above the printer: calibration cube, Linux penguin, rocket, trailing plant.
  place(null, new THREE.Matrix4().makeTranslation(1.4, .15, -1), [
    [COLOR.peach, rounded(1.4, .05, .3, .015).translate(1.5, 2.15, -2.8)],
    [COLOR.plum, box(.04, .14, .2, .95, 2.055, -2.85)],
    [COLOR.plum, box(.04, .14, .2, 2.05, 2.055, -2.85)],
    [COLOR.coral, rounded(.12, .12, .12, .015).translate(.98, 2.235, -2.8)],
    [COLOR.night, new THREE.SphereGeometry(.075, 12, 8).scale(1, 1.3, 1).translate(1.26, 2.27, -2.8)],
    [COLOR.paper, new THREE.SphereGeometry(.055, 10, 6).scale(1, 1.25, .6).translate(1.26, 2.26, -2.745)],
    [COLOR.peach, new THREE.ConeGeometry(.018, .045, 6).rotateX(Math.PI / 2).translate(1.26, 2.31, -2.715)],
    [COLOR.lilac, new THREE.CylinderGeometry(.04, .04, .16, 10).translate(1.55, 2.255, -2.8)],
    [COLOR.coral, new THREE.ConeGeometry(.04, .08, 10).translate(1.55, 2.375, -2.8)],
    [COLOR.coral, box(.13, .05, .012, 1.55, 2.2, -2.8)],
    [COLOR.coral, box(.012, .05, .13, 1.55, 2.2, -2.8)],
    [COLOR.sage, new THREE.CylinderGeometry(.07, .055, .1, 12).translate(1.88, 2.225, -2.8)],
    [COLOR.leaf, new THREE.SphereGeometry(.075, 8, 6).translate(1.88, 2.33, -2.8)],
    [COLOR.leaf, new THREE.SphereGeometry(.05, 8, 6).translate(1.95, 2.3, -2.73)],
    ...[[1.97, 2.12], [1.99, 2.02], [2, 1.93]].map(([x, y]): Piece => [COLOR.leaf, new THREE.SphereGeometry(.03, 6, 4).translate(x, y, -2.63)]),
  ]);
  // Poster between the shelf and the rack.
  place(null, new THREE.Matrix4().makeTranslation(1.45, .1, -1), [
    [COLOR.plum, box(.86, 1.1, .02, 2.95, 2.1, -2.94)],
    [COLOR.paper, box(.78, 1.02, .01, 2.95, 2.1, -2.925)],
    [COLOR.coral, new THREE.CircleGeometry(.13, 20).translate(3.12, 2.35, -2.918)],
    [COLOR.plum, new THREE.CircleGeometry(.3, 3).rotateZ(Math.PI / 2).translate(2.86, 1.81, -2.917)],
    [COLOR.lilac, new THREE.CircleGeometry(.24, 3).rotateZ(Math.PI / 2).translate(3.12, 1.78, -2.916)],
    [COLOR.sage, box(.78, .07, .004, 2.95, 1.625, -2.917)],
  ]);
  place(null, ARMCHAIR, [
    [COLOR.coral, rounded(.95, .3, .85, .06).translate(0, .2, 0)],
    [COLOR.butter, rounded(.7, .12, .66, .05).translate(0, .4, .06)],
    [COLOR.coral, rounded(.95, .75, .22, .06).translate(0, .55, -.33)],
    ...[-1, 1].map((side): Piece => [COLOR.coral, rounded(.18, .5, .85, .06).translate(side * .42, .4, 0)]),
    [COLOR.rose, rounded(.35, .3, .12, .05).translate(.12, .62, -.17)],
  ]);
  // Lit bulbs: the sconce over the door, the floor lamp and the desk lamp.
  place(null, null, [
    [COLOR.bulb, new THREE.SphereGeometry(.07, 10, 6).translate(0, 3.22, -3.86)],
    [COLOR.bulb, new THREE.SphereGeometry(.08, 10, 6).translate(6.05, 1.56, 3.6)],
  ], true);

  // Corner desk: drawers on the wall side, legs clear in front of the chair for his outstretched legs.
  place('desk', DESK, [
    [COLOR.peach, rounded(1.5, .07, .75, .03, 2).translate(0, .745, 0)],
    [COLOR.lilac, rounded(.42, .7, .66).translate(-.5, .355, -.02)],
    [COLOR.cream, rounded(.36, .28, .02, .008).translate(-.5, .53, .32)],
    [COLOR.cream, rounded(.36, .28, .02, .008).translate(-.5, .2, .32)],
    [COLOR.plum, rounded(.12, .025, .025, .008).translate(-.5, .6, .34)],
    [COLOR.plum, rounded(.12, .025, .025, .008).translate(-.5, .27, .34)],
    [COLOR.plum, box(.06, .71, .06, .68, .355, .3)],
    [COLOR.plum, box(.06, .71, .06, .68, .355, -.3)],
    [COLOR.silver, rounded(.46, .024, .32, .01).translate(0, .792, .215)],
    [COLOR.night, box(.4, .004, .14, 0, .805, .19)],
    [0xb9bcc6, box(.15, .003, .07, 0, .8045, .315)],
    [COLOR.plum, new THREE.CylinderGeometry(.09, .1, .03, 16).translate(.55, .795, -.15)],
    [COLOR.plum, new THREE.CylinderGeometry(.016, .016, .36, 8).translate(.55, .99, -.15)],
    [COLOR.coral, new THREE.ConeGeometry(.11, .14, 16).rotateX(-.5).translate(.55, 1.2, -.1)],
    [COLOR.paper, new THREE.CylinderGeometry(.055, .05, .12, 14).translate(-.48, .84, .15)],
    [COLOR.paper, new THREE.TorusGeometry(.035, .011, 6, 10).translate(-.425, .84, .15)],
    [COLOR.terracotta, new THREE.CylinderGeometry(.07, .055, .1, 12).translate(-.6, .83, -.2)],
    [COLOR.leaf, new THREE.SphereGeometry(.07, 8, 6).scale(1, 1.3, 1).translate(-.6, .94, -.2)],
    [COLOR.sage, new THREE.SphereGeometry(.05, 8, 6).translate(-.65, .93, -.14)],
  ]);
  place('desk', LID, [
    [COLOR.silver, rounded(.46, .3, .016, .008).translate(0, .15, -.008)],
    [COLOR.lilac, new THREE.CylinderGeometry(.04, .04, .004, 16).rotateX(Math.PI / 2).translate(0, .16, -.018)],
  ]);
  place('desk', DESK, [[COLOR.bulb, new THREE.SphereGeometry(.04, 10, 6).translate(.55, 1.14, -.075)]], true);

  // Code is drawn once; update() scrolls it through the texture offset.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#1f1b2e'; context.fillRect(0, 0, 256, 256);
    const inks = ['#eb9a84', '#b39bc3', '#a6b4a0', '#e8b38b', '#f4ecdf', '#8fc8e8'];
    let seed = 11;
    const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let line = 0; line < 32; line++) {
      if (random() < .12) continue;
      let x = 12 + Math.floor(random() * 4) * 16;
      for (let token = 1 + Math.floor(random() * 3); token > 0 && x < 236; token--) {
        const width = 16 + Math.floor(random() * 68);
        context.fillStyle = inks[Math.floor(random() * inks.length)];
        context.fillRect(x, line * 8 + 2, Math.min(width, 244 - x), 4);
        x += width + 10;
      }
    }
  }
  const code = new THREE.CanvasTexture(canvas);
  code.colorSpace = THREE.SRGBColorSpace;
  code.wrapT = THREE.RepeatWrapping;
  code.repeat.set(1, .5);
  mesh(new THREE.Mesh(new THREE.PlaneGeometry(.42, .26).translate(0, .155, .001).applyMatrix4(LID), new THREE.MeshBasicMaterial({ map: code })), 'macbook-screen', 'desk');
  const chair = mesh(new THREE.Mesh(shape([
    [COLOR.coral, rounded(.5, .07, .5).translate(0, SEAT - .035, 0)],
    [COLOR.coral, rounded(.48, .38, .06).translate(0, .57, .23)],
    [COLOR.ink, new THREE.CylinderGeometry(.035, .035, .26, 8).translate(0, .16, 0)],
    [COLOR.ink, new THREE.CylinderGeometry(.26, .28, .05, 16).translate(0, .025, 0)],
  ]), solid), 'desk-chair', 'desk');
  // Parked beside the desk, out of his path; slides under the stand point while he types.
  const placeChair = (tucked: number) => {
    chair.position.set(-.62 * (1 - tucked), 0, 1 - .24 * tucked).applyMatrix4(DESK);
    chair.rotation.y = Math.PI / 4 + .5 * (1 - tucked);
  };

  // Low platform bed against the back wall, head to the left; the blanket top is the seat.
  place('bed', null, [
    [COLOR.peach, rounded(2.6, .14, 1.25, .05).translate(-3.15, .07, -3.325)],
    [COLOR.paper, rounded(2.5, .16, 1.17, .07, 2).translate(-3.15, .22, -3.325)],
    [COLOR.sage, rounded(1.95, .06, 1.23).translate(-2.845, SEAT - .03, -3.325)],
    [COLOR.coral, rounded(.12, .062, 1.235, .02).translate(-3.5, SEAT - .029, -3.325)],
    [COLOR.cream, rounded(.14, .07, 1.24).translate(-3.76, SEAT - .025, -3.325)],
    [0xe6dcf0, rounded(.5, .16, .82, .07, 2).translate(-4.13, .36, -3.325)],
    [COLOR.mauve, rounded(.12, 1.1, 1.29, .05).translate(-4.51, .55, -3.31)],
  ]);
  // The reading lamp's light: off until he reads.
  const lampLight = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const bedLamp = mesh(new THREE.Mesh(shape([
    [COLOR.bulb, new THREE.ConeGeometry(.45, 1.1, 20, 1, true)],
    [COLOR.bulb, new THREE.SphereGeometry(.05, 10, 6).translate(0, .52, 0)],
  ]), lampLight), 'bed-lamp-light', null);
  bedLamp.position.set(-4.2, 1.03, -3.6);

  // Printer cabinet, then an open-frame printer whose bed slides in z while the head runs along the gantry.
  place('printer', null, [
    [COLOR.lilac, rounded(1.2, .75, .6, .05).translate(2.9, .375, -3.65)],
    [COLOR.cream, rounded(.56, .62, .02, .01).translate(2.6, .385, -3.345)],
    [COLOR.cream, rounded(.56, .62, .02, .01).translate(3.2, .385, -3.345)],
    [COLOR.peach, new THREE.SphereGeometry(.025, 8, 6).translate(2.83, .48, -3.33)],
    [COLOR.peach, new THREE.SphereGeometry(.025, 8, 6).translate(2.97, .48, -3.33)],
  ]);
  place('printer', PRINTER, [
    [COLOR.ink, rounded(.7, .1, .55).translate(0, .05, 0)],
    [COLOR.night, box(.14, .07, .01, .2, .05, .28)],
    [COLOR.cream, new THREE.CylinderGeometry(.025, .025, .02, 12).rotateX(Math.PI / 2).translate(.31, .05, .285)],
    [COLOR.ink, box(.04, .72, .04, -.3, .44, -.07)],
    [COLOR.ink, box(.04, .72, .04, .3, .44, -.07)],
    [COLOR.ink, box(.64, .04, .04, 0, .8, -.07)],
    [COLOR.silver, new THREE.CylinderGeometry(.008, .008, .5, 6).rotateX(Math.PI / 2).translate(-.12, .106, 0)],
    [COLOR.silver, new THREE.CylinderGeometry(.008, .008, .5, 6).rotateX(Math.PI / 2).translate(.12, .106, 0)],
    [COLOR.coral, new THREE.TorusGeometry(.09, .045, 8, 18).translate(.52, .14, .02)],
    [COLOR.cream, new THREE.CylinderGeometry(.05, .05, .1, 12).rotateX(Math.PI / 2).translate(.52, .14, .02)],
    [COLOR.ink, box(.03, .14, .03, .52, .07, -.06)],
  ]);
  const plate = mesh(new THREE.Mesh(shape([[COLOR.night, new THREE.BoxGeometry(.44, .025, .38)], [0xd9a76a, box(.4, .004, .34, 0, .0145, 0)]]), solid), 'printer-bed', 'printer');
  const printed = mesh(new THREE.Mesh(shape([[COLOR.coral, new THREE.CylinderGeometry(.055, .07, .16, 14).translate(0, .08, 0)]]), solid), 'printer-part', 'printer', plate);
  printed.position.y = .0165;
  const gantry = mesh(new THREE.Mesh(shape([[COLOR.ink, new THREE.BoxGeometry(.6, .035, .035)]]), solid), 'printer-gantry', 'printer');
  const head = mesh(new THREE.Mesh(shape([[COLOR.coral, rounded(.11, .1, .09, .02)], [COLOR.brass, new THREE.ConeGeometry(.018, .04, 8).rotateX(Math.PI).translate(0, -.07, 0)]]), solid), 'printer-head', 'printer', gantry);
  head.position.z = .07;
  const progressBar = mesh(new THREE.Mesh(shape([[COLOR.coral, new THREE.PlaneGeometry(.1, .014).translate(.05, 0, 0)]]), glow), 'printer-progress', 'printer');
  progressBar.position.set(2.95, .8, -3.3635);

  // Homelab rack: NAS bays, two servers, a 1U box, switch, patch panel, a vented blank and a router on top.
  place('rack', RACK, [
    [COLOR.ink, rounded(.8, 2.3, .8, .05).translate(0, 1.15, 0)],
    ...[[.375, .45, COLOR.steel], [.79, .22, COLOR.slate], [1.07, .22, COLOR.steel], [1.31, .14, COLOR.slate], [1.51, .14, COLOR.steel], [1.71, .14, COLOR.slate], [2.02, .32, COLOR.steel]]
      .map(([y, height, hex]): Piece => [hex, box(.68, height, .03, 0, y, .41)]),
    ...[-.25, -.1, .05, .2].map((x): Piece => [COLOR.mauve, box(.13, .36, .02, x, .4, .435)]),
    ...PORTS.map((x): Piece => [COLOR.night, box(.05, .04, .01, x, 1.49, .43)]),
    ...Array.from({ length: 10 }, (_, i): Piece => [COLOR.night, box(.035, .035, .01, -.27 + i * .06, 1.71, .43)]),
    ...[1.95, 2.02, 2.09].map((y): Piece => [COLOR.night, box(.3, .02, .01, -.12, y, .43)]),
    ...FANS.map(([x, y]): Piece => [COLOR.night, new THREE.TorusGeometry(.075, .01, 6, 18).translate(x, y, .432)]),
    [COLOR.cream, rounded(.4, .07, .25, .02).translate(-.1, 2.335, 0)],
    [COLOR.ink, new THREE.CylinderGeometry(.012, .012, .22, 6).translate(-.26, 2.48, -.08)],
    [COLOR.ink, new THREE.CylinderGeometry(.012, .012, .22, 6).translate(.06, 2.48, -.08)],
  ]);
  const blades = shape([
    ...[0, 1, 2, 3].map((k): Piece => [COLOR.cream, new THREE.BoxGeometry(.13, .026, .006).rotateZ(k * Math.PI / 4)]),
    [COLOR.night, new THREE.CylinderGeometry(.022, .022, .01, 10).rotateX(Math.PI / 2)],
  ]);
  const fans = FANS.map(([x, y]) => {
    const fan = mesh(new THREE.Mesh(blades, solid), 'rack-fan', 'rack');
    fan.position.set(5.75 + x, y, -3.116);
    return fan;
  });
  const leds = mesh(new THREE.InstancedMesh(tinted(new THREE.BoxGeometry(.022, .022, .01), 0xffffff), glow, LED_SPOTS.length), 'rack-leds', 'rack');
  LED_SPOTS.forEach(([x, y], i) => leds.setMatrixAt(i, new THREE.Matrix4().makeTranslation(5.75 + x, y, -3.12)));
  const ledOn = [0x8be0a4, 0xff9f80, 0xc7a6ff].map((hex) => new THREE.Color(hex));
  const ledOff = new THREE.Color(0x2f2a3a);
  const paintLeds = (step: number, density: number) => {
    // The first LED of each server row is a steady power light; the rest flicker with activity.
    LED_SPOTS.forEach((_, i) => leds.setColorAt(i, i < 16 && i % 4 === 0 ? ledOn[0] : noise(i, step) < density ? ledOn[1 + i % 2] : ledOff));
    leds.instanceColor!.needsUpdate = true;
  };

  // Fairy lights: each bulb hangs just under the wire and twinkles between bright and dim.
  const lights = mesh(new THREE.InstancedMesh(tinted(new THREE.SphereGeometry(.045, 8, 6), 0xffffff), glow, BULBS.length), 'string-lights', null);
  BULBS.forEach((x, i) => lights.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, sag(x) - .05, -3.88)));
  const bright = BULBS.map((_, i) => new THREE.Color([COLOR.butter, COLOR.rose, COLOR.mint, COLOR.sky, COLOR.coral][i % 5]));
  const dim = bright.map((color) => color.clone().multiplyScalar(.45));
  const twinkle = (step: number) => {
    BULBS.forEach((_, i) => lights.setColorAt(i, noise(i + 100, step) < .3 ? dim[i] : bright[i]));
    lights.instanceColor!.needsUpdate = true;
  };

  // Clock minute hand on the left wall.
  const clockHand = mesh(new THREE.Mesh(shape([[COLOR.plum, box(.012, .24, .03, 0, .1, 0)]]), solid), 'clock-hand', null);
  clockHand.position.set(-6.425, 2.9, 1.4);

  // Toy basket on the rug; the ball (owned by activity-props) rests on its lid.
  place('ball', null, [
    [COLOR.coral, new THREE.CylinderGeometry(.23, .21, .38, 20).translate(BALL_REST.x, .22, BALL_REST.z)],
    [COLOR.cream, new THREE.CylinderGeometry(.235, .23, .06, 20).translate(BALL_REST.x, .3, BALL_REST.z)],
    [COLOR.plum, new THREE.CylinderGeometry(.245, .245, .04, 20).translate(BALL_REST.x, .43, BALL_REST.z)],
  ]);

  const cable = new THREE.CatmullRomCurve3(CABLE.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  mesh(new THREE.Mesh(shape([[COLOR.plum, new THREE.TubeGeometry(cable, 120, .028, 6)]]), solid), 'network-cable', null);

  // The back door: a leaf hinged on the left jamb. The scene swings it out toward -z (positive rotation.y) during the intro.
  const door = new THREE.Group();
  door.name = 'back-door';
  door.position.set(-.7, 0, -4.1);
  group.add(door);
  mesh(new THREE.Mesh(shape([
    [COLOR.coral, rounded(1.38, 2.96, .08, .03).translate(.69, 1.49, 0)],
    ...[.38, 1].map((x): Piece => [COLOR.butter, rounded(.42, .9, .1, .03).translate(x, .75, 0)]),
    [COLOR.sky, new THREE.CylinderGeometry(.24, .24, .1, 20).rotateX(Math.PI / 2).translate(.69, 2.15, 0)],
    ...[-1, 1].flatMap((side): Piece[] => [
      [COLOR.paper, new THREE.TorusGeometry(.26, .04, 6, 20).translate(.69, 2.15, side * .045)],
      [COLOR.brass, new THREE.SphereGeometry(.05, 8, 6).translate(1.2, 1.3, side * .07)],
    ]),
    ...[.5, 2.5].map((y): Piece => [COLOR.brass, box(.05, .16, .1, .02, y, 0)]),
  ]), solid), 'back-door-leaf', null, door);

  // Sky behind the window opening and a cloud drifting between the wall pieces that hide it at either end.
  const sky = tinted(new THREE.PlaneGeometry(1.2, 1.2), 0xffffff);
  const horizon = new THREE.Color(0xe6f5fb); const zenith = new THREE.Color(0x8fcbef); const tone = new THREE.Color();
  for (let i = 0; i < sky.attributes.position.count; i++) tone.lerpColors(horizon, zenith, sky.attributes.position.getY(i) / 1.2 + .5).toArray(sky.attributes.color.array, i * 3);
  mesh(new THREE.Mesh(sky.translate(-3, 2, -4.22), glow), 'window-sky', null);
  const cloud = mesh(new THREE.Mesh(shape([[-.15, 0, .13], [0, .05, .17], [.16, -.01, .12]]
    .map(([x, y, radius]): Piece => [0xffffff, new THREE.SphereGeometry(radius, 12, 8).scale(1, 1, .3).translate(x, y, 0)])), solid), 'window-cloud', null);

  for (const { station, lit, pieces } of buckets.values()) mesh(new THREE.Mesh(shape(pieces), lit ? glow : solid), `${station ?? 'decor'}${lit ? '-glow' : ''}`, station);

  let print = .35; let trace = 0; let blink = 0; let ledStep = 0; let fanAngle = 0; let fanSpeed = 7; let scroll = 0; let tucked = 0;
  let lamp = 0; let twinkleStep = 0;
  let disposed = false;
  const update: WorldArea['update'] = (dt, elapsed, { stationId }) => {
    if (disposed) return;
    const step = Math.max(0, dt);
    const printing = stationId === 'printer'; const tinkering = stationId === 'rack'; const typing = stationId === 'desk';
    // One part every 36 s (9 s while he watches); the last 0.15 of a cycle shows it finished before it resets.
    print += step / (printing ? 9 : 36);
    const cycle = print % 1.15; const layer = Math.min(1, cycle);
    if (cycle < 1) trace += step * (printing ? 16 : 6);
    printed.scale.y = progressBar.scale.x = Math.max(.02, layer);
    head.position.x = Math.cos(trace) * .065;
    plate.position.set(2.8, .875, -3.65 - Math.sin(trace) * .065);
    gantry.position.set(2.8, .9855 + .16 * layer, -3.72);

    fanSpeed += ((tinkering ? 34 : 7) - fanSpeed) * (1 - Math.exp(-step * 3));
    fanAngle -= fanSpeed * step;
    fans.forEach((fan, i) => { fan.rotation.z = fanAngle * (1 + i * .13); });
    blink += step * (tinkering ? 11 : 1.7);
    if (Math.floor(blink) !== ledStep) { ledStep = Math.floor(blink); paintLeds(ledStep, tinkering ? .8 : .55); }

    scroll += step * (typing ? .32 : .035);
    code.offset.y = (1 - scroll % 1) % 1;
    tucked += ((typing ? 1 : 0) - tucked) * (1 - Math.exp(-step * 5));
    placeChair(tucked);

    lamp += ((stationId === 'bed' ? .4 : 0) - lamp) * (1 - Math.exp(-step * 4));
    lampLight.opacity = lamp;
    bedLamp.visible = lamp > .01;
    if (Math.floor(elapsed * 3) !== twinkleStep) { twinkleStep = Math.floor(elapsed * 3); twinkle(twinkleStep); }
    clockHand.rotation.x = -elapsed * .5;
    cloud.position.set(-3.95 + (elapsed * .07 + .5) % 1 * 1.9, 2.22 + Math.sin(elapsed * .6) * .02, -4.15);
  };
  paintLeds(0, .55);
  twinkle(0);
  update(0, 0, { stationId: null, progress: 0 });
  group.updateMatrixWorld(true);

  return {
    id: 'bedroom',
    group,
    bounds: { minX: -6.3, maxX: 6.3, minZ: -3.75, maxZ: 3.9 },
    obstacles: OBSTACLES.map((obstacle) => ({ ...obstacle })),
    stations: STATIONS.map((station) => ({ ...station, stand: { ...station.stand }, reach: { ...station.reach } })),
    exit: { x: 2.4, z: 3.3 },
    // The middle of the blanket.
    landing: { x: -3.15, y: SEAT, z: -3.3 },
    view: { center: { x: 0, y: 1.6, z: 0 } },
    propRests: { ball: { ...BALL_REST }, book: { ...BOOK_REST } },
    pick(raycaster) {
      group.updateMatrixWorld();
      const station = raycaster.intersectObjects(pickables, false)[0]?.object.userData.station;
      return typeof station === 'string' ? station : null;
    },
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        for (const material of [node.material].flat()) materials.add(material);
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      code.dispose();
    },
  };
};

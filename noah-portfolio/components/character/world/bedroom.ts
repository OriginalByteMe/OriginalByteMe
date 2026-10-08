import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AreaBuilder, Obstacle, Station, WorldArea } from './types';

const COLOR = {
  cream: 0xf4ecdf, plum: 0x72509c, lilac: 0xb39bc3, coral: 0xeb9a84, sage: 0xa6b4a0, peach: 0xe8b38b,
  mauve: 0x9681b8, paper: 0xfffaf3, floor: 0xead2b4, sideWall: 0xeee3ec, rug: 0xd8c8e3, ink: 0x4b4458,
  steel: 0x6d6380, slate: 0x5c5470, night: 0x2b2738, silver: 0xcfd2da, leaf: 0x8fae86, brass: 0xd8a14a,
  terracotta: 0xd58f6f, bulb: 0xfff1c9,
};
type Piece = [color: number, geometry: THREE.BufferGeometry];

// Area-local layout. The desk sits at 45 degrees in the back-left corner, its local +z toward the chair,
// so the MacBook screen faces the camera side of the room.
const DESK = new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(-4.3, 0, -2.1);
const LID = DESK.clone().multiply(new THREE.Matrix4().makeRotationX(-.26).setPosition(0, 1.074, .06));
const PRINTER = new THREE.Matrix4().makeTranslation(1.4, .75, -2.65);
const RACK = new THREE.Matrix4().makeTranslation(4.15, 0, -2.55);
const deskPoint = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(DESK);
const BALL_REST = { x: -.3, y: .6, z: .975 }; // on the toy basket lid
const BOOK_REST = { x: -1.05, y: .7, z: -1.92 }; // on the blanket beside the bed seat
const ROW = [-.28, -.22, -.16, -.1];
const PORTS = Array.from({ length: 8 }, (_, i) => -.26 + i * .07);
const FANS = [[.22, .79], [.22, 1.07], [.2, 2.02]];
const LED_SPOTS = [...[-.25, -.1, .05, .2].map((x) => [x, .19]), ...[.79, 1.07, 1.31].flatMap((y) => ROW.map((x) => [x, y])), ...PORTS.map((x) => [x, 1.555])];
const CABLE = [[3.85, .3, -2.12], [3.82, .03, -1.92], [3.4, .03, -1.1], [3.15, .03, 0], [2.95, .03, 1.1], [2.45, .03, 1.95], [1.7, .03, 2.38],
  [1, .03, 2.6], [.72, .03, 3], [.7, .03, 3.18], [.69, 0, 3.26], [.68, -.12, 3.32], [.67, -.46, 3.34]];
const deskStand = deskPoint(0, 0, .605);
const STATIONS: Station[] = [
  // The sit clip puts the pelvis 0.15 behind the stand point, so seats sit directly under it.
  { id: 'desk', kind: 'type', label: 'MacBook', stand: { x: deskStand.x, z: deskStand.z }, heading: -3 * Math.PI / 4, reach: deskPoint(0, 1.077, .2), seat: .62 },
  // Printer and rack stands sit to one side so he does not hide the machine from the front camera.
  { id: 'printer', kind: 'watch', label: '3D printer', stand: { x: 2.2, z: -2 }, heading: Math.atan2(1.6 - 2.2, -2.36 + 2), reach: { x: 1.6, y: .8, z: -2.36 } },
  { id: 'rack', kind: 'tinker', label: 'Server rack', stand: { x: 3.45, z: -1.85 }, heading: Math.atan2(4.1 - 3.45, -2.12 + 1.85), reach: { x: 4.1, y: 1.31, z: -2.12 } },
  { id: 'ball', kind: 'ball', label: 'Ball', stand: { x: 0, z: .6 }, heading: 0, reach: BALL_REST },
  { id: 'bed', kind: 'read', label: 'Bed', stand: { x: -1.5, z: -1.62 }, heading: 0, reach: BOOK_REST, seat: .66 },
];
const OBSTACLES: Obstacle[] = [
  // Desk-local circles: the desk front stops 0.23 short of the stand point; the chair is parked off his path.
  ...[{ id: 'desk', x: 0, z: -.07, radius: .44 }, { id: 'desk', x: -.42, z: -.07, radius: .45 }, { id: 'desk', x: .42, z: -.07, radius: .45 },
    { id: 'desk', x: -.62, z: .12, radius: .3 }, { id: 'desk', x: .62, z: .12, radius: .3 }, { id: 'chair', x: -.62, z: 1, radius: .3 }]
    .map(({ id, x, z, radius }) => { const point = deskPoint(x, 0, z); return { id, x: point.x, z: point.z, radius }; }),
  ...[-2.95, -2.45, -1.95, -1.45, -.95].map((x) => ({ id: 'bed', x, z: -2.4, radius: .55 })),
  { id: 'bed', x: -3.05, z: -1.95, radius: .25 }, { id: 'bed', x: -.85, z: -1.95, radius: .25 },
  { id: 'printer', x: 1.2, z: -2.65, radius: .42 }, { id: 'printer', x: 1.8, z: -2.65, radius: .42 },
  { id: 'plant', x: .15, z: -2.6, radius: .3 },
  { id: 'rack', x: 4.15, z: -2.55, radius: .58 },
  { id: 'toybox', x: BALL_REST.x, z: BALL_REST.z, radius: .25 },
  { id: 'beanbag', x: -4.2, z: 1.3, radius: .55 },
];

const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, radius);
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

/** Noah's cutaway bedroom: corner desk with the MacBook, bed, 3D printer, homelab rack and the cable he trips on. */
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

  // Room shell: slab, back wall around the window opening, side wall, caps, skirting.
  place(null, null, [
    [COLOR.lilac, rounded(10.8, .58, 6.5, .22, 2).translate(0, -.31, .05)],
    [COLOR.floor, new THREE.BoxGeometry(10.6, .1, 6.32).translate(0, -.05, .04)],
    [COLOR.cream, new THREE.BoxGeometry(2.85, 3.8, .25).translate(-3.975, 1.9, -3.075)],
    [COLOR.cream, new THREE.BoxGeometry(6.75, 3.8, .25).translate(2.025, 1.9, -3.075)],
    [COLOR.cream, new THREE.BoxGeometry(1.2, 1.6, .25).translate(-1.95, .8, -3.075)],
    [COLOR.cream, new THREE.BoxGeometry(1.2, 1, .25).translate(-1.95, 3.3, -3.075)],
    [COLOR.sideWall, new THREE.BoxGeometry(.25, 3.8, 6.25).translate(-5.275, 1.9, .175)],
    [COLOR.lilac, rounded(10.9, .12, .35, .04).translate(0, 3.86, -3.075)],
    [COLOR.lilac, rounded(.35, .12, 6.55, .04).translate(-5.275, 3.86, .075)],
    [COLOR.peach, new THREE.BoxGeometry(10.55, .12, .04).translate(.125, .06, -2.93)],
    [COLOR.peach, new THREE.BoxGeometry(.04, .12, 6.25).translate(-5.13, .06, .175)],
    // Window frame, sill and mullions.
    [COLOR.paper, rounded(1.36, .08, .32, .02).translate(-1.95, 2.84, -3.04)],
    [COLOR.paper, rounded(1.5, .08, .42, .02).translate(-1.95, 1.56, -2.99)],
    [COLOR.paper, rounded(.08, 1.2, .32, .02).translate(-2.59, 2.2, -3.04)],
    [COLOR.paper, rounded(.08, 1.2, .32, .02).translate(-1.31, 2.2, -3.04)],
    [COLOR.paper, new THREE.BoxGeometry(.04, 1.2, .04).translate(-1.95, 2.2, -3.04)],
    [COLOR.paper, new THREE.BoxGeometry(1.2, .04, .04).translate(-1.95, 2.2, -3.04)],
    // Shelf of printed figurines: calibration cube, Linux penguin, rocket, trailing plant.
    [COLOR.peach, rounded(1.4, .05, .3, .015).translate(1.5, 2.15, -2.8)],
    [COLOR.plum, new THREE.BoxGeometry(.04, .14, .2).translate(.95, 2.055, -2.85)],
    [COLOR.plum, new THREE.BoxGeometry(.04, .14, .2).translate(2.05, 2.055, -2.85)],
    [COLOR.coral, rounded(.12, .12, .12, .015).translate(.98, 2.235, -2.8)],
    [COLOR.night, new THREE.SphereGeometry(.075, 12, 8).scale(1, 1.3, 1).translate(1.26, 2.27, -2.8)],
    [COLOR.paper, new THREE.SphereGeometry(.055, 10, 6).scale(1, 1.25, .6).translate(1.26, 2.26, -2.745)],
    [COLOR.peach, new THREE.ConeGeometry(.018, .045, 6).rotateX(Math.PI / 2).translate(1.26, 2.31, -2.715)],
    [COLOR.lilac, new THREE.CylinderGeometry(.04, .04, .16, 10).translate(1.55, 2.255, -2.8)],
    [COLOR.coral, new THREE.ConeGeometry(.04, .08, 10).translate(1.55, 2.375, -2.8)],
    [COLOR.coral, new THREE.BoxGeometry(.13, .05, .012).translate(1.55, 2.2, -2.8)],
    [COLOR.coral, new THREE.BoxGeometry(.012, .05, .13).translate(1.55, 2.2, -2.8)],
    [COLOR.sage, new THREE.CylinderGeometry(.07, .055, .1, 12).translate(1.88, 2.225, -2.8)],
    [COLOR.leaf, new THREE.SphereGeometry(.075, 8, 6).translate(1.88, 2.33, -2.8)],
    [COLOR.leaf, new THREE.SphereGeometry(.05, 8, 6).translate(1.95, 2.3, -2.73)],
    ...[[1.97, 2.12], [1.99, 2.02], [2, 1.93]].map(([x, y]): Piece => [COLOR.leaf, new THREE.SphereGeometry(.03, 6, 4).translate(x, y, -2.63)]),
    // Poster between the shelf and the rack.
    [COLOR.plum, new THREE.BoxGeometry(.86, 1.1, .02).translate(2.95, 2.1, -2.94)],
    [COLOR.paper, new THREE.BoxGeometry(.78, 1.02, .01).translate(2.95, 2.1, -2.925)],
    [COLOR.coral, new THREE.CircleGeometry(.13, 20).translate(3.12, 2.35, -2.918)],
    [COLOR.plum, new THREE.CircleGeometry(.3, 3).rotateZ(Math.PI / 2).translate(2.86, 1.81, -2.917)],
    [COLOR.lilac, new THREE.CircleGeometry(.24, 3).rotateZ(Math.PI / 2).translate(3.12, 1.78, -2.916)],
    [COLOR.sage, new THREE.BoxGeometry(.78, .07, .004).translate(2.95, 1.625, -2.917)],
    // Side wall clock and print.
    [COLOR.coral, new THREE.CylinderGeometry(.33, .33, .03, 24).rotateZ(Math.PI / 2).translate(-5.135, 2.55, .9)],
    [COLOR.paper, new THREE.CylinderGeometry(.29, .29, .04, 24).rotateZ(Math.PI / 2).translate(-5.13, 2.55, .9)],
    [COLOR.plum, new THREE.BoxGeometry(.01, .22, .03).translate(-5.105, 2.64, .9)],
    [COLOR.plum, new THREE.BoxGeometry(.01, .03, .15).translate(-5.105, 2.55, .965)],
    [COLOR.peach, new THREE.BoxGeometry(.03, .9, .72).translate(-5.135, 2.1, 2.2)],
    [COLOR.sage, new THREE.BoxGeometry(.02, .8, .62).translate(-5.12, 2.1, 2.2)],
    [COLOR.cream, new THREE.CircleGeometry(.16, 20).rotateY(Math.PI / 2).translate(-5.108, 2.22, 2.2)],
    [COLOR.coral, new THREE.CircleGeometry(.09, 3).rotateY(Math.PI / 2).translate(-5.107, 1.88, 2.05)],
    // Floor plant, rug and bean bag.
    [COLOR.peach, new THREE.CylinderGeometry(.22, .17, .42, 16).translate(.15, .21, -2.6)],
    [COLOR.night, new THREE.CylinderGeometry(.2, .2, .02, 16).translate(.15, .41, -2.6)],
    [COLOR.leaf, new THREE.CylinderGeometry(.02, .025, .6, 6).translate(.15, .7, -2.6)],
    ...[[.15, .85, -2.6, .26], [-.05, .7, -2.5, .2], [.36, .72, -2.5, .2], [.05, 1.1, -2.65, .2], [.28, 1.05, -2.6, .18], [.15, 1.3, -2.62, .16]]
      .map(([x, y, z, radius], i): Piece => [i % 2 ? COLOR.sage : COLOR.leaf, new THREE.SphereGeometry(radius, 10, 8).translate(x, y, z)]),
    [COLOR.rug, new THREE.CylinderGeometry(1.2, 1.2, .03, 40).translate(.35, .015, .55)],
    [COLOR.coral, new THREE.RingGeometry(.82, .92, 40).rotateX(-Math.PI / 2).translate(.35, .032, .55)],
    [COLOR.paper, new THREE.RingGeometry(.42, .5, 32).rotateX(-Math.PI / 2).translate(.35, .032, .55)],
    [COLOR.mauve, new THREE.SphereGeometry(.55, 16, 12).scale(1, .55, 1).translate(-4.2, .3, 1.3)],
  ]);

  // Corner desk: drawers on the wall side, legs clear in front of the chair for his outstretched legs.
  place('desk', DESK, [
    [COLOR.peach, rounded(1.5, .07, .75, .03, 2).translate(0, 1.015, 0)],
    [COLOR.lilac, rounded(.42, .96, .66).translate(-.5, .49, -.02)],
    [COLOR.cream, rounded(.36, .38, .02, .008).translate(-.5, .74, .32)],
    [COLOR.cream, rounded(.36, .38, .02, .008).translate(-.5, .3, .32)],
    [COLOR.plum, rounded(.12, .025, .025, .008).translate(-.5, .84, .34)],
    [COLOR.plum, rounded(.12, .025, .025, .008).translate(-.5, .4, .34)],
    [COLOR.plum, new THREE.BoxGeometry(.06, .98, .06).translate(.68, .49, .3)],
    [COLOR.plum, new THREE.BoxGeometry(.06, .98, .06).translate(.68, .49, -.3)],
    [COLOR.silver, rounded(.46, .024, .32, .01).translate(0, 1.062, .215)],
    [COLOR.night, new THREE.BoxGeometry(.4, .004, .14).translate(0, 1.075, .19)],
    [0xb9bcc6, new THREE.BoxGeometry(.15, .003, .07).translate(0, 1.0745, .315)],
    [COLOR.plum, new THREE.CylinderGeometry(.09, .1, .03, 16).translate(.55, 1.065, -.15)],
    [COLOR.plum, new THREE.CylinderGeometry(.016, .016, .36, 8).translate(.55, 1.26, -.15)],
    [COLOR.coral, new THREE.ConeGeometry(.11, .14, 16).rotateX(-.5).translate(.55, 1.47, -.1)],
    [COLOR.paper, new THREE.CylinderGeometry(.055, .05, .12, 14).translate(-.48, 1.11, .15)],
    [COLOR.paper, new THREE.TorusGeometry(.035, .011, 6, 10).translate(-.425, 1.11, .15)],
    [COLOR.terracotta, new THREE.CylinderGeometry(.07, .055, .1, 12).translate(-.6, 1.1, -.2)],
    [COLOR.leaf, new THREE.SphereGeometry(.07, 8, 6).scale(1, 1.3, 1).translate(-.6, 1.21, -.2)],
    [COLOR.sage, new THREE.SphereGeometry(.05, 8, 6).translate(-.65, 1.2, -.14)],
  ]);
  place('desk', LID, [
    [COLOR.silver, rounded(.46, .3, .016, .008).translate(0, .15, -.008)],
    [COLOR.lilac, new THREE.CylinderGeometry(.04, .04, .004, 16).rotateX(Math.PI / 2).translate(0, .16, -.018)],
  ]);
  place('desk', DESK, [[COLOR.bulb, new THREE.SphereGeometry(.04, 10, 6).translate(.55, 1.41, -.075)]], true);

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
    [COLOR.coral, rounded(.5, .07, .5).translate(0, .585, 0)],
    [COLOR.coral, rounded(.48, .38, .06).translate(0, .86, .23)],
    [COLOR.ink, new THREE.CylinderGeometry(.035, .035, .52, 8).translate(0, .29, 0)],
    [COLOR.ink, new THREE.CylinderGeometry(.26, .28, .05, 16).translate(0, .025, 0)],
  ]), solid), 'desk-chair', 'desk');
  // Parked beside the desk, out of his path; slides under the stand point while he types.
  const placeChair = (tucked: number) => {
    chair.position.set(-.62 * (1 - tucked), 0, 1 - .24 * tucked).applyMatrix4(DESK);
    chair.rotation.y = Math.PI / 4 + .5 * (1 - tucked);
  };

  place('bed', null, [
    [COLOR.peach, rounded(2.6, .34, 1.25, .05).translate(-1.95, .17, -2.325)],
    [COLOR.paper, rounded(2.5, .28, 1.17, .1, 2).translate(-1.95, .48, -2.325)],
    [COLOR.sage, rounded(1.95, .06, 1.23).translate(-1.645, .63, -2.325)],
    [COLOR.coral, rounded(.12, .062, 1.235, .02).translate(-2.3, .631, -2.325)],
    [COLOR.cream, rounded(.14, .07, 1.24).translate(-2.56, .635, -2.325)],
    [0xe6dcf0, rounded(.5, .16, .82, .07, 2).translate(-2.93, .69, -2.325)],
    [COLOR.mauve, rounded(.12, 1.1, 1.29, .05).translate(-3.31, .55, -2.31)],
  ]);

  // Printer cabinet, then an open-frame printer whose bed slides in z while the head runs along the gantry.
  place('printer', null, [
    [COLOR.lilac, rounded(1.2, .75, .6, .05).translate(1.5, .375, -2.65)],
    [COLOR.cream, rounded(.56, .62, .02, .01).translate(1.2, .385, -2.345)],
    [COLOR.cream, rounded(.56, .62, .02, .01).translate(1.8, .385, -2.345)],
    [COLOR.peach, new THREE.SphereGeometry(.025, 8, 6).translate(1.43, .48, -2.33)],
    [COLOR.peach, new THREE.SphereGeometry(.025, 8, 6).translate(1.57, .48, -2.33)],
  ]);
  place('printer', PRINTER, [
    [COLOR.ink, rounded(.7, .1, .55).translate(0, .05, 0)],
    [COLOR.night, new THREE.BoxGeometry(.14, .07, .01).translate(.2, .05, .28)],
    [COLOR.cream, new THREE.CylinderGeometry(.025, .025, .02, 12).rotateX(Math.PI / 2).translate(.31, .05, .285)],
    [COLOR.ink, new THREE.BoxGeometry(.04, .72, .04).translate(-.3, .44, -.07)],
    [COLOR.ink, new THREE.BoxGeometry(.04, .72, .04).translate(.3, .44, -.07)],
    [COLOR.ink, new THREE.BoxGeometry(.64, .04, .04).translate(0, .8, -.07)],
    [COLOR.silver, new THREE.CylinderGeometry(.008, .008, .5, 6).rotateX(Math.PI / 2).translate(-.12, .106, 0)],
    [COLOR.silver, new THREE.CylinderGeometry(.008, .008, .5, 6).rotateX(Math.PI / 2).translate(.12, .106, 0)],
    [COLOR.coral, new THREE.TorusGeometry(.09, .045, 8, 18).translate(.52, .14, .02)],
    [COLOR.cream, new THREE.CylinderGeometry(.05, .05, .1, 12).rotateX(Math.PI / 2).translate(.52, .14, .02)],
    [COLOR.ink, new THREE.BoxGeometry(.03, .14, .03).translate(.52, .07, -.06)],
  ]);
  const plate = mesh(new THREE.Mesh(shape([[COLOR.night, new THREE.BoxGeometry(.44, .025, .38)], [0xd9a76a, new THREE.BoxGeometry(.4, .004, .34).translate(0, .0145, 0)]]), solid), 'printer-bed', 'printer');
  const printed = mesh(new THREE.Mesh(shape([[COLOR.coral, new THREE.CylinderGeometry(.055, .07, .16, 14).translate(0, .08, 0)]]), solid), 'printer-part', 'printer', plate);
  printed.position.y = .0165;
  const gantry = mesh(new THREE.Mesh(shape([[COLOR.ink, new THREE.BoxGeometry(.6, .035, .035)]]), solid), 'printer-gantry', 'printer');
  const head = mesh(new THREE.Mesh(shape([[COLOR.coral, rounded(.11, .1, .09, .02)], [COLOR.brass, new THREE.ConeGeometry(.018, .04, 8).rotateX(Math.PI).translate(0, -.07, 0)]]), solid), 'printer-head', 'printer', gantry);
  head.position.z = .07;
  const progressBar = mesh(new THREE.Mesh(shape([[COLOR.coral, new THREE.PlaneGeometry(.1, .014).translate(.05, 0, 0)]]), glow), 'printer-progress', 'printer');
  progressBar.position.set(1.55, .8, -2.3635);

  // Homelab rack: NAS bays, two servers, a 1U box, switch, patch panel, a vented blank and a router on top.
  place('rack', RACK, [
    [COLOR.ink, rounded(.8, 2.3, .8, .05).translate(0, 1.15, 0)],
    ...[[.375, .45, COLOR.steel], [.79, .22, COLOR.slate], [1.07, .22, COLOR.steel], [1.31, .14, COLOR.slate], [1.51, .14, COLOR.steel], [1.71, .14, COLOR.slate], [2.02, .32, COLOR.steel]]
      .map(([y, height, hex]): Piece => [hex, new THREE.BoxGeometry(.68, height, .03).translate(0, y, .41)]),
    ...[-.25, -.1, .05, .2].map((x): Piece => [COLOR.mauve, new THREE.BoxGeometry(.13, .36, .02).translate(x, .4, .435)]),
    ...PORTS.map((x): Piece => [COLOR.night, new THREE.BoxGeometry(.05, .04, .01).translate(x, 1.49, .43)]),
    ...Array.from({ length: 10 }, (_, i): Piece => [COLOR.night, new THREE.BoxGeometry(.035, .035, .01).translate(-.27 + i * .06, 1.71, .43)]),
    ...[1.95, 2.02, 2.09].map((y): Piece => [COLOR.night, new THREE.BoxGeometry(.3, .02, .01).translate(-.12, y, .43)]),
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
    fan.position.set(4.15 + x, y, -2.116);
    return fan;
  });
  const leds = mesh(new THREE.InstancedMesh(tinted(new THREE.BoxGeometry(.022, .022, .01), 0xffffff), glow, LED_SPOTS.length), 'rack-leds', 'rack');
  LED_SPOTS.forEach(([x, y], i) => leds.setMatrixAt(i, new THREE.Matrix4().makeTranslation(4.15 + x, y, -2.12)));
  const ledOn = [0x8be0a4, 0xff9f80, 0xc7a6ff].map((hex) => new THREE.Color(hex));
  const ledOff = new THREE.Color(0x2f2a3a);
  const paintLeds = (step: number, density: number) => {
    // The first LED of each server row is a steady power light; the rest flicker with activity.
    LED_SPOTS.forEach((_, i) => leds.setColorAt(i, i < 16 && i % 4 === 0 ? ledOn[0] : noise(i, step) < density ? ledOn[1 + i % 2] : ledOff));
    leds.instanceColor!.needsUpdate = true;
  };

  // Toy basket on the rug; the ball (owned by activity-props) rests on its lid.
  place('ball', null, [
    [COLOR.coral, new THREE.CylinderGeometry(.23, .21, .38, 20).translate(BALL_REST.x, .22, BALL_REST.z)],
    [COLOR.cream, new THREE.CylinderGeometry(.235, .23, .06, 20).translate(BALL_REST.x, .3, BALL_REST.z)],
    [COLOR.plum, new THREE.CylinderGeometry(.245, .245, .04, 20).translate(BALL_REST.x, .43, BALL_REST.z)],
  ]);

  // The network cable runs from the rack, past the exit and over the front edge toward the lab below.
  const cable = new THREE.CatmullRomCurve3(CABLE.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  mesh(new THREE.Mesh(shape([[COLOR.plum, new THREE.TubeGeometry(cable, 140, .028, 6)]]), solid), 'network-cable', null);

  // Sky behind the window opening and a cloud drifting between the wall pieces that hide it at either end.
  const sky = tinted(new THREE.PlaneGeometry(1.2, 1.2), 0xffffff);
  const horizon = new THREE.Color(0xe6f5fb); const zenith = new THREE.Color(0x8fcbef); const tone = new THREE.Color();
  for (let i = 0; i < sky.attributes.position.count; i++) tone.lerpColors(horizon, zenith, sky.attributes.position.getY(i) / 1.2 + .5).toArray(sky.attributes.color.array, i * 3);
  mesh(new THREE.Mesh(sky.translate(-1.95, 2.2, -3.18), glow), 'window-sky', null);
  const cloud = mesh(new THREE.Mesh(shape([[-.15, 0, .13], [0, .05, .17], [.16, -.01, .12]]
    .map(([x, y, radius]): Piece => [0xffffff, new THREE.SphereGeometry(radius, 12, 8).scale(1, 1, .3).translate(x, y, 0)])), solid), 'window-cloud', null);

  for (const { station, lit, pieces } of buckets.values()) mesh(new THREE.Mesh(shape(pieces), lit ? glow : solid), `${station ?? 'decor'}${lit ? '-glow' : ''}`, station);

  let print = .35; let trace = 0; let blink = 0; let ledStep = 0; let fanAngle = 0; let fanSpeed = 7; let scroll = 0; let tucked = 0;
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
    plate.position.set(1.4, .875, -2.65 - Math.sin(trace) * .065);
    gantry.position.set(1.4, .9855 + .16 * layer, -2.72);

    fanSpeed += ((tinkering ? 34 : 7) - fanSpeed) * (1 - Math.exp(-step * 3));
    fanAngle -= fanSpeed * step;
    fans.forEach((fan, i) => { fan.rotation.z = fanAngle * (1 + i * .13); });
    blink += step * (tinkering ? 11 : 1.7);
    if (Math.floor(blink) !== ledStep) { ledStep = Math.floor(blink); paintLeds(ledStep, tinkering ? .8 : .55); }

    scroll += step * (typing ? .32 : .035);
    code.offset.y = (1 - scroll % 1) % 1;
    tucked += ((typing ? 1 : 0) - tucked) * (1 - Math.exp(-step * 5));
    placeChair(tucked);
    cloud.position.set(-2.9 + (elapsed * .07 + .5) % 1 * 1.9, 2.42 + Math.sin(elapsed * .6) * .02, -3.12);
  };
  paintLeds(0, .55);
  update(0, 0, { stationId: null, progress: 0 });
  group.updateMatrixWorld(true);

  return {
    id: 'bedroom',
    group,
    bounds: { minX: -4.75, maxX: 4.75, minZ: -2.6, maxZ: 2.8 },
    obstacles: OBSTACLES.map((obstacle) => ({ ...obstacle })),
    stations: STATIONS.map((station) => ({ ...station, stand: { ...station.stand }, reach: { ...station.reach } })),
    exit: { x: 1.7, z: 2.18 },
    landing: { x: -1.95, y: .66, z: -2.3 },
    view: { center: { x: 0, y: 1.3, z: .1 } },
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
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      code.dispose(); leds.dispose();
    },
  };
};

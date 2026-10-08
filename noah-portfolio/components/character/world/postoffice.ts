import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterLine } from '@/lib/character/narrative';
import type { AreaBuilder, Obstacle, Station, StationKind } from './types';

type V3 = [number, number, number];
type Cell = { x: number; y: number; width: number; height: number };
type Animate = (time: number, energy: number, progress: number, dt: number) => void;

const CREAM = 0xfff1df, BLUSH = 0xfcdcd0, RED = 0xe5533d, BRICK = 0xb83a2b, BLUE = 0x3f7cc4, SKY = 0x8cc7ea, SUN = 0xf7c548,
  MINT = 0x7fcfae, NAVY = 0x2e3f63, PEACH = 0xf6b38f, WOOD = 0xc98d5b, KRAFT = 0xd6a46c, PINK = 0xf49ab0, LEAF = 0x5fae6b, PAPER = 0xfffaf0;
const FLAGS = [RED, SUN, SKY, MINT, PINK];
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const SOURCE = 'content/about-me/contact.md';
const ATLAS = { width: 1024, height: 768 };
const CELLS = {
  sayHi: { x: 0, y: 0, width: 1024, height: 128 },
  office: { x: 0, y: 128, width: 1024, height: 128 },
  email: { x: 0, y: 256, width: 512, height: 128 },
  github: { x: 512, y: 256, width: 512, height: 128 },
  blog: { x: 0, y: 384, width: 512, height: 128 },
  flag: { x: 0, y: 512, width: 512, height: 256 },
};
const BOUNDS = { minX: -6.2, maxX: 6.2, minZ: -2.5, maxZ: 3.6 };
const MAILBOX = { x: -1.8, z: .6 }, PARCELS = { x: 2.4, z: -1.5 }, FLAGPOLE = { x: 4.9, z: .2 }, BOARD = { x: -5.2, z: -2.85 };
const FLAG_LOW = 1.5, FLAG_HIGH = 4.05;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3() };

const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 2, height / 2, depth / 2));
const cylinder = (top: number, bottom: number, height: number, segments = 14) => new THREE.CylinderGeometry(top, bottom, height, segments);
const ball = (radius: number) => new THREE.SphereGeometry(radius, 10, 6);
const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };

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

/** Every sign's words on one canvas, each shrunk to fit its cell. */
function paintAtlas(words: { cell: Cell; text: string; ink: string; weight: number; fill?: string }[]) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS.width; canvas.height = ATLAS.height;
  const context = canvas.getContext('2d')!;
  context.textAlign = 'center'; context.textBaseline = 'middle';
  for (const { cell, text, ink, weight, fill } of words) {
    if (fill) { context.fillStyle = fill; context.fillRect(cell.x, cell.y, cell.width, cell.height); }
    let size = cell.height * .72;
    context.font = `${weight} ${size}px ${FONT}`;
    while (size > 16 && context.measureText(text).width > cell.width * .86) context.font = `${weight} ${size -= 4}px ${FONT}`;
    context.fillStyle = ink;
    context.fillText(text, cell.x + cell.width / 2, cell.y + cell.height * .54);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

/** Lot 7, "Say hi" (#say-hi): a cheerful post office at the end of the street. A pillar box for email, a bouncing parcel for GitHub, a flag he hoists for LinkedIn and a pinboard with a paper plane for the blog. */
export const createPostoffice: AreaBuilder = (origin, content) => {
  const { email, github, linkedin, blog } = content.contact;
  const group = new THREE.Group();
  group.name = 'postoffice';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
  const signs = new THREE.MeshBasicMaterial({
    map: paintAtlas([
      { cell: CELLS.sayHi, text: 'Say hi', ink: '#b83a2b', weight: 800 },
      { cell: CELLS.office, text: 'Post office', ink: '#fff8ec', weight: 800 },
      { cell: CELLS.email, text: 'Email', ink: '#fff8ec', weight: 800 },
      { cell: CELLS.github, text: 'GitHub', ink: '#2e3f63', weight: 800 },
      ...blog ? [{ cell: CELLS.blog, text: 'Blog', ink: '#2e3f63', weight: 800 }] : [],
      { cell: CELLS.flag, text: 'LinkedIn', ink: '#ffffff', weight: 800, fill: '#3f7cc4' },
    ]),
    transparent: true, toneMapped: false,
  });
  const solid = (parts: THREE.BufferGeometry[], parent: THREE.Object3D, at: V3 = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts), toy);
    parts.forEach((part) => part.dispose());
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  /** A plane showing one cell of the sign atlas. */
  const sign = (cell: Cell, width: number, height: number, parent: THREE.Object3D, at: V3, segments = 1) => {
    const quad = new THREE.PlaneGeometry(width, height, segments, 1), uv = quad.attributes.uv;
    for (let vertex = 0; vertex < uv.count; vertex++) uv.setXY(vertex, (cell.x + uv.getX(vertex) * cell.width) / ATLAS.width, 1 - (cell.y + (1 - uv.getY(vertex)) * cell.height) / ATLAS.height);
    const mesh = new THREE.Mesh(quad, signs);
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  const obstacles: Obstacle[] = [];
  const stations: Station[] = [];
  const reactives: { id: string; energy: number; animate: Animate }[] = [];
  const ambient: ((time: number) => void)[] = [];

  /** A station's object group, and the spot `stand` from its centre toward `side` where he stands so the object shows beside him from the camera; his hands reach `reach` from the centre. */
  const post = ({ id, kind, label, at, side, stand, reach, reachY, present }: { id: string; kind: StationKind; label: string; at: { x: number; z: number }; side: [number, number]; stand: number; reach: number; reachY: number; present: Station['present'] }, animate: Animate) => {
    const root = new THREE.Group();
    root.name = root.userData.station = id;
    root.position.set(at.x, 0, at.z);
    group.add(root);
    const length = Math.hypot(...side), ux = side[0] / length, uz = side[1] / length;
    stations.push({
      id, kind, label,
      stand: { x: at.x + ux * stand, z: at.z + uz * stand },
      heading: Math.atan2(-ux, -uz),
      reach: { x: at.x + ux * reach, y: reachY, z: at.z + uz * reach },
      present,
    });
    reactives.push({ id, energy: 0, animate });
    return root;
  };
  const line = (id: string, text: string): CharacterLine => ({ id, line: text, source: SOURCE });

  // Building: tiled floor, striped back wall under a red gable, left wall, picket fence on the open street end, counter, bench and planters. One draw call.
  const tiles = Array.from({ length: 13 * 8 }, (_, index) => [index % 13 - 6, Math.floor(index / 13) - 3.4] as const).filter(([x, z]) => (x + Math.round(z + 3.4)) % 2);
  const pickets = Array.from({ length: 23 }, (_, index) => -3.75 + index * .32);
  const pigeonholes = Array.from({ length: 24 }, (_, index) => [-1.58 + (index % 8) * .45, 1.62 + Math.floor(index / 8) * .32] as const);
  const gable = new THREE.Shape([new THREE.Vector2(-6.9, 0), new THREE.Vector2(6.9, 0), new THREE.Vector2(0, 1.15)]);
  const slope = Math.atan2(1.15, 6.9), rafter = Math.hypot(6.9, 1.15);
  solid([
    piece(rounded(13.8, .5, 8.4, .18, 2), 0xf4e3cf, [0, -.25, 0]),
    piece(rounded(13.4, .4, 8, .18, 2), RED, [0, -.66, 0]),
    ...tiles.map(([x, z]) => piece(new THREE.PlaneGeometry(.96, .96), 0xf0d2bd, [x, .004, z], [-Math.PI / 2, 0, 0])),
    piece(rounded(1.9, .02, 5.9, .01), SUN, [0, .012, .45]),
    piece(rounded(1.7, .022, 5.7, .01), SKY, [0, .014, .45]),
    piece(rounded(1.3, .03, .7, .05), RED, [.4, .016, 3.85]),
    // Back wall, wainscot, stripes, gable with its rafters and clock face.
    piece(rounded(13.8, 5, .3, .08, 2), CREAM, [0, 2.5, -4.05]),
    piece(rounded(13.6, 1.3, .1, .03), RED, [0, .65, -3.86]),
    piece(rounded(13.6, .12, .16, .03), NAVY, [0, 1.33, -3.84]),
    ...Array.from({ length: 19 }, (_, index) => piece(new THREE.PlaneGeometry(.34, 3.55), BLUSH, [-6.3 + index * .7, 3.18, -3.895])),
    piece(new THREE.ExtrudeGeometry(gable, { depth: .3, bevelEnabled: false }), RED, [0, 5, -4.2]),
    piece(rounded(13.9, .22, .5, .05), NAVY, [0, 5, -4]),
    ...[-1, 1].map((side) => piece(rounded(rafter, .22, .5, .05), BRICK, [side * 3.45, 5.7, -4], [0, 0, -side * slope])),
    piece(cylinder(.4, .4, .05, 24), CREAM, [0, 5.55, -3.87], [Math.PI / 2, 0, 0]),
    piece(new THREE.TorusGeometry(.4, .045, 6, 24), NAVY, [0, 5.55, -3.86]),
    ...[0, 1, 2, 3].map((index) => piece(ball(.035), BRICK, [Math.sin(index * Math.PI / 2) * .3, 5.55 + Math.cos(index * Math.PI / 2) * .3, -3.84])),
    // Say hi board with an envelope either side.
    piece(rounded(4.8, 1.2, .1, .05), SUN, [0, 3.9, -3.86]),
    piece(rounded(4.6, 1, .06, .04), PAPER, [0, 3.9, -3.8]),
    ...[-1, 1].flatMap((side) => [
      piece(rounded(.62, .42, .05, .03), PAPER, [side * 3, 3.9, -3.85]),
      piece(new THREE.CircleGeometry(.31, 3), RED, [side * 3, 4.04, -3.82], [0, 0, -Math.PI / 2], [.45, 1.15, 1]),
    ]),
    // Left wall.
    piece(rounded(.3, 5, 5.9, .08, 2), 0xf8e2cc, [-6.75, 2.5, -1.25]),
    piece(rounded(.12, 1.3, 5.9, .03), RED, [-6.56, .65, -1.25]),
    piece(rounded(.34, .2, 6, .05), NAVY, [-6.75, 5.04, -1.25]),
    // Picket fence along the street's end.
    ...pickets.flatMap((z) => [
      piece(new THREE.BoxGeometry(.1, .72, .07), PAPER, [6.6, .36, z]),
      piece(new THREE.ConeGeometry(.075, .13, 4), PAPER, [6.6, .78, z], [0, Math.PI / 4, 0]),
    ]),
    ...[.22, .56].map((y) => piece(rounded(.05, .08, 7.25, .02), 0xf0e2cf, [6.55, y, -.23])),
    // Counter with its header, scalloped trim, pigeonholes and things on top.
    piece(rounded(4.4, 1, .8, .06), BLUE, [0, .5, -3.1]),
    piece(rounded(4.6, .08, .92, .03), WOOD, [0, 1.04, -3.1]),
    piece(rounded(4.5, .1, .82, .03), NAVY, [0, .05, -3.08]),
    ...[-1.45, 0, 1.45].map((x) => piece(rounded(1.2, .6, .03, .02), SKY, [x, .52, -2.69])),
    ...[-1, 1].map((side) => piece(rounded(.14, 1.6, .14, .03), WOOD, [side * 2.25, 1.86, -3.3])),
    piece(rounded(4.7, .42, .16, .05), RED, [0, 2.78, -3.3]),
    ...Array.from({ length: 11 }, (_, index) => piece(new THREE.CircleGeometry(.2, 12, Math.PI, Math.PI), index % 2 ? SUN : PAPER, [-2.1 + index * .42, 2.57, -3.21])),
    piece(rounded(3.8, 1.04, .28, .04), WOOD, [0, 1.94, -3.76]),
    ...pigeonholes.map(([x, y]) => piece(new THREE.BoxGeometry(.38, .25, .1), 0x8a5a3a, [x, y, -3.6])),
    ...pigeonholes.filter((_, index) => index % 3 !== 1).map(([x, y], index) => piece(new THREE.BoxGeometry(.24, .14, .04), [PAPER, PINK, SKY, SUN][index % 4], [x + (index % 2 ? .04 : -.04), y - .02, -3.53], [0, 0, (index % 3 - 1) * .12])),
    piece(cylinder(.12, .14, .04, 16), NAVY, [1.5, 1.1, -2.95]),
    piece(new THREE.SphereGeometry(.11, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), SUN, [1.5, 1.12, -2.95]),
    piece(ball(.025), SUN, [1.5, 1.25, -2.95]),
    piece(rounded(.5, .05, .34, .02), 0xc9c4cf, [-1.4, 1.12, -2.95]),
    piece(cylinder(.12, .12, .04, 16), PAPER, [-1.4, 1.27, -2.82], [Math.PI / 2.4, 0, 0]),
    piece(rounded(.24, .16, .2, .03), RED, [-1.4, 1.22, -3.02]),
    piece(rounded(.3, .04, .22, .02), NAVY, [.4, 1.1, -2.95]),
    piece(cylinder(.04, .04, .16, 10), WOOD, [.75, 1.16, -2.95]),
    piece(rounded(.12, .05, .12, .02), RED, [.75, 1.26, -2.95]),
    // Bench and plant at the back right, planters at the front corners.
    piece(rounded(1.7, .08, .46, .03), WOOD, [4.4, .33, -3.35]),
    piece(rounded(1.7, .4, .06, .03), WOOD, [4.4, .62, -3.6], [-.12, 0, 0]),
    ...[-1, 1].map((side) => piece(rounded(.08, .32, .4, .02), NAVY, [4.4 + side * .74, .16, -3.35])),
    ...[[5.85, -3.45], [-6.15, 3.85], [6.15, 3.85]].flatMap(([x, z]) => [
      piece(cylinder(.26, .2, .38, 12), PEACH, [x, .19, z]),
      piece(new THREE.SphereGeometry(.32, 12, 8), LEAF, [x, .6, z], [0, 0, 0], [1, .9, 1]),
      ...[0, 1, 2].map((index) => piece(ball(.06), [PINK, SUN, PAPER][index], [x + Math.sin(index * 2.1) * .22, .78 + index * .04, z + Math.cos(index * 2.1) * .22])),
    ]),
  ], group);
  sign(CELLS.sayHi, 4.4, .55, group, [0, 3.92, -3.765]);
  sign(CELLS.office, 3.8, .475, group, [0, 2.79, -3.215]);

  // Clock hands and bunting: ambient life on the building.
  const hourHand = solid([piece(rounded(.05, .22, .02, .01), NAVY, [0, .09, 0])], group, [0, 5.55, -3.83]);
  const minuteHand = solid([piece(rounded(.035, .32, .02, .01), RED, [0, .14, 0])], group, [0, 5.55, -3.82]);
  const pennants = Array.from({ length: 23 }, (_, index) => -6.05 + index * .55);
  const sag = (x: number) => -.3 * (1 - (x / 6.3) ** 2);
  const bunting = solid([
    piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, index) => { const x = -6.4 + index * 1.6; return new THREE.Vector3(x, sag(x), 0); })), 32, .012, 4), NAVY),
    ...pennants.map((x, index) => piece(new THREE.CircleGeometry(.17, 3), FLAGS[index % FLAGS.length], [x, sag(x) - .075, 0], [0, 0, -Math.PI / 2], [.86, .9, 1])),
  ], group, [0, 4.88, -3.62]);
  ambient.push((time) => {
    minuteHand.rotation.z = -time * .6;
    hourHand.rotation.z = -time * .05 - 1.2;
    bunting.rotation.x = .06 * Math.sin(time * 1.3);
  });

  // Email: a red pillar box. Letters fly into its slot and the flap snaps; a bluebird lives on top.
  const letterParts = [
    piece(rounded(.34, .22, .02, .01), PAPER),
    piece(new THREE.CircleGeometry(.17, 3), 0xe8d5bf, [0, .073, .012], [0, 0, -Math.PI / 2], [.43, 1.15, 1]),
    piece(rounded(.06, .07, .01, .005), RED, [.12, .06, .015]),
  ];
  const letterGeometry = mergeGeometries(letterParts).scale(1.4, 1.4, 1.4);
  letterParts.forEach((part) => part.dispose());
  const slot = new THREE.Vector3(0, 1.12, .44), letterStart = new THREE.Vector3(-1.2, 2, 1);
  const letters: THREE.Mesh[] = [];
  const mailbox = post({
    id: 'contact:email', kind: 'tinker', label: 'Mailbox: email Noah', at: MAILBOX, side: [.95, .3], stand: .95, reach: .47, reachY: 1.25,
    present: { lines: [line('contact-email', `Drop me a line at ${email}!`)], url: `mailto:${email}`, linkLabel: 'Send an email' },
  }, (time, energy) => {
    let snap = 0;
    letters.forEach((letter, index) => {
      const phase = (time * .55 + index / 3) % 1, flight = smooth(phase / .85);
      letter.visible = energy > .01;
      letter.position.lerpVectors(letterStart, slot, flight).y += Math.sin(Math.PI * flight) * .55;
      letter.scale.setScalar(energy * (phase > .85 ? 1 - (phase - .85) / .15 * .7 : 1));
      letter.rotation.set(-.2, .3 * (1 - flight), .5 * Math.sin(time * 7 + index) * (1 - flight));
      if (phase > .8) snap = Math.max(snap, Math.sin((phase - .8) / .2 * Math.PI));
    });
    flap.rotation.x = -energy * snap * .9;
  });
  solid([
    piece(cylinder(.5, .53, .12, 20), NAVY, [0, .06, 0]),
    piece(cylinder(.42, .42, 1.2, 20), RED, [0, .72, 0]),
    piece(cylinder(.44, .44, .08, 20), BRICK, [0, .5, 0]),
    piece(cylinder(.46, .46, .1, 20), BRICK, [0, 1.36, 0]),
    piece(new THREE.SphereGeometry(.42, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), RED, [0, 1.41, 0]),
    piece(ball(.06), SUN, [0, 1.85, 0]),
    piece(rounded(.4, .07, .06, .02), NAVY, [0, 1.12, .41]),
    piece(rounded(.62, .24, .03, .02), NAVY, [0, .78, .415]),
  ], mailbox);
  sign(CELLS.email, .58, .145, mailbox, [0, .78, .433]);
  const flap = solid([piece(rounded(.4, .1, .03, .01), BRICK, [0, -.05, 0])], mailbox, [0, 1.19, .46]);
  const bird = solid([
    piece(ball(.08), SKY, [0, .07, 0], [0, 0, 0], [1.2, .9, 1]),
    piece(ball(.055), SKY, [.07, .15, 0]),
    piece(new THREE.ConeGeometry(.022, .06, 6), SUN, [.135, .15, 0], [0, 0, -Math.PI / 2]),
    piece(ball(.012), NAVY, [.1, .17, .045]),
    piece(new THREE.ConeGeometry(.04, .1, 4), BLUE, [-.1, .1, 0], [0, 0, Math.PI / 2.4]),
  ], mailbox, [-.12, 1.77, .06]);
  for (let index = 0; index < 3; index++) {
    const letter = new THREE.Mesh(letterGeometry, toy);
    letter.visible = false; letter.position.copy(slot);
    letters.push(letter); mailbox.add(letter);
  }
  mailbox.scale.setScalar(1.15);
  obstacles.push({ id: 'mailbox', x: MAILBOX.x, z: MAILBOX.z, radius: .62 });
  ambient.push((time) => {
    bird.position.y = 1.77 + .05 * Math.max(0, Math.sin(time * 5)) ** 2;
    bird.rotation.y = .5 * Math.sin(time * .7) + (Math.sin(time * .31) > .6 ? Math.PI : 0);
  });

  // GitHub: parcels on a pallet, the pile tagged GitHub; the top one bounces and squashes.
  const parcels = post({
    id: 'contact:github', kind: 'play', label: 'Parcels: Noah on GitHub', at: PARCELS, side: [-1, .3], stand: 1.25, reach: .75, reachY: 1,
    present: { lines: [line('contact-github', `My code lives on GitHub, as ${github.replace(/\/+$/, '').split('/').pop()}!`)], url: github, linkLabel: 'Open GitHub' },
  }, (time, energy) => {
    const bounce = Math.abs(Math.sin(time * 4.5)), squash = energy * (1 - bounce) ** 6;
    topParcel.position.y = 1.05 + energy * .42 * bounce;
    topParcel.scale.set(1 + squash * .1, 1 - squash * .18, 1 + squash * .1);
    topParcel.rotation.z = energy * .14 * Math.sin(time * 4.5);
    middleParcel.rotation.y = .28 + energy * .1 * Math.sin(time * 9);
  });
  solid([
    ...[-.34, 0, .34].map((z) => piece(new THREE.BoxGeometry(1, .05, .28), WOOD, [0, .125, z])),
    ...[-.38, 0, .38].map((x) => piece(new THREE.BoxGeometry(.14, .1, .96), 0xa86f45, [x, .05, 0])),
    piece(rounded(.86, .5, .8, .04), KRAFT, [0, .4, 0]),
    piece(rounded(.87, .51, .08, .01), 0xeed9ad, [0, .4, 0]),
    piece(rounded(.08, .51, .81, .01), 0xeed9ad, [0, .4, 0]),
    piece(rounded(.74, .2, .02, .02), PAPER, [0, .42, .41]),
  ], parcels);
  const middleParcel = solid([
    piece(rounded(.62, .4, .58, .04), PEACH, [0, .2, 0]),
    piece(rounded(.63, .41, .07, .01), RED, [0, .2, 0]),
  ], parcels, [-.02, .65, -.02]);
  const topParcel = solid([
    piece(rounded(.52, .38, .46, .04), SKY, [0, .19, 0]),
    piece(rounded(.53, .39, .07, .01), SUN, [0, .19, 0]),
    piece(rounded(.07, .39, .47, .01), SUN, [0, .19, 0]),
    ...[-1, 1].map((side) => piece(new THREE.TorusGeometry(.07, .022, 6, 12), SUN, [side * .07, .42, 0], [0, 0, side * .6], [1, .7, 1])),
  ], parcels, [0, 1.05, .02]);
  sign(CELLS.github, .7, .175, parcels, [0, .42, .422]);
  parcels.scale.setScalar(1.3);
  obstacles.push({ id: 'parcels', x: PARCELS.x, z: PARCELS.z, radius: .92 });

  // LinkedIn: a flagpole in a planter; he hoists the LinkedIn flag to the top while the pulley turns. It flutters always.
  let hoist = 0;
  const flagpole = post({
    id: 'contact:linkedin', kind: 'tinker', label: 'Flagpole: Noah on LinkedIn', at: FLAGPOLE, side: [-.92, .39], stand: .78, reach: .28, reachY: 1.1,
    present: { lines: [line('contact-linkedin', "Let's connect on LinkedIn! Up goes the flag!")], url: linkedin, linkLabel: 'Open LinkedIn' },
  }, (time, energy, progress, dt) => {
    hoist += (energy * Math.min(1, progress * 2.5) - hoist) * (1 - Math.exp(-dt * 2.5));
    flag.position.y = FLAG_LOW + (FLAG_HIGH - FLAG_LOW) * smooth(hoist);
    pulley.rotation.z = -hoist * 14;
  });
  solid([
    piece(cylinder(.36, .3, .4, 14), PEACH, [0, .2, 0]),
    piece(cylinder(.33, .33, .02, 14), 0x7a5236, [0, .4, 0]),
    ...[0, 1, 2, 3, 4].map((index) => piece(ball(.07), [PINK, SUN, PAPER, PINK, SUN][index], [Math.sin(index * 1.26) * .22, .47, Math.cos(index * 1.26) * .22])),
    piece(cylinder(.035, .05, 4.2, 10), 0xf2efe9, [0, 2.4, 0]),
    piece(ball(.09), SUN, [0, 4.56, 0]),
    piece(cylinder(.008, .008, 3.3, 4), NAVY, [.07, 2.75, .04]),
    piece(rounded(.04, .14, .05, .01), NAVY, [.06, 1.1, .05]),
  ], flagpole);
  const pulley = solid([piece(new THREE.TorusGeometry(.06, .02, 6, 12), NAVY), piece(rounded(.12, .02, .02, .005), SUN)], flagpole, [.06, 4.4, .06]);
  const flag = sign(CELLS.flag, 1, .5, flagpole, [.55, FLAG_LOW, .03], 8);
  const flagRest = Float32Array.from(flag.geometry.attributes.position.array);
  ambient.push((time) => {
    const positions = flag.geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const along = flagRest[vertex * 3] + .5;
      positions.setZ(vertex, Math.sin(along * 5 - time * 4) * .07 * along);
    }
    positions.needsUpdate = true;
  });
  obstacles.push({ id: 'flagpole', x: FLAGPOLE.x, z: FLAGPOLE.z, radius: .42 });

  // Blog: an easel pinboard of notes. A paper plane takes off and loops above it while a fresh note pops up.
  if (blog) {
    const plane = new THREE.Vector3(.8, 1.21, .2), loop = new THREE.Vector3(-.2, 2.95, .3);
    const restTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 1.3, .1)), heading = new THREE.Quaternion(), ahead = new THREE.Vector3();
    const board = post({
      id: 'contact:blog', kind: 'watch', label: "Pinboard: Noah's blog", at: BOARD, side: [.9, .44], stand: 1.45, reach: .95, reachY: 1.2,
      present: { lines: [line('contact-blog', `My blog lives at ${blog.replace(/^https?:\/\//, '').replace(/\/+$/, '')}!`)], url: blog, linkLabel: 'Read the blog' },
    }, (time, energy) => {
      const spin = time * 2.2;
      ahead.set(.8 * Math.sin(spin), .22 * Math.sin(spin * 2), .3 * Math.cos(spin));
      paperPlane.position.copy(plane).lerp(ahead.add(loop), energy);
      heading.setFromUnitVectors(Z_AXIS, ahead.set(.8 * Math.cos(spin), .44 * Math.cos(spin * 2), -.3 * Math.sin(spin)).normalize());
      paperPlane.quaternion.copy(restTurn).slerp(heading, energy);
      paperPlane.rotateZ(.08 * Math.sin(time * 2));
      freshNote.visible = energy > .01;
      freshNote.scale.setScalar(Math.max(.001, smooth(energy * 1.4 - .2)));
      freshNote.rotation.z = .15 * Math.sin(time * 3) * energy;
    });
    solid([
      ...[-1, 1].map((side) => piece(rounded(.08, 2.4, .08, .02), WOOD, [side * .6, 1.2, 0], [0, 0, side * .06])),
      piece(rounded(.08, 2.3, .08, .02), WOOD, [0, 1.12, -.35], [-.18, 0, 0]),
      piece(rounded(1.56, 1.14, .08, .04), WOOD, [0, 1.72, .05]),
      piece(rounded(1.42, 1, .06, .03), 0xd9a878, [0, 1.72, .08]),
      piece(rounded(1.95, .08, .2, .02), WOOD, [.2, 1.12, .12]),
      piece(rounded(.9, .26, .05, .04), MINT, [0, 2.44, .1]),
      ...[[-.48, 1.95, PINK, .1], [-.1, 2.0, SUN, -.08], [-.42, 1.5, SKY, -.05], [.02, 1.52, PAPER, .12], [.44, 1.5, MINT, -.1]].flatMap(([x, y, color, tilt]) => [
        piece(rounded(.3, .34, .01, .01), color, [x, y, .115], [0, 0, tilt]),
        ...[.06, 0, -.06].map((offset) => piece(new THREE.BoxGeometry(.2, .018, .005), 0x8a6a8f, [x, y + offset - .03, .122], [0, 0, tilt])),
        piece(ball(.025), RED, [x, y + .14, .13]),
      ]),
    ], board);
    sign(CELLS.blog, .8, .2, board, [0, 2.44, .13]);
    const planeShape = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, .22, -.15, 0, -.12, 0, -.05, -.12, 0, 0, .22, 0, -.05, -.12, -.15, 0, -.12,
      0, 0, .22, 0, -.05, -.12, .15, 0, -.12, 0, 0, .22, .15, 0, -.12, 0, -.05, -.12,
    ], 3));
    planeShape.computeVertexNormals();
    const paperPlane = solid([piece(planeShape, PAPER, [0, 0, 0], [0, 0, 0], [1.5, 1.5, 1.5])], board);
    const freshNote = solid([
      piece(rounded(.3, .34, .01, .01), RED, [0, 0, 0]),
      piece(new THREE.CircleGeometry(.08, 5), SUN, [0, .02, .008]),
      piece(ball(.025), NAVY, [0, .14, .015]),
    ], board, [.4, 2.02, .12]);
    freshNote.visible = false; freshNote.scale.setScalar(.001);
    paperPlane.position.copy(plane); paperPlane.quaternion.copy(restTurn);
  }
  group.updateMatrixWorld(true);

  return {
    id: 'postoffice',
    group,
    bounds: { ...BOUNDS },
    obstacles,
    stations,
    entry: { x: .4, z: 3.1 },
    view: { center: { x: 0, y: 2.2, z: -.4 } },
    pick: (raycaster) => {
      group.updateWorldMatrix(true, true);
      for (let node: THREE.Object3D | null = raycaster.intersectObject(group, true)[0]?.object ?? null; node; node = node.parent) {
        if (typeof node.userData.station === 'string') return node.userData.station;
      }
      return null;
    },
    update: (dt, elapsed, activity) => {
      for (const animate of ambient) animate(elapsed);
      for (const reactive of reactives) {
        const active = reactive.id === activity.stationId;
        reactive.energy = THREE.MathUtils.clamp(reactive.energy + (active ? 4 : -3) * dt, 0, 1);
        reactive.animate(elapsed, reactive.energy, active ? activity.progress : 0, dt);
      }
    },
    dispose: () => {
      group.traverse((node) => {
        if (node instanceof THREE.Mesh) node.geometry.dispose();
      });
      toy.dispose(); signs.map?.dispose(); signs.dispose();
    },
  };
};

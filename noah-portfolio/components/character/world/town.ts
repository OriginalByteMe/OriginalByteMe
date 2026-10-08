import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOTS, type AreaId, type WorldArea } from './types';

/** Lot origins sit this far apart along +x: a building up to 14 wide plus a gap. */
export const LOT_SPACING = 16;
/** World z of the street's centre line, in front of every lot's open front. */
export const STREET_Z = 5.7;
const STREET_WIDTH = 2.6;
export const lotOrigin = (lot: number) => new THREE.Vector3(lot * LOT_SPACING, 0, 0);

const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const scratch = new THREE.Color();

/** Flat vertex colour so static parts merge into one draw call on a vertex-coloured material. */
function tinted(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const colors = new Float32Array(flat.attributes.position.count * 3);
  scratch.set(color);
  for (let index = 0; index < colors.length; index += 3) scratch.toArray(colors, index);
  return flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
const box = (width: number, height: number, depth: number, x: number, y: number, z: number, radius = .06) =>
  new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, width / 2, height / 2, depth / 2)).translate(x, y, z);
/** One mesh from parts, its sources disposed. */
function merged(parts: THREE.BufferGeometry[], material: THREE.Material) {
  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  for (const part of parts) part.dispose();
  return mesh;
}

/** The ground every lot stands on and the street that joins them, one draw call. The ground ends just behind the buildings so the sky shows above it, and runs well past the end lots and toward the camera so no other edge shows. The scene adds and disposes it. */
export function createStreet(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'street';
  const end = (LOTS.length - 1) * LOT_SPACING;
  const length = end + 8 * LOT_SPACING;
  const parts = [
    tinted(new THREE.PlaneGeometry(length, 78).rotateX(-Math.PI / 2).translate(end / 2, -.04, 31), 0xb9cfa4),
    tinted(box(length, .08, STREET_WIDTH, end / 2, -.04, STREET_Z, .03), 0xe9dccb),
    ...[-1, 1].map((side) => tinted(box(length, .1, .18, end / 2, -.03, STREET_Z + side * (STREET_WIDTH / 2 + .09), .04), 0xcdb8a6)),
    ...Array.from({ length: Math.floor(length / 2.4) }, (_, index) => tinted(new THREE.BoxGeometry(1.1, .02, .14).translate((end - length) / 2 + 1.2 + index * 2.4, .005, STREET_Z), 0xfff8ec)),
  ];
  group.add(merged(parts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 })));
  return group;
}

export type ShellSpec = {
  id: AreaId;
  /** Chapter title on the sign. */
  name: string;
  palette: { floor: number; wall: number; trim: number; accent: number; sign: number; ink: string };
};

/**
 * Placeholder building for a lot whose ticket has not built it yet: floor, back wall,
 * corner posts, a named sign and one display he can walk up to. Twice the old room floor.
 */
export function createShell(origin: THREE.Vector3, { id, name, palette }: ShellSpec): WorldArea {
  const group = new THREE.Group();
  group.name = id;
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  group.add(merged([
    tinted(box(13.6, .5, 8.4, 0, -.25, 0, .18), palette.floor),
    tinted(box(13.2, .4, 8, 0, -.66, 0, .18), palette.trim),
    tinted(box(13.6, 5, .3, 0, 2.5, -4.05, .08), palette.wall),
    tinted(box(13.8, .2, .5, 0, 5.08, -4, .06), palette.trim),
    tinted(box(13.4, .16, .2, 0, .08, -3.82, .04), palette.trim),
    ...[-1, 1].flatMap((side) => [
      tinted(box(.4, 5, .4, side * 6.6, 2.5, -3.7, .08), palette.trim),
      tinted(box(.4, 4.2, .4, side * 6.6, 2.1, 3.9, .08), palette.trim),
      tinted(new THREE.SphereGeometry(.3, 14, 10).translate(side * 6.6, 4.45, 3.9), palette.accent),
    ]),
    tinted(box(6.4, 1.3, .14, 0, 4.1, -3.83, .1), palette.trim),
    tinted(box(6.1, 1.06, .16, 0, 4.1, -3.82, .08), palette.sign),
  ], toy));

  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 176;
  const context = canvas.getContext('2d')!;
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = palette.ink;
  let size = 120;
  context.font = `800 ${size}px ${FONT}`;
  while (size > 24 && context.measureText(name).width > 940) context.font = `800 ${size -= 6}px ${FONT}`;
  context.fillText(name, 512, 92);
  const signTexture = new THREE.CanvasTexture(canvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false }));
  sign.position.set(0, 4.1, -3.73);
  group.add(sign);

  // The one station until the real building lands: a display crate against the back wall.
  const station = `${id}:display`;
  const display = merged([
    tinted(box(1.4, .9, .9, 0, .45, 0, .1), palette.accent),
    tinted(box(1.5, .1, 1, 0, .95, 0, .04), palette.trim),
  ], toy);
  display.name = display.userData.station = station;
  display.position.set(0, 0, -2.7);
  group.add(display);
  group.updateMatrixWorld(true);

  return {
    id,
    group,
    bounds: { minX: -6.2, maxX: 6.2, minZ: -3.4, maxZ: 3.6 },
    obstacles: [{ id: 'display', x: 0, z: -2.7, radius: .8 }],
    stations: [{ id: station, kind: 'watch', label: `${name} display`, stand: { x: 0, z: -1.55 }, heading: Math.PI, reach: { x: 0, y: .98, z: -2.25 } }],
    entry: { x: 2.2, z: 3.1 },
    view: { center: { x: 0, y: 2, z: -.4 } },
    pick: (raycaster) => {
      for (let node: THREE.Object3D | null = raycaster.intersectObject(group, true)[0]?.object ?? null; node && node !== group; node = node.parent) {
        if (typeof node.userData.station === 'string') return node.userData.station;
      }
      return null;
    },
    update: (dt, elapsed, activity) => {
      display.position.y = activity.stationId === station ? .06 * Math.abs(Math.sin(elapsed * 6)) : 0;
    },
    dispose: () => {
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
      });
      toy.dispose(); sign.material.dispose(); signTexture.dispose();
    },
  };
}

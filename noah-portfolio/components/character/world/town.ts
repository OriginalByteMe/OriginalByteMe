import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOTS } from './types';

/** Lot origins sit this far apart along +x: a building up to 14 wide plus a gap. */
export const LOT_SPACING = 16;
/** World z of the street's centre line, in front of every lot's open front. */
export const STREET_Z = 5.7;
const STREET_WIDTH = 2.6;
export const lotOrigin = (lot: number) => new THREE.Vector3(lot * LOT_SPACING, 0, 0);

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

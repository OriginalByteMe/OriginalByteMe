import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AreaBuilder } from './types';

const WALL_Z = -3.1; // front face of the back wall
const IMAGE = { width: 2.1 * 1408 / 1926, height: 2.1 }; // /hero.png aspect
const BORDER = .16;
const FRAME = { width: IMAGE.width + 2 * BORDER, height: IMAGE.height + 2 * BORDER, bottom: 1.4, front: WALL_Z + .16 };
const NAIL_Y = FRAME.bottom + FRAME.height + .16;
const SHELF = { x: -2.9, z: -2.85, width: 2.2, top: .98 };
const TABLE = { x: 3.3, z: -2.45, top: .82 };
const COUCH = { x: -3.3, z: 1.2, seat: .56 };

/** About Me diorama, the gallery lot until it is rebuilt: Noah's framed portrait, a Kuala Lumpur skyline model, a career shelf and a couch. */
export const createAbout: AreaBuilder = (origin, content) => {
  const group = new THREE.Group();
  group.name = 'about-area';
  group.position.copy(origin);
  const textures: THREE.Texture[] = [];
  let disposed = false;
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra });
  const box = (width: number, height: number, depth: number, radius = .06) => new RoundedBoxGeometry(width, height, depth, 2, radius);
  const add = <M extends THREE.Material>(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: M, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const station = (id: string) => { const root = new THREE.Group(); root.userData.station = id; group.add(root); return root; };
  const paint = (width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d')!);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture); return texture;
  };
  const loader = new THREE.TextureLoader();
  const load = (url: string, onLoad: (texture: THREE.Texture) => void) => {
    const texture = loader.load(url, (loaded) => { if (disposed) loaded.dispose(); else onLoad(loaded); }, undefined, () => {});
    texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture); return texture;
  };
  const cream = mat(0xf4ecdf), plum = mat(0x72509c), lilac = mat(0xb39bc3), coral = mat(0xeb9a84), sage = mat(0xa6b4a0), peach = mat(0xe8b38b);

  // Room shell: floor slab, back wall toward -z, left side wall; front and right stay open.
  add(group, box(11.2, .5, 6.6, .2), mat(0xe2c4a6), 0, -.25, -.1);
  add(group, box(11.2, 4.4, .3, .08), mat(0xf6e6d6), 0, 2.2, WALL_Z - .15);
  add(group, new THREE.BoxGeometry(10.9, 1, .04), lilac, .15, .5, WALL_Z + .02);
  add(group, box(.3, 4.4, 5.4, .08), mat(0xeadcf0), -5.45, 2.2, -.7);
  const rug = add(group, new THREE.CylinderGeometry(1.9, 1.9, .015, 40), mat(0xd9c6e4), -.2, .008, .5);
  rug.scale.z = .65;

  // Portrait: chunky frame hanging from a nail; the pivot sits at the nail so a tilt swings like a real picture.
  const portrait = station('portrait');
  add(portrait, new THREE.SphereGeometry(.035, 10, 8), plum, 0, NAIL_Y, WALL_Z + .03);
  const pivot = new THREE.Group(); pivot.position.set(0, NAIL_Y, WALL_Z); portrait.add(pivot);
  const wood = mat(0xb07a52), centerY = FRAME.bottom + FRAME.height / 2 - NAIL_Y;
  add(pivot, box(FRAME.width, FRAME.height, .08, .03), mat(0x8a5a3c), 0, centerY, .04);
  for (const side of [-1, 1]) {
    add(pivot, box(FRAME.width, BORDER, .16, .04), wood, 0, centerY + side * (FRAME.height - BORDER) / 2, .08);
    add(pivot, box(BORDER, FRAME.height - 2 * BORDER, .16, .04), wood, side * (FRAME.width - BORDER) / 2, centerY, .08);
    const corner = new THREE.Vector2(side * FRAME.width * .32, centerY + FRAME.height / 2);
    const wire = add(pivot, new THREE.CylinderGeometry(.008, .008, corner.length(), 5), plum, corner.x / 2, corner.y / 2, .03);
    wire.rotation.z = Math.atan2(-corner.x, corner.y);
  }
  const placeholder = paint(128, 176, (context) => {
    const wash = context.createLinearGradient(0, 0, 0, 176);
    wash.addColorStop(0, '#e9def1'); wash.addColorStop(1, '#f7e3d6');
    context.fillStyle = wash; context.fillRect(0, 0, 128, 176);
    context.fillStyle = 'rgba(114,80,156,0.22)';
    context.beginPath(); context.arc(64, 70, 38, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.ellipse(64, 176, 50, 46, 0, 0, Math.PI * 2); context.fill();
  });
  const image = add(pivot, new THREE.PlaneGeometry(IMAGE.width, IMAGE.height), new THREE.MeshBasicMaterial({ map: placeholder, toneMapped: false }), 0, centerY, .082);
  load('/hero.png', (texture) => { image.material.map = texture; image.material.needsUpdate = true; });
  const twinkle = mat(0xfff1ce, { emissive: 0xffe08a, emissiveIntensity: 1.2 });
  const sparkleShape = new THREE.OctahedronGeometry(.07);
  const sparkles = [[1.08, 3.62], [1.24, 3.3], [.98, 3.95]].map(([x, y]) => {
    const sparkle = add(portrait, sparkleShape, twinkle, x, y, WALL_Z + .3); sparkle.visible = false; return sparkle;
  });

  // Kuala Lumpur skyline model on a side table: Petronas Twin Towers, KL Tower and a few blocks, merged per material.
  const skyline = station('skyline');
  add(skyline, new THREE.CylinderGeometry(.55, .55, .06, 24), cream, TABLE.x, TABLE.top - .03, TABLE.z);
  add(skyline, new THREE.CylinderGeometry(.05, .07, TABLE.top - .06, 10), plum, TABLE.x, (TABLE.top - .06) / 2, TABLE.z);
  add(skyline, new THREE.CylinderGeometry(.28, .3, .04, 20), plum, TABLE.x, .02, TABLE.z);
  const silver = mat(0xdcd8e8, { metalness: .3, roughness: .45 });
  const windows = [0, 1, 2].map(() => mat(0xfff1c9, { emissive: 0xffd98a, emissiveIntensity: .35 }));
  const city = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    city.set(material, [...city.get(material) ?? [], geometry.translate(x, y, z)]);
  };
  const ground = TABLE.top + .03;
  part(new THREE.BoxGeometry(.9, .03, .6), sage, TABLE.x, TABLE.top + .015, TABLE.z - .05);
  part(new THREE.BoxGeometry(.5, .05, .2), cream, TABLE.x, ground + .025, -2.6);
  for (const side of [-1, 1]) {
    let y = ground;
    for (const [index, [radius, height]] of [[.085, .22], [.078, .16], [.07, .12], [.06, .09], [.048, .07], [.036, .05]].entries()) {
      part(new THREE.CylinderGeometry(radius, radius, height, 8), silver, TABLE.x + side * .13, y + height / 2, -2.6);
      part(new THREE.CylinderGeometry(radius + .004, radius + .004, .025, 8), windows[(index + side + 3) % 3], TABLE.x + side * .13, y + height / 2, -2.6);
      y += height;
    }
    part(new THREE.ConeGeometry(.016, .2, 6), silver, TABLE.x + side * .13, y + .1, -2.6);
  }
  part(new THREE.BoxGeometry(.13, .025, .03), silver, TABLE.x, ground + .38, -2.6);
  part(new THREE.CylinderGeometry(.04, .05, .06, 10), silver, 3.68, ground + .03, -2.45);
  part(new THREE.CylinderGeometry(.018, .026, .6, 10), silver, 3.68, ground + .36, -2.45);
  part(new THREE.SphereGeometry(.06, 12, 8).scale(1, .7, 1), silver, 3.68, ground + .62, -2.45);
  part(new THREE.CylinderGeometry(.064, .064, .015, 12), windows[1], 3.68, ground + .62, -2.45);
  part(new THREE.CylinderGeometry(.006, .006, .22, 5), silver, 3.68, ground + .78, -2.45);
  for (const [index, [x, z, width, height, depth, material]] of ([
    [TABLE.x, -2.3, .3, .32, .2, lilac], [2.92, -2.55, .2, .42, .2, peach], [3.62, -2.2, .16, .22, .16, sage], [2.98, -2.22, .14, .2, .14, coral],
  ] as const).entries()) {
    part(new THREE.BoxGeometry(width, height, depth), material, x, ground + height / 2, z);
    for (let floor = 0; .07 + floor * .09 < height - .03; floor++) {
      part(new THREE.BoxGeometry(width * .7, .03, .008), windows[(index + floor) % 3], x, ground + .07 + floor * .09, z + depth / 2 + .004);
    }
  }
  for (const [material, parts] of city) add(skyline, mergeGeometries(parts)!, material);

  // Career shelf: one badge per job with its logo, company and period.
  const career = station('career');
  add(career, box(SHELF.width, SHELF.top - .06, .5), sage, SHELF.x, (SHELF.top - .06) / 2, SHELF.z);
  add(career, box(SHELF.width + .1, .06, .56, .025), cream, SHELF.x, SHELF.top - .03, SHELF.z);
  for (const side of [-1, 1]) add(career, new THREE.SphereGeometry(.035, 10, 8), cream, SHELF.x + side * .25, .6, SHELF.z + .26);
  const slot = (SHELF.width - .1) / Math.max(3, content.career.length);
  const badgeY = SHELF.top + .4;
  const badges = content.career.map((job, index) => {
    const badge = new THREE.Group();
    badge.position.set(SHELF.x + (index - (content.career.length - 1) / 2) * slot, badgeY, SHELF.z);
    badge.rotation.x = -.1; badge.scale.setScalar(Math.min(1, slot / .7));
    career.add(badge);
    add(badge, box(.6, .76, .05, .04), mat(0xfff7ea), 0, 0, 0);
    add(badge, new THREE.BoxGeometry(.3, .04, .18), plum, 0, -.39, 0);
    const label = paint(512, 190, (context) => {
      context.fillStyle = '#5b3f7d'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.font = '700 64px system-ui, sans-serif';
      const size = Math.min(64, 64 * 480 / context.measureText(job.company).width);
      context.font = `700 ${size}px system-ui, sans-serif`; context.fillText(job.company, 256, 62);
      context.fillStyle = '#8a6fa8'; context.font = '500 46px system-ui, sans-serif'; context.fillText(job.period, 256, 140);
    });
    add(badge, new THREE.PlaneGeometry(.54, .2), new THREE.MeshBasicMaterial({ map: label, transparent: true, toneMapped: false }), 0, -.24, .027);
    const logo = add(badge, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), 0, .12, .027);
    logo.visible = false;
    logo.material.map = load(job.logo, (texture) => {
      const { width, height } = texture.image as { width: number; height: number };
      const aspect = width / height || 1;
      logo.scale.set(Math.min(.46, .36 * aspect), Math.min(.36, .46 / aspect), 1);
      logo.visible = true;
    });
    return badge;
  });

  // Couch, facing the camera from the front-left.
  const couch = new THREE.Group(); couch.position.set(COUCH.x, 0, COUCH.z); group.add(couch);
  add(couch, box(1.8, .4, .85, .08), coral, 0, .2, 0);
  add(couch, box(1.8, .65, .24, .1), coral, 0, .625, -.305);
  for (const side of [-1, 1]) {
    add(couch, box(.24, .62, .85, .1), coral, side * .78, .31, 0);
    add(couch, box(.64, .16, .62, .07), cream, side * .33, COUCH.seat - .08, .1);
  }
  add(couch, box(.36, .3, .12, .06), lilac, -.45, .72, -.12).rotation.z = .2;

  // Floor lamp and potted plant for ambient life.
  add(group, new THREE.CylinderGeometry(.2, .22, .04, 20), plum, -4.7, .02, -.2);
  add(group, new THREE.CylinderGeometry(.025, .025, 1.6, 8), plum, -4.7, .82, -.2);
  const glow = mat(0xfff1ce, { emissive: 0xffd9a0, emissiveIntensity: .7, side: THREE.DoubleSide });
  add(group, new THREE.CylinderGeometry(.18, .26, .3, 16, 1, true), glow, -4.7, 1.75, -.2);
  add(group, new THREE.SphereGeometry(.07, 12, 8), glow, -4.7, 1.68, -.2);
  add(group, new THREE.CylinderGeometry(.2, .15, .36, 16), coral, 4.75, .18, -2.7);
  const leaves = new THREE.Group(); leaves.position.set(4.75, .34, -2.7); group.add(leaves);
  const leafShape = new THREE.SphereGeometry(.09, 10, 8);
  for (let index = 0; index < 5; index++) {
    const leaf = add(leaves, leafShape, sage, Math.sin(index * 1.26) * .08, .26, Math.cos(index * 1.26) * .08);
    leaf.scale.set(1, 3.2, .45); leaf.rotation.set(Math.cos(index * 1.26) * .45, index * 1.26, -Math.sin(index * 1.26) * .45);
  }

  let tilt = 0, swing = 0;
  return {
    id: 'gallery',
    group,
    bounds: { minX: -4.5, maxX: 4.5, minZ: -2.6, maxZ: 2.6 },
    obstacles: [
      { id: 'career-shelf-left', x: SHELF.x - .7, z: SHELF.z, radius: .42 },
      { id: 'career-shelf', x: SHELF.x, z: SHELF.z, radius: .42 },
      { id: 'career-shelf-right', x: SHELF.x + .7, z: SHELF.z, radius: .42 },
      { id: 'skyline-table', x: TABLE.x, z: TABLE.z, radius: .6 },
      { id: 'couch-left', x: COUCH.x - .45, z: COUCH.z, radius: .55 },
      { id: 'couch-right', x: COUCH.x + .45, z: COUCH.z, radius: .55 },
      { id: 'lamp', x: -4.7, z: -.2, radius: .3 },
      { id: 'plant', x: 4.75, z: -2.7, radius: .3 },
    ],
    stations: [
      { id: 'portrait', kind: 'admire', label: "Noah's portrait", stand: { x: .55, z: -2.35 }, heading: Math.PI, reach: { x: (FRAME.width - BORDER) / 2, y: FRAME.bottom + BORDER / 2, z: FRAME.front } },
      { id: 'skyline', kind: 'watch', label: `Skyline model of ${content.location}`, stand: { x: TABLE.x, z: -1.6 }, heading: Math.PI, reach: { x: TABLE.x, y: 1, z: -2.2 } },
      { id: 'career', kind: 'watch', label: 'Career shelf', stand: { x: SHELF.x, z: -2.15 }, heading: Math.PI, reach: { x: SHELF.x, y: SHELF.top, z: -2.64 } },
    ],
    entry: { x: 1.9, z: 2.3 },
    view: { center: { x: 0, y: 1.8, z: -.6 } },
    pick: (raycaster) => {
      const hit = raycaster.intersectObject(group, true).find((candidate) => candidate.object.visible);
      for (let node = hit?.object ?? null; node && node !== group; node = node.parent) if (node.userData.station) return node.userData.station as string;
      return null;
    },
    update: (dt, elapsed, { stationId, progress }) => {
      const step = Math.min(dt, .05);
      glow.emissiveIntensity = .7 + .2 * Math.sin(elapsed * 1.4);
      leaves.rotation.z = .05 * Math.sin(elapsed * 1.1); leaves.rotation.x = .03 * Math.sin(elapsed * .7 + 1);
      // Damped pendulum: he knocks the frame crooked for the first part of the visit, then it swings back straight.
      const target = stationId === 'portrait' && progress < .45 ? .16 : 0;
      swing += (-40 * (tilt - target) - 2.3 * swing) * step; tilt += swing * step;
      pivot.rotation.z = tilt;
      for (const [index, sparkle] of sparkles.entries()) {
        sparkle.visible = stationId === 'portrait';
        sparkle.scale.setScalar(.4 + .6 * Math.abs(Math.sin(elapsed * 4 + index * 2.1))); sparkle.rotation.y = elapsed * 2 + index;
      }
      for (const [index, material] of windows.entries()) material.emissiveIntensity = stationId === 'skyline' ? .3 + 1.1 * Math.max(0, Math.sin(elapsed * 7 + index * 2.1)) : .35;
      for (const [index, badge] of badges.entries()) badge.position.y = badgeY + (stationId === 'career' ? .05 * Math.abs(Math.sin(elapsed * 5 + index * 1.3)) : 0);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) material.dispose();
      });
      for (const texture of textures) texture.dispose();
    },
  };
};

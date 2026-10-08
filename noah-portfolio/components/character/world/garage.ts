import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterLine } from '@/lib/character/narrative';
import type { AreaBuilder, Obstacle, Station, StationKind } from './types';

type V3 = [number, number, number];
type Animate = (time: number, energy: number, progress: number, dt: number) => void;
type Kit = {
  root: THREE.Group;
  /** Static parts, merged with the station's other static parts into one draw call. */
  parts: THREE.BufferGeometry[];
  /** One rigid moving part from merged pieces, added to `parent` at `at`. */
  solid: (parts: THREE.BufferGeometry[], parent: THREE.Object3D, at?: V3) => THREE.Mesh;
};
/** A machine or gadget: its animation, where his hands go (root-local), what his body does there, and for gadgets the name he heads for ("Off to the typewriter."). */
type Rig = { animate: Animate; reach: V3; kind: StationKind; label?: string };

const CONCRETE = 0xcfd2d9, JOINT = 0xb3b8c2, OIL = 0xa3a9b4, WALL = 0x6f9cc4, WALL_SIDE = 0x86afd2, WAINSCOT = 0x4f78a0, NAVY = 0x2f4a72,
  MUSTARD = 0xf2c14e, GOLD = 0xdcaa3a, TOMATO = 0xe2603f, CHERRY = 0xb8432c, MINT = 0x8fd3b6, MINT_DARK = 0x6cbb9a, SKY = 0x8fc9f0,
  PINK = 0xf29bb6, LEAF = 0x7fb069, WOOD = 0xd39a5c, WOOD_DARK = 0xa66e3c, PEG = 0xdcb47f, HOLE = 0x8f6d45, INK = 0x262d3b,
  CHARCOAL = 0x3a4250, SLATE = 0x4a5568, CREAM = 0xfff4dc, BEIGE = 0xe8dbb8, PUTTY = 0xd2c39f, BEZEL = 0x4d463a, STEEL = 0xb7bec9,
  SILVER = 0xd9dde4, PEARL = 0xe9ecf1, GRAPHITE = 0x6f7784, ORANGE = 0xff8a3d, COFFEE = 0x5a3a22, MAT = 0x3d4a5c, BULB = 0xfff1c9,
  BULB_DIM = 0x8a6f3d, AMBER = 0xffb347, LED_OFF = 0x23402f, SCREEN_OFF = 0x1b2230;
const SPOOLS = [TOMATO, MINT, SKY, PINK, MUSTARD];
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const TOP = .92; // workbench top
const BENCH = { left: -6.1, right: 2.9, z: -3.3 };
const SURFACE = .74; // gadget cart and desk tops
const PEG_Z = -3.86; // pegboard front face
const TILE = .38;
/** He stands this far right of a bench machine, so the dead-on camera sees it beside him. */
const STAND = { dx: .95, z: -2.55 };
/**
 * Side gadgets: the printer cart in the back corner and a desk far enough forward that, from the camera, it sits
 * below the cart instead of in front of the printer. Built a size up so they read beside him; he stands front-right of each.
 */
const SLOTS = [{ x: 4.45, z: -3.05, cart: true }, { x: 3.85, z: .9, cart: false }];
const GADGET = { scale: 1.3, radius: .8, dx: .9, dz: .72 };
const BOUNDS = { minX: -6.2, maxX: 6.2, minZ: -3.4, maxZ: 3.6 };
const CORNERS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const LAYERS = 14;
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3(), color: new THREE.Color() };

const OS_SOURCE = 'content/about-me/operating-systems.md', FUN = 'content/about-me/fun-facts.md', CAREER = 'content/about-me/career.md', CONTACT = 'content/about-me/contact.md';
/** What he says presenting each machine, by station id; every line a public fact with its source. */
const LINES: Record<string, readonly CharacterLine[]> = {
  'os:linux-environment': [{ id: 'rig-linux', line: 'Linux, Debian and Ubuntu. My Linux environment, booting up!', source: OS_SOURCE }],
  'os:windows-environment': [{ id: 'rig-windows', line: 'Windows too, with WSL2 so Linux is never far away!', source: OS_SOURCE }],
  'os:macos-workstation': [{ id: 'rig-macos', line: 'And my macOS workstation. Wakey wakey!', source: OS_SOURCE }],
  'os:homelab-server': [
    { id: 'rig-homelab', line: 'My homelab server runs Linux and Unraid!', source: OS_SOURCE },
    { id: 'rig-self-host', line: 'I self-host on Proxmox and Unraid. Blink blink, little drives!', source: FUN },
  ],
  'side:3d-printing': [
    { id: 'rig-cad', line: 'I design parts in CAD and print them on FDM machines!', source: CAREER },
    { id: 'rig-materials', line: 'High-end materials, layer by layer. Watch it go!', source: FUN },
  ],
  'side:my-blog': [{ id: 'rig-blog', line: 'I keep a tech blog too. Fresh off the press!', source: CONTACT }],
};

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, radius);
const block = (width: number, height: number, depth: number) => new THREE.BoxGeometry(width, height, depth);
const cylinder = (top: number, bottom: number, height: number, segments = 14) => new THREE.CylinderGeometry(top, bottom, height, segments);
const ball = (radius: number) => new THREE.SphereGeometry(radius, 10, 6);

/** Bakes transform and a flat vertex colour so static and rigid parts merge into one draw call with the shared toy material. */
function piece(source: THREE.BufferGeometry, color: THREE.ColorRepresentation, at: V3 = [0, 0, 0], turn: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  const { matrix, position, rotation, euler } = scratch;
  geometry.applyMatrix4(matrix.compose(position.set(...at), rotation.setFromEuler(euler.set(...turn)), scratch.scale.set(...scale)));
  const tint = new THREE.Color(color), count = geometry.attributes.position.count, colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) tint.toArray(colors, index * 3);
  return geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** Stable per-index, per-step coin flip: blinking stays deterministic without Math.random. */
const noise = (index: number, step: number) => {
  let h = Math.imul(index + 1, 374761393) ^ Math.imul(step + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * A dark screen with a faint screensaver that boots: it flickers on, then fills its bars ([left, y, width, height]
 * from the screen centre) one by one with the progress. Its power LED breathes amber while idle and glows mint when on.
 */
function screen(parent: THREE.Object3D, width: number, height: number, at: V3, on: number, ink: number, bars: [number, number, number, number][], led: V3) {
  const face = new THREE.MeshBasicMaterial({ color: SCREEN_OFF, toneMapped: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), face);
  panel.position.set(...at); parent.add(panel);
  const fill = new THREE.MeshBasicMaterial({ color: ink, toneMapped: false });
  const fills = bars.map(([left, y, barWidth, barHeight]) => {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, barHeight).translate(barWidth / 2, 0, 0), fill);
    bar.position.set(left, y, .003); bar.scale.x = .001; panel.add(bar);
    return bar;
  });
  const light = new THREE.MeshBasicMaterial({ color: AMBER, toneMapped: false });
  const lamp = new THREE.Mesh(ball(.022), light);
  lamp.position.set(...led); parent.add(lamp);
  const lit = new THREE.Color(on), mint = new THREE.Color(MINT);
  return (time: number, energy: number, progress: number) => {
    const flicker = progress < .08 ? .45 + .55 * Math.abs(Math.sin(time * 37)) : 1;
    face.color.set(SCREEN_OFF).lerp(lit, Math.max(.06 + .04 * Math.sin(time * 1.3 + at[1]), energy * flicker));
    fills.forEach((bar, index) => { bar.scale.x = Math.max(.001, energy * THREE.MathUtils.clamp(progress * 1.25 * fills.length - index, 0, 1)); });
    light.color.set(AMBER).lerp(mint, energy).multiplyScalar(.5 + .5 * Math.max(energy, .5 + .5 * Math.sin(time * 2.1)));
  };
}

/** Linux: a beige CRT with a terminal that scrolls up, a keyboard, and a penguin on top that dances when it boots. */
function crt({ root, parts, solid }: Kit): Rig {
  parts.push(
    piece(rounded(.42, .05, .4, .02), BEIGE, [0, TOP + .025, -3.38]),
    piece(rounded(.8, .62, .6, .07, 2), BEIGE, [0, TOP + .36, -3.36]),
    piece(rounded(.5, .42, .2, .05), PUTTY, [0, TOP + .38, -3.72]),
    piece(rounded(.64, .48, .03, .02), BEZEL, [0, TOP + .39, -3.05]),
    piece(block(.2, .025, .02), INK, [-.18, TOP + .11, -3.055]),
    piece(rounded(.64, .045, .22, .02), BEIGE, [.42, TOP + .025, -2.93]),
    ...Array.from({ length: 30 }, (_, index) => piece(block(.045, .02, .045), index === 29 ? TOMATO : PUTTY, [.15 + (index % 10) * .06, TOP + .055, -2.99 + Math.floor(index / 10) * .06])),
  );
  const show = screen(root, .54, .38, [0, TOP + .39, -3.03], 0x163a29, 0x8dffb0,
    [[-.23, .12, .3, .03], [-.23, .06, .42, .03], [-.23, 0, .2, .03], [-.23, -.06, .36, .03], [-.23, -.12, .06, .04]], [.3, TOP + .11, -3.05]);
  const penguin = solid([
    piece(ball(.1), INK, [0, .12, 0], [0, 0, 0], [1, 1.2, .9]),
    piece(ball(.075), CREAM, [0, .11, .035], [0, 0, 0], [1, 1.2, .8]),
    piece(new THREE.ConeGeometry(.025, .06, 6), ORANGE, [0, .19, .09], [Math.PI / 2, 0, 0]),
    ...[-1, 1].flatMap((side) => [piece(rounded(.05, .02, .07, .01), ORANGE, [side * .04, .01, .03]), piece(ball(.014), CREAM, [side * .035, .21, .07])]),
  ], root, [-.2, TOP + .67, -3.4]);
  return {
    kind: 'type', reach: [.42, TOP + .06, -2.93],
    animate: (time, energy, progress) => {
      show(time, energy, progress);
      penguin.position.y = TOP + .67 + energy * .08 * Math.abs(Math.sin(time * 7));
      penguin.rotation.y = .35 * Math.sin(time * .9) + energy * .6 * Math.sin(time * 5);
    },
  };
}

/** Windows: a flat monitor that tiles in, a keyboard and mouse, and a tower under the bench whose fan spins up. */
function desktop({ root, parts, solid }: Kit): Rig {
  parts.push(
    piece(rounded(.4, .03, .26, .012), INK, [0, TOP + .015, -3.45]),
    piece(rounded(.07, .36, .05, .02), INK, [0, TOP + .2, -3.53]),
    piece(rounded(1.04, .64, .06, .03), INK, [0, TOP + .64, -3.47]),
    piece(rounded(.5, .3, .1, .04), CHARCOAL, [0, TOP + .6, -3.54]),
    piece(rounded(.64, .03, .2, .012), PEARL, [.4, TOP + .015, -3.0]),
    ...Array.from({ length: 36 }, (_, index) => piece(block(.04, .014, .04), CHARCOAL, [.125 + (index % 12) * .05, TOP + .036, -3.06 + Math.floor(index / 12) * .055])),
    piece(block(.22, .008, .2), TOMATO, [.88, TOP + .004, -3.0]),
    piece(ball(.045), PEARL, [.88, TOP + .02, -3.0], [0, 0, 0], [.8, .45, 1.2]),
    piece(rounded(.34, .66, .6, .04), CHARCOAL, [-.3, .34, -3.3]),
    piece(block(.26, .03, .01), SKY, [-.3, .62, -2.997]),
  );
  const show = screen(root, .96, .56, [0, TOP + .64, -3.437], 0x2f6fd6, 0xffffff,
    [[-.115, .1, .1, .1], [.015, .1, .1, .1], [-.115, -.02, .1, .1], [.015, -.02, .1, .1], [-.2, -.17, .4, .025]], [-.18, .55, -2.995]);
  const fan = solid([
    piece(new THREE.TorusGeometry(.12, .014, 6, 20), MINT),
    piece(cylinder(.035, .035, .02, 10), INK, [0, 0, 0], [Math.PI / 2, 0, 0]),
    ...[0, 1, 2, 3].map((blade) => piece(block(.05, .1, .01), STEEL, [Math.sin(blade * Math.PI / 2) * .06, Math.cos(blade * Math.PI / 2) * .06, 0], [0, 0, -blade * Math.PI / 2])),
  ], root, [-.3, .36, -2.99]);
  return {
    kind: 'type', reach: [.4, TOP + .04, -3.0],
    animate: (time, energy, progress, dt) => {
      show(time, energy, progress);
      fan.rotation.z -= dt * (2 + 16 * energy);
    },
  };
}

/** macOS: a laptop asleep with its lid half shut and its lid light breathing, opening wide as it wakes. */
function laptop({ root, parts, solid }: Kit): Rig {
  parts.push(
    piece(rounded(.74, .035, .5, .015), SILVER, [.1, TOP + .018, -3.12]),
    piece(block(.62, .006, .22), GRAPHITE, [.1, TOP + .037, -3.2]),
    piece(block(.24, .004, .13), PEARL, [.1, TOP + .037, -2.98]),
    piece(cylinder(.06, .055, .13), TOMATO, [-.52, TOP + .065, -3.0]),
    piece(new THREE.TorusGeometry(.035, .012, 6, 10), TOMATO, [-.455, TOP + .07, -3.0]),
    piece(cylinder(.05, .05, .01), COFFEE, [-.52, TOP + .126, -3.0]),
    piece(cylinder(.085, .065, .13), PINK, [-.45, TOP + .065, -3.62]),
    ...[[0, .18, 0], [-.045, .16, .03], [.045, .16, -.02], [0, .15, .05]].map(([x, y, z]) => piece(ball(.045), LEAF, [-.45 + x, TOP + y, -3.62 + z], [0, 0, 0], [.8, 1.3, .8])),
  );
  const lid = new THREE.Group();
  lid.position.set(.1, TOP + .035, -3.36); root.add(lid);
  solid([piece(rounded(.74, .48, .02, .01), SILVER, [0, .24, -.01])], lid);
  const show = screen(lid, .66, .4, [0, .25, .001], 0xf3ece2, NAVY, [[-.04, .07, .08, .08], [-.15, -.07, .3, .025]], [0, .24, -.022]);
  return {
    kind: 'type', reach: [.36, TOP + .04, -3.0],
    animate: (time, energy, progress) => {
      show(time, energy, progress);
      lid.rotation.x = THREE.MathUtils.lerp(.8, -.24, THREE.MathUtils.smoothstep(energy, 0, 1));
    },
  };
}

/** Homelab: a ten-inch rack with patch cables, drive bays that blink, a status LCD and a desk fan cooling it. */
function rack({ root, parts, solid }: Kit): Rig {
  const units = [TOP + .5, TOP + .32];
  parts.push(
    ...[-1, 1].map((side) => piece(rounded(.05, .94, .46, .015), INK, [.08 + side * .31, TOP + .47, -3.36])),
    ...[TOP + .02, TOP + .96].map((y) => piece(rounded(.68, .04, .48, .015), NAVY, [.08, y, -3.36])),
    piece(rounded(.56, .1, .42, .015), INK, [.08, TOP + .84, -3.37]),
    ...Array.from({ length: 8 }, (_, index) => piece(block(.035, .03, .01), SPOOLS[index % 4], [-.13 + index * .06, TOP + .855, -3.155])),
    ...[[0, MUSTARD], [2, TOMATO], [5, SKY]].map(([port, color]) => piece(new THREE.TorusGeometry(.03, .007, 4, 10, Math.PI), color, [-.1 + port * .06, TOP + .845, -3.14], [0, 0, Math.PI])),
    piece(rounded(.56, .12, .42, .015), SLATE, [.08, TOP + .68, -3.37]),
    ...units.flatMap((y) => [
      piece(rounded(.56, .16, .42, .015), SLATE, [.08, y, -3.37]),
      ...[0, 1, 2, 3].map((bay) => piece(block(.12, .13, .02), CREAM, [-.115 + bay * .13, y, -3.155])),
    ]),
    piece(rounded(.56, .1, .42, .015), INK, [.08, TOP + .16, -3.37]),
    ...[-.15, -.05, .05, .15].map((x) => piece(block(.06, .06, .01), CHARCOAL, [.08 + x, TOP + .16, -3.155])),
    piece(rounded(.2, .04, .16, .015), MUSTARD, [-.52, TOP + .02, -3.2]),
    piece(cylinder(.015, .015, .26, 6), STEEL, [-.52, TOP + .16, -3.2]),
  );
  const show = screen(root, .26, .07, [.02, TOP + .68, -3.155], AMBER, INK, [[-.11, .012, .2, .016], [-.11, -.014, .12, .014]], [.27, TOP + .68, -3.15]);
  const blink = new THREE.InstancedMesh(block(.024, .024, .01), new THREE.MeshBasicMaterial({ toneMapped: false }), units.length * 4);
  units.forEach((y, unit) => [0, 1, 2, 3].forEach((bay) => {
    blink.setMatrixAt(unit * 4 + bay, scratch.matrix.makeTranslation(-.08 + bay * .13, y + .045, -3.14));
    blink.setColorAt(unit * 4 + bay, scratch.color.set(LED_OFF));
  }));
  root.add(blink);
  const head = new THREE.Group();
  head.position.set(-.52, TOP + .32, -3.2); root.add(head);
  solid([
    piece(new THREE.TorusGeometry(.13, .008, 4, 24), STEEL),
    piece(rounded(.1, .1, .12, .03), MUSTARD, [0, 0, -.08]),
    ...[0, 1, 2, 3].map((spoke) => piece(block(.004, .26, .004), STEEL, [0, 0, .005], [0, 0, spoke * Math.PI / 4])),
  ], head);
  const blades = solid([
    piece(cylinder(.025, .025, .03, 8), INK, [0, 0, 0], [Math.PI / 2, 0, 0]),
    ...[0, 1, 2].map((blade) => piece(block(.05, .11, .008), SKY, [Math.sin(blade * 2.094) * .06, Math.cos(blade * 2.094) * .06, 0], [0, 0, -blade * 2.094])),
  ], head, [0, 0, -.015]);
  return {
    kind: 'tinker', reach: [.36, TOP + .5, -3.1],
    animate: (time, energy, progress, dt) => {
      show(time, energy, progress);
      blades.rotation.z -= dt * (4 + 22 * energy);
      head.rotation.y = THREE.MathUtils.lerp(.5 * Math.sin(time * .6), .7, energy);
      const step = Math.floor(time * (1.5 + 12 * energy));
      for (let index = 0; index < units.length * 4; index++) {
        const on = noise(index, step) < .35 + .45 * energy;
        blink.setColorAt(index, scratch.color.set(on ? (energy > .5 && index % 3 === 0 ? SKY : MINT) : LED_OFF));
      }
      blink.instanceColor!.needsUpdate = true;
    },
  };
}

/** 3D printing: a bed-slinger printing a little vase layer by layer, its head zipping and its spool unwinding. */
function printer({ root, parts, solid }: Kit): Rig {
  const S = SURFACE;
  parts.push(
    piece(rounded(.78, .11, .6, .03), INK, [0, S + .055, -.03]),
    ...[-1, 1].map((side) => piece(rounded(.05, .84, .05, .015), NAVY, [side * .36, S + .53, -.2])),
    piece(rounded(.77, .05, .05, .015), NAVY, [0, S + .95, -.2]),
    piece(cylinder(.012, .012, .1, 6), STEEL, [0, S + 1.0, -.2]),
  );
  const show = screen(root, .16, .08, [-.24, S + .055, .272], MINT, INK, [[-.065, 0, .13, .025]], [.3, S + .055, .275]);
  const spool = solid([
    piece(cylinder(.13, .13, .07, 18), TOMATO, [0, 0, 0], [Math.PI / 2, 0, 0]),
    piece(cylinder(.045, .045, .075, 10), CREAM, [0, 0, 0], [Math.PI / 2, 0, 0]),
    piece(block(.02, .07, .074), CREAM, [0, .09, 0]),
  ], root, [0, S + 1.12, -.2]);
  const bed = new THREE.Group();
  bed.position.set(0, S + .12, 0); root.add(bed);
  solid([piece(rounded(.5, .02, .46, .008), SKY), ...[-1, 1].map((side) => piece(block(.04, .025, .06), STEEL, [side * .23, .005, .2]))], bed);
  const layers = new THREE.InstancedMesh(cylinder(1, 1, 1, 12), new THREE.MeshStandardMaterial({ roughness: .5 }), LAYERS);
  for (let index = 0; index < LAYERS; index++) layers.setColorAt(index, scratch.color.set(MINT).lerp(new THREE.Color(PINK), index / (LAYERS - 1)));
  bed.add(layers);
  let shown = -1;
  const gantry = new THREE.Group();
  gantry.position.z = -.2; root.add(gantry);
  solid([piece(rounded(.7, .04, .04, .012), INK)], gantry);
  const head = solid([
    piece(rounded(.12, .14, .12, .03), MUSTARD, [0, 0, .14]),
    piece(new THREE.ConeGeometry(.025, .05, 8), INK, [0, -.095, .16], [Math.PI, 0, 0]),
    piece(block(.06, .06, .01), INK, [0, 0, .205]),
  ], gantry);
  return {
    kind: 'watch', label: '3D printer', reach: [.35, S + .2, .3],
    animate: (time, energy, progress, dt) => {
      show(time, energy, progress);
      // Idle shows the finished vase; while he presents it prints again from the first layer.
      const count = energy > 0 ? Math.min(LAYERS, 1 + Math.floor(progress * LAYERS * 1.15)) : LAYERS;
      if (count !== shown) {
        shown = count;
        const { matrix, position, rotation, scale } = scratch;
        for (let index = 0; index < LAYERS; index++) {
          const radius = .075 + .035 * Math.sin(index / (LAYERS - 1) * Math.PI);
          layers.setMatrixAt(index, matrix.compose(position.set(0, .021 + index * .022, 0), rotation.identity(), index < count ? scale.set(radius, .022, radius) : scale.setScalar(0)));
        }
        layers.instanceMatrix.needsUpdate = true;
      }
      gantry.position.y = S + .12 + .01 + count * .022 + .13;
      head.position.x = .04 * Math.sin(time * .8) + energy * .2 * Math.sin(time * 7);
      bed.position.z = energy * .07 * Math.sin(time * 4.3);
      spool.rotation.z -= dt * (.15 + 2.5 * energy);
    },
  };
}

/** The blog: a typewriter that types a page, pushes it up and sends a paper plane off with it. */
function typewriter({ root, parts, solid }: Kit): Rig {
  const S = SURFACE;
  parts.push(
    piece(rounded(.52, .12, .36, .04), MINT, [.1, S + .06, 0]),
    piece(rounded(.48, .1, .14, .03), MINT_DARK, [.1, S + .16, -.12]),
    ...Array.from({ length: 24 }, (_, index) => piece(cylinder(.018, .018, .02, 8), CREAM, [-.075 + (index % 8) * .05, S + .13 + Math.floor(index / 8) * .012, .14 - Math.floor(index / 8) * .05])),
    piece(block(.24, .02, .03), CREAM, [.1, S + .125, .17]),
    piece(cylinder(.055, .05, .11), SKY, [-.34, S + .055, .15]),
    piece(cylinder(.046, .046, .01), COFFEE, [-.34, S + .106, .15]),
    piece(rounded(.24, .05, .3, .01), CREAM, [-.33, S + .025, -.1]),
  );
  const carriage = new THREE.Group();
  carriage.position.set(.1, S + .23, -.14); root.add(carriage);
  solid([
    piece(cylinder(.045, .045, .6, 14), INK, [0, 0, 0], [0, 0, Math.PI / 2]),
    ...[-1, 1].map((side) => piece(ball(.045), MUSTARD, [side * .32, 0, 0])),
    piece(block(.14, .02, .02), STEEL, [-.36, .05, .04], [0, 0, .4]),
  ], carriage);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(.32, .4).translate(0, .2, 0), new THREE.MeshStandardMaterial({ color: CREAM, side: THREE.DoubleSide, roughness: .9 }));
  paper.position.set(0, -.02, -.03); carriage.add(paper);
  const ink = new THREE.MeshBasicMaterial({ color: INK });
  const lines = [.28, .2, .3, .24, .14, .26].map((width, index) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(width, .016).translate(width / 2, 0, 0), ink);
    line.position.set(-.13, .34 - index * .045, .002); line.scale.x = .001; paper.add(line);
    return line;
  });
  const typebars = [-1, 0, 1].map((offset) => solid([piece(block(.012, .13, .012), STEEL, [0, .065, 0])], root, [.1 + offset * .035, S + .12, .02]));
  const plane = solid([piece(new THREE.ConeGeometry(.06, .18, 3), CREAM, [0, 0, 0], [0, 0, -Math.PI / 2], [.3, 1, 1])], root);
  return {
    kind: 'type', label: 'typewriter', reach: [.34, S + .14, .14],
    animate: (time, energy, progress) => {
      paper.position.y = -.02 + energy * (.04 + .12 * progress);
      paper.rotation.x = -.25 + .04 * Math.sin(time * 1.8);
      lines.forEach((line, index) => { line.scale.x = Math.max(.001, energy * THREE.MathUtils.clamp(progress * 1.25 * lines.length - index, 0, 1)); });
      carriage.position.x = .1 + energy * (.08 - .16 * ((time * .7) % 1));
      typebars.forEach((bar, index) => { bar.rotation.x = -.3 - energy * .9 * Math.max(0, Math.sin(time * 13 + index * 2.1)); });
      const flight = (time * .45) % 1;
      plane.position.set(.1 + .65 * flight, S + .5 + .45 * Math.sin(Math.PI * flight), -.1 + .3 * flight);
      plane.rotation.z = .5 * Math.cos(Math.PI * flight);
      plane.scale.setScalar(Math.max(.001, energy));
    },
  };
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

/** One pegboard tool, cycling wrench, hammer, screwdriver, pliers, tape measure and a cable coil along the board. */
function tool(index: number, x: number): THREE.BufferGeometry[] {
  const z = PEG_Z + .02;
  switch (index % 6) {
    case 0: return [piece(block(.05, .36, .02), STEEL, [x, 2.85, z], [0, 0, .25]), piece(new THREE.TorusGeometry(.055, .018, 6, 12, Math.PI * 1.6), STEEL, [x - .045, 3.03, z], [0, 0, .55])];
    case 1: return [piece(block(.04, .36, .03), WOOD, [x, 2.82, z]), piece(rounded(.2, .07, .06, .02), INK, [x, 3.02, z])];
    case 2: return [-.06, .06].flatMap((dx, side) => [piece(cylinder(.026, .026, .13, 8), side ? MINT : TOMATO, [x + dx, 3.07, z + .01]), piece(cylinder(.008, .008, .2, 6), STEEL, [x + dx, 2.9, z + .01])]);
    case 3: return [-1, 1].map((side) => piece(block(.03, .32, .015), side < 0 ? TOMATO : SKY, [x + side * .03, 2.9, z], [0, 0, side * .18]));
    case 4: return [piece(cylinder(.07, .07, .05, 14), MUSTARD, [x, 2.95, z + .01], [Math.PI / 2, 0, 0]), piece(cylinder(.03, .03, .052, 8), INK, [x, 2.95, z + .01], [Math.PI / 2, 0, 0])];
    default: return [piece(new THREE.TorusGeometry(.11, .02, 6, 16), ORANGE, [x, 2.95, z + .01]), piece(new THREE.TorusGeometry(.09, .02, 6, 16), ORANGE, [x + .01, 2.93, z + .02])];
  }
}

/**
 * The rig, lot 6 (#rig): a garage with a roll-up door, a long workbench under a pegboard and shop lights. Each
 * operating system group is a machine on the bench with its system icons hung above it, booting when he presents it;
 * each side project is a gadget acting out what it does, with a Visit sign where it links somewhere.
 */
export const createGarage: AreaBuilder = (origin, content) => {
  const group = new THREE.Group();
  group.name = 'garage';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
  const solid = (parts: THREE.BufferGeometry[], parent: THREE.Object3D, at: V3 = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts), toy);
    parts.forEach((part) => part.dispose());
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  const obstacles: Obstacle[] = [];
  const stations: Station[] = [];
  const reactives: { id: string; energy: number; animate: Animate }[] = [];
  const loaded: THREE.Texture[] = [];
  const loader = new THREE.TextureLoader();
  let disposed = false;

  // Icons hang as tiles; each url loads once and its material is shared by every tile showing it.
  const tileGeometry = rounded(TILE, TILE, .04, .06), iconGeometry = new THREE.PlaneGeometry(TILE * .74, TILE * .74);
  const tileMaterial = new THREE.MeshStandardMaterial({ color: CREAM, roughness: .6 });
  const icons = new Map<string, THREE.MeshBasicMaterial>();
  const hang = (parent: THREE.Object3D, parts: THREE.BufferGeometry[], url: string | null, at: V3) => {
    parts.push(piece(cylinder(.012, .012, .06, 6), STEEL, [at[0], at[1], at[2] - .02], [Math.PI / 2, 0, 0]));
    const pivot = new THREE.Group();
    pivot.position.set(...at); parent.add(pivot);
    const back = new THREE.Mesh(tileGeometry, tileMaterial);
    back.position.y = -.03 - TILE / 2; pivot.add(back);
    if (!url) return pivot;
    let material = icons.get(url);
    if (!material) {
      const fresh = material = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, visible: false });
      icons.set(url, fresh);
      loaded.push(loader.load(url, (texture) => {
        if (disposed) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        fresh.map = texture; fresh.visible = true; fresh.needsUpdate = true;
      }));
    }
    const icon = new THREE.Mesh(iconGeometry, material);
    icon.position.set(0, -.03 - TILE / 2, .022); pivot.add(icon);
    return pivot;
  };

  // Operating systems: one machine per group along the bench, its icons on the pegboard above.
  const systems = content.operatingSystems, pitch = Math.min(2.25, (BENCH.right - BENCH.left) / Math.max(1, systems.length));
  systems.forEach((system, index) => {
    const id = `os:${slug(system.name)}`, x = (BENCH.left + BENCH.right) / 2 + (index - (systems.length - 1) / 2) * pitch;
    const root = new THREE.Group();
    root.name = root.userData.station = id;
    root.position.x = x; group.add(root);
    const parts: THREE.BufferGeometry[] = [];
    const build = /mac/i.test(system.name) ? laptop : /server|homelab/i.test(system.name) ? rack : /windows/i.test(system.name) ? desktop : crt;
    const rig = build({ root, parts, solid });
    // The tile row sits left of the machine, clear of his afro while he presents it.
    const tiles = system.systems.map((entry, tile) => hang(root, parts, entry.icon, [-.3 + (tile - (system.systems.length - 1) / 2) * (TILE + .08), 2.45, PEG_Z + .03]));
    solid(parts, root);
    const reach = { x: x + rig.reach[0], y: rig.reach[1], z: rig.reach[2] }, stand = { x: x + STAND.dx, z: STAND.z };
    stations.push({ id, kind: rig.kind, label: system.name, stand, heading: Math.atan2(reach.x - stand.x, reach.z - stand.z), reach, present: { lines: LINES[id] ?? [] } });
    reactives.push({ id, energy: 0, animate: (time, energy, progress, dt) => {
      rig.animate(time, energy, progress, dt);
      // Tiles sway on their pegs; booting pops each forward and flips it once, in turn.
      tiles.forEach((tile, order) => {
        tile.rotation.z = .05 * Math.sin(time * 1.7 + order + index * 2) * (1 - energy);
        tile.rotation.y = energy * Math.PI * 2 * THREE.MathUtils.smoothstep(progress * 1.4 * tiles.length - order, 0, 1);
        tile.position.z = PEG_Z + .03 + energy * .18;
        tile.scale.setScalar(1 + energy * .3);
      });
    } });
  });
  // The bench keeps him at its front edge.
  for (let x = BENCH.left + .45; x <= BENCH.right - .45 + 1e-6; x += .8) obstacles.push({ id: 'workbench', x, z: -3.35, radius: .5 });

  // Side projects: a gadget per slot on the printer cart or the desk.
  content.sideProjects.slice(0, SLOTS.length).forEach((side, index) => {
    const id = `side:${slug(side.title)}`, slot = SLOTS[index];
    const root = new THREE.Group();
    root.name = root.userData.station = id;
    root.position.set(slot.x, 0, slot.z); root.scale.setScalar(GADGET.scale); group.add(root);
    const parts: THREE.BufferGeometry[] = [];
    if (slot.cart) {
      parts.push(
        piece(rounded(.96, .06, .72, .02), MUSTARD, [0, SURFACE - .03, 0]),
        piece(rounded(.9, .04, .66, .015), NAVY, [0, .22, 0]),
        ...CORNERS.flatMap(([sx, sz]) => [piece(block(.05, .6, .05), NAVY, [sx * .43, .38, sz * .31]), piece(ball(.045), INK, [sx * .43, .045, sz * .31])]),
        piece(rounded(.3, .2, .3, .02), CREAM, [-.2, .34, 0]),
        piece(cylinder(.12, .12, .07, 16), SKY, [.2, .36, .05], [Math.PI / 2, 0, 0]),
      );
    } else {
      parts.push(
        piece(rounded(1.0, .06, .66, .02), WOOD, [0, SURFACE - .03, 0]),
        ...CORNERS.map(([sx, sz]) => piece(block(.05, SURFACE - .06, .05), MUSTARD, [sx * .44, (SURFACE - .06) / 2, sz * .28])),
        piece(rounded(.36, .16, .56, .02), TOMATO, [.26, SURFACE - .14, 0]),
        piece(ball(.025), CREAM, [.26, SURFACE - .14, .29]),
      );
    }
    const rig = (/print/i.test(side.title) ? printer : typewriter)({ root, parts, solid });
    if (side.icon) hang(root, parts, side.icon, [-.26, SURFACE - .06, .39]);
    solid(parts, root);
    const reach = { x: slot.x + rig.reach[0] * GADGET.scale, y: rig.reach[1] * GADGET.scale, z: slot.z + rig.reach[2] * GADGET.scale };
    const stand = { x: slot.x + GADGET.dx, z: slot.z + GADGET.dz };
    obstacles.push({ id, x: slot.x, z: slot.z, radius: GADGET.radius });
    stations.push({
      id, kind: rig.kind, label: rig.label ?? side.title, stand, heading: Math.atan2(reach.x - stand.x, reach.z - stand.z), reach,
      present: { lines: LINES[id] ?? [], url: side.url ?? undefined, linkLabel: side.url ? `Visit ${new URL(side.url).host}` : undefined },
    });
    reactives.push({ id, energy: 0, animate: rig.animate });
  });

  // The garage: slab, walls, roll-up door, bench, pegboard and tools, shelves, chest, tyres, drum and cables. One draw call.
  const room: THREE.BufferGeometry[] = [
    piece(rounded(13.6, .5, 8.4, .18, 2), CONCRETE, [0, -.25, 0]),
    piece(rounded(13.2, .4, 8, .18, 2), NAVY, [0, -.66, 0]),
    ...[-2.2, 2.2].map((x) => piece(block(.04, .01, 7.6), JOINT, [x, .004, .1])),
    piece(block(13.2, .01, .04), JOINT, [0, .004, .9]),
    ...[[-1.2, 1.6, .55], [2.4, .6, .35]].map(([x, z, radius]) => piece(new THREE.CircleGeometry(radius, 16), OIL, [x, .008, z], [-Math.PI / 2, 0, 0], [1.4, 1, 1])),
    ...Array.from({ length: 26 }, (_, index) => piece(block(.5, .012, .24), index % 2 ? INK : MUSTARD, [-6.25 + index * .5, .006, 3.95])),
    piece(block(8.6, .02, .7), MAT, [-1.6, .01, -2.45]),
    // Back wall, side walls and the joist the lights hang from.
    piece(rounded(13.6, 5, .3, .06, 2), WALL, [0, 2.5, -4.05]),
    piece(block(13.2, 1.1, .04), WAINSCOT, [0, .55, -3.88]),
    piece(rounded(13.8, .16, .4, .05), NAVY, [0, 5.06, -4]),
    piece(block(13.3, .14, .08), NAVY, [0, .07, -3.86]),
    piece(rounded(.3, 5, 5.8, .06, 2), WALL_SIDE, [-6.65, 2.5, -1.3]),
    piece(rounded(.4, .16, 5.9, .05), NAVY, [-6.65, 5.06, -1.3]),
    piece(rounded(.3, 5, 4.8, .06, 2), WALL_SIDE, [6.65, 2.5, -1.8]),
    piece(rounded(.4, .16, 4.9, .05), NAVY, [6.65, 5.06, -1.8]),
    piece(rounded(13, .16, .2, .04), WOOD_DARK, [0, 5.12, -3]),
    ...[-1, 1].flatMap((side) => [
      piece(cylinder(.12, .12, 1, 12), MUSTARD, [side * 6.45, .5, 3.75]),
      ...[.35, .75].map((y) => piece(cylinder(.125, .125, .12, 12), INK, [side * 6.45, y, 3.75])),
      piece(ball(.12), MUSTARD, [side * 6.45, 1, 3.75]),
    ]),
    // The roll-up door, shut, on the left wall.
    ...Array.from({ length: 14 }, (_, index) => piece(rounded(.06, .23, 3.2, .03), index % 2 ? GOLD : MUSTARD, [-6.47, .14 + index * .245, -2])),
    ...[-3.65, -.35].map((z) => piece(block(.1, 3.6, .1), NAVY, [-6.44, 1.8, z])),
    piece(rounded(.34, .4, 3.5, .06), NAVY, [-6.38, 3.75, -2]),
    piece(block(.04, .05, .3), STEEL, [-6.42, .5, -2]),
    // Workbench, with crates underneath and a vice at its end.
    piece(rounded(9, .08, 1, .02), WOOD, [-1.6, TOP - .04, BENCH.z]),
    piece(block(9, .06, .04), WOOD_DARK, [-1.6, TOP - .08, -2.8]),
    ...[-6, -1.6, 2.8].flatMap((x) => [-2.88, -3.72].map((z) => piece(block(.08, TOP - .08, .08), MUSTARD, [x, (TOP - .08) / 2, z]))),
    piece(block(8.9, .05, .05), MUSTARD, [-1.6, .18, -3.72]),
    ...[[-5.55, TOMATO], [-1.15, SKY], [2.35, MINT]].map(([x, color]) => piece(rounded(.5, .32, .42, .03), color, [x, .17, -3.35])),
    piece(rounded(.22, .14, .16, .02), NAVY, [-5.8, TOP + .07, -3]),
    piece(block(.2, .1, .03), STEEL, [-5.8, TOP + .12, -2.9]),
    piece(cylinder(.015, .015, .3, 6), STEEL, [-5.8, TOP + .06, -2.86], [0, 0, Math.PI / 2]),
    // Pegboard with its holes and tools.
    piece(block(8.9, 2, .04), PEG, [-1.6, 2.3, -3.88]),
    ...Array.from({ length: 35 * 8 }, (_, index) => piece(new THREE.CircleGeometry(.022, 5), HOLE, [-5.85 + (index % 35) * .25, 1.43 + Math.floor(index / 35) * .25, PEG_Z + .003])),
    ...Array.from({ length: 16 }, (_, index) => tool(index, -5.7 + index * .54)).flat(),
    // Filament shelves over the printer, the clock face, the breaker box, a bike wheel and a cord reel on the right.
    ...[2.75, 3.4].flatMap((y, row) => [
      piece(block(2.4, .05, .3), WOOD, [4.75, y, -3.72]),
      ...[-1, 1].map((side) => piece(block(.04, .2, .25), NAVY, [4.75 + side * 1.05, y - .12, -3.73])),
      ...[0, 1, 2, 3, 4].flatMap((spool) => [
        piece(cylinder(.13, .13, .1, 16), SPOOLS[(spool + row * 2) % SPOOLS.length], [3.85 + spool * .45, y + .155, -3.72], [Math.PI / 2, 0, 0]),
        piece(cylinder(.04, .04, .102, 8), CREAM, [3.85 + spool * .45, y + .155, -3.72], [Math.PI / 2, 0, 0]),
      ]),
    ]),
    piece(cylinder(.26, .26, .03, 24), CREAM, [5.1, 4.2, -3.87], [Math.PI / 2, 0, 0]),
    piece(new THREE.TorusGeometry(.26, .03, 6, 24), NAVY, [5.1, 4.2, -3.86]),
    piece(rounded(.06, .7, .5, .02), STEEL, [6.47, 2.5, -1.1]),
    piece(block(.02, .08, .3), TOMATO, [6.44, 2.65, -1.1]),
    piece(new THREE.TorusGeometry(.34, .035, 6, 24), INK, [6.4, 2.9, -2.6], [0, Math.PI / 2, 0]),
    ...[0, 1, 2].map((spoke) => piece(block(.008, .66, .008), STEEL, [6.4, 2.9, -2.6], [spoke * Math.PI / 3, 0, 0])),
    piece(new THREE.TorusGeometry(.16, .06, 6, 16), ORANGE, [6.42, 1.15, -.1], [0, Math.PI / 2, 0]),
    // Tool chest, tyres, oil drum and a cone by the street.
    piece(rounded(.8, 1, .55, .04), TOMATO, [-5.75, .56, 1.5]),
    piece(rounded(.84, .06, .58, .02), INK, [-5.75, 1.09, 1.5]),
    ...[0, 1, 2, 3, 4].flatMap((drawer) => [
      piece(block(.72, .012, .01), CHERRY, [-5.75, .2 + drawer * .17, 1.78]),
      piece(block(.3, .03, .03), STEEL, [-5.75, .28 + drawer * .17, 1.79]),
    ]),
    ...CORNERS.map(([sx, sz]) => piece(ball(.05), INK, [-5.75 + sx * .33, .05, 1.5 + sz * .2])),
    ...[0, 1, 2].map((tyre) => piece(new THREE.TorusGeometry(.3, .12, 8, 20), INK, [-4.85, .12 + tyre * .24, 2.95], [Math.PI / 2, 0, 0])),
    piece(cylinder(.17, .17, .02, 16), STEEL, [-4.85, .62, 2.95]),
    piece(cylinder(.32, .32, .9, 18), TOMATO, [5.6, .45, 2.95]),
    ...[.3, .6].map((y) => piece(cylinder(.335, .335, .04, 18), INK, [5.6, y, 2.95])),
    piece(cylinder(.05, .05, .03, 8), STEEL, [5.7, .915, 2.9]),
    piece(rounded(.36, .04, .36, .01), ORANGE, [4.75, .02, 3.2]),
    piece(new THREE.ConeGeometry(.16, .5, 12), ORANGE, [4.75, .29, 3.2]),
    piece(cylinder(.085, .11, .08, 12), CREAM, [4.75, .24, 3.2]),
    // Cables: bench to the printer cart, and an extension cord from the wall reel to the desk.
    ...[
      { color: INK, points: [[2.85, .9, -3.1], [3.05, .45, -2.95], [3.3, .03, -2.75], [3.55, .03, -2.85], [3.7, .03, -3.2]] },
      { color: ORANGE, points: [[6.42, 1, -.1], [6.3, .03, .1], [5.6, .03, .3], [5, .03, .45], [4.75, .03, .3]] },
    ].map(({ color, points }) => piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), 32, .022, 6), color)),
  ];
  // The sign board; its text and bulbs are separate below.
  room.push(piece(rounded(3.6, 1, .08, .04), NAVY, [0, 4.2, -3.84]));
  solid(room, group);
  obstacles.push(
    { id: 'tool-chest', x: -5.75, z: 1.5, radius: .55 },
    { id: 'tyres', x: -4.85, z: 2.95, radius: .48 },
    { id: 'oil-drum', x: 5.6, z: 2.95, radius: .38 },
    { id: 'cone', x: 4.75, z: 3.2, radius: .22 },
  );

  const signMaterial = new THREE.MeshBasicMaterial({
    map: paint(1024, 256, (context) => {
      context.font = `900 168px ${FONT}`; context.fillStyle = '#f2c14e';
      context.fillText('THE RIG', 512, 136, 960);
    }),
    transparent: true, toneMapped: false,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .8), signMaterial);
  sign.position.set(0, 4.2, -3.795); group.add(sign);
  // Marquee bulbs round the board, in order so the chase runs clockwise.
  const spots = [...Array.from({ length: 9 }, (_, index) => [-1.6 + index * .4, 4.62]), [1.6, 4.2], ...Array.from({ length: 9 }, (_, index) => [1.6 - index * .4, 3.78]), [-1.6, 4.2]];
  const bulbs = new THREE.InstancedMesh(ball(.045), new THREE.MeshBasicMaterial({ toneMapped: false }), spots.length);
  spots.forEach(([x, y], index) => { bulbs.setMatrixAt(index, scratch.matrix.makeTranslation(x, y, -3.79)); bulbs.setColorAt(index, scratch.color.set(BULB)); });
  group.add(bulbs);

  const lightMaterial = new THREE.MeshBasicMaterial({ color: BULB, toneMapped: false });
  const lamps = [-4.2, 3.8].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 5.05, -3); group.add(pivot);
    solid([...[-.5, .5].map((dx) => piece(cylinder(.01, .01, .8, 4), STEEL, [dx, -.4, 0])), piece(rounded(1.3, .1, .26, .03), NAVY, [0, -.85, 0])], pivot);
    const tube = new THREE.Mesh(cylinder(.035, .035, 1.15, 8), lightMaterial);
    tube.rotation.z = Math.PI / 2; tube.position.y = -.93; pivot.add(tube);
    return pivot;
  });
  const minute = solid([piece(block(.025, .2, .01), INK, [0, .08, 0])], group, [5.1, 4.2, -3.84]);
  const hour = solid([piece(block(.03, .13, .01), TOMATO, [0, .05, 0])], group, [5.1, 4.2, -3.835]);
  // Rest pose before the first frame, so the printer's gantry starts above its print, not in the floor.
  for (const reactive of reactives) reactive.animate(0, 0, 0, 0);
  group.updateMatrixWorld(true);

  return {
    id: 'garage',
    group,
    bounds: { ...BOUNDS },
    obstacles,
    stations,
    entry: { x: 1.2, z: 3.15 },
    view: { center: { x: 0, y: 2.1, z: -.6 } },
    pick: (raycaster) => {
      group.updateWorldMatrix(true, true);
      for (let node: THREE.Object3D | null = raycaster.intersectObject(group, true)[0]?.object ?? null; node; node = node.parent) {
        if (typeof node.userData.station === 'string') return node.userData.station;
      }
      return null;
    },
    update: (dt, elapsed, activity) => {
      for (const reactive of reactives) {
        const active = reactive.id === activity.stationId;
        reactive.energy = THREE.MathUtils.clamp(reactive.energy + (active ? 4 : -3) * dt, 0, 1);
        reactive.animate(elapsed, reactive.energy, active ? activity.progress : 0, dt);
      }
      lamps.forEach((lamp, index) => { lamp.rotation.z = .03 * Math.sin(elapsed * .9 + index * 2); });
      lightMaterial.color.set(BULB).multiplyScalar(noise(7, Math.floor(elapsed * 10)) > .94 ? .45 : 1);
      const chase = Math.floor(elapsed * 5);
      for (let index = 0; index < spots.length; index++) bulbs.setColorAt(index, scratch.color.set((index + chase) % 3 ? BULB_DIM : BULB));
      bulbs.instanceColor!.needsUpdate = true;
      minute.rotation.z = -elapsed * .4; hour.rotation.z = -elapsed * .4 / 12;
    },
    dispose: () => {
      disposed = true;
      group.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) {
          if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
          material.dispose();
        }
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
      loaded.forEach((texture) => texture.dispose());
    },
  };
};

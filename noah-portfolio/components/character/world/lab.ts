import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AreaBuilder, Obstacle, Station } from './types';

type V3 = [number, number, number];
type Animate = (time: number, energy: number, progress: number, dt: number) => void;
/** Adds an exhibit's moving parts to `root`, pushes static parts into `parts` (merged with the pedestal) and returns its animation. */
type Theme = (root: THREE.Group, parts: THREE.BufferGeometry[], light: THREE.Material, glow: THREE.Material, solid: (parts: THREE.BufferGeometry[], at: V3) => THREE.Mesh) => Animate;

const CREAM = 0xf4ecdf, PLUM = 0x72509c, LILAC = 0xb39bc3, CORAL = 0xeb9a84, SAGE = 0xa6b4a0, PEACH = 0xe8b38b, INK = 0x3f2849, STEEL = 0xbcb6c8;
const ACCENTS = [CORAL, LILAC, SAGE, PEACH, 0x9681b8];
/** [skill key, category key] per skill group. */
const KEY_COLORS = [[0xf4bba9, 0xd9826b], [0xd3c2e2, 0x9a7fb8], [0xc6d3c0, 0x86997f], [0xf2d0ae, 0xd39663], [0xdcc9ee, 0x72509c]];
const WHITE = new THREE.Color(0xffffff);
const FONT = 'ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif';
const TOP = .89; // pedestal top
const FOCUS = 8; // exhibits turn toward (0, FOCUS) so the end ones face the camera
const WALL_Z = -2.62; // back wall front face
const BOARD_X = -.3;
const CAP_Z = WALL_Z + .15; // key cap centre, .14 deep on an .08 plate
const KEY_BASE = 1.95; // bottom key row centre, above the exhibits as seen from the camera
const POKE_Y = 1.28; // the skills poke button, at standing hand height
const BOUNDS = { minX: -4.6, maxX: 4.6, minZ: -2.2, maxZ: 2.6 };
const EXIT = { x: 3, z: 2.3 };
const LANDING = { x: 0, y: .6, z: 1.98 };
const SCREEN = { width: .62, height: .35 };
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), scale: new THREE.Vector3(), color: new THREE.Color() };

const rounded = (width: number, height: number, depth: number, radius = .03, segments = 1) => new RoundedBoxGeometry(width, height, depth, segments, radius);
const cylinder = (top: number, bottom: number, height: number, segments = 14) => new THREE.CylinderGeometry(top, bottom, height, segments);
const ball = (radius: number) => new THREE.SphereGeometry(radius, 10, 6);

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
    context.font = `700 ${size}px ${FONT}`;
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

const kiosk: Theme = (root, parts, light, _glow, solid) => {
  parts.push(
    piece(rounded(.4, .44, .3, .05), LILAC, [-.04, TOP + .22, -.08]),
    piece(rounded(.34, .25, .03, .015), PLUM, [-.04, TOP + .3, .08], [-.3, 0, 0]),
    piece(cylinder(.05, .055, .03), INK, [.32, TOP + .015, .02]),
  );
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.28, .19), light);
  face.position.set(-.04, TOP + .3, .1); face.rotation.x = -.3; root.add(face);
  const stick = solid([piece(cylinder(.012, .012, .12), INK, [0, .06, 0]), piece(ball(.035), CORAL, [0, .13, 0])], [.32, TOP + .03, .02]);
  return (time, energy) => {
    stick.rotation.z = .12 * Math.sin(time * 1.5) + energy * .5 * Math.sin(time * 11);
    stick.rotation.x = energy * .4 * Math.sin(time * 7);
  };
};

const THEMES: Record<string, Theme> = {
  'llm-comparison': (root, parts, _light, glow, solid) => {
    parts.push(piece(cylinder(.42, .42, .012, 20), 0xd9cdea, [0, TOP + .006, -.02], [0, 0, 0], [1, 1, .6]));
    const heads = [-1, 1].map((side) => solid([
      piece(cylinder(.045, .055, .08), PLUM, [0, .04, 0]),
      piece(rounded(.26, .22, .24, .06), side < 0 ? CORAL : LILAC, [0, .19, 0]),
      piece(rounded(.03, .1, .19, .012), INK, [-side * .13, .2, 0]),
      piece(ball(.024), 0x9fe3c9, [-side * .15, .21, -.05]), piece(ball(.024), 0x9fe3c9, [-side * .15, .21, .05]),
      piece(cylinder(.009, .009, .1, 6), PLUM, [0, .35, 0]), piece(ball(.032), side < 0 ? PEACH : CORAL, [0, .41, 0]),
    ], [side * .24, TOP, -.02]));
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(.075), glow);
    spark.position.set(0, TOP + .27, -.02); root.add(spark);
    return (time, energy) => {
      heads.forEach((head, index) => {
        head.position.y = TOP + .012 * Math.sin(time * 2.2 + index * 2) + energy * .12 * Math.abs(Math.sin(time * 8 + index * Math.PI / 2));
        head.rotation.z = (index ? -1 : 1) * energy * .2 * Math.sin(time * 8 + index);
      });
      spark.rotation.y = time * (1.2 + energy * 8);
      spark.scale.setScalar(1 + .1 * Math.sin(time * 3) + energy * (.6 + .3 * Math.sin(time * 17)));
    };
  },
  moodify: (root, parts, _light, _glow, solid) => {
    let angle = 0;
    parts.push(
      piece(rounded(.5, .09, .4, .03), PLUM, [-.12, TOP + .045, -.04]),
      piece(cylinder(.18, .18, .02, 24), CREAM, [-.15, TOP + .1, -.04]),
      piece(cylinder(.025, .025, .06), CREAM, [.06, TOP + .12, -.18]),
      piece(rounded(.022, .018, .22, .008), CREAM, [.04, TOP + .15, -.07], [0, -.35, 0]),
    );
    const vinyl = solid([
      piece(cylinder(.165, .165, .012, 24), INK),
      piece(cylinder(.06, .06, .014, 12), CORAL, [0, .001, 0]),
      piece(rounded(.04, .016, .02, .005), CREAM, [.035, .006, 0]),
    ], [-.15, TOP + .117, -.04]);
    const swatches = [CORAL, PEACH, SAGE, LILAC].map((color, index) => solid([piece(rounded(.06, .11, .02, .01), color, [0, .055, 0])], [.22 + index * .075, TOP, -.02 - .03 * Math.abs(index - 1.5)]));
    return (time, energy, _progress, dt) => {
      angle += dt * (.8 + energy * 10);
      vinyl.rotation.y = angle;
      swatches.forEach((swatch, index) => { swatch.position.y = TOP + energy * .07 * Math.max(0, Math.sin(time * 9 - index)); swatch.rotation.z = .05 * Math.sin(time * 1.3 + index); });
    };
  },
  'ai-image-cutout': (root, parts, _light, _glow, solid) => {
    parts.push(
      piece(rounded(.5, .016, .34, .006), CREAM, [-.02, TOP + .008, -.05]),
      piece(cylinder(.05, .05, .008), CORAL, [-.17, TOP + .02, -.12]),
      piece(cylinder(.045, .045, .008, 5), SAGE, [.12, TOP + .02, -.14]),
      piece(rounded(.09, .008, .07, .004), LILAC, [-.06, TOP + .02, .05]),
    );
    const sticker = solid([piece(cylinder(.05, .05, .008, 6), PEACH, [.05, 0, 0])], [.07, TOP + .02, .02]);
    const scissors = new THREE.Group();
    scissors.position.set(-.02, TOP + .22, -.05); scissors.rotation.x = 1.1; root.add(scissors);
    const blades = [1, -1].map((side) => {
      const blade = solid([
        piece(rounded(.3, .02, .05, .01), STEEL, [.15, 0, 0]),
        piece(new THREE.TorusGeometry(.05, .016, 6, 12), side > 0 ? CORAL : LILAC, [-.08, side * .004, side * .04], [Math.PI / 2, 0, 0]),
      ], [0, 0, 0]);
      scissors.add(blade);
      return blade;
    });
    return (time, energy) => {
      const open = .3 + .06 * Math.sin(time * 1.5) + energy * .45 * Math.abs(Math.sin(time * 9));
      blades.forEach((blade, index) => { blade.rotation.y = (index ? -1 : 1) * open / 2; });
      scissors.position.y = TOP + .22 + .015 * Math.sin(time * 1.8);
      sticker.rotation.z = energy * .9 * (.5 + .5 * Math.sin(time * 4));
    };
  },
  'story-model-benchmark': (root, parts, _light, glow, solid) => {
    const heights = [.3, .44, .22];
    parts.push(piece(rounded(.62, .05, .36, .02), PLUM, [0, TOP + .025, -.05]));
    const bars = heights.map((height, index) => solid([piece(rounded(.15, height, .15, .03), [LILAC, CORAL, SAGE][index], [0, height / 2, 0])], [(index - 1) * .19, TOP + .05, -.05]));
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(.06), glow);
    root.add(star);
    return (time, energy, progress) => {
      bars.forEach((bar, index) => { bar.scale.y = 1 + .04 * Math.sin(time * 1.6 + index) + energy * (.2 + .35 * progress) * (1 + .2 * Math.sin(time * 7 + index * 1.7)); });
      star.position.set(0, TOP + .05 + heights[1] * bars[1].scale.y + .09, -.05);
      star.rotation.y = time * (1 + energy * 6);
    };
  },
  'ask-me-portfolio': (root, parts, light, _glow, solid) => {
    parts.push(
      piece(rounded(.2, .02, .13, .008), PLUM, [-.08, TOP + .01, -.08]),
      piece(cylinder(.025, .025, .13), PLUM, [-.08, TOP + .075, -.08]),
      piece(rounded(.44, .3, .05, .03), PLUM, [-.08, TOP + .28, -.08]),
    );
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.38, .24), light);
    face.position.set(-.08, TOP + .28, -.053); root.add(face);
    const bubble = solid([
      piece(ball(.13), CREAM, [0, 0, 0], [0, 0, 0], [1.35, 1, .55]),
      piece(cylinder(0, .05, .1, 8), CREAM, [-.1, -.12, 0], [0, 0, 2.6]),
      ...[-1, 0, 1].map((dot) => piece(ball(.022), PLUM, [dot * .06, 0, .07])),
    ], [.14, TOP + .52, -.02]);
    return (time, energy) => {
      const cycle = (time * 1.2) % 1;
      const pop = cycle < .72 ? 1 + .4 * cycle / .72 : cycle < .8 ? 0 : (cycle - .8) / .2;
      bubble.scale.setScalar(Math.max(.001, THREE.MathUtils.lerp(1 + .04 * Math.sin(time * 3), pop, energy)));
      bubble.position.y = TOP + .52 + .02 * Math.sin(time * 2);
    };
  },
};

/** Tech Lab: one exhibit per corpus project in an arc (two staggered rows past five), a keyboard wall of every skill, a beanbag landing and a toolbox to trip over at the exit. */
export const createLab: AreaBuilder = (origin, content) => {
  const group = new THREE.Group();
  group.name = 'lab';
  group.position.copy(origin);
  const toy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
  const solid = (parts: THREE.BufferGeometry[], parent: THREE.Object3D, at: V3 = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(mergeGeometries(parts), toy);
    parts.forEach((part) => part.dispose());
    mesh.position.set(...at); parent.add(mesh);
    return mesh;
  };
  const obstacles: Obstacle[] = [{ id: 'workbench', x: 3.85, z: -2.2, radius: .42 }, { id: 'workbench-drawers', x: 4.5, z: -2.2, radius: .42 }];
  const stations: Station[] = [];
  const reactives: { id: string; energy: number; animate: Animate }[] = [];
  const loaded: THREE.Texture[] = [];
  const loader = new THREE.TextureLoader();
  let disposed = false;

  // Skills keyboard layout: one row per group (first on top), a wide category key then a key per skill.
  const rows = content.skills.length, widest = Math.max(1, ...content.skills.map((skillGroup) => skillGroup.skills.length));
  const rowHeight = Math.min(.42, 2.1 / Math.max(1, rows)), keyHeight = rowHeight - .07, categoryWidth = 1.36;
  const keyWidth = Math.min(.9, (6.9 - categoryWidth) / widest - .06);
  const boardWidth = categoryWidth + widest * (keyWidth + .06), left = BOARD_X - boardWidth / 2;
  const signY = KEY_BASE - rowHeight / 2 + rows * rowHeight + .5;
  const keys = content.skills.flatMap((skillGroup, row) => {
    const y = KEY_BASE + (rows - 1 - row) * rowHeight, [cap, category] = KEY_COLORS[row % KEY_COLORS.length];
    return [
      { text: skillGroup.category, x: left + categoryWidth / 2, y, width: categoryWidth, color: category, ink: '#fff8ee', column: 0, row, span: 2 },
      ...skillGroup.skills.map(({ name: text }, index) => ({ text, x: left + categoryWidth + .06 + keyWidth / 2 + index * (keyWidth + .06), y, width: keyWidth, color: cap, ink: '#3f2849', column: index + 1, row, span: 1 })),
    ];
  });
  // The poke button sits in a gap of the exhibit arc so the walk to it stays open.
  const skillsX = content.projects.length % 2 ? Math.min(1.75, 7.4 / Math.max(1, content.projects.length - 1)) / 2 : 0;

  // Room shell, workbench corner, shelf, cables, toolbox and beanbag: one static draw call.
  const cables: V3[][] = [
    [[1, signY + .15, -2.57], [2.2, signY + .4, -2.57], [3.3, signY + .1, -2.57], [3.36, 2.9, -2.57], [3.38, 1.3, -2.57], [3.5, 1.06, -2.4]],
    [[EXIT.x + .25, .2, 2.78], [EXIT.x + .5, .03, 2.86], [EXIT.x + .75, .03, 2.95], [EXIT.x + .95, -.08, 3.04], [EXIT.x + 1.05, -.5, 3.06]],
  ];
  solid([
    piece(rounded(10.4, .5, 6, .18, 3), CREAM, [0, -.25, .02]),
    piece(rounded(10, .4, 5.6, .18, 2), LILAC, [0, -.66, .02]),
    piece(rounded(10.4, 4.95, .26, .08, 2), 0xebe1f0, [0, 2.475, -2.75]),
    piece(rounded(.26, 4.95, 4.2, .08, 2), 0xdfd0ea, [-5.07, 2.475, -.77]),
    piece(rounded(10.5, .14, .34, .05), PLUM, [0, 4.97, -2.75]),
    piece(rounded(.34, .14, 4.25, .05), PLUM, [-5.07, 4.97, -.77]),
    piece(rounded(10.4, .16, .3, .04), SAGE, [0, .08, -2.6]),
    piece(rounded(.3, .16, 4.2, .04), SAGE, [-4.92, .08, -.77]),
    piece(rounded(8.4, .02, 3.2, .01), 0xe6dcef, [0, .01, -.45]),
    piece(rounded(2.6, .66, .08, .04), PLUM, [BOARD_X, signY, WALL_Z + .04]),
    piece(rounded(1.4, .08, .66), PEACH, [4.15, 1, -2.25]),
    ...[-1, 1].flatMap((x) => [-1, 1].map((z) => piece(rounded(.07, .96, .07, .02), PLUM, [4.15 + x * .62, .48, -2.25 + z * .27]))),
    piece(rounded(.5, .6, .56, .04), LILAC, [4.58, .32, -2.25]),
    ...[.45, .2].map((y) => piece(rounded(.16, .03, .03, .01), PLUM, [4.58, y, -1.96])),
    piece(rounded(.38, .26, .28, .04), SAGE, [3.8, 1.17, -2.3]),
    piece(rounded(.24, .15, .02, .01), 0x2e4b45, [3.76, 1.19, -2.155]),
    ...[1.23, 1.12].map((y) => piece(ball(.025), CORAL, [3.95, y, -2.16])),
    piece(new THREE.TorusGeometry(.11, .025, 6, 18), CORAL, [4.45, 1.065, -2.2], [Math.PI / 2, 0, 0]),
    piece(rounded(1.4, 1.15, .04, .02), 0xf0d9bd, [4.15, 2.15, -2.6]),
    ...Array.from({ length: 42 }, (_, index) => piece(new THREE.CircleGeometry(.018, 6), 0xb8987a, [3.6 + (index % 7) * .18, 1.7 + Math.floor(index / 7) * .18, -2.578])),
    piece(rounded(.05, .34, .02, .01), STEEL, [3.72, 2.12, -2.555]),
    piece(new THREE.TorusGeometry(.055, .018, 6, 12), STEEL, [3.72, 2.33, -2.555]),
    piece(cylinder(.03, .03, .14), CORAL, [4, 2.42, -2.55]),
    piece(cylinder(.008, .008, .22, 6), STEEL, [4, 2.24, -2.55]),
    piece(cylinder(.02, .02, .34), PEACH, [4.3, 2.1, -2.55]),
    piece(rounded(.18, .07, .07, .02), PLUM, [4.3, 2.28, -2.55]),
    piece(new THREE.TorusGeometry(.06, .025, 6, 14), SAGE, [4.6, 2.32, -2.55]),
    piece(rounded(.34, .05, 1.7, .02), PEACH, [-4.77, 2.7, -1.2]),
    ...[CORAL, SAGE, LILAC].map((color, index) => piece(rounded(.26, .2, .34, .04), color, [-4.78, 2.825, -1.8 + index * .55])),
    ...cables.map((points) => piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), 40, .025, 6), INK)),
    piece(rounded(.56, .26, .3, .04), CORAL, [EXIT.x, .13, 2.78]),
    piece(rounded(.58, .06, .32, .02), PLUM, [EXIT.x, .29, 2.78]),
    piece(new THREE.TorusGeometry(.09, .02, 6, 12, Math.PI), INK, [EXIT.x, .32, 2.78]),
    piece(rounded(.08, .05, .02, .01), CREAM, [EXIT.x, .22, 2.94]),
    piece(new THREE.SphereGeometry(.64, 18, 12), CORAL, [LANDING.x, .24, LANDING.z], [0, 0, 0], [1, .6, 1]),
  ], group);

  const signMaterial = new THREE.MeshBasicMaterial({
    map: paint(512, 128, (context) => {
      context.strokeStyle = '#eb9a84'; context.lineWidth = 6;
      context.beginPath(); context.roundRect(10, 10, 492, 108, 40); context.stroke();
      context.shadowColor = '#ff8fa8'; context.shadowBlur = 18; context.fillStyle = '#fff1f4';
      fitText(context, 'TECH LAB', 256, 64, 440, 96, 84);
    }),
    transparent: true, toneMapped: false,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .6), signMaterial);
  sign.position.set(BOARD_X, signY, WALL_Z + .085); group.add(sign);

  const skills = new THREE.Group();
  skills.name = skills.userData.station = 'skills';
  group.add(skills);
  let column = 0, atlasRow = 0;
  const cells = keys.map(({ span }) => {
    if (column + span > 4) { column = 0; atlasRow += 1; }
    const cell = { x: column * 256, y: atlasRow * 112, width: span * 256 };
    column += span;
    return cell;
  });
  const atlasHeight = (atlasRow + 1) * 112;
  solid([
    piece(rounded(boardWidth + .24, rows * rowHeight + .17, .08, .03), 0x5d3f80, [BOARD_X, KEY_BASE - rowHeight / 2 + rows * rowHeight / 2, WALL_Z + .04]),
    piece(rounded(.46, .4, .06, .03), 0x5d3f80, [skillsX, POKE_Y, WALL_Z + .03]),
  ], skills);
  const pokeLight = new THREE.MeshBasicMaterial({ color: CORAL, toneMapped: false });
  const poke = new THREE.Mesh(cylinder(.11, .12, .1, 18), pokeLight);
  poke.position.set(skillsX, POKE_Y, WALL_Z + .11); poke.rotation.x = Math.PI / 2;
  skills.add(poke);
  const caps = new THREE.InstancedMesh(rounded(1, 1, 1, .2), new THREE.MeshStandardMaterial({ roughness: .55 }), keys.length);
  skills.add(caps);
  const press = new Float32Array(keys.length);
  let labelMesh: THREE.Mesh | null = null, labelRest = new Float32Array(0);
  if (keys.length) {
    const atlas = paint(1024, atlasHeight, (context) => keys.forEach((key, index) => {
      context.fillStyle = key.ink;
      fitText(context, key.text, cells[index].x + cells[index].width / 2, cells[index].y + 56, cells[index].width - 28, 96, 44);
    }));
    const quads = keys.map((key, index) => {
      const quad = new THREE.PlaneGeometry(key.width - .07, keyHeight - .07), uv = quad.attributes.uv, cell = cells[index];
      for (let vertex = 0; vertex < uv.count; vertex++) uv.setXY(vertex, (cell.x + uv.getX(vertex) * cell.width) / 1024, 1 - (cell.y + (1 - uv.getY(vertex)) * 112) / atlasHeight);
      return quad.translate(key.x, key.y, CAP_Z + .073);
    });
    labelMesh = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshBasicMaterial({ map: atlas, transparent: true, toneMapped: false }));
    quads.forEach((quad) => quad.dispose());
    labelRest = Float32Array.from(labelMesh.geometry.attributes.position.array);
    skills.add(labelMesh);
  }
  const layKeys = (time: number, energy: number) => {
    const { matrix, position, rotation, scale, color } = scratch;
    keys.forEach((key, index) => {
      const wave = energy * Math.max(0, Math.sin(time * 6 - key.column * .55 - key.row * .35)) ** 6;
      press[index] = wave * .06;
      caps.setMatrixAt(index, matrix.compose(position.set(key.x, key.y, CAP_Z - press[index]), rotation.identity(), scale.set(key.width, keyHeight, .14)));
      caps.setColorAt(index, color.set(key.color).lerp(WHITE, wave * .6 + energy * .1));
    });
    caps.instanceMatrix.needsUpdate = true;
    if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
    if (!labelMesh) return;
    const positions = labelMesh.geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex++) positions.setZ(vertex, labelRest[vertex * 3 + 2] - press[Math.floor(vertex / 4)]);
    positions.needsUpdate = true;
  };
  layKeys(0, 0);
  let keysResting = true;
  reactives.push({ id: 'skills', energy: 0, animate: (time, energy) => {
    if (energy === 0 && keysResting) return;
    layKeys(time, energy);
    poke.position.z = WALL_Z + .11 - energy * .04 * (.5 + .5 * Math.sin(time * 8));
    pokeLight.color.set(CORAL).lerp(WHITE, energy * .5);
    keysResting = energy === 0;
  } });

  // Exhibits: a gentle arc facing the camera; past five they alternate between a back and a front row.
  const count = content.projects.length, zigzag = count > 5;
  const pitch = Math.min(1.75, 7.4 / Math.max(1, count - 1));
  const labelWidth = Math.min(1.4, pitch * (zigzag ? 2 : 1) - .3);
  content.projects.forEach((project, index) => {
    const id = `project:${project.slug}`, accent = ACCENTS[index % ACCENTS.length];
    const x = (index - (count - 1) / 2) * pitch, z = (zigzag ? (index % 2 ? .2 : -1.35) : -.72) + .05 * x * x, yaw = Math.atan2(-x, FOCUS - z);
    const root = new THREE.Group();
    root.name = root.userData.station = id;
    root.position.set(x, 0, z); root.rotation.y = yaw;
    group.add(root);
    const parts = [
      piece(rounded(.96, TOP - .03, .68, .08, 2), CREAM, [0, (TOP - .03) / 2, 0]),
      piece(rounded(1, .05, .72, .02), accent, [0, TOP - .025, 0]),
      piece(rounded(.72, .43, .05, .02), PLUM, [0, .44, .35]),
      piece(cylinder(.025, .025, .74, 8), PLUM, [0, TOP + .37, -.3]),
    ];
    const light = new THREE.MeshBasicMaterial({ color: accent, toneMapped: false });
    const control = new THREE.Mesh(rounded(.34, .05, .1, .02), light);
    control.position.set(0, TOP + .02, .27); root.add(control);
    const animate = (THEMES[project.slug] ?? kiosk)(root, parts, light, glow, (moving, at) => solid(moving, root, at));
    solid(parts, root);

    const screen = new THREE.MeshBasicMaterial({ color: 0xd9cdea, toneMapped: false });
    const display = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height), screen);
    display.position.set(0, .44, .377); root.add(display);
    if (project.image) loaded.push(loader.load(project.image, (texture) => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      const { width, height } = texture.image;
      // Cover-crop to the screen's aspect.
      const ratio = width && height ? width / height / (SCREEN.width / SCREEN.height) : 1;
      if (ratio > 1) { texture.repeat.x = 1 / ratio; texture.offset.x = (1 - 1 / ratio) / 2; } else { texture.repeat.y = ratio; texture.offset.y = (1 - ratio) / 2; }
      screen.map = texture; screen.color.copy(WHITE); screen.needsUpdate = true;
    }));

    const title = paint(512, 192, (context) => {
      context.fillStyle = '#fff8ee'; context.strokeStyle = `#${accent.toString(16).padStart(6, '0')}`; context.lineWidth = 10;
      context.beginPath(); context.roundRect(6, 6, 500, 180, 44); context.fill(); context.stroke();
      context.fillStyle = '#3f2849';
      fitText(context, project.title, 256, 96, 440, 156, 60);
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(labelWidth, labelWidth * .375), new THREE.MeshBasicMaterial({ map: title, transparent: true, toneMapped: false }));
    label.position.set(0, TOP + .7 + labelWidth * .1875, -.27); root.add(label);

    root.updateMatrix();
    const stand = new THREE.Vector3(0, 0, .82).applyMatrix4(root.matrix), reach = new THREE.Vector3(0, TOP + .07, .32).applyMatrix4(root.matrix);
    obstacles.push({ id, x, z, radius: .55 });
    stations.push({ id, kind: 'play', label: `${project.title} exhibit`, stand: { x: stand.x, z: stand.z }, heading: yaw > 0 ? yaw - Math.PI : yaw + Math.PI, reach: { x: reach.x, y: reach.y, z: reach.z } });
    reactives.push({ id, energy: 0, animate: (time, energy, progress, dt) => {
      animate(time, energy, progress, dt);
      control.position.y = TOP + .02 - energy * .014 * (.5 + .5 * Math.sin(time * 10));
      light.color.set(accent).lerp(WHITE, energy * (.35 + .3 * Math.sin(time * 9)));
    } });
  });
  stations.push({ id: 'skills', kind: 'tinker', label: 'Skills keyboard wall', stand: { x: skillsX, z: -1.95 }, heading: Math.PI, reach: { x: skillsX, y: POKE_Y, z: WALL_Z + .16 } });
  group.updateMatrixWorld(true);

  return {
    id: 'lab',
    group,
    bounds: { ...BOUNDS },
    obstacles,
    stations,
    exit: { ...EXIT },
    landing: { ...LANDING },
    view: { center: { x: 0, y: 1.7, z: -.3 } },
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
      const noise = Math.sin(Math.floor(elapsed * 8) * 91.7) * 4375.85 % 1;
      signMaterial.opacity = Math.abs(noise) > .93 ? .35 : Math.abs(noise) > .88 ? .75 : 1;
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
      toy.dispose(); glow.dispose();
      loaded.forEach((texture) => texture.dispose());
    },
  };
};

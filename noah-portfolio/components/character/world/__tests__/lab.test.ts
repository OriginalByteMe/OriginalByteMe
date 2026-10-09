import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { createCharacterState, resolveCharacterTarget, stepCharacter, type Vec2 } from '@/lib/character/controller';
import { STATION_LINES } from '@/lib/character/narrative';
import { skillStationId, worldContent, type WorldContent } from '@/lib/character/world-content';
import { loadCorpus } from '@/lib/corpus/loader';
import { createLab } from '../lab';
import type { WorldArea } from '../types';

const real = worldContent(loadCorpus().corpus);
const origin = new THREE.Vector3(0, -18, 0);
/** From the room toward the scene's camera. */
const TO_CAMERA = new THREE.Vector3(0, .42, 1).normalize();
const withContent = (projects: WorldContent['projects'], skills: WorldContent['skills']): WorldContent => ({ ...real, projects, skills });
const projectOf = (slug: string) => real.projects.find((project) => project.slug === slug)!;
const full = withContent(
  [...real.projects, ...['alpha', 'beta', 'gamma'].map((name) => ({ ...real.projects[0], slug: `extra-${name}`, title: `Extra ${name}` }))],
  [...real.skills, ...['Game Engines', 'Testing', 'Design'].map((category) => ({ category, skills: [{ name: 'Zod', icon: '/icons/zod.svg' }, { name: 'PyTorch', icon: '/icons/pytorch.svg' }] }))],
);

type PictureLoad = { url: string; image: HTMLImageElement; onLoad?: (image: HTMLImageElement) => void; onError?: (error: unknown) => void };
type IconLoad = { url: string; texture: THREE.Texture<HTMLImageElement>; onLoad?: (texture: THREE.Texture<HTMLImageElement>) => void; onError?: (error: unknown) => void };
let pictures: PictureLoad[];
let icons: IconLoad[];
let drawn: { canvas: HTMLCanvasElement; args: unknown[] }[];

beforeEach(() => {
  pictures = []; icons = []; drawn = [];
  vi.spyOn(THREE.ImageLoader.prototype, 'load').mockImplementation((url, onLoad, _progress, onError) => {
    const image = document.createElement('img');
    pictures.push({ url, image, onLoad, onError });
    return image;
  });
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url, onLoad, _progress, onError) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    icons.push({ url, texture, onLoad, onError });
    return texture;
  });
  // jsdom has no 2D canvas: record the pictures drawn on each canvas.
  stubCanvas2d().mockImplementation(function (this: HTMLCanvasElement) {
    const state: Record<string | symbol, unknown> = { font: '10px sans-serif' };
    return new Proxy(state, {
      get: (target, key) => key in target ? target[key]
        : key === 'measureText' ? (text: string) => ({ width: text.length * Number(/([\d.]+)px/.exec(String(state.font))?.[1] ?? 10) * .6 })
        : key === 'drawImage' ? (...args: unknown[]) => { drawn.push({ canvas: this, args }); }
        : () => ({ addColorStop() {} }),
      set: (target, key, value) => { target[key] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
  });
});
afterEach(() => vi.restoreAllMocks());

const image = (width: number, height: number) => Object.assign(document.createElement('img'), { width, height });
/** A project picture finishing its load at its natural size. */
const finish = (load: PictureLoad, width: number, height: number) => load.onLoad?.(Object.defineProperties(load.image, { naturalWidth: { value: width }, naturalHeight: { value: height } }));
const loadIcons = () => icons.forEach((load) => { load.texture.image = image(256, 256); load.onLoad?.(load.texture); });
const ids = (content: WorldContent) => [...content.projects.map((project) => `project:${project.slug}`), ...content.skills.map((group) => skillStationId(group.category))];
const part = (area: WorldArea, name: string) => area.group.getObjectByName(name)!;
const flat = (point: Vec2) => new THREE.Vector2(point.x, point.z);
const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
const meshes = (object: THREE.Object3D) => {
  const found: THREE.Mesh[] = [];
  object.traverse((node) => { if (node instanceof THREE.Mesh) found.push(node); });
  return found;
};

describe('createLab', () => {
  it.each<[string, WorldContent]>([
    ['the real corpus', real], ['no projects or skills', withContent([], [])], ['no projects', withContent([], real.skills)],
    ['no skills', withContent(real.projects, [])], ['eight projects and eight skill groups', full],
  ])('lays out %s inside the envelope with every stand, the exit and the hop off the beanbag reachable and apart', (_, content) => {
    const area = createLab(origin, content);
    const { bounds, obstacles } = area;
    expect(area.id).toBe('lab');
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    expect(area.stations.map((station) => station.id)).toEqual(ids(content));
    expect(area.stations.map((station) => station.kind)).toEqual([...content.projects.map(() => 'play'), ...content.skills.map(() => 'tinker')]);
    const box = new THREE.Box3().setFromObject(area.group).translate(origin.clone().negate());
    expect(box.min.toArray().map((value, axis) => value >= [-9, -3, -6.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [9, 8, 6][axis])).toEqual([true, true, true]);

    const inset = (point: Vec2) => point.x >= bounds.minX + .22 && point.x <= bounds.maxX - .22 && point.z >= bounds.minZ + .22 && point.z <= bounds.maxZ - .22;
    const clear = (point: Vec2) => obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .22);
    // Where the scene hops him down to after he lands.
    const hop = resolveCharacterTarget(area.landing, { x: area.landing.x, z: area.landing.z + .9 }, obstacles, bounds);
    const places: [string, Vec2][] = [['hop', hop], ['exit', area.exit], ...area.stations.map((station): [string, Vec2] => [station.id, station.stand])];
    for (const [id, point] of places) expect(inset(point) && clear(point), id).toBe(true);
    for (const [index, [a, from]] of places.entries()) for (const [b, to] of places.slice(index + 1)) expect(flat(from).distanceTo(flat(to)), `${a} / ${b}`).toBeGreaterThan(.5);
    expect(area.exit.z).toBeGreaterThan(bounds.maxZ - .6);
    for (const station of area.stations) {
      const ahead = flat(station.reach).sub(flat(station.stand));
      expect(ahead.length(), station.id).toBeGreaterThanOrEqual(.35);
      expect(ahead.length(), station.id).toBeLessThanOrEqual(.55);
      expect(station.reach.y, station.id).toBeGreaterThanOrEqual(.85);
      expect(station.reach.y, station.id).toBeLessThanOrEqual(1.3);
      const facing = Math.atan2(ahead.x, ahead.y) - station.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), station.id).toBeLessThan(.5);
    }
    for (const [id, target] of places.slice(1)) {
      const state = createCharacterState(hop);
      for (let frame = 0; frame < 1800; frame++) stepCharacter(state, target, 1 / 60, obstacles, bounds);
      expect(Math.hypot(state.position.x - target.x, state.position.z - target.z), id).toBeLessThan(.13);
    }

    // He lands on the beanbag's soft top, not in the air above it.
    expect(area.landing.y).toBeGreaterThan(.2);
    const below = ray(local(area.landing.x, area.landing.y + 1, area.landing.z), local(area.landing.x, 0, area.landing.z)).intersectObject(area.group, true)[0];
    expect(below.point.y - origin.y).toBeCloseTo(area.landing.y, 1);

    // Every bay stays between the side edges, and no part of one bay runs into a part of another.
    const bays = area.stations.map((station) => meshes(part(area, station.id)).map((mesh) => new THREE.Box3().setFromObject(mesh).translate(origin.clone().negate())));
    for (const [index, bay] of bays.entries()) {
      expect(bay.every((box) => box.min.x >= bounds.minX && box.max.x <= bounds.maxX), area.stations[index].id).toBe(true);
      for (const other of bays.slice(index + 1)) expect(bay.some((box) => other.some((next) => box.intersectsBox(next))), area.stations[index].id).toBe(false);
    }

    let drawCalls = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      drawCalls += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    const skills = content.skills.reduce((sum, group) => sum + group.skills.length, 0);
    expect(drawCalls).toBeLessThanOrEqual(6 + 11 * content.projects.length + 6 * content.skills.length + skills);
    expect(triangles).toBeLessThanOrEqual(16000 + 3500 * content.projects.length + 2500 * content.skills.length);
  });

  it('presents projects and skill groups with their corpus lines, and a Visit link only for a project with a url', () => {
    const gadget = { slug: 'gadget', title: 'Gadget', description: 'Makes toast. Also tea!', url: '', image: '/gadget.png', tech: ['Rust', 'Go', 'Zig'].map((name) => ({ name, icon: '/icons/zod.svg' })) };
    const databases = real.skills.find((group) => group.category === 'Databases')!;
    const content = withContent([projectOf('moodify'), gadget], [databases, { category: 'Game Engines', skills: [{ name: 'Godot', icon: '/icons/zod.svg' }] }]);
    const present = (id: string) => createLab(origin, content).stations.find((station) => station.id === id)!.present!;
    const said = (id: string) => present(id).lines.map((line) => line.line);

    const moodify = present('project:moodify');
    expect(moodify.lines[0]).toEqual(STATION_LINES['project:moodify'][0]);
    expect(said('project:moodify')).toEqual([
      "Moodify paints the page in an album cover's colours!",
      'Search your favourite tune and its album colours take over the page.',
      "The same palette trick recolours this site's hero dither!",
      'Built with TypeScript, React and Node.js.',
    ]);
    expect([moodify.url, moodify.linkLabel]).toEqual(['https://github.com/OriginalByteMe/Moodify', 'Visit Moodify']);
    expect(said('project:gadget')).toEqual(['Makes toast.', 'Built with Rust, Go and Zig.']);
    expect([present('project:gadget').url, present('project:gadget').linkLabel]).toEqual([undefined, undefined]);
    for (const slug of ['moodify', 'gadget']) {
      const { lines } = present(`project:${slug}`);
      for (const line of lines) expect(line.source, line.id).toBe(`content/about-me/projects/${slug}.md`);
      expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
    }

    expect(said(skillStationId('Databases'))).toEqual(['Five databases, filing every row away!', 'Databases: PostgreSQL, MySQL, SQLite, Redis and MongoDB.']);
    expect(said(skillStationId('Game Engines'))).toEqual(['Game Engines: Godot.']);
    for (const category of ['Databases', 'Game Engines']) {
      const { lines, url } = present(skillStationId(category));
      for (const line of lines) expect(line.source, line.id).toBe('content/about-me/skills.md');
      expect(url).toBeUndefined();
    }
  });

  it('loads only same-origin pictures and icons, cover-crops each picture into its sRGB card and keeps a plain card or hides the icon when one fails', () => {
    const [cutout, moodify, broken] = ['ai-image-cutout', 'moodify', 'llm-comparison'].map(projectOf);
    const remote = { ...cutout, slug: 'remote', image: 'https://example.com/remote.png' }, relative = { ...cutout, slug: 'relative', image: '//example.com/remote.png' };
    const content = withContent([cutout, moodify, broken, remote, relative], [{ category: 'Mixed', skills: [
      { name: 'Wide', icon: '/icons/aws.svg' }, { name: 'Broken', icon: '/icons/git.svg' }, { name: 'Remote', icon: 'https://example.com/remote.svg' },
    ] }]);
    const area = createLab(origin, content);
    expect(pictures.map((load) => load.url)).toEqual([cutout.image, moodify.image, broken.image]);
    expect(icons.map((load) => load.url)).toEqual(['/icons/aws.svg', '/icons/git.svg']);
    const faces = content.projects.map((project) => meshes(part(area, `project:${project.slug}:picture`))
      .map((mesh) => (mesh.material as THREE.MeshBasicMaterial).map).find((map) => map instanceof THREE.CanvasTexture)!);
    for (const face of faces) expect(face.colorSpace).toBe(THREE.SRGBColorSpace);

    const version = faces[0].version;
    finish(pictures[0], 1600, 900);
    finish(pictures[1], 300, 150);
    pictures[2].onError?.(new Error('404'));
    expect(faces[0].version).toBeGreaterThan(version);
    expect(drawn.map((draw) => faces.findIndex((face) => face.image === draw.canvas))).toEqual([0, 1]);
    // The photo keeps its proportions: a centred source rectangle with the window's aspect.
    const [, sx, sy, sw, sh, , , dw, dh] = drawn[0].args as number[];
    expect(sw / sh).toBeCloseTo(dw / dh, 3);
    expect([sx * 2 + sw, sy * 2 + sh].map(Math.round)).toEqual([1600, 900]);
    expect(Math.min(sx, sy)).toBeGreaterThanOrEqual(-1e-9);
    // An SVG has no reliable size of its own, so it is drawn whole into the window.
    expect(drawn[1].args).toHaveLength(5);

    const shown = meshes(part(area, skillStationId('Mixed'))).filter((mesh) => mesh.name.startsWith('icon:'));
    expect(shown.map((mesh) => mesh.name)).toEqual(['icon:Wide', 'icon:Broken', 'icon:Remote']);
    icons[0].texture.image = image(512, 256);
    icons[0].onLoad?.(icons[0].texture);
    icons[1].onError?.(new Error('404'));
    const map = (mesh: THREE.Mesh) => (mesh.material as THREE.MeshBasicMaterial).map;
    expect([shown[0].visible, map(shown[0]), icons[0].texture.colorSpace]).toEqual([true, icons[0].texture, THREE.SRGBColorSpace]);
    expect(shown[0].scale.x / shown[0].scale.y).toBeCloseTo(2);
    for (const mesh of shown.slice(1)) expect([mesh.visible, map(mesh)], mesh.name).toEqual([false, null]);
  });

  it('picks the station for every part of its bay, and nothing for the floor, walls or sign', () => {
    const area = createLab(origin, real);
    loadIcons();
    // Aim from the camera side at the part's box centre, else at its vertices, until the ray really touches the part.
    const aim = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3();
      for (let vertex = -1; vertex < position.count; vertex += 3) {
        if (vertex < 0) new THREE.Box3().setFromObject(mesh).getCenter(target);
        else mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        const raycaster = ray(target.clone().addScaledVector(TO_CAMERA, 1.2), target);
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      throw new Error(`no ray reaches ${mesh.name || mesh.parent?.name}`);
    };
    for (const id of ids(real)) {
      const parts = meshes(part(area, id)).filter((mesh) => !(mesh instanceof THREE.InstancedMesh) && mesh.visible);
      expect(parts.length, id).toBeGreaterThanOrEqual(4);
      for (const mesh of parts) expect(area.pick(aim(mesh)), `${id} ${mesh.name}`).toBe(id);
    }
    const floor = ray(local(area.exit.x, 3, area.exit.z), local(area.exit.x, 0, area.exit.z));
    const sideWall = ray(local(0, 3.2, -1.5), local(-10, 3.2, -1.5));
    const sign = ray(local(area.landing.x, 5.4, 6), local(area.landing.x, 5.4, -6));
    for (const raycaster of [floor, sideWall, sign]) {
      expect(raycaster.intersectObject(area.group, true).length).toBeGreaterThan(0);
      expect(area.pick(raycaster)).toBeNull();
    }
  });

  const pose = (object: THREE.Object3D) => {
    object.updateWorldMatrix(true, true);
    const values: number[] = [];
    object.traverse((node) => {
      values.push(...node.matrixWorld.elements, node.visible ? 1 : 0);
      if (node instanceof THREE.InstancedMesh) values.push(...node.instanceMatrix.array, ...(node.instanceColor?.array ?? []));
      if (node instanceof THREE.Mesh && 'color' in node.material && node.material.color instanceof THREE.Color) values.push(...node.material.color.toArray());
    });
    return values;
  };
  const difference = (a: number[], b: number[]) => a.reduce((largest, value, index) => Math.max(largest, Math.abs(value - b[index])), 0);
  const run = (area: WorldArea, stationId: string | null, from = 1, to = 45) => {
    for (let frame = from; frame <= to; frame++) area.update(1 / 30, frame / 30, { stationId, progress: frame / 90 });
  };

  it('keeps the pictures drifting and the skill machines ticking while nobody is at a station', () => {
    const area = createLab(origin, real);
    const drifting = real.projects.map((project) => `project:${project.slug}:picture`), ticking = real.skills.map((group) => `${skillStationId(group.category)}:machine`);
    const before = [...drifting, ...ticking].map((name) => pose(part(area, name)));
    run(area, null);
    [...drifting, ...ticking].forEach((name, index) => expect(difference(before[index], pose(part(area, name))), name).toBeGreaterThan(index < drifting.length ? .01 : 0));
  });

  it.each(ids(real))('%s reacts visibly while he presents it, keeps going, and nothing else changes', (active) => {
    const idle = createLab(origin, real), busy = createLab(origin, real);
    loadIcons();
    run(idle, null); run(busy, active);
    for (const id of ids(real)) {
      const change = difference(pose(part(idle, id)), pose(part(busy, id)));
      if (id === active) expect(change, id).toBeGreaterThan(.05);
      else expect(change, id).toBe(0);
    }
    const moment = pose(part(busy, `${active}:machine`));
    run(busy, active, 46, 60);
    expect(difference(moment, pose(part(busy, `${active}:machine`)))).toBeGreaterThan(.01);
  });

  it('dispose frees every geometry, material and texture it put in the scene, including a picture or icon that loads afterwards', () => {
    const area = createLab(origin, real);
    const [late, early] = icons;
    early.texture.image = image(256, 256);
    early.onLoad?.(early.texture);
    finish(pictures[1], 800, 400);
    const owned = new Set<unknown>(icons.map((load) => load.texture));
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      owned.add(node.geometry);
      if (node instanceof THREE.InstancedMesh) owned.add(node);
      for (const material of [node.material].flat()) {
        owned.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) owned.add(value);
      }
    });
    const dispatch = vi.spyOn(THREE.EventDispatcher.prototype, 'dispatchEvent');
    area.dispose();
    const painted = drawn.length;
    finish(pictures[0], 1600, 900);
    late.texture.image = image(256, 256);
    late.onLoad?.(late.texture);

    expect(drawn).toHaveLength(painted);
    const freed = new Set<unknown>(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    expect([...owned].filter((item) => !freed.has(item))).toEqual([]);
    expect([...owned].filter((item) => item instanceof THREE.CanvasTexture).length).toBeGreaterThan(real.projects.length);
    expect(meshes(area.group).some((mesh) => (mesh.material as THREE.MeshBasicMaterial).map === late.texture)).toBe(false);
  });
});

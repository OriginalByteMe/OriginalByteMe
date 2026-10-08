import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { createCharacterState, stepCharacter } from '@/lib/character/controller';
import { STATION_LINES } from '@/lib/character/narrative';
import { worldContent, type WorldContent } from '@/lib/character/world-content';
import { loadCorpus } from '@/lib/corpus/loader';
import { createLab } from '../lab';
import { lotOrigin } from '../town';
import type { WorldArea } from '../types';

const real = worldContent(loadCorpus().corpus);
const origin = lotOrigin(2);
const withProjects = (projects: WorldContent['projects']): WorldContent => ({ ...real, projects });
const eight = withProjects([...real.projects, ...['alpha', 'beta', 'gamma'].map((name) => ({ ...real.projects[0], slug: `extra-${name}`, title: `Extra ${name}` }))]);
/** From the lot toward the scene's camera: dead-on down -z with its gentle downward tilt. */
const TO_CAMERA = new THREE.Vector3(0, .3, 1).normalize();

type Load = { url: string; image: HTMLImageElement; onLoad?: (image: HTMLImageElement) => void; onError?: (error: unknown) => void };
let loads: Load[];
let texts: { canvas: HTMLCanvasElement; text: string }[];
let drawn: { canvas: HTMLCanvasElement; image: unknown }[];

beforeEach(() => {
  loads = []; texts = []; drawn = [];
  vi.spyOn(THREE.ImageLoader.prototype, 'load').mockImplementation((url, onLoad, _progress, onError) => {
    const image = document.createElement('img');
    loads.push({ url, image, onLoad, onError });
    return image;
  });
  // jsdom has no 2D canvas: record the text and pictures drawn on each canvas.
  stubCanvas2d().mockImplementation(function (this: HTMLCanvasElement) {
    const state: Record<string | symbol, unknown> = { font: '10px sans-serif' };
    return new Proxy(state, {
      get: (target, key) => key in target ? target[key]
        : key === 'measureText' ? (text: string) => ({ width: text.length * Number(/([\d.]+)px/.exec(String(state.font))?.[1] ?? 10) * .6 })
        : key === 'fillText' ? (text: string) => { texts.push({ canvas: this, text }); }
        : key === 'drawImage' ? (image: unknown) => { drawn.push({ canvas: this, image }); }
        : () => ({ addColorStop() {} }),
      set: (target, key, value) => { target[key] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
  });
});
afterEach(() => vi.restoreAllMocks());

const ids = (content: WorldContent) => content.projects.map((project) => `project:${project.slug}`);
const part = (area: WorldArea, id: string, kind: 'machine' | 'picture') => area.group.getObjectByName(`${id}:${kind}`)!;
const flat = (point: { x: number; z: number }) => new THREE.Vector2(point.x, point.z);
/** Lot-local bounding box. */
const boxOf = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object).translate(origin.clone().negate());
const cardFace = (area: WorldArea, id: string) => {
  let face: THREE.CanvasTexture | undefined;
  part(area, id, 'picture').traverse((node) => { if (node instanceof THREE.Mesh && node.material.map instanceof THREE.CanvasTexture) face = node.material.map; });
  return face!;
};

describe('createLab, the workshop', () => {
  it.each([0, 1, 5])('gives each of %i projects a station with a machine and a floating picture', (count) => {
    const content = withProjects(real.projects.slice(0, count));
    const area = createLab(origin, content);
    expect(area.id).toBe('workshop');
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    expect(area.stations.map((station) => station.id)).toEqual(ids(content));
    for (const station of area.stations) {
      expect(station.kind).toBe('play');
      expect(station.label).toContain(content.projects.find((project) => station.id === `project:${project.slug}`)!.title);
      expect(part(area, station.id, 'machine')).toBeInstanceOf(THREE.Object3D);
      expect(part(area, station.id, 'picture')).toBeInstanceOf(THREE.Object3D);
    }
  });

  it.each([
    ['no', withProjects([])], ['one', withProjects(real.projects.slice(0, 1))], ['the real', real], ['eight', eight],
  ])('lays out %s projects inside the lot with every station reachable and in view beside him', (_, content) => {
    const area = createLab(origin, content);
    const { bounds, obstacles } = area;
    const box = boxOf(area.group);
    expect(box.min.toArray().map((value, axis) => value >= [-7, -3, -4.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [7, 7, 4.5][axis])).toEqual([true, true, true]);
    // Noticeably bigger than the old 9.2 by 4.8 room.
    expect((bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)).toBeGreaterThan(70);

    const inset = (point: { x: number; z: number }) => point.x >= bounds.minX + .22 && point.x <= bounds.maxX - .22 && point.z >= bounds.minZ + .22 && point.z <= bounds.maxZ - .22;
    const clear = (point: { x: number; z: number }) => obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .22);
    for (const station of area.stations) {
      expect(inset(station.stand) && clear(station.stand), station.id).toBe(true);
      const ahead = flat(station.reach).sub(flat(station.stand));
      expect(ahead.length(), station.id).toBeGreaterThanOrEqual(.35);
      expect(ahead.length(), station.id).toBeLessThanOrEqual(.55);
      expect(station.reach.y, station.id).toBeGreaterThanOrEqual(.85);
      expect(station.reach.y, station.id).toBeLessThanOrEqual(1.3);
      const facing = Math.atan2(ahead.x, ahead.y) - station.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), station.id).toBeLessThan(.5);
    }
    for (const [index, a] of area.stations.entries()) for (const b of area.stations.slice(index + 1)) expect(flat(a.stand).distanceTo(flat(b.stand))).toBeGreaterThan(.5);

    expect(inset(area.entry) && clear(area.entry)).toBe(true);
    expect(area.entry.z).toBeGreaterThan(bounds.maxZ - .8);
    for (const station of area.stations) {
      const state = createCharacterState({ ...area.entry });
      for (let frame = 0; frame < 1800; frame++) stepCharacter(state, station.stand, 1 / 60, obstacles, bounds);
      expect(Math.hypot(state.position.x - station.stand.x, state.position.z - station.stand.z), station.id).toBeLessThan(.13);
    }

    // Standing at a station, his afro hides neither its machine nor its picture from the camera, and the picture floats above his head.
    for (const station of area.stations) {
      const afro = new THREE.Sphere(new THREE.Vector3(station.stand.x, 1.85, station.stand.z), .8);
      for (const kind of ['machine', 'picture'] as const) {
        const centre = boxOf(part(area, station.id, kind)).getCenter(new THREE.Vector3());
        expect(new THREE.Ray(centre, TO_CAMERA).intersectsSphere(afro), `${station.id} ${kind}`).toBe(false);
      }
      expect(boxOf(part(area, station.id, 'picture')).min.y, station.id).toBeGreaterThan(2.45);
    }
    for (const kind of ['machine', 'picture'] as const) {
      const boxes = area.stations.map((station) => boxOf(part(area, station.id, kind)));
      for (const [index, a] of boxes.entries()) {
        expect([a.min.x >= -6.8, a.max.x <= 6.8, a.min.z >= -4.2, a.max.z <= 4.2], `${kind} ${index}`).toEqual([true, true, true, true]);
        for (const b of boxes.slice(index + 1)) expect(a.intersectsBox(b), `${kind} ${index}`).toBe(false);
      }
    }

    let drawCalls = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      drawCalls += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    expect(drawCalls).toBeLessThanOrEqual(10 + 11 * content.projects.length);
    expect(triangles).toBeLessThanOrEqual(16000 + 3500 * content.projects.length);
  });

  it('presents every project with sourced lines from its corpus file, its url and a Visit label', () => {
    const content = withProjects([...real.projects, { ...real.projects[0], slug: 'no-link', title: 'No Link', url: '' }]);
    const area = createLab(origin, content);
    for (const project of content.projects) {
      const station = area.stations.find((entry) => entry.id === `project:${project.slug}`)!;
      const { lines, url, linkLabel } = station.present!;
      expect(lines.length, station.id).toBeGreaterThanOrEqual(2);
      for (const line of lines) expect(line.source, line.id).toBe(`content/about-me/projects/${project.slug}.md`);
      expect(new Set(lines.map((line) => line.id)).size, station.id).toBe(lines.length);
      expect(url, station.id).toBe(project.url || undefined);
      expect(linkLabel).toBe(`Visit ${project.title}`);
    }
    // The opening line is the exhibit's line from the narrative.
    for (const id of ids(real)) expect(area.stations.find((entry) => entry.id === id)!.present!.lines[0]).toEqual(STATION_LINES[id][0]);
  });

  it('titles each floating card and paints its project picture in once it loads, keeping the placeholder when one fails', () => {
    const area = createLab(origin, real);
    expect(loads.map((load) => load.url)).toEqual(real.projects.map((project) => project.image));
    const faces = ids(real).map((id) => cardFace(area, id));
    real.projects.forEach((project, index) => {
      expect(texts.filter((text) => text.canvas === faces[index].image).map((text) => text.text).join(' ')).toContain(project.title);
      expect(faces[index].colorSpace).toBe(THREE.SRGBColorSpace);
    });
    const version = faces[0].version;
    loads[0].onLoad?.(Object.assign(loads[0].image, { width: 1600, height: 900 }));
    expect(drawn).toEqual([{ canvas: faces[0].image, image: loads[0].image }]);
    expect(faces[0].version).toBeGreaterThan(version);
    loads[1].onError?.(new Error('404'));
    expect(drawn).toHaveLength(1);
  });

  it('picks the project for rays at its picture and its machine, and nothing for the floor, walls or sign', () => {
    const area = createLab(origin, real);
    const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
    // Aim from the front at the part's box centre, else at its vertices, until the ray really touches the part.
    const aim = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3();
      for (let vertex = -1; vertex < position.count; vertex += 3) {
        if (vertex < 0) new THREE.Box3().setFromObject(mesh).getCenter(target);
        else mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        const raycaster = ray(target.clone().addScaledVector(TO_CAMERA, 1.2), target);
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      throw new Error(`no ray reaches a part of ${mesh.parent?.name}`);
    };
    for (const id of ids(real)) {
      for (const kind of ['picture', 'machine'] as const) {
        const parts: THREE.Mesh[] = [];
        part(area, id, kind).traverse((node) => { if (node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh) && node.visible) parts.push(node); });
        expect(parts.length, `${id} ${kind}`).toBeGreaterThanOrEqual(2);
        for (const mesh of parts) expect(area.pick(aim(mesh)), `${id} ${kind}`).toBe(id);
      }
    }
    const local = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
    const floor = ray(local(area.entry.x, 3, area.entry.z), local(area.entry.x, 0, area.entry.z));
    const sideWall = ray(local(0, 3.2, -1.5), local(-10, 3.2, -1.5));
    const sign = ray(local(0, 4.6, 6), local(0, 4.6, -4));
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

  it('keeps every machine still and lets every picture float while nobody is at one', () => {
    const area = createLab(origin, eight);
    const machines = ids(eight).map((id) => pose(part(area, id, 'machine')));
    const pictures = ids(eight).map((id) => pose(part(area, id, 'picture')));
    run(area, null);
    ids(eight).forEach((id, index) => {
      expect(difference(machines[index], pose(part(area, id, 'machine'))), id).toBe(0);
      expect(difference(pictures[index], pose(part(area, id, 'picture'))), id).toBeGreaterThan(.01);
    });
  });

  it.each(ids(eight))('runs only the %s machine while he presents it, and keeps it running', (active) => {
    const idle = createLab(origin, eight), busy = createLab(origin, eight);
    run(idle, null); run(busy, active);
    for (const id of ids(eight)) {
      const change = difference(pose(part(idle, id, 'machine')), pose(part(busy, id, 'machine')));
      if (id === active) expect(change, id).toBeGreaterThan(.05);
      else expect(change, id).toBe(0);
    }
    const moment = pose(part(busy, active, 'machine'));
    run(busy, active, 46, 60);
    expect(difference(moment, pose(part(busy, active, 'machine')))).toBeGreaterThan(.01);
  });

  it('dispose frees every geometry, material and texture it put in the scene, and ignores a picture that loads afterwards', () => {
    const area = createLab(origin, real);
    loads[1].onLoad?.(Object.assign(loads[1].image, { width: 800, height: 400 }));
    const owned = new Set<unknown>();
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
    loads[0].onLoad?.(Object.assign(loads[0].image, { width: 1600, height: 900 }));
    expect(drawn).toHaveLength(painted);

    const freed = new Set<unknown>(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    expect([...owned].filter((item) => !freed.has(item))).toEqual([]);
    expect([...owned].filter((item) => item instanceof THREE.CanvasTexture).length).toBeGreaterThan(real.projects.length);
  });
});

import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/lib/character/__tests__/canvas-stub';
import { createCharacterState, stepCharacter } from '@/lib/character/controller';
import { worldContent, type WorldContent } from '@/lib/character/world-content';
import { loadCorpus } from '@/lib/corpus/loader';
import { createToolshed } from '../toolshed';
import { lotOrigin } from '../town';
import type { Station, WorldArea } from '../types';

const real = worldContent(loadCorpus().corpus);
const origin = lotOrigin(3);
const withSkills = (skills: WorldContent['skills']): WorldContent => ({ ...real, skills });
const six = withSkills([...real.skills, { category: 'Game Engines', skills: [{ name: 'Godot', icon: '/icons/godot.svg' }, { name: 'Unity', icon: '/icons/unity.png' }] }]);

type Load = { url: string; texture: THREE.Texture<HTMLImageElement>; onLoad?: (texture: THREE.Texture<HTMLImageElement>) => void; onError?: (error: unknown) => void };
let loads: Load[];
let texts: string[];

beforeEach(() => {
  loads = []; texts = [];
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url, onLoad, _progress, onError) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    loads.push({ url, texture, onLoad, onError });
    return texture;
  });
  stubCanvas2d().mockImplementation(() => new Proxy({}, {
    get: (_, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 20 }) : key === 'fillText' ? (text: string) => { texts.push(text); } : () => ({ addColorStop() {} }),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

const image = (width: number, height: number) => Object.assign(document.createElement('img'), { width, height });
const loadAll = () => loads.forEach((load) => { load.texture.image = image(256, 256); load.onLoad?.(load.texture); });
const bay = (area: WorldArea, station: Station) => area.group.getObjectByName(station.id)!;
const icons = (area: WorldArea, station: Station) => {
  const found: THREE.Mesh[] = [];
  bay(area, station).traverse((node) => { if (node instanceof THREE.Mesh && node.name.startsWith('icon:')) found.push(node); });
  return found;
};
const local = (object: THREE.Object3D, point = new THREE.Vector3()) => object.getWorldPosition(point).sub(origin);
const flat = (point: { x: number; z: number }) => new THREE.Vector2(point.x, point.z);

describe('createToolshed', () => {
  it('has one tinker station per skill group that presents the group from skills.md', () => {
    const area = createToolshed(origin.clone(), real);
    expect(area.id).toBe('toolshed');
    expect(area.group.position.toArray()).toEqual(origin.toArray());
    expect(area.stations).toHaveLength(real.skills.length);
    expect(new Set(area.stations.map((station) => station.id)).size).toBe(real.skills.length);
    real.skills.forEach((group, index) => {
      const station = area.stations[index];
      expect(station.id).toMatch(/^toolbox:[a-z0-9-]+$/);
      expect(station.kind).toBe('tinker');
      expect(station.label).toContain(group.category);
      const lines = station.present!.lines;
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.source, line.line).toBe('content/about-me/skills.md');
      const said = lines.map((line) => line.line).join(' ');
      for (const skill of group.skills) expect(said, station.id).toContain(skill.name);
      // Skill groups have no site to visit, so no Visit sign.
      expect(station.present!.url).toBeUndefined();
    });
  });

  it('puts a short sign over every group and the toolbox name on the gable', () => {
    createToolshed(origin.clone(), real);
    expect(texts).toContain('The toolbox');
    expect(texts).toHaveLength(real.skills.length + 1);
    for (const text of texts) expect(text.length, text).toBeLessThanOrEqual(16);
  });

  it.each([
    ['no', withSkills([])], ['the real', real], ['six', six],
  ])('lays out %s skill groups inside the lot with reachable stations he never hides', (_, content) => {
    const area = createToolshed(origin.clone(), content);
    loadAll();
    area.group.updateMatrixWorld(true);
    const { bounds, obstacles } = area;
    expect((bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)).toBeGreaterThan(80);
    const box = new THREE.Box3().setFromObject(area.group).translate(origin.clone().negate());
    expect(box.min.toArray().map((value, axis) => value >= [-7, -3, -4.5][axis])).toEqual([true, true, true]);
    expect(box.max.toArray().map((value, axis) => value <= [7, 7, 4.5][axis])).toEqual([true, true, true]);
    expect(box.min.y).toBeLessThan(0);

    const inset = (point: { x: number; z: number }) => point.x >= bounds.minX + .22 && point.x <= bounds.maxX - .22 && point.z >= bounds.minZ + .22 && point.z <= bounds.maxZ - .22;
    const clear = (point: { x: number; z: number }) => obstacles.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.radius + .22);
    expect(inset(area.entry) && clear(area.entry)).toBe(true);
    expect(area.entry.z).toBeGreaterThan(bounds.maxZ - .6);
    // The scene's dead-on camera: along (0, .3, 1) from the view centre.
    const center = area.view.center;
    const eye = new THREE.Vector3(center.x, center.y, center.z).addScaledVector(new THREE.Vector3(0, .3, 1).normalize(), 24);
    for (const station of area.stations) {
      expect(inset(station.stand) && clear(station.stand), station.id).toBe(true);
      const ahead = flat(station.reach).sub(flat(station.stand));
      expect(ahead.length(), station.id).toBeGreaterThanOrEqual(.35);
      expect(ahead.length(), station.id).toBeLessThanOrEqual(.6);
      expect(station.reach.y, station.id).toBeGreaterThanOrEqual(.85);
      expect(station.reach.y, station.id).toBeLessThanOrEqual(1.3);
      const facing = Math.atan2(ahead.x, ahead.y) - station.heading;
      expect(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))), station.id).toBeLessThan(.5);

      const state = createCharacterState({ ...area.entry });
      for (let frame = 0; frame < 1800; frame++) stepCharacter(state, station.stand, 1 / 60, obstacles, bounds);
      expect(Math.hypot(state.position.x - station.stand.x, state.position.z - station.stand.z), station.id).toBeLessThan(.13);

      // Standing there, his body and afro (an axis up to 2 with .45 around it) leave the machine and every icon in sight.
      const feet = new THREE.Vector3(station.stand.x, 0, station.stand.z), crown = new THREE.Vector3(station.stand.x, 2, station.stand.z);
      const seen = (target: THREE.Vector3) => Math.sqrt(new THREE.Ray(eye, target.clone().sub(eye).normalize()).distanceSqToSegment(feet, crown));
      const machine = bay(area, station).getObjectByName('machine')!;
      expect(seen(new THREE.Box3().setFromObject(machine).getCenter(new THREE.Vector3()).sub(origin)), `${station.id} machine`).toBeGreaterThan(.45);
      for (const icon of icons(area, station)) expect(seen(local(icon)), icon.name).toBeGreaterThan(.45);
    }
    for (const [index, a] of area.stations.entries()) for (const b of area.stations.slice(index + 1)) expect(flat(a.stand).distanceTo(flat(b.stand))).toBeGreaterThan(.5);

    let drawCalls = 0, triangles = 0;
    area.group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      drawCalls += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3 * (node instanceof THREE.InstancedMesh ? node.count : 1);
    });
    expect(drawCalls).toBeLessThanOrEqual(75);
    expect(triangles).toBeLessThanOrEqual(30000);
  });

  it('shows every skill icon as a same-origin texture from /icons, sized to its picture, and hides one that fails to load', () => {
    const area = createToolshed(origin.clone(), real);
    const wanted = real.skills.flatMap((group) => group.skills.map((skill) => skill.icon));
    expect(loads.map((load) => load.url)).toEqual(wanted);
    for (const url of wanted) expect(url).toMatch(/^\/icons\/[a-z0-9-]+\.(svg|png)$/);

    const shown = area.stations.flatMap((station) => icons(area, station));
    expect(shown.map((mesh) => mesh.name)).toEqual(real.skills.flatMap((group) => group.skills.map((skill) => `icon:${skill.name}`)));
    for (const mesh of shown) expect(mesh.visible, mesh.name).toBe(false);
    const [wide, broken, ...rest] = loads;
    wide.texture.image = image(512, 256);
    wide.onLoad?.(wide.texture);
    broken.onError?.(new Error('404'));
    for (const load of rest) { load.texture.image = image(256, 256); load.onLoad?.(load.texture); }

    const map = (mesh: THREE.Mesh) => (mesh.material as THREE.MeshBasicMaterial).map;
    shown.forEach((mesh, index) => {
      if (index === 1) { expect([mesh.visible, map(mesh)]).toEqual([false, null]); return; }
      expect(mesh.visible, mesh.name).toBe(true);
      expect(map(mesh), mesh.name).toBe(loads[index].texture);
      expect(loads[index].texture.colorSpace).toBe(THREE.SRGBColorSpace);
    });
    expect(shown[0].scale.x / shown[0].scale.y).toBeCloseTo(2);
    expect(shown[2].scale.x / shown[2].scale.y).toBeCloseTo(1);
  });

  it('picks the group for its pegboard, icons, sign board and machine, and nothing for floor or walls', () => {
    const area = createToolshed(origin.clone(), real);
    loadAll();
    const ray = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Raycaster(from, to.clone().sub(from).normalize());
    // Aim from the front at the part's box centre, else at its vertices, until the ray really touches the part.
    const aim = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.attributes.position, target = new THREE.Vector3();
      for (let vertex = -1; vertex < position.count; vertex += 3) {
        if (vertex < 0) new THREE.Box3().setFromObject(mesh).getCenter(target);
        else mesh.localToWorld(target.fromBufferAttribute(position, vertex));
        const raycaster = ray(target.clone().add(new THREE.Vector3(0, .3, 1.3)), target);
        if (raycaster.intersectObject(mesh).length) return raycaster;
      }
      throw new Error(`no ray reaches ${mesh.name || mesh.parent?.name}`);
    };
    for (const station of area.stations) {
      const parts: THREE.Mesh[] = [];
      bay(area, station).traverse((node) => { if (node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh)) parts.push(node); });
      expect(parts.length).toBeGreaterThanOrEqual(4);
      for (const part of parts) expect(area.pick(aim(part)), `${station.id} ${part.name}`).toBe(station.id);
      for (const icon of icons(area, station)) expect(area.pick(ray(local(icon).add(origin).add(new THREE.Vector3(0, .2, 2)), local(icon).add(origin))), icon.name).toBe(station.id);
    }
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(origin);
    const floor = ray(at(area.entry.x, 3, area.entry.z), at(area.entry.x, 0, area.entry.z));
    const sideWall = ray(at(0, 3.4, -1.5), at(-10, 3.4, -1.5));
    for (const raycaster of [floor, sideWall]) {
      expect(raycaster.intersectObject(area.group, true).length).toBeGreaterThan(0);
      expect(area.pick(raycaster)).toBeNull();
    }
  });

  const pose = (object: THREE.Object3D) => {
    object.updateWorldMatrix(true, true);
    const values: number[] = [];
    object.traverse((node) => {
      values.push(...node.matrixWorld.elements);
      if (node instanceof THREE.InstancedMesh) values.push(...node.instanceMatrix.array, ...(node.instanceColor?.array ?? []));
      if (node instanceof THREE.Mesh && 'color' in node.material && node.material.color instanceof THREE.Color) values.push(...node.material.color.toArray());
    });
    return values;
  };
  const difference = (a: number[], b: number[]) => a.reduce((largest, value, index) => Math.max(largest, Math.abs(value - b[index])), 0);
  const run = (area: WorldArea, stationId: string | null, onFrame?: () => void) => {
    for (let frame = 1; frame <= 45; frame++) { area.update(1 / 30, frame / 30, { stationId, progress: frame / 45 }); onFrame?.(); }
  };

  it('keeps every group machine gently moving while nobody is at a station', () => {
    const area = createToolshed(origin.clone(), six);
    const before = area.stations.map((station) => pose(bay(area, station).getObjectByName('machine')!));
    run(area, null);
    area.stations.forEach((station, index) => expect(difference(before[index], pose(bay(area, station).getObjectByName('machine')!)), station.id).toBeGreaterThan(0));
  });

  it.each(six.skills.map((group, index) => [group.category, index] as const))('the %s station runs its own machine and pops its icons while he is there, and no other group changes', (_, index) => {
    const idle = createToolshed(origin.clone(), six), busy = createToolshed(origin.clone(), six);
    loadAll();
    const station = busy.stations[index], active = station.id;
    const rest = new Map(icons(busy, station).map((icon) => [icon, icon.scale.x]));
    let popped = 0;
    run(idle, null);
    run(busy, active, () => { for (const [icon, scale] of rest) popped = Math.max(popped, icon.scale.x / scale); });
    expect(popped).toBeGreaterThan(1.15);
    for (const each of busy.stations) {
      const twin = idle.stations.find((entry) => entry.id === each.id)!;
      const machine = difference(pose(bay(idle, twin).getObjectByName('machine')!), pose(bay(busy, each).getObjectByName('machine')!));
      const whole = difference(pose(bay(idle, twin)), pose(bay(busy, each)));
      if (each.id === active) expect(machine, each.id).toBeGreaterThan(.05);
      else expect(whole, each.id).toBe(0);
    }
  });

  it('dispose frees every geometry, material and texture it put in the scene, including an icon that loads afterwards', () => {
    const area = createToolshed(origin.clone(), real);
    const [late, early] = loads;
    early.texture.image = image(256, 256);
    early.onLoad?.(early.texture);
    const owned = new Set<unknown>(loads.map((load) => load.texture));
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
    late.texture.image = image(256, 256);
    late.onLoad?.(late.texture);

    const freed = new Set<unknown>(dispatch.mock.calls.flatMap(([event], index) => event.type === 'dispose' ? [dispatch.mock.contexts[index]] : []));
    expect([...owned].filter((item) => !freed.has(item))).toEqual([]);
    expect([...owned].filter((item) => item instanceof THREE.CanvasTexture)).toHaveLength(1);
    let attached = false;
    area.group.traverse((node) => { if (node instanceof THREE.Mesh && 'map' in node.material && node.material.map === late.texture) attached = true; });
    expect(attached).toBe(false);
  });
});

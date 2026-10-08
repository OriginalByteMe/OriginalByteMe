import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Quaternion, Raycaster, Vector2, Vector3, type BufferGeometry, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera, type Scene, type Sprite } from 'three';
import type { CharacterScene } from '@/components/character/create-character-scene';
import { createBedroom } from '@/components/character/world/bedroom';
import { createLab } from '@/components/character/world/lab';
import { lotOrigin } from '@/components/character/world/town';
import { LOTS, type AreaBuilder } from '@/components/character/world/types';
import { corpus } from '@/lib/corpus';
import { worldContent } from '@/lib/character/world-content';
import { rayHitsSphere } from '@/lib/character/input';
import { AFRO_LINES, AREA_ARRIVAL_LINES, CHASE_LINE, STATION_LINES } from '@/lib/character/narrative';
import { stubCanvas2d } from './canvas-stub';

// Real asset, real mixer, real areas, real scene/controller/tour/face/prop code. Only WebGL
// drawing, embedded image decoding and 2D canvas are replaced. This does not claim browser visual QA.
const capture = vi.hoisted(() => ({ scene: null as Scene | null, camera: null as PerspectiveCamera | null, renders: 0 }));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas');
    setPixelRatio() {} setClearColor() {} setSize() {} dispose() {} forceContextLoss() {}
    render(scene: Scene, camera: PerspectiveCamera) {
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      capture.scene = scene; capture.camera = camera; capture.renders += 1;
    }
  } };
});
vi.mock('three/addons/loaders/GLTFLoader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three/addons/loaders/GLTFLoader.js')>();
  const { Texture } = await import('three');
  return { ...actual, GLTFLoader: class extends actual.GLTFLoader {
    override async loadAsync() {
      this.register((parser) => ({ name: 'headless-textures', beforeRoot() { parser.loadTextureImage = async () => new Texture(); return null; } }));
      const data = readFileSync(resolve(process.cwd(), 'public/models/good-vibes-hero.glb'));
      const bytes = new ArrayBuffer(data.byteLength); new Uint8Array(bytes).set(data);
      return this.parseAsync(bytes, '');
    }
  } };
});

const content = worldContent(corpus);
let api: CharacterScene | undefined;
let host: HTMLDivElement;
let world: HTMLElement;
let wrapper: HTMLDivElement;
let now: number;
let width: number;
let height: number;
let scrollTop: number;
let rafId: number;
let frames: Map<number, FrameRequestCallback>;
let visibilityCallback: IntersectionObserverCallback;
let hidden = false;
const message = vi.fn();
const greeting = vi.fn();
const phase = vi.fn();
const sign = vi.fn();
/** Page layout in screens: the hero is one screen, every later lot's section two. */
const lotTop = (lot: number) => lot && 1 + (lot - 1) * 2;

beforeEach(() => {
  vi.resetModules();
  now = 100; rafId = 0; width = 1200; height = 800; scrollTop = 0; hidden = false;
  frames = new Map();
  capture.scene = null; capture.camera = null; capture.renders = 0;
  message.mockClear(); greeting.mockClear(); phase.mockClear(); sign.mockClear();
  sessionStorage.clear();
  document.body.innerHTML = `<div class="character-world">
    <div class="character-hero"><div id="scene-host"></div></div>
    ${LOTS.map(({ section }, lot) => `<section id="${section}">${lot === 0 ? '<button id="ui">UI</button>' : lot === 1 ? '<div id="panel" data-character-ui>Facts</div>' : ''}</section>`).join('')}
  </div>`;
  world = document.querySelector('.character-world')!;
  wrapper = document.querySelector('.character-hero')!;
  host = document.querySelector('#scene-host')!;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  const rect = (top: number, size: number) => ({ left: 0, top, right: width, bottom: top + size, width, height: size, x: 0, y: top, toJSON() {} });
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => rect(0, height));
  LOTS.forEach(({ section }, lot) => {
    vi.spyOn(document.getElementById(section)!, 'getBoundingClientRect').mockImplementation(() => rect(lotTop(lot) * height - scrollTop, (lot ? 2 : 1) * height));
  });
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  stubCanvas2d();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++rafId, callback); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { visibilityCallback = callback; } observe() {} disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { api?.dispose(); api = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function create() {
  const { createCharacterScene } = await import('@/components/character/create-character-scene');
  api = await createCharacterScene(host, { content, onMessage: message, onGreeting: greeting, onPhase: phase, onSign: sign, onError: vi.fn() });
  return api;
}
function advance(seconds: number) {
  for (let frame = 0; frame < Math.ceil(seconds * 30); frame += 1) {
    now += 1000 / 30 + .001;
    const pending = [...frames]; frames.clear();
    for (const [, callback] of pending) callback(now);
  }
}
function visible(value: boolean) {
  visibilityCallback([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver);
}
function scrollToLot(lot: number) { scrollTop = lotTop(lot) * height; window.dispatchEvent(new Event('scroll')); }
const screenOf = (point: Vector3) => { const ndc = point.clone().project(capture.camera!); return { x: (ndc.x + 1) * width / 2, y: (1 - ndc.y) * height / 2 }; };
function click({ x, y }: { x: number; y: number }, target: HTMLElement = world) {
  for (const kind of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(kind, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    target.dispatchEvent(event);
  }
}
const clickWorld = (x: number, z: number, target?: HTMLElement) => click(screenOf(new Vector3(x, 0, z)), target);
const mesh = (name: string) => capture.scene!.getObjectByName(name) as Mesh;
const position = () => host.dataset.position!.split(',').map(Number);
const afroTop = () => mesh('head').getWorldPosition(new Vector3()).add(new Vector3(0, .55, 0));
const until = (done: () => boolean, seconds = 60) => { for (let frame = 0; !done() && frame < seconds * 30; frame += 1) advance(1 / 30); };
/** Layout data from a throwaway copy of a lot; the scene builds its own. */
const layout = (build: AreaBuilder, lot = 0) => { const area = build(lotOrigin(lot), content); area.dispose(); return area; };
/** An open floor point across the room from him, near the open front edge where nothing is in the way. */
const openFloor = () => {
  const [x] = position();
  return { x: x > 0 ? x - 2.2 : x + 2.2, z: layout(createBedroom).entry.z - .3 };
};
/** A screen point the lot's own pick resolves to the station, clear of his afro. */
function stationPoint(id: string, build: AreaBuilder = createBedroom, lot = 0) {
  const origin = lotOrigin(lot);
  const area = build(origin.clone(), content);
  area.group.updateMatrixWorld(true);
  const reach = area.stations.find((station) => station.id === id)!.reach;
  const raycaster = new Raycaster();
  try {
    for (const [dx, dy] of [[0, 0], [0, .12], [0, -.12], [.12, 0], [-.12, 0], [0, .25], [0, -.25]]) {
      const screen = screenOf(new Vector3(reach.x + dx, reach.y + dy, reach.z).add(origin));
      raycaster.setFromCamera(new Vector2(screen.x / width * 2 - 1, 1 - screen.y / height * 2), capture.camera!);
      const afro = rayHitsSphere(raycaster.ray.origin, raycaster.ray.direction, { center: afroTop(), radius: .7 });
      if (!afro && area.pick(raycaster) === id) return screen;
    }
    throw new Error(`no clear screen point picks ${id}`);
  } finally { area.dispose(); }
}
/** The meshes of the shipped model, found by name prefix. */
const modelMesh = (prefix: string) => { let found: Mesh | undefined; capture.scene!.traverse((node) => { if (!found && (node as Mesh).isMesh && node.name.startsWith(prefix)) found = node as Mesh; }); return found!; };
const skinColor = (prefix: string) => (modelMesh(prefix).material as MeshStandardMaterial).color.clone();
const steamShowing = () => capture.scene!.children.filter((child) => (child as Sprite).isSprite && child.visible).length;
const morph = (name: string, target: string) => { const node = mesh(name); return node.morphTargetInfluences![node.morphTargetDictionary![target]]; };
/** Horizontal angle between where his body faces and the camera, in radians. */
function angleToCamera() {
  let actor: Object3D = mesh('head');
  while (actor.parent && actor.parent !== capture.scene) actor = actor.parent;
  const facing = new Vector3(0, 0, 1).applyQuaternion(actor.getWorldQuaternion(new Quaternion()));
  const toCamera = capture.camera!.position.clone().sub(actor.getWorldPosition(new Vector3()));
  const angle = Math.atan2(toCamera.x, toCamera.z) - Math.atan2(facing.x, facing.z);
  return Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
}

describe('shipped character world integration', () => {
  it('builds the seven lots along the street once and disposes every geometry the town created', async () => {
    await create(); advance(.1);
    const groups = capture.scene!.children.filter((child) => child.type === 'Group' && !child.getObjectByName('head'));
    const lots = groups.filter((group) => group.name !== 'street');
    expect(lots.map((lot) => lot.position.toArray())).toEqual(LOTS.map((_, lot) => lotOrigin(lot).toArray()));
    expect(groups.length).toBe(LOTS.length + 1);
    expect(host.dataset.area).toBe('home');
    const geometries = new Set<BufferGeometry>();
    for (const group of groups) group.traverse((node: Object3D) => { if ((node as Mesh).isMesh) geometries.add((node as Mesh).geometry); });
    expect(geometries.size).toBeGreaterThan(40);
    const disposed = new Set<BufferGeometry>();
    for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed.add(geometry));
    const renders = capture.renders;
    api!.dispose(); advance(2);
    expect(disposed.size).toBe(geometries.size);
    for (const lot of lots) expect(lot.parent).toBeNull();
    expect(capture.renders).toBe(renders);
    expect(host.querySelector('canvas')).toBeNull();
    expect(frames.size).toBe(0);
  });

  it('runs by active time and freezes during pause, hidden tab, and offscreen', async () => {
    await create();
    expect(phase).toHaveBeenLastCalledWith('opening');
    advance(1);
    const time = host.dataset.introTime;
    api!.setPaused(true); advance(12);
    expect(host.dataset.introTime).toBe(time);
    expect(host.dataset.paused).toBe('true');
    api!.setPaused(false); advance(1);
    expect(Number(host.dataset.introTime)).toBeGreaterThan(Number(time));
    visible(false); const offscreen = host.dataset.introTime; advance(12);
    expect(host.dataset.introTime).toBe(offscreen);
    visible(true); advance(.1);
    hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    const hiddenTime = host.dataset.introTime; advance(12);
    expect(host.dataset.introTime).toBe(hiddenTime);
    hidden = false; document.dispatchEvent(new Event('visibilitychange'));
    advance(12);
    expect(host.dataset.phase).toBe('roam');
    expect(wrapper.style.getPropertyValue('--intro-black')).toBe('0');
    expect(phase.mock.calls.map(([value]) => value)).toEqual(['opening', 'reveal', 'approach', 'bonk', 'recoil', 'recover', 'roam']);
  });

  it('applies real facial morphs after run mixer evaluation and resets them after speech', async () => {
    await create(); advance(3.8);
    expect(host.dataset.phase).toBe('approach');
    expect(host.dataset.motion).toBe('run');
    const mouths = ['cavity', 'teeth', 'tongue'].map((part) => mesh(`FACE2_mouth_${part}`));
    for (const mouth of mouths) {
      expect(mouth).toBeDefined();
      expect(mouth.morphTargetInfluences![mouth.morphTargetDictionary!.Talk]).toBeGreaterThan(.05);
      expect(mouth.morphTargetInfluences!.slice(5).some((value) => value > .01)).toBe(true);
    }
    let sawClosedEye = false;
    for (let index = 0; index < 65; index += 1) {
      advance(1 / 30);
      const eye = mesh('FACE2_eye_white_L');
      const values = eye.morphTargetInfluences!;
      const blink = Object.entries(eye.morphTargetDictionary!).find(([name]) => name.startsWith('Blink.'))![1];
      if (values[blink] > .9) { sawClosedEye = true; expect(values[eye.morphTargetDictionary!.HappyEyes]).toBeLessThan(.05); }
    }
    expect(sawClosedEye).toBe(true);
    api!.skipIntro(); advance(.5);
    for (const mouth of mouths) expect(mouth.morphTargetInfluences![mouth.morphTargetDictionary!.Talk]).toBeLessThan(.05);
  });

  it('moves him on a floor click, ignores UI and panel clicks, and a click cancels a live activity', async () => {
    await create(); api!.skipIntro(); advance(.1);
    const original = position();
    const floor = openFloor();
    clickWorld(floor.x, floor.z, document.querySelector<HTMLElement>('#ui')!); advance(.4);
    clickWorld(floor.x, floor.z, document.querySelector<HTMLElement>('#panel')!); advance(.4);
    expect(position()).toEqual(original);
    clickWorld(floor.x, floor.z); advance(.4);
    expect(position()).not.toEqual(original);
    expect(message).toHaveBeenCalledWith('On my way. Click another spot to change course.');
    until(() => host.dataset.activity !== 'idle');
    expect(host.dataset.activity, JSON.stringify({ dataset: { ...host.dataset }, messages: message.mock.calls })).not.toBe('idle');
    const [x] = position();
    clickWorld(x > 0 ? x - 1.5 : x + 1.5, openFloor().z); advance(1 / 30);
    expect(host.dataset.activity).toBe('idle');
  });

  it('answers an afro click with "Stop, don\'t do that." and stays put, even over the floor', async () => {
    await create(); api!.skipIntro(); advance(.5);
    const original = position();
    click(screenOf(afroTop())); advance(.5);
    expect(greeting).toHaveBeenCalledWith("Stop, don't do that.");
    expect(AFRO_LINES[0].line).toBe("Stop, don't do that.");
    expect(message).not.toHaveBeenCalledWith('On my way. Click another spot to change course.');
    expect(position()).toEqual(original);
    advance(2); click(screenOf(afroTop())); advance(.2);
    expect(greeting).toHaveBeenLastCalledWith(AFRO_LINES[1].line);
  });

  it('gets angrier with every afro poke, cools off after a quiet spell, then starts the lines over', async () => {
    await create(); api!.skipIntro(); advance(.5);
    const calm = { brow: morph('FACE2_brow_L', 'BrowSad'), arm: skinColor('Arm') };
    expect(host.dataset.anger).toBe('0');
    let brow = calm.brow;
    for (const [index, { line }] of AFRO_LINES.entries()) {
      click(screenOf(afroTop())); advance(.6);
      expect(greeting).toHaveBeenLastCalledWith(line);
      expect(host.dataset.anger).toBe(String(index + 1));
      expect(host.dataset.expression).toBe('angry');
      // Every level pulls his brows further down toward the nose.
      expect(morph('FACE2_brow_L', 'BrowSad')).toBeLessThan(brow - .1);
      brow = morph('FACE2_brow_L', 'BrowSad');
    }
    // The angriest level: narrowed eyes without the happy squint, a red face (not red arms) and steam.
    expect(morph('FACE2_eyelid_L', 'HappyEyes')).toBe(0);
    expect(morph('FACE2_eyelid_L', 'Blink.R')).toBeGreaterThan(.2); // The left eye mesh carries the rig's Blink.R.
    expect(skinColor('Head').g).toBeLessThan(skinColor('Arm').g - .1);
    expect(skinColor('Arm').equals(calm.arm)).toBe(true);
    expect(steamShowing()).toBeGreaterThan(0);
    advance(9); expect(host.dataset.anger).toBe('4');
    advance(7);
    expect(host.dataset.anger).toBe('0');
    expect(host.dataset.expression).not.toBe('angry');
    expect(morph('FACE2_brow_L', 'BrowSad')).toBeCloseTo(calm.brow, 2);
    expect(skinColor('Head').equals(calm.arm)).toBe(true);
    expect(steamShowing()).toBe(0);
    click(screenOf(afroTop())); advance(.3);
    expect(greeting).toHaveBeenLastCalledWith("Stop, don't do that.");
    expect(host.dataset.anger).toBe('1');
  });

  it('looks surprised, brows up and mouth round, when he bonks into furniture', async () => {
    await create(); api!.skipIntro(); advance(.5);
    // Straight through the toy box from where he stands.
    const [x, z] = position();
    const box = layout(createBedroom).obstacles.find((obstacle) => obstacle.id === 'toybox')!;
    const away = Math.hypot(box.x - x, box.z - z);
    clickWorld(box.x + (box.x - x) / away * .7, box.z + (box.z - z) / away * .7);
    until(() => host.dataset.bumps !== '0', 8);
    expect(host.dataset.bumps).not.toBe('0');
    expect(host.dataset.expression).toBe('surprised');
    advance(.3);
    expect(morph('FACE2_brow_L', 'BrowRaise')).toBeGreaterThan(.8);
    // Still rounded while his apology flaps the mouth; his resting grin has no O at all.
    expect(morph('FACE2_mouth_cavity', 'O')).toBeGreaterThan(.25);
  });

  it('turns his whole body to the camera while he speaks standing free, then back to his own heading', async () => {
    await create(); api!.skipIntro(); advance(.5);
    const floor = openFloor();
    clickWorld(floor.x, floor.z);
    until(() => message.mock.calls.some(([text]) => text === 'Click my things to see what I get up to.'), 10);
    advance(.5);
    const walkedHeading = angleToCamera();
    expect(walkedHeading).toBeGreaterThan(.6);
    click(screenOf(afroTop()));
    expect(greeting).toHaveBeenLastCalledWith("Stop, don't do that.");
    advance(1.5);
    expect(angleToCamera()).toBeLessThan(.05);
    until(() => greeting.mock.calls.at(-1)?.[0] === null, 10);
    advance(1.5);
    expect(angleToCamera()).toBeCloseTo(walkedHeading, 1);
  });

  it('Say hi waves, says hello right away and winks', async () => {
    await create(); api!.skipIntro(); advance(.5);
    api!.wave(); advance(.3);
    expect(greeting).toHaveBeenLastCalledWith('Hi, you see me? Do you see me? Oh, hello.');
    advance(.5);
    expect(host.dataset.expression).toBe('wink');
    expect(morph('FACE2_eyelid_L', 'Blink.R')).toBeGreaterThan(.8);
    expect(morph('FACE2_eyelid_R', 'Blink.L')).toBeLessThan(.5);
  });

  it('a station pick sends him to that station and starts its routine', async () => {
    await create(); api!.skipIntro(); advance(.1);
    click(stationPoint('printer')); advance(1 / 30);
    expect(host.dataset.station).toBe('printer');
    until(() => host.dataset.activity === 'perform', 30);
    expect(host.dataset.activity).toBe('perform');
    expect(host.dataset.station).toBe('printer');
  });

  it('walks along the street to the workshop when its section scrolls into view, ignoring clicks on the way, then walks back home', async () => {
    await create(); api!.skipIntro(); advance(.1);
    scrollToLot(2);
    const tours: string[] = [];
    const seen = new Set<string>();
    let clicked = false;
    for (let frame = 0; frame < 6 * 30; frame += 1) {
      advance(1 / 30);
      if (tours.at(-1) !== host.dataset.tour) tours.push(host.dataset.tour!);
      seen.add(host.dataset.area!);
      if (host.dataset.tour === 'travel' && !clicked) { clicked = true; click({ x: width / 2, y: height * .6 }); }
    }
    expect(tours).toEqual(['settled', 'travel', 'settled']);
    // He passes the hall without stopping there.
    expect([...seen]).toEqual(['home', 'workshop']);
    expect(message).not.toHaveBeenCalledWith('On my way. Click another spot to change course.');
    const { bounds } = layout(createLab, 2);
    const [x, z] = position();
    expect(x).toBeGreaterThanOrEqual(bounds.minX); expect(x).toBeLessThanOrEqual(bounds.maxX);
    expect(z).toBeGreaterThanOrEqual(bounds.minZ); expect(z).toBeLessThanOrEqual(bounds.maxZ);
    const lines = greeting.mock.calls.map(([line]) => line);
    expect(lines).toContain(CHASE_LINE.line);
    expect(lines).toContain(AREA_ARRIVAL_LINES.workshop.line);
    scrollToLot(0);
    const back: string[] = [];
    for (let frame = 0; frame < 5 * 30; frame += 1) { advance(1 / 30); if (back.at(-1) !== host.dataset.tour) back.push(host.dataset.tour!); }
    expect(back).toEqual(['settled', 'travel', 'settled']);
    expect(host.dataset.area).toBe('home');
  });

  it('runs past several lots in one trip on a fast scroll and stops only at the last', async () => {
    await create(); api!.skipIntro(); advance(.1);
    scrollToLot(1); advance(.2); scrollToLot(3); advance(.2); scrollToLot(5);
    const seen = new Set<string>();
    until(() => { seen.add(host.dataset.area!); return host.dataset.tour === 'settled' && host.dataset.area !== 'home'; }, 10);
    expect([...seen]).toEqual(['home', 'garage']);
    expect(greeting).toHaveBeenLastCalledWith(AREA_ARRIVAL_LINES.garage.line);
  });

  it('presents a project exhibit he is sent to, with its Visit sign, until a floor click or a scroll ends it', async () => {
    await create(); api!.skipIntro(); advance(.1);
    scrollToLot(2);
    until(() => host.dataset.area === 'workshop' && host.dataset.tour === 'settled', 10);
    const moodify = content.projects.find((project) => project.slug === 'moodify')!;
    const present = () => {
      click(stationPoint('project:moodify', createLab, 2));
      until(() => host.dataset.presenting === 'project:moodify', 20);
      expect(host.dataset.presenting).toBe('project:moodify');
    };
    present();
    expect(greeting).toHaveBeenLastCalledWith(STATION_LINES['project:moodify'][0].line);
    expect(host.dataset.station).toBe('project:moodify');
    const shown = sign.mock.calls.at(-1)![0];
    expect(shown).toMatchObject({ url: moodify.url, label: 'Visit Moodify' });
    expect(shown.x).toBeGreaterThan(0); expect(shown.x).toBeLessThan(width);
    expect(shown.y).toBeGreaterThan(0); expect(shown.y).toBeLessThan(height);
    advance(1.5);
    expect(angleToCamera()).toBeLessThan(.1);
    // Still presenting, sign up, long after the line is done.
    advance(8);
    expect(host.dataset.presenting).toBe('project:moodify');
    expect(sign).not.toHaveBeenLastCalledWith(null);
    const { entry } = layout(createLab, 2);
    clickWorld(lotOrigin(2).x + entry.x, entry.z); advance(1 / 30);
    expect(host.dataset.presenting).toBe('');
    expect(sign).toHaveBeenLastCalledWith(null);
    present();
    scrollToLot(3);
    until(() => host.dataset.tour === 'travel', 2);
    expect(host.dataset.presenting).toBe('');
    expect(sign).toHaveBeenLastCalledWith(null);
  });

  it('starts mid-page at the deep-linked lot without the intro', async () => {
    scrollTop = lotTop(4) * height;
    await create();
    expect(phase).toHaveBeenLastCalledWith('roam');
    expect(wrapper.style.getPropertyValue('--intro-black')).toBe('0');
    advance(.1);
    expect(host.dataset.area).toBe('gallery');
    expect(host.dataset.tour).toBe('settled');
  });

  it('does not move from hover, scroll, cancelled taps, or taps while paused', async () => {
    await create(); api!.skipIntro(); advance(.1);
    const original = position();
    world.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 800, clientY: 600 }));
    window.dispatchEvent(new Event('scroll'));
    advance(.3);
    expect(position()).toEqual(original);
    const down = new MouseEvent('pointerdown', { bubbles: true, clientX: 800, clientY: 600, button: 0 });
    Object.defineProperties(down, { pointerId: { value: 1 }, isPrimary: { value: true } });
    world.dispatchEvent(down); world.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    const up = new MouseEvent('pointerup', { bubbles: true, clientX: 800, clientY: 600, button: 0 });
    Object.defineProperties(up, { pointerId: { value: 1 }, isPrimary: { value: true } });
    world.dispatchEvent(up); advance(.3);
    expect(position()).toEqual(original);
    const floor = openFloor();
    api!.setPaused(true); clickWorld(floor.x, floor.z); advance(.3);
    api!.setPaused(false); advance(.1);
    expect(position()).toEqual(original);
    expect(message).not.toHaveBeenCalledWith('On my way. Click another spot to change course.');
  });

  it('can skip while paused without replaying cues and eases a cancelled ball back to its bedroom rest', async () => {
    await create(); advance(3.8);
    expect(greeting).toHaveBeenCalledWith('Hi hi hi hi');
    api!.setPaused(true); api!.skipIntro();
    expect(phase).toHaveBeenLastCalledWith('roam');
    expect(greeting).toHaveBeenLastCalledWith(null);
    expect(wrapper.style.getPropertyValue('--intro-black')).toBe('0');
    api!.skipIntro(); api!.setPaused(false);
    click(stationPoint('ball'));
    until(() => host.dataset.activity === 'toss-ball');
    expect(host.dataset.activity).toBe('toss-ball');
    advance(.35);
    const ball = capture.scene!.getObjectByName('activity-ball')!;
    const before = ball.position.clone();
    const [x] = position();
    clickWorld(x > 0 ? x - 1.5 : x + 1.5, openFloor().z);
    expect(ball.position.distanceTo(before)).toBe(0);
    advance(1 / 30);
    expect(host.dataset.activity).toBe('idle');
    expect(ball.position.distanceTo(before)).toBeLessThan(.01);
    advance(.8);
    const rest = layout(createBedroom).propRests!.ball;
    expect(ball.position.x).toBeCloseTo(rest.x); expect(ball.position.y).toBeCloseTo(rest.y); expect(ball.position.z).toBeCloseTo(rest.z);
    expect(greeting.mock.calls.filter(([line]) => line === 'Hi hi hi hi')).toHaveLength(1);
  });

  it('reads on the bed in a stable seated pose', async () => {
    await create(); api!.skipIntro(); advance(.1);
    click(stationPoint('bed'));
    until(() => host.dataset.activity === 'read');
    expect(host.dataset.activity).toBe('read');
    advance(.4);
    const hips = mesh('pelvis');
    const seated = hips.getWorldPosition(new Vector3());
    const seat = layout(createBedroom).stations.find((station) => station.id === 'bed')!.seat!;
    expect(seated.y).toBeGreaterThan(seat);
    advance(3);
    expect(host.dataset.activity).toBe('read');
    expect(hips.getWorldPosition(new Vector3()).distanceTo(seated)).toBeLessThan(.005);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageLoader, Quaternion, Raycaster, Texture, TextureLoader, Vector2, Vector3, type AnimationAction, type BufferGeometry, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera, type Scene, type Sprite } from 'three';
import type { CharacterScene } from '@/components/character/create-character-scene';
import { createBedroom } from '@/components/character/world/bedroom';
import { createLab } from '@/components/character/world/lab';
import type { AreaBuilder } from '@/components/character/world/types';
import { corpus } from '@/lib/corpus';
import { worldContent } from '@/lib/character/world-content';
import { CLIP_SPEED } from '@/lib/character/controller';
import { rayHitsSphere } from '@/lib/character/input';
import { INTRO_DIALOGUE } from '@/lib/character/intro';
import { AFRO_LINES, AREA_ARRIVAL_LINES, CHASE_LINE } from '@/lib/character/narrative';
import { stubCanvas2d } from './canvas-stub';

// Real asset, real mixer, real areas, real scene/controller/tour/face/prop code. Only WebGL
// drawing, embedded image decoding and 2D canvas are replaced. This does not claim browser visual QA.
const capture = vi.hoisted(() => ({ scene: null as Scene | null, camera: null as PerspectiveCamera | null, renders: 0, actions: new Map<string, AnimationAction>() }));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas');
    setPixelRatio() {} setClearColor() {} setSize() {} dispose() {} forceContextLoss() {}
    render(scene: Scene, camera: PerspectiveCamera) {
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      capture.scene = scene; capture.camera = camera; capture.renders += 1;
    }
  }, AnimationMixer: class extends actual.AnimationMixer {
    // The scene's clip actions, by clip name, so tests can read their weights and time scales.
    override clipAction(...args: Parameters<InstanceType<typeof actual.AnimationMixer>['clipAction']>): AnimationAction {
      const action = super.clipAction(...args)!;
      capture.actions.set(action.getClip().name, action);
      return action;
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
/** The lab exhibit the presentation tests send him to: a project with a page to visit. */
const project = content.projects.find(({ url }) => url)!;
const exhibit = `project:${project.slug}`;
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
const askPromoted = vi.fn();

beforeEach(() => {
  vi.resetModules();
  now = 100; rafId = 0; width = 1200; height = 800; scrollTop = 0; hidden = false;
  frames = new Map();
  capture.scene = null; capture.camera = null; capture.renders = 0; capture.actions.clear();
  message.mockClear(); greeting.mockClear(); phase.mockClear(); sign.mockClear(); askPromoted.mockReset();
  sessionStorage.clear();
  document.body.innerHTML = `<div class="character-world">
    <div class="character-hero"><div id="scene-host"></div></div>
    <section id="hero"><button id="ui">UI</button></section>
    <section id="lab"><div id="panel" data-character-ui>Lab panel</div></section>
    <section id="about"></section>
  </div>`;
  world = document.querySelector('.character-world')!;
  wrapper = document.querySelector('.character-hero')!;
  host = document.querySelector('#scene-host')!;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  const rect = (top: number, size: number) => ({ left: 0, top, right: width, bottom: top + size, width, height: size, x: 0, y: top, toJSON() {} });
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => rect(0, height));
  // Page layout: hero one screen, lab and about two screens each, measured relative to the viewport.
  for (const [id, top, size] of [['hero', 0, 1], ['lab', 1, 2], ['about', 3, 2]] as const) {
    vi.spyOn(document.getElementById(id)!, 'getBoundingClientRect').mockImplementation(() => rect(top * height - scrollTop, size * height));
  }
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  stubCanvas2d();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++rafId, callback); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { visibilityCallback = callback; } observe() {} disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { api?.dispose(); api = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function create() {
  // Imported per test: vi.resetModules and vi.doMock swap the scene's modules between tests.
  const { createCharacterScene } = await import('@/components/character/create-character-scene');
  api = await createCharacterScene(host, { content, onMessage: message, onGreeting: greeting, onPhase: phase, onSign: sign, onAskPromoted: askPromoted, onError: vi.fn() });
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
function scrollTo(screens: number) { scrollTop = screens * height; window.dispatchEvent(new Event('scroll')); }
const screenOf = (point: Vector3) => { const ndc = point.clone().project(capture.camera!); return { x: (ndc.x + 1) * width / 2, y: (1 - ndc.y) * height / 2 }; };
function click({ x, y }: { x: number; y: number }, target: HTMLElement = world) {
  for (const kind of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(kind, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    target.dispatchEvent(event);
  }
}
/** Clicks an area-local floor point; areas stack 18 units apart on y. */
const clickWorld = (x: number, z: number, target?: HTMLElement, y = 0) => click(screenOf(new Vector3(x, y, z)), target);
const mesh = (name: string) => capture.scene!.getObjectByName(name) as Mesh;
const position = () => host.dataset.position!.split(',').map(Number);
const afroTop = () => mesh('head').getWorldPosition(new Vector3()).add(new Vector3(0, .55, 0));
const until = (done: () => boolean, seconds = 60) => { for (let frame = 0; !done() && frame < seconds * 30; frame += 1) advance(1 / 30); };
/** Layout data from a throwaway copy of an area; the scene builds its own. */
const layout = (build: AreaBuilder, y = 0) => { const area = build(new Vector3(0, y, 0), content); area.dispose(); return area; };
/** Depth of a floor line near the bedroom's open front edge, where nothing is in the way. */
const frontZ = () => layout(createBedroom).exit.z - .3;
/** An open floor point across the room from him, near the open front edge. */
const openFloor = () => {
  const [x] = position();
  return { x: x > 0 ? x - 2.2 : x + 2.2, z: frontZ() };
};
/** Walks him to the bedroom's clear centre line at the front, so a straight run across the room is open. */
function toFront() {
  clickWorld(layout(createBedroom).view.center.x, frontZ());
  until(() => message.mock.calls.at(-1)?.[0] === 'Click my things to see what I get up to.', 10);
  advance(.5);
}
/** A clear floor point straight through the nearest bedroom furniture that is not right beside him, so he walks into it. */
function throughFurniture() {
  const [x, z] = position();
  const { obstacles, bounds } = layout(createBedroom);
  const open = ({ x: px, z: pz }: { x: number; z: number }) => px > bounds.minX + .3 && px < bounds.maxX - .3 && pz > bounds.minZ + .3 && pz < bounds.maxZ - .3
    && obstacles.every((obstacle) => Math.hypot(px - obstacle.x, pz - obstacle.z) > obstacle.radius + .3);
  const aims = obstacles.map((obstacle) => {
    const away = Math.hypot(obstacle.x - x, obstacle.z - z), reach = obstacle.radius + .5;
    return { away, point: { x: obstacle.x + (obstacle.x - x) / away * reach, z: obstacle.z + (obstacle.z - z) / away * reach } };
  }).filter(({ away, point }) => away > .8 && open(point)).sort((a, b) => a.away - b.away);
  return aims[0].point;
}
/** A screen point the bedroom's own pick resolves to the station, clear of his afro. */
function stationPoint(id: string) {
  const bedroom = createBedroom(new Vector3(), content);
  bedroom.group.updateMatrixWorld(true);
  const reach = bedroom.stations.find((station) => station.id === id)!.reach;
  const raycaster = new Raycaster();
  try {
    for (const [dx, dy] of [[0, 0], [0, .12], [0, -.12], [.12, 0], [-.12, 0], [0, .25], [0, -.25]]) {
      const screen = screenOf(new Vector3(reach.x + dx, reach.y + dy, reach.z));
      raycaster.setFromCamera(new Vector2(screen.x / width * 2 - 1, 1 - screen.y / height * 2), capture.camera!);
      const afro = rayHitsSphere(raycaster.ray.origin, raycaster.ray.direction, { center: afroTop(), radius: .7 });
      if (!afro && bedroom.pick(raycaster) === id) return screen;
    }
    throw new Error(`no clear screen point picks ${id}`);
  } finally { bedroom.dispose(); }
}
/** The meshes of the shipped model, found by name prefix. */
const modelMesh = (prefix: string) => { let found: Mesh | undefined; capture.scene!.traverse((node) => { if (!found && (node as Mesh).isMesh && node.name.startsWith(prefix)) found = node as Mesh; }); return found!; };
const skinColor = (prefix: string) => (modelMesh(prefix).material as MeshStandardMaterial).color.clone();
const steamShowing = () => capture.scene!.children.filter((child) => (child as Sprite).isSprite && child.visible).length;
const morph = (name: string, target: string) => { const node = mesh(name); return node.morphTargetInfluences![node.morphTargetDictionary![target]]; };
/** The group that carries him: travel, heading, lean and lift. */
function actorOf() {
  let actor: Object3D = mesh('head');
  while (actor.parent && actor.parent !== capture.scene) actor = actor.parent;
  return actor;
}
const yawOf = (object: Object3D) => { const facing = new Vector3(0, 0, 1).applyQuaternion(object.getWorldQuaternion(new Quaternion())); return Math.atan2(facing.x, facing.z); };
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
/** Horizontal angle between where his body faces and the camera, in radians. */
function angleToCamera() {
  const actor = actorOf();
  const toCamera = capture.camera!.position.clone().sub(actor.getWorldPosition(new Vector3()));
  return Math.abs(wrap(Math.atan2(toCamera.x, toCamera.z) - yawOf(actor)));
}
const CLIPS = { idle: '01_Idle_Breathe', walk: '06_Walk_InPlace', run: '07_Run_InPlace', wave: '02_Wave_Hello', sit: '08_Sit_Relaxed' } as const;
type Clip = keyof typeof CLIPS;
/** Each clip's share of the pose this frame; a clip the mixer is not running counts as zero. */
const weights = () => Object.fromEntries(Object.entries(CLIPS).map(([clip, name]) => {
  const action = capture.actions.get(name);
  return [clip, action?.isScheduled() ? action.getEffectiveWeight() : 0];
})) as Record<Clip, number>;
/** One rendered frame of his motion: where he is, whether the camera sees him, how the clips are mixed, and how fast the walk and run clips play. */
type Motion = { at: Vector3; visible: boolean; weights: Record<Clip, number>; walk: number; run: number; phase: string; tour: string; activity: string };
function motion(): Motion {
  const at = actorOf().getWorldPosition(new Vector3());
  const chest = at.clone().setY(at.y + 1.2).project(capture.camera!);
  return {
    at, visible: Math.abs(chest.x) <= 1 && Math.abs(chest.y) <= 1, weights: weights(),
    walk: capture.actions.get(CLIPS.walk)!.getEffectiveTimeScale(), run: capture.actions.get(CLIPS.run)!.getEffectiveTimeScale(),
    phase: host.dataset.phase!, tour: host.dataset.tour!, activity: host.dataset.activity!,
  };
}
/** Steps one 30 Hz frame at a time and samples after each. */
function record<T>(seconds: number, sample: () => T, done: () => boolean = () => false) {
  const samples: T[] = [];
  for (let frame = 0; frame < seconds * 30 && !done(); frame += 1) { advance(1 / 30); samples.push(sample()); }
  return samples;
}
const groundSpeed = (from: Vector3, to: Vector3) => Math.hypot(to.x - from.x, to.z - from.z) * 30;
/**
 * Frames where one locomotion clip carries the pose at a steady speed while the camera
 * sees him: how far its feet push per second (time scale times the clip's measured ground
 * speed) against how fast he really moved. Zero means no foot slide.
 */
function glides(samples: Motion[]) {
  const slides: { clip: 'walk' | 'run'; slide: number }[] = [];
  for (let index = 2; index < samples.length; index += 1) {
    const speed = groundSpeed(samples[index - 1].at, samples[index].at), before = groundSpeed(samples[index - 2].at, samples[index - 1].at);
    const clip = samples[index].weights.run > .95 ? 'run' : samples[index].weights.walk > .95 ? 'walk' : null;
    if (!clip || !samples[index].visible || speed < .3 || Math.abs(speed - before) > speed * .1) continue;
    slides.push({ clip, slide: Math.abs(samples[index][clip] * CLIP_SPEED[clip] - speed) / speed });
  }
  return slides;
}

describe('shipped character world integration', () => {
  it('builds the bedroom, lab and about areas once and disposes every geometry they created', async () => {
    await create(); advance(.1);
    const areas = capture.scene!.children.filter((child) => child.type === 'Group' && !child.getObjectByName('head'));
    expect(areas.map((area) => area.position.y)).toEqual([0, -18, -36]);
    expect(host.dataset.area).toBe('bedroom');
    const geometries = new Set<BufferGeometry>();
    for (const area of areas) area.traverse((node: Object3D) => { if ((node as Mesh).isMesh) geometries.add((node as Mesh).geometry); });
    expect(geometries.size).toBeGreaterThan(30);
    const disposed = new Set<BufferGeometry>();
    for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed.add(geometry));
    const renders = capture.renders;
    api!.dispose(); advance(2);
    expect(disposed.size).toBe(geometries.size);
    for (const area of areas) expect(area.parent).toBeNull();
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
    expect(phase.mock.calls.map(([value]) => value)).toEqual(['opening', 'approach', 'bonk', 'recoil', 'recover', 'point', 'roam']);
  });

  it('draws room pictures, icons and logos that land while he is held paused, in one frame', async () => {
    // A shared /#lab link shows the room frozen behind Click to enter; images arriving after that first frame must still appear.
    const lands: (() => void)[] = [];
    vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const texture = new Texture({ width: 64, height: 64 } as HTMLImageElement);
      lands.push(() => onLoad?.(texture));
      return texture;
    });
    vi.spyOn(ImageLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
      const image = document.createElement('img');
      lands.push(() => onLoad?.(image));
      return image;
    });
    await create(); api!.setPaused(true); advance(1);
    expect(lands.length).toBeGreaterThan(10);
    const frozen = capture.renders;
    lands.forEach((land) => land());
    advance(1);
    expect(capture.renders).toBe(frozen + 1);
    expect(host.dataset.paused).toBe('true');
  });

  it('applies real facial morphs after locomotion mixer evaluation and resets them after speech', async () => {
    // Just into the run-up, while "Hi hi hi hi" still flaps his mouth.
    await create(); advance(.7);
    expect(host.dataset.phase).toBe('approach');
    expect(host.dataset.motion).toMatch(/^(walk|run)$/);
    const mouths = ['cavity', 'teeth', 'tongue'].map((part) => mesh(`FACE2_mouth_${part}`));
    for (const mouth of mouths) {
      expect(mouth).toBeDefined();
      expect(mouth.morphTargetInfluences![mouth.morphTargetDictionary!.Talk]).toBeGreaterThan(.05);
      expect(mouth.morphTargetInfluences!.slice(5).some((value) => value > .01)).toBe(true);
    }
    let sawClosedEye = false;
    // Blinks come every 3 to 6 seconds.
    for (let index = 0; index < 200; index += 1) {
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
    clickWorld(x > 0 ? x - 1.5 : x + 1.5, frontZ()); advance(1 / 30);
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
    const through = throughFurniture();
    clickWorld(through.x, through.z);
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
    // Across the room along the front, so he ends up side-on to the camera.
    toFront();
    const floor = openFloor();
    message.mockClear();
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
    click(stationPoint('desk')); advance(1 / 30);
    expect(host.dataset.station).toBe('desk');
    until(() => host.dataset.activity === 'perform', 30);
    expect(host.dataset.activity).toBe('perform');
    expect(host.dataset.station).toBe('desk');
    expect(host.dataset.presenting).toBe('');
  });

  it('follows a scroll to the lab: runs to the exit, trips there, falls onto the lab landing, ignores clicks on the way, takes a queued Show me, then jumps back up', async () => {
    await create(); api!.skipIntro(); advance(.1);
    const { exit } = layout(createBedroom), lab = layout(createLab, -18);
    scrollTo(1);
    // A Show me pressed while he is still upstairs waits until he has landed in the lab.
    api!.visit(exhibit);
    const phases: string[] = [];
    const chase: Motion[] = [];
    let tripped: number[] = [], landed: number[] = [];
    until(() => {
      const tour = host.dataset.tour!;
      if (phases.at(-1) !== tour) {
        phases.push(tour);
        if (tour === 'trip') tripped = position();
        if (tour === 'land') landed = position();
        // Clicks mid-flight go nowhere.
        if (tour === 'chase' || tour === 'trip') click({ x: width / 2, y: height * .6 });
      }
      if (tour === 'chase') chase.push(motion());
      return phases.length === 7;
    }, 20);
    expect(phases).toEqual(['settled', 'chase', 'trip', 'fall', 'land', 'recover', 'settled']);
    expect(message).not.toHaveBeenCalledWith('On my way. Click another spot to change course.');
    // The chase lasts as long as his run to the exit takes, and the trip starts there.
    expect(Math.hypot(tripped[0] - exit.x, tripped[1] - exit.z)).toBeLessThan(.2);
    // The camera heads down to the lab as he runs, so every steady frame counts, seen or not.
    const strides = glides(chase.map((sample) => ({ ...sample, visible: true })));
    expect(strides.length).toBeGreaterThan(5);
    for (const { slide } of strides) expect(slide).toBeLessThan(.15);
    expect(landed[0]).toBeCloseTo(lab.landing.x, 1); expect(landed[1]).toBeCloseTo(lab.landing.z, 1);
    expect(host.dataset.area).toBe('lab');
    const { bounds } = lab;
    const [x, z] = position();
    expect(x).toBeGreaterThanOrEqual(bounds.minX); expect(x).toBeLessThanOrEqual(bounds.maxX);
    expect(z).toBeGreaterThanOrEqual(bounds.minZ); expect(z).toBeLessThanOrEqual(bounds.maxZ);
    const lines = greeting.mock.calls.map(([line]) => line);
    expect(lines).toContain(CHASE_LINE.line);
    expect(lines).toContain(AREA_ARRIVAL_LINES.lab.line);
    until(() => host.dataset.station === exhibit, 5);
    expect(host.dataset.station).toBe(exhibit);
    scrollTo(0);
    const back: string[] = [];
    until(() => { if (back.at(-1) !== host.dataset.tour) back.push(host.dataset.tour!); return back.length === 5; }, 10);
    expect(back).toEqual(['settled', 'jump', 'land', 'recover', 'settled']);
    expect(host.dataset.area).toBe('bedroom');
  });

  it('presents a project exhibit a Show me sends him to: its lines to the camera, a Visit sign, and the room told throughout, until a floor click, Escape or a scroll ends it', async () => {
    const updates: { stationId: string | null; progress: number }[] = [];
    vi.doMock('@/components/character/world/lab', async (importOriginal) => {
      const { createLab: build } = await importOriginal<{ createLab: AreaBuilder }>();
      return { createLab: (...args: Parameters<AreaBuilder>) => {
        const area = build(...args);
        const update = area.update;
        area.update = (dt, elapsed, activity) => { updates.push({ ...activity }); update(dt, elapsed, activity); };
        return area;
      } };
    });
    try {
      // A deep link to the lab starts him there.
      scrollTop = height;
      await create(); advance(.1);
      expect(host.dataset.area).toBe('lab');
      const lab = layout(createLab, -18);
      const { present } = lab.stations.find((station) => station.id === exhibit)!;
      const show = () => {
        api!.visit(exhibit);
        until(() => host.dataset.presenting === exhibit, 20);
        expect(host.dataset.presenting).toBe(exhibit);
      };
      show();
      expect(greeting).toHaveBeenLastCalledWith(present!.lines[0].line);
      expect(host.dataset.station).toBe(exhibit);
      const shown = sign.mock.calls.at(-1)![0];
      expect(shown).toMatchObject({ url: present!.url, label: present!.linkLabel ?? 'Visit' });
      expect(shown.x).toBeGreaterThan(0); expect(shown.x).toBeLessThan(width);
      expect(shown.y).toBeGreaterThan(0); expect(shown.y).toBeLessThan(height);
      updates.length = 0;
      advance(1.5);
      expect(angleToCamera()).toBeLessThan(.1);
      // Every line in order, then still presenting, sign up, long after the last one.
      advance(present!.lines.length * 6);
      expect(greeting.mock.calls.map(([line]) => line).filter((line) => present!.lines.some((each) => each.line === line))).toEqual(present!.lines.map(({ line }) => line));
      expect(host.dataset.presenting).toBe(exhibit);
      expect(sign).not.toHaveBeenLastCalledWith(null);
      expect(updates.every(({ stationId }) => stationId === exhibit)).toBe(true);
      updates.forEach(({ progress }, index) => { if (index) expect(progress).toBeGreaterThanOrEqual(updates[index - 1].progress); });
      expect(updates.at(-1)!.progress).toBe(1);
      clickWorld(lab.exit.x, lab.exit.z, undefined, -18); advance(1 / 30);
      expect(host.dataset.presenting).toBe('');
      expect(sign).toHaveBeenLastCalledWith(null);
      expect(updates.at(-1)!.stationId).toBeNull();
      show();
      api!.key('Escape'); advance(1 / 30);
      expect(host.dataset.presenting).toBe('');
      expect(sign).toHaveBeenLastCalledWith(null);
      show();
      scrollTo(3);
      until(() => host.dataset.tour === 'chase', 2);
      expect(host.dataset.presenting).toBe('');
      expect(sign).toHaveBeenLastCalledWith(null);
    } finally { vi.doUnmock('@/components/character/world/lab'); }
  });

  it('starts mid-page in the viewed area without the intro', async () => {
    scrollTop = 3 * height;
    await create();
    expect(phase).toHaveBeenLastCalledWith('roam');
    expect(wrapper.style.getPropertyValue('--intro-black')).toBe('0');
    advance(.1);
    expect(host.dataset.area).toBe('about');
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
    await create(); advance(1.5);
    expect(greeting).toHaveBeenCalledWith('Hi hi hi hi');
    api!.setPaused(true); api!.skipIntro();
    expect(phase).toHaveBeenLastCalledWith('roam');
    expect(greeting).toHaveBeenLastCalledWith(null);
    expect(wrapper.style.getPropertyValue('--intro-black')).toBe('0');
    api!.skipIntro(); api!.setPaused(false);
    api!.visit('ball');
    until(() => host.dataset.activity === 'toss-ball');
    expect(host.dataset.activity).toBe('toss-ball');
    advance(.35);
    const ball = capture.scene!.getObjectByName('activity-ball')!;
    const before = ball.position.clone();
    const [x] = position();
    clickWorld(x > 0 ? x - 1.5 : x + 1.5, frontZ());
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
    api!.visit('bed');
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

const bone = (name: string) => capture.scene!.getObjectByName(name)!;
/** A joint in his own space: travel, heading and lift taken out. */
const inActor = (name: string) => actorOf().worldToLocal(bone(name).getWorldPosition(new Vector3()));

describe('his motion', () => {
  it('plays the walk and run as fast as he really moves, so his feet do not slide', async () => {
    await create(); api!.skipIntro(); advance(.5);
    toFront();
    const [x, z] = position();
    // A long trip runs; a short one walks.
    clickWorld(x > 0 ? x - 3.4 : x + 3.4, z);
    const samples = record(5, motion);
    const [after, depth] = position();
    clickWorld(after > 0 ? after - .9 : after + .9, depth);
    samples.push(...record(4, motion));
    const slides = glides(samples);
    expect(slides.filter(({ clip }) => clip === 'run').length).toBeGreaterThan(5);
    expect(slides.filter(({ clip }) => clip === 'walk').length).toBeGreaterThan(5);
    for (const { slide } of slides) expect(slide).toBeLessThan(.15);
  });

  it('runs at the lens with his feet keeping up with the ground', async () => {
    await create();
    const samples = record(6, motion, () => host.dataset.phase === 'bonk');
    const slides = glides(samples.filter((sample) => sample.phase === 'approach'));
    expect(slides.length).toBeGreaterThan(20);
    for (const { slide } of slides) expect(slide).toBeLessThan(.15);
  });

  it('renders on a steady beat on 60 and 120 Hz displays, even with timestamp jitter', async () => {
    await create(); api!.skipIntro(); advance(.5);
    for (const hz of [60, 120]) {
      const gaps = new Set<number>();
      let last = -1;
      for (let vsync = 0; vsync < 240; vsync += 1) {
        now += 1000 / hz + Math.sin(vsync * 12.9898) * .3;
        const renders = capture.renders;
        const pending = [...frames]; frames.clear();
        for (const [, callback] of pending) callback(now);
        if (capture.renders === renders) continue;
        if (last >= 0) gaps.add(vsync - last);
        last = vsync;
      }
      expect([...gaps]).toEqual([hz === 60 ? 1 : 2]);
    }
  });

  it('crossfades clips with eased weights that always add up to one, through a run start, a slow-down, a stop and a reversal', async () => {
    await create(); api!.skipIntro(); advance(.5);
    toFront();
    const [x, z] = position();
    const ahead = x > 0 ? -1 : 1;
    clickWorld(x + ahead * 3.4, z);
    const samples = record(.9, weights);
    const [running, depth] = position();
    clickWorld(running + ahead * .8, depth);
    samples.push(...record(2.5, weights));
    clickWorld(running - ahead * 2.5, depth);
    samples.push(...record(2.5, weights));
    expect(samples.some((sample) => sample.run > .99)).toBe(true);
    expect(samples.some((sample) => sample.walk > .99)).toBe(true);
    const step = 1 / 30 / .22 + .01;
    samples.forEach((sample, index) => {
      expect(Object.values(sample).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 2);
      if (index) for (const clip of Object.keys(CLIPS) as Clip[]) expect(Math.abs(sample[clip] - samples[index - 1][clip])).toBeLessThan(step);
    });
  });

  it('keeps walking or running through a bump and eases the jolt in and out', async () => {
    await create(); api!.skipIntro(); advance(.5);
    const through = throughFurniture();
    clickWorld(through.x, through.z);
    const samples = record(6, () => ({ height: actorOf().position.y, weights: weights(), motion: host.dataset.motion! }));
    const bumping = samples.filter((sample) => sample.motion === 'bump');
    expect(bumping.length).toBeGreaterThan(3);
    for (const sample of bumping) expect(sample.weights.idle).toBeLessThan(.5);
    samples.slice(1).forEach((sample, index) => expect(Math.abs(sample.height - samples[index].height)).toBeLessThan(.015));
  });

  it('eases his idle bob in and out, so starting and stopping never twitch his height', async () => {
    await create(); api!.skipIntro(); advance(.5);
    toFront(); advance(3.5);
    const [x, z] = position();
    const ahead = x > 0 ? -1 : 1;
    clickWorld(x + ahead * 2, z);
    const heights = record(5, () => actorOf().position.y);
    clickWorld(x, z);
    heights.push(...record(5, () => actorOf().position.y));
    expect(host.dataset.bumps).toBe('0');
    heights.slice(1).forEach((height, index) => expect(Math.abs(height - heights[index])).toBeLessThan(.005));
  });

  it('turns to face the bed at a steady pace once he gets there, not in a whip', async () => {
    await create(); api!.skipIntro(); advance(.5);
    const { stand } = layout(createBedroom).stations.find((station) => station.id === 'bed')!;
    click(stationPoint('bed'));
    const samples = record(20, () => ({ yaw: yawOf(actorOf()), at: actorOf().getWorldPosition(new Vector3()) }), () => host.dataset.activity === 'pickup-book');
    let turning = 0;
    for (let index = 1; index < samples.length; index += 1) {
      const { at, yaw } = samples[index];
      // At the stand point (inside the station's arrival radius), standing still.
      if (Math.hypot(at.x - stand.x, at.z - stand.z) > .13 || groundSpeed(samples[index - 1].at, at) > .05) continue;
      const rate = Math.abs(wrap(yaw - samples[index - 1].yaw)) * 30;
      if (rate > .01) turning += 1;
      expect(rate).toBeLessThan(4.5);
    }
    expect(turning).toBeGreaterThan(2);
  });

  it('guards his afro with bent elbows and hands on its sides, raised and lowered gently', async () => {
    await create(); api!.skipIntro(); advance(.5);
    click(screenOf(afroTop()));
    const joints = ['L', 'R'].map((side) => ({ shoulder: `upper_arm${side}`, elbow: `forearm${side}`, hand: `hand${side}` }));
    const samples = record(2.3, () => joints.map(({ shoulder, elbow, hand }) => ({ shoulder: inActor(shoulder), elbow: inActor(elbow), hand: inActor(hand) })));
    expect(greeting).toHaveBeenCalledWith("Stop, don't do that.");
    samples.slice(1).forEach((arms, index) => arms.forEach(({ hand }, side) => expect(hand.distanceTo(samples[index][side].hand) * 30).toBeLessThan(3)));
    // Mid-guard: hands up by the afro, out past the shoulders, elbows bent.
    for (const { shoulder, elbow, hand } of samples[30]) {
      const length = shoulder.distanceTo(elbow) + elbow.distanceTo(hand);
      expect(shoulder.distanceTo(hand)).toBeLessThan(.92 * length);
      expect(elbow.clone().sub(shoulder).angleTo(hand.clone().sub(elbow))).toBeGreaterThan(.35);
      expect(hand.y).toBeGreaterThan(shoulder.y);
      expect(Math.abs(hand.x)).toBeGreaterThan(Math.abs(shoulder.x));
    }
  });

  it('reaches for the book and puts it back with unhurried hands', async () => {
    await create(); api!.skipIntro(); advance(.5);
    click(stationPoint('bed'));
    let returned = false;
    const samples = record(30, () => ({ activity: host.dataset.activity!, hands: ['handL', 'handR'].map(inActor) }), () => {
      returned ||= host.dataset.activity === 'return-book';
      return returned && host.dataset.activity !== 'return-book';
    });
    samples.push(...record(.6, () => ({ activity: 'released', hands: ['handL', 'handR'].map(inActor) })));
    const handled = samples.map((sample, index) => ({ ...sample, index })).filter(({ activity }) => ['pickup-book', 'return-book', 'released'].includes(activity));
    expect(handled.length).toBeGreaterThan(50);
    for (const { index, hands } of handled) hands.forEach((hand, side) => expect(hand.distanceTo(samples[index - 1].hands[side]) * 30).toBeLessThan(3));
  });

  it('lowers him onto a low seat: his feet stay down until his hips reach it', async () => {
    // The islands' seats sit at about 0.3 to 0.35, below his 0.59 hip.
    const seat = .33;
    vi.doMock('@/components/character/world/bedroom', async (importOriginal) => {
      const { createBedroom: build } = await importOriginal<{ createBedroom: AreaBuilder }>();
      return { createBedroom: (...args: Parameters<AreaBuilder>) => {
        const area = build(...args);
        for (const station of area.stations) if (station.seat !== undefined) station.seat = seat;
        return area;
      } };
    });
    try {
      await create(); api!.skipIntro(); advance(.5);
      api!.visit('desk');
      const samples = record(20, () => ({ activity: host.dataset.activity!, lift: actorOf().position.y, hips: bone('pelvis').getWorldPosition(new Vector3()).y }), () => host.dataset.activity === 'perform');
      const sitting = samples.filter(({ activity }) => activity === 'sit');
      expect(sitting.length).toBeGreaterThan(20);
      // The seat contact sits 0.13 below the pelvis bone.
      for (const { hips, lift } of sitting) if (hips > seat + .13 + .01) expect(lift).toBeLessThan(.005);
      expect(samples.at(-1)!.hips).toBeCloseTo(seat + .13, 1);
    } finally { vi.doUnmock('@/components/character/world/bedroom'); }
  });

  it('opens on a close dead-on shot he runs into through the back door, then dollies straight back to the bedroom camera without a cut', async () => {
    await create();
    const { bounds } = layout(createBedroom);
    const door = capture.scene!.getObjectByName('back-door')!;
    let roaming = 0;
    const samples = record(20, () => ({
      phase: host.dataset.phase!, at: actorOf().getWorldPosition(new Vector3()), door: door.rotation.y,
      camera: capture.camera!.position.clone(), forward: capture.camera!.getWorldDirection(new Vector3()),
    }), () => (roaming += +(host.dataset.phase === 'roam')) > 30);
    // He starts out behind the back wall, and the door swings open for him and shuts behind him.
    expect(samples[0].at.z).toBeLessThan(bounds.minZ);
    expect(Math.max(...samples.map((sample) => sample.door))).toBeGreaterThan(1);
    expect(samples.find((sample) => sample.phase === 'bonk')!.door).toBe(0);
    expect(samples.at(-1)!.phase).toBe('roam');
    // The bonk shakes the camera; outside it he only gets closer until he hits the lens, and only further after.
    const steady = samples.map((sample, index) => ({ ...sample, index })).filter(({ phase: name }) => name !== 'bonk');
    // Along the floor, so the hop as he falls back does not count as coming closer.
    const distanceOf = ({ camera, at }: { camera: Vector3; at: Vector3 }) => Math.hypot(camera.x - at.x, camera.z - at.z);
    const closest = steady.reduce((best, sample) => distanceOf(sample) < distanceOf(best) ? sample : best).index;
    // He hits the lens between the last frame of the run and the first of the fall back.
    expect(['approach', 'recoil']).toContain(samples[closest].phase);
    samples.slice(1).forEach((sample, index) => {
      const before = samples[index];
      // No teleport, from the first frame through the hand-over to roaming.
      expect(sample.at.distanceTo(before.at)).toBeLessThan(.2);
      // The camera only ever pulls straight back along one unchanging view direction.
      expect(sample.camera.z).toBeGreaterThanOrEqual(before.camera.z - 1e-6);
      if (sample.phase === 'bonk' || before.phase === 'bonk') return;
      expect(sample.forward.angleTo(samples[0].forward)).toBeLessThan(Math.PI / 180);
      const distance = distanceOf(sample) - distanceOf(before);
      if (index + 1 <= closest) expect(distance).toBeLessThan(.01); else expect(distance).toBeGreaterThan(-.01);
    });
  });

  it('ends the intro pointing down at the Ask bar and promotes it once', async () => {
    await create();
    const phases: string[] = [];
    askPromoted.mockImplementation(() => { phases.push(phase.mock.calls.at(-1)![0]); });
    until(() => host.dataset.phase === 'point', 15);
    advance(1.2);
    expect(askPromoted).toHaveBeenCalledOnce();
    expect(phases).toEqual(['point']);
    expect(greeting).toHaveBeenLastCalledWith(INTRO_DIALOGUE.point.line);
    // One hand points forward and down, toward the bar at the bottom of the screen.
    const pointing = ['L', 'R'].map((side) => ({ shoulder: inActor(`upper_arm${side}`), hand: inActor(`hand${side}`) }))
      .filter(({ shoulder, hand }) => hand.z - shoulder.z > .25 && hand.y < shoulder.y - .1);
    expect(pointing).toHaveLength(1);
    until(() => host.dataset.phase === 'roam', 10);
    advance(5);
    expect(askPromoted).toHaveBeenCalledOnce();
  });

  it('never promotes the Ask bar when the intro is skipped', async () => {
    await create(); advance(1); api!.skipIntro(); advance(14);
    expect(askPromoted).not.toHaveBeenCalled();
  });

  it('promotes the Ask bar again when a remount before roaming replays the intro', async () => {
    await create();
    until(() => askPromoted.mock.calls.length === 1, 15);
    // Portrait and back mid-intro: a fresh scene on the same page plays the intro again.
    api!.dispose(); await create();
    until(() => askPromoted.mock.calls.length === 2, 15);
    expect(askPromoted).toHaveBeenCalledTimes(2);
  });
});

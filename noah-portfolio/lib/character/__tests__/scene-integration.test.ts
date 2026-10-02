import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3, type Mesh, type PerspectiveCamera, type Scene } from 'three';
import type { CharacterScene } from '@/components/character/create-character-scene';

// Real asset, real mixer, real scene/controller/face/prop code. Only WebGL and
// embedded image decoding are replaced. This does not claim browser visual QA.
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

let api: CharacterScene | undefined;
let host: HTMLDivElement;
let hero: HTMLElement;
let wrapper: HTMLDivElement;
let now: number;
let width: number;
let height: number;
let rafId: number;
let frames: Map<number, FrameRequestCallback>;
let visibilityCallback: IntersectionObserverCallback;
let resizeCallback: ResizeObserverCallback;
let hidden = false;
const message = vi.fn();
const greeting = vi.fn();
const phase = vi.fn();

beforeEach(() => {
  vi.resetModules();
  now = 100; rafId = 0; width = 1200; height = 800; hidden = false;
  frames = new Map();
  capture.scene = null; capture.camera = null; capture.renders = 0;
  message.mockClear(); greeting.mockClear(); phase.mockClear();
  sessionStorage.clear();
  document.body.innerHTML = '<section id="hero"><div class="character-hero"><div id="scene-host"></div></div><button id="ui">UI</button></section>';
  hero = document.querySelector('#hero')!;
  wrapper = document.querySelector('.character-hero')!;
  host = document.querySelector('#scene-host')!;
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON() {} }));
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++rafId, callback); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { visibilityCallback = callback; } observe() {} disconnect() {} });
  vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { resizeCallback = callback; } observe() {} disconnect() {} });
});
afterEach(() => { api?.dispose(); api = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function create() {
  const { createCharacterScene } = await import('@/components/character/create-character-scene');
  api = await createCharacterScene(host, { onMessage: message, onGreeting: greeting, onPhase: phase, onError: vi.fn() });
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
function clickWorld(x: number, z: number, target: HTMLElement = hero) {
  const point = new Vector3(x, 0, z).project(capture.camera!);
  const init = { bubbles: true, clientX: (point.x + 1) * width / 2, clientY: (1 - point.y) * height / 2, button: 0 };
  for (const kind of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(kind, init);
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    target.dispatchEvent(event);
  }
}
const mesh = (name: string) => capture.scene!.getObjectByName(name) as Mesh;
const position = () => host.dataset.position!.split(',').map(Number);

describe('shipped character scene integration', () => {
  it('runs by active time and freezes during pause, hidden tab, and offscreen', async () => {
    await create();
    expect(phase).toHaveBeenLastCalledWith('opening');
    advance(1);
    const time = host.dataset.introTime;
    api!.setPaused(true); advance(12);
    expect(host.dataset.introTime).toBe(time);
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

  it('accepts native click coordinates, rejects UI clicks, and cancels a live activity', async () => {
    await create(); api!.skipIntro(); advance(.1);
    const original = position();
    clickWorld(-.2, 1.8, document.querySelector<HTMLElement>('#ui')!); advance(.4);
    expect(position()).toEqual(original);
    clickWorld(-.2, 1.8); advance(.4);
    expect(position()).not.toEqual(original);
    expect(message).toHaveBeenCalledWith('On my way. Click another spot to change course.');
    for (let frame = 0; host.dataset.activity === 'idle' && frame < 1800; frame += 1) advance(1 / 30);
    expect(host.dataset.activity, JSON.stringify({ dataset: { ...host.dataset }, messages: message.mock.calls })).not.toBe('idle');
    clickWorld(0, .8); advance(1 / 30);
    expect(host.dataset.activity).toBe('idle');
  });

  it('releases a sculpture-centre command so autonomous activities resume', async () => {
    await create(); api!.skipIntro(); advance(.1);
    clickWorld(-1.35, -.45); advance(1 / 30);
    for (let frame = 0; host.dataset.activity === 'idle' && frame < 1800; frame += 1) advance(1 / 30);
    expect(host.dataset.activity, JSON.stringify({ dataset: { ...host.dataset }, messages: message.mock.calls })).not.toBe('idle');
  });

  it('reprojects a live destination that resize clamps inside the book pedestal', async () => {
    await create(); api!.skipIntro(); advance(.1);
    clickWorld(4, 0); advance(.1);
    width = 390; height = 844; resizeCallback([], {} as ResizeObserver);
    advance(12);
    expect(message).toHaveBeenCalledWith('A little play, a little reading. Click to explore.');
    for (let frame = 0; host.dataset.activity === 'idle' && frame < 1800; frame += 1) advance(1 / 30);
    expect(host.dataset.activity).not.toBe('idle');
  });

  it('does not move from hover, scroll, cancelled taps, or taps while paused', async () => {
    await create(); api!.skipIntro(); advance(.1);
    const original = position();
    hero.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 800, clientY: 600 }));
    window.dispatchEvent(new Event('scroll'));
    advance(.3);
    expect(position()).toEqual(original);
    const down = new MouseEvent('pointerdown', { bubbles: true, clientX: 800, clientY: 600, button: 0 });
    Object.defineProperties(down, { pointerId: { value: 1 }, isPrimary: { value: true } });
    hero.dispatchEvent(down); hero.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    const up = new MouseEvent('pointerup', { bubbles: true, clientX: 800, clientY: 600, button: 0 });
    Object.defineProperties(up, { pointerId: { value: 1 }, isPrimary: { value: true } });
    hero.dispatchEvent(up); advance(.3);
    expect(position()).toEqual(original);
    api!.setPaused(true); clickWorld(-1, 1); advance(.3);
    api!.setPaused(false); advance(.1);
    expect(position()).toEqual(original);
    expect(message).not.toHaveBeenCalledWith('On my way. Click another spot to change course.');
  });

  it('can skip while paused without replaying cues and eases cancelled props home', async () => {
    await create(); advance(3.8);
    expect(greeting).toHaveBeenCalledWith('Hi hi hi hi');
    api!.setPaused(true); api!.skipIntro();
    expect(phase).toHaveBeenLastCalledWith('roam');
    expect(greeting).toHaveBeenLastCalledWith(null);
    expect(wrapper.style.getPropertyValue('--intro-black')).toBe('0');
    api!.skipIntro(); api!.setPaused(false);
    for (let frame = 0; host.dataset.activity !== 'toss-ball' && frame < 1800; frame += 1) advance(1 / 30);
    expect(host.dataset.activity).toBe('toss-ball');
    advance(.35);
    const ball = capture.scene!.getObjectByName('activity-ball')!;
    const before = ball.position.clone();
    clickWorld(0, .5);
    expect(ball.position.distanceTo(before)).toBe(0);
    advance(1 / 30);
    expect(host.dataset.activity).toBe('idle');
    expect(ball.position.distanceTo(before)).toBeLessThan(.01);
    advance(.8);
    expect(ball.position.x).toBeCloseTo(-1.9);
    expect(ball.position.y).toBeCloseTo(.6);
    expect(ball.position.z).toBeCloseTo(1.16);
    expect(greeting.mock.calls.filter(([line]) => line === 'Hi hi hi hi')).toHaveLength(1);
  });

  it('keeps reading pose stable, confines resize, and disposes without further rendering', async () => {
    await create(); api!.skipIntro(); advance(.1);
    for (let frame = 0; host.dataset.activity !== 'read' && frame < 2400; frame += 1) advance(1 / 30);
    expect(host.dataset.activity).toBe('read');
    advance(.4);
    const hips = mesh('pelvis');
    expect(hips).toBeDefined();
    const seated = hips.position.clone();
    advance(3);
    expect(host.dataset.activity).toBe('read');
    expect(hips.position.distanceTo(seated)).toBeLessThan(.005);
    width = 390; height = 844; resizeCallback([], {} as ResizeObserver); advance(.1);
    expect(Math.abs(position()[0])).toBeLessThanOrEqual(2.08);
    const renders = capture.renders;
    api!.dispose(); advance(2);
    expect(capture.renders).toBe(renders);
    expect(host.querySelector('canvas')).toBeNull();
    expect(frames.size).toBe(0);
  });
});

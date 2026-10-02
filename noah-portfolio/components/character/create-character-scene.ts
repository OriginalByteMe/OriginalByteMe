import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { characterCameraDistance, shouldCancelOnPointerLeave } from '@/lib/character/input';
import { createCharacterState, stepCharacter, type Vec2 } from '@/lib/character/controller';

export interface CharacterScene {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  wave: () => void;
  reset: () => void;
  key: (key: string) => boolean;
}
const BOUNDS = { minX: -2.3, maxX: 2.3, minZ: -1.25, maxZ: 1.1 };
const OBSTACLES = [
  { id: 'coral', x: -1.35, z: .15, radius: .34 },
  { id: 'violet', x: 1.2, z: -.45, radius: .38 },
  { id: 'sage', x: .65, z: .95, radius: .25 },
];
const clamp = THREE.MathUtils.clamp;

/** An imperative, disposable scene keeps the animation loop outside React. */
export async function createCharacterScene(host: HTMLElement, callbacks: { onMessage: (message: string) => void; onError: () => void }): Promise<CharacterScene> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 40);
  const cameraLook = new THREE.Vector3(0, 1.05, 0);
  const light = new THREE.HemisphereLight(0xfff5e6, 0x95809f, 2.8);
  scene.add(light);
  const keyLight = new THREE.DirectionalLight(0xffedd7, 3.4);
  keyLight.position.set(-3, 6, 4);
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xa995dc, 2.2);
  rim.position.set(4, 3, -3);
  scene.add(rim);

  const world = new THREE.Group();
  scene.add(world);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.1, .12, 64), new THREE.MeshStandardMaterial({ color: 0xd9cbdc, roughness: .88 }));
  floor.position.y = -.1;
  floor.scale.z = .64;
  world.add(floor);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(2.85, 2.865, 64), new THREE.MeshBasicMaterial({ color: 0xb39bc3, transparent: true, opacity: .5, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.scale.y = .62;
  floorRing.position.y = -.033;
  world.add(floorRing);
  const props: THREE.Group[] = [];
  OBSTACLES.forEach((obstacle, index) => {
    const group = new THREE.Group();
    group.position.set(obstacle.x, 0, obstacle.z);
    const colors = [0xeb9a84, 0x9681b8, 0xa6b4a0];
    const mesh = new THREE.Mesh(
      index === 1 ? new THREE.CylinderGeometry(.31, .36, .6, 8) : new THREE.BoxGeometry(obstacle.radius * 1.4, index === 2 ? .25 : .42, obstacle.radius * 1.4),
      new THREE.MeshStandardMaterial({ color: colors[index], roughness: .7 }),
    );
    mesh.position.y = index === 1 ? .3 : index === 2 ? .125 : .21;
    mesh.rotation.y = index === 1 ? .2 : -.2;
    group.add(mesh);
    if (index === 1) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe4cbb1, roughness: .55 }));
      orb.position.y = .79;
      group.add(orb);
    }
    world.add(group); props.push(group);
  });
  // Cheap soft contact shadow: no second skinned/morph rendering pass.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const context = shadowCanvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(63,40,73,0.35)'); gradient.addColorStop(1, 'rgba(63,40,73,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .75), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.025;
  world.add(shadow);
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(.10, .13, 32), new THREE.MeshBasicMaterial({ color: 0x8964b4, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }));
  targetRing.rotation.x = -Math.PI / 2; targetRing.position.y = -.01; targetRing.visible = false;
  world.add(targetRing);

  let disposed = false;
  let raf = 0;
  const disposeObject = (object: THREE.Object3D) => {
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) { value.dispose(); const data = value.source?.data; if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) data.close(); }
        material.dispose();
      }
      if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose();
    });
  };
  let gltf;
  try {
    gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/good-vibes-hero.glb');
  } catch (error) {
    disposeObject(scene); renderer.dispose(); renderer.domElement.remove(); throw error;
  }
  const actor = new THREE.Group();
  const model = gltf.scene;
  // Normalize once in bind pose; outer actor owns travel so clips stay in place.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = 2.45 / size.y;
  model.scale.multiplyScalar(scale);
  model.position.set(-(box.min.x + box.max.x) * .5 * scale, -box.min.y * scale, -(box.min.z + box.max.z) * .5 * scale);
  actor.add(model); world.add(actor);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map(gltf.animations.map((clip) => [clip.name, mixer!.clipAction(clip)]));
  const clips = { idle: '01_Idle_Breathe', walk: '06_Walk_InPlace', run: '07_Run_InPlace', wave: '02_Wave_Hello' };
  let current: THREE.AnimationAction | undefined;
  const play = (name: keyof typeof clips) => {
    const next = actions.get(clips[name]);
    if (!next || current === next) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.22).play();
    current?.fadeOut(.22); current = next;
  };
  play('idle');
  let state = createCharacterState({ x: 0, z: .15 });
  let target: Vec2 | null = null;
  let pointerActive = false;
  let paused = false;
  let visible = true;
  let last = 0;
  let lastRender = 0;
  let waveUntil = 1.8;
  let elapsed = 0;
  let scroll = 0;
  let scrollUntil = 0;
  let lastBump = 0;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const hero = host.closest('#hero') as HTMLElement | null;
  let canvasWidth = 0;
  let canvasHeight = 0;
  const updateCamera = () => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const resized = rect.width !== canvasWidth || rect.height !== canvasHeight;
    if (resized) {
      canvasWidth = rect.width; canvasHeight = rect.height;
      renderer.setSize(rect.width, rect.height, false);
    }
    camera.aspect = rect.width / rect.height;
    const distance = characterCameraDistance(camera.aspect);
    camera.position.set(Math.sin(scroll * .42) * 1.1, 4.7 + scroll * .7, distance);
    camera.lookAt(cameraLook); camera.updateProjectionMatrix();
    // Resizing clears the drawing buffer, including while simulation is paused.
    if (resized) renderer.render(scene, camera);
  };
  const resize = new ResizeObserver(updateCamera); resize.observe(host); updateCamera();
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; }, { threshold: .01 }); visibility.observe(host);
  const setTarget = (event: PointerEvent) => {
    if (paused) return;
    const rect = host.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    target = { x: clamp(hit.x, BOUNDS.minX + .22, BOUNDS.maxX - .22), z: clamp(hit.z, BOUNDS.minZ + .22, BOUNDS.maxZ - .22) };
    pointerActive = event.pointerType !== 'touch';
    scrollUntil = 0;
    targetRing.visible = true;
    targetRing.position.set(target.x, -.01, target.z);
    waveUntil = 0;
    callbacks.onMessage(event.pointerType === 'touch' ? 'On my way. Keep exploring.' : 'Catch me if you can.');
  };
  const pointerMove = (event: PointerEvent) => { if (event.pointerType !== 'touch') setTarget(event); };
  let touchStart: { x: number; y: number } | null = null;
  const pointerDown = (event: PointerEvent) => { touchStart = { x: event.clientX, y: event.clientY }; if (event.pointerType !== 'touch') setTarget(event); };
  const pointerUp = (event: PointerEvent) => { if (event.pointerType === 'touch' && touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 12) setTarget(event); touchStart = null; };
  const stopMovement = () => { pointerActive = false; target = null; targetRing.visible = false; callbacks.onMessage('Good things happen when you explore.'); };
  const pointerLeave = (event: PointerEvent) => { if (shouldCancelOnPointerLeave(event.pointerType)) stopMovement(); };
  const onScroll = () => {
    if (!hero || paused) return;
    const rect = hero.getBoundingClientRect();
    scroll = clamp(-rect.top / Math.max(1, rect.height * .75), 0, 1);
    updateCamera();
    if (!pointerActive && visible) {
      target = { x: Math.sin(scroll * Math.PI * 2) * 1.65, z: -.65 + scroll * 1.4 };
      scrollUntil = elapsed + .7;
      waveUntil = 0;
      callbacks.onMessage(scroll > .5 ? 'There’s more to the story ↓' : 'Let’s take a little scroll.');
    }
  };
  const contextLost = (event: Event) => { event.preventDefault(); callbacks.onError(); };
  host.addEventListener('pointermove', pointerMove);
  host.addEventListener('pointerdown', pointerDown);
  host.addEventListener('pointerup', pointerUp);
  host.addEventListener('pointerleave', pointerLeave);
  window.addEventListener('scroll', onScroll, { passive: true });
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const tick = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden || paused) { last = 0; return; }
    // Cap to 30fps. Pointer/input stays native; no React rerender per frame.
    if (now - lastRender < 1000 / 30) return;
    const dt = last ? Math.min((now - last) / 1000, .1) : 1 / 30;
    last = lastRender = now; elapsed += dt;
    if (!pointerActive && scrollUntil && elapsed > scrollUntil) { target = null; scrollUntil = 0; }
    stepCharacter(state, elapsed < waveUntil ? null : target, dt, OBSTACLES, BOUNDS);
    actor.position.set(state.position.x, state.bumpRemaining > 0 ? Math.sin(state.bumpRemaining * 16) * .05 : 0, state.position.z);
    actor.rotation.y = state.heading;
    actor.rotation.z = state.bumpRemaining > 0 ? Math.sin(state.bumpRemaining * 25) * .06 : 0;
    shadow.position.x = state.position.x; shadow.position.z = state.position.z;
    if (state.bumpCount !== lastBump) { lastBump = state.bumpCount; callbacks.onMessage('Oops. Excuse me, tiny sculpture.'); }
    props.forEach((prop, index) => {
      const distance = Math.hypot(prop.position.x - state.position.x, prop.position.z - state.position.z);
      prop.rotation.z = state.bumpRemaining > 0 && distance < OBSTACLES[index].radius + .5 ? Math.sin(state.bumpRemaining * 28) * .1 : 0;
    });
    play(elapsed < waveUntil ? 'wave' : state.motion === 'run' ? 'run' : state.motion === 'walk' ? 'walk' : 'idle');
    if (current && (state.motion === 'walk' || state.motion === 'run')) current.timeScale = clamp(state.speed / (state.motion === 'run' ? 2.4 : 1), .6, 1.6);
    mixer!.update(dt);
    // Readable diagnostics used by smoke tests; no production global or test hook.
    host.dataset.motion = state.motion;
    host.dataset.position = `${state.position.x.toFixed(3)},${state.position.z.toFixed(3)}`;
    host.dataset.bumps = String(state.bumpCount);
    host.dataset.scroll = scroll.toFixed(3);
    renderer.render(scene, camera);
  };
  renderer.render(scene, camera); raf = requestAnimationFrame(tick);
  const wave = () => { if (paused) return; scrollUntil = 0; target = null; pointerActive = false; targetRing.visible = false; waveUntil = elapsed + 2; callbacks.onMessage('Hey there. Nice to meet you!'); };
  return {
    setPaused: (value) => { paused = value; last = 0; host.dataset.paused = String(value); },
    wave,
    reset: () => { state = createCharacterState({ x: 0, z: .15 }); target = null; pointerActive = false; paused = false; host.dataset.paused = 'false'; lastBump = 0; targetRing.visible = false; wave(); },
    key: (key) => {
      if (key === ' ') { wave(); return true; }
      if (key === 'Escape') { stopMovement(); return true; }
      const deltas: Record<string, Vec2> = { ArrowLeft: { x: -.65, z: 0 }, ArrowRight: { x: .65, z: 0 }, ArrowUp: { x: 0, z: -.65 }, ArrowDown: { x: 0, z: .65 } };
      const delta = deltas[key]; if (!delta || paused) return false;
      target = { x: clamp(state.position.x + delta.x, BOUNDS.minX + .22, BOUNDS.maxX - .22), z: clamp(state.position.z + delta.z, BOUNDS.minZ + .22, BOUNDS.maxZ - .22) };
      pointerActive = true; waveUntil = 0; targetRing.visible = true; targetRing.position.set(target.x, -.01, target.z); return true;
    },
    dispose: () => {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf);
      resize.disconnect(); visibility.disconnect();
      host.removeEventListener('pointermove', pointerMove); host.removeEventListener('pointerdown', pointerDown); host.removeEventListener('pointerup', pointerUp); host.removeEventListener('pointerleave', pointerLeave);
      window.removeEventListener('scroll', onScroll); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      mixer?.stopAllAction(); mixer?.uncacheRoot(model); disposeObject(scene); shadowTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CharacterIdleController } from '@/lib/character/idle';
import { CharacterNarrativeController, NarrativeFactController, heroScrollProgress, type NarrativePhase, type NarrativeDialogueId } from '@/lib/character/narrative';
import { CharacterMeepAudio } from '@/lib/character/audio';
import { createFaceLayer } from '@/lib/character/face';
import { characterCameraDistance, shouldCancelOnPointerLeave } from '@/lib/character/input';
import { createCharacterState, stepCharacter, type Vec2 } from '@/lib/character/controller';

export interface CharacterScene {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  setSoundEnabled: (enabled: boolean) => Promise<boolean>;
  skipIntro: () => void;
  wave: () => void;
  reset: () => void;
  key: (key: string) => boolean;
}
let sessionFactCount = 0;
let sessionGreetingCount = 0;
let sessionSkippedIntro = false;
let sessionDialogueIds: readonly NarrativeDialogueId[] = [];
const OBSTACLES = [
  { id: 'coral', x: -1.35, z: -.45, radius: .34 },
  { id: 'violet', x: 1.3, z: -1.15, radius: .38 },
  { id: 'sage', x: .65, z: 1.4, radius: .25 },
  { id: 'peach', x: -3.4, z: 1.1, radius: .42 },
  { id: 'lilac', x: 3.6, z: -.25, radius: .46 },
];
const clamp = THREE.MathUtils.clamp;

/** An imperative, disposable scene keeps the animation loop outside React. */
export async function createCharacterScene(host: HTMLElement, callbacks: { onMessage: (message: string) => void; onGreeting: (line: string | null) => void; onPhase: (phase: NarrativePhase) => void; onError: () => void }): Promise<CharacterScene> {
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
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(8.25, 8.1, .18, 96), new THREE.MeshStandardMaterial({ color: 0xd9cbdc, roughness: .88 }));
  floor.position.y = -.1;
  floor.scale.z = .64;
  world.add(floor);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(6.85, 6.875, 96), new THREE.MeshBasicMaterial({ color: 0xb39bc3, transparent: true, opacity: .5, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.scale.y = .62;
  floorRing.position.y = -.033;
  world.add(floorRing);
  const props: THREE.Group[] = [];
  OBSTACLES.forEach((obstacle, index) => {
    const group = new THREE.Group();
    group.position.set(obstacle.x, 0, obstacle.z);
    const colors = [0xeb9a84, 0x9681b8, 0xa6b4a0, 0xe8b38b, 0xa58cc8];
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
  const bounds = { minX: -4.8, maxX: 4.8, minZ: -2.0, maxZ: 2.2 };
  let state = createCharacterState({ x: 1.4, z: .42 });
  let target: Vec2 | null = null;
  let paused = false;
  let visible = true;
  let last = 0;
  let lastRender = 0;
  let waveUntil = 0;
  let elapsed = 0;
  let scroll = 0;
  let lastBump = 0;
  let phase: NarrativePhase = 'intro';
  let previousPhase: NarrativePhase = 'intro';
  let speechUntil = 0;
  let speechActive = false;
  let speechKind: 'greeting' | 'bonk' | 'fact' | 'idle' | null = null;
  let pendingManualGreeting = false;
  try { sessionGreetingCount = Math.max(sessionGreetingCount, Number(window.sessionStorage.getItem('good-vibes-greetings-v1')) || 0); } catch { /* In-memory cap remains. */ }
  const idle = new CharacterIdleController({ greetingsShown: sessionGreetingCount });
  const audio = new CharacterMeepAudio();
  const face = createFaceLayer(model, gltf.animations);
  try { sessionFactCount = Math.max(sessionFactCount, Number(window.sessionStorage.getItem('good-vibes-facts-v1')) || 0); } catch { /* In-memory cap remains. */ }
  const facts = new NarrativeFactController({ factsShown: sessionFactCount });
  const narrative = new CharacterNarrativeController({ skipped: sessionSkippedIntro, consumedDialogueIds: sessionDialogueIds });
  const cancelSpeech = () => {
    pendingManualGreeting = false;
    idle.cancelGreeting(); facts.cancel(); audio.cancel(); speechUntil = 0;
    if (speechActive) callbacks.onGreeting(null);
    speechActive = false; speechKind = null;
  };
  const speak = (line: string, duration: number, kind: 'greeting' | 'bonk' | 'fact' = 'greeting') => {
    audio.cancel(); callbacks.onGreeting(line); speechActive = true; speechKind = kind; speechUntil = elapsed + duration;
    audio.playUtterance(line, kind);
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const hero = host.closest('#hero') as HTMLElement | null;
  const inputSurface = hero ?? host;
  let canvasWidth = 0;
  let canvasHeight = 0;
  const readScroll = () => { if (hero) scroll = heroScrollProgress(hero.getBoundingClientRect(), window.innerHeight); };
  let cameraDepth = 0;
  let cameraShake = 0;
  const updateCamera = (depth = 0, shake = 0) => {
    cameraDepth = depth; cameraShake = shake;
    const distance = characterCameraDistance(camera.aspect);
    camera.position.set(Math.sin(scroll * 75) * shake * .065, 4.7 - depth * 2 + Math.cos(scroll * 90) * shake * .065, distance - (distance - 7.8) * depth);
    camera.lookAt(cameraLook); camera.updateProjectionMatrix();
  };
  const resizeScene = () => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (rect.width !== canvasWidth || rect.height !== canvasHeight) {
      canvasWidth = rect.width; canvasHeight = rect.height;
      renderer.setSize(rect.width, rect.height, false);
    }
    camera.aspect = rect.width / rect.height;
    cameraLook.y = camera.aspect < .85 ? 2.25 : 1.05;
    const halfWidth = clamp(2.3 + Math.max(0, camera.aspect - .8) * 1.8, 2.3, 5.4);
    bounds.minX = -halfWidth; bounds.maxX = halfWidth;
    state.position.x = clamp(state.position.x, bounds.minX + .22, bounds.maxX - .22);
    state.position.z = clamp(state.position.z, bounds.minZ + .22, bounds.maxZ - .22);
    if (phase === 'roam') { actor.position.x = state.position.x; actor.position.z = state.position.z; }
    readScroll(); updateCamera(cameraDepth, cameraShake); renderer.render(scene, camera);
  };
  const resize = new ResizeObserver(resizeScene); resize.observe(host); resizeScene();
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; if (!visible) cancelSpeech(); }, { threshold: .01 }); visibility.observe(host);
  const setTarget = (event: PointerEvent) => {
    if (paused || phase !== 'roam') return;
    if ((event.target as HTMLElement)?.closest?.('a, button, input, textarea, select, [role="dialog"]')) return;
    const rect = host.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    target = { x: clamp(hit.x, bounds.minX + .22, bounds.maxX - .22), z: clamp(hit.z, bounds.minZ + .22, bounds.maxZ - .22) };
    cancelSpeech(); targetRing.visible = true; targetRing.position.set(target.x, -.01, target.z); waveUntil = 0;
    callbacks.onMessage(event.pointerType === 'touch' ? 'On my way. Keep exploring.' : 'I’m just following my curiosity.');
  };
  const pointerMove = (event: PointerEvent) => { if (event.pointerType !== 'touch') setTarget(event); };
  let touchStart: { x: number; y: number } | null = null;
  const pointerDown = (event: PointerEvent) => { touchStart = { x: event.clientX, y: event.clientY }; if (event.pointerType !== 'touch') setTarget(event); };
  const pointerUp = (event: PointerEvent) => { if (event.pointerType === 'touch' && touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 12) setTarget(event); touchStart = null; };
  const stopMovement = () => { target = null; targetRing.visible = false; callbacks.onMessage('Good things happen when you explore.'); };
  const pointerLeave = (event: PointerEvent) => { if (shouldCancelOnPointerLeave(event.pointerType)) stopMovement(); };
  const onScroll = () => { readScroll(); };
  const onDocumentVisibility = () => { if (document.hidden) cancelSpeech(); last = 0; };
  document.addEventListener('visibilitychange', onDocumentVisibility);
  const contextLost = (event: Event) => { event.preventDefault(); callbacks.onError(); };
  inputSurface.addEventListener('pointermove', pointerMove as EventListener);
  inputSurface.addEventListener('pointerdown', pointerDown as EventListener);
  inputSurface.addEventListener('pointerup', pointerUp as EventListener);
  inputSurface.addEventListener('pointerleave', pointerLeave as EventListener);
  window.addEventListener('scroll', onScroll, { passive: true });
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const tick = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden || paused) { last = 0; return; }
    if (now - lastRender < 1000 / 30) return;
    const dt = last ? Math.min((now - last) / 1000, .1) : 1 / 30;
    last = lastRender = now; elapsed += dt;
    const story = narrative.update(scroll);
    phase = story.phase;
    if (phase !== previousPhase) {
      cancelSpeech(); target = null; targetRing.visible = false;
      if (phase === 'roam') { state = createCharacterState({ x: Math.min(2.6, bounds.maxX * .65) * .55, z: .42 }); lastBump = 0; }
      callbacks.onPhase(phase); previousPhase = phase;
    }
    if (story.dialogueStarted) {
      speak(story.dialogueStarted.line, story.dialogueStarted.duration, phase === 'bonk' ? 'bonk' : 'greeting');
      sessionDialogueIds = narrative.consumedDialogueIds;
    }
    const roaming = phase === 'roam';
    const cinematicDepth = roaming ? 0 : phase === 'invitation' ? .5 * (1 - story.invitationProgress * story.invitationProgress * (3 - 2 * story.invitationProgress)) : story.pose.depth;
    updateCamera(cinematicDepth, story.cameraShake);
    if (roaming) {
      stepCharacter(state, elapsed < waveUntil ? null : target, dt, OBSTACLES, bounds);
      actor.position.set(state.position.x, state.bumpRemaining > 0 ? Math.sin(state.bumpRemaining * 16) * .05 : 0, state.position.z);
      actor.rotation.set(0, state.heading, state.bumpRemaining > 0 ? Math.sin(state.bumpRemaining * 25) * .06 : 0);
      actor.scale.set(1, 1, 1);
      if (state.bumpCount !== lastBump) { lastBump = state.bumpCount; cancelSpeech(); speak('Ow. Excuse me, tiny sculpture.', 2, 'bonk'); }
      play(elapsed < waveUntil ? 'wave' : state.motion === 'run' ? 'run' : state.motion === 'walk' ? 'walk' : 'idle');
      if (current && (state.motion === 'walk' || state.motion === 'run')) current.timeScale = clamp(state.speed / (state.motion === 'run' ? 2.4 : 1), .6, 1.6);
      mixer.update(dt);
    } else {
      const side = Math.min(2.6, bounds.maxX * .65);
      actor.position.set(side * (1 - story.pose.depth), story.pose.lift, -3 + story.pose.depth * 7.6);
      actor.rotation.set(story.pose.lean, story.pose.turn, 0);
      actor.scale.set(1, story.pose.squash, 1);
      // Poses, including the in-place run stride, scrub with scroll in either direction.
      play(phase === 'approach' ? 'run' : phase === 'invitation' ? 'wave' : 'idle');
      mixer.update(dt);
      if (phase === 'approach' && current) { current.time = story.approachProgress * current.getClip().duration * 8; mixer.update(0); }
    }
    shadow.position.x = actor.position.x; shadow.position.z = actor.position.z;
    const stationary = roaming ? state.motion === 'idle' && state.speed < .05 : phase === 'intro' || phase === 'invitation';
    if (stationary && pendingManualGreeting) { idle.greetNow(); pendingManualGreeting = false; }
    const idleFrame = idle.tick(dt, stationary && (phase === 'intro' || roaming) && (!speechActive || speechKind === 'idle'));
    actor.position.y += idleFrame.bob;
    const factFrame = facts.tick(dt, { phase, stationary: stationary && !idleFrame.greeting && (!speechActive || speechKind === 'fact') && elapsed >= waveUntil });
    if (factFrame.factStarted) {
      speak(factFrame.factStarted.line, factFrame.factStarted.duration, 'fact');
      sessionFactCount = factFrame.count;
      try { window.sessionStorage.setItem('good-vibes-facts-v1', String(sessionFactCount)); } catch { /* In-memory cap remains. */ }
    }
    if (idleFrame.greetingStarted) { callbacks.onGreeting(idleFrame.greetingStarted.line); speechActive = true; speechKind = 'idle'; speechUntil = elapsed + idleFrame.greetingStarted.duration; audio.playGreeting(idleFrame.greetingStarted); sessionGreetingCount = idleFrame.greetingsShown; try { window.sessionStorage.setItem('good-vibes-greetings-v1', String(sessionGreetingCount)); } catch { /* In-memory cap remains. */ } }
    if ((factFrame.factEnded && speechKind === 'fact') || (idleFrame.greetingEnded && speechKind === 'idle')) cancelSpeech();
    const moving = roaming && state.motion !== 'idle';
    if ((moving && state.motion !== 'bump' && !pendingManualGreeting) || (speechActive && elapsed > speechUntil)) { cancelSpeech(); }
    const talking = speechActive && elapsed < speechUntil;
    const mouth = talking ? Math.max(idleFrame.mouthOpen, .6 * Math.max(0, Math.sin(elapsed * 18))) : idleFrame.mouthOpen;
    face.apply({ active: stationary || talking, blink: idleFrame.blink, mouth, time: elapsed });
    props.forEach((prop, index) => {
      const distance = Math.hypot(prop.position.x - actor.position.x, prop.position.z - actor.position.z);
      prop.rotation.z = roaming && state.bumpRemaining > 0 && distance < OBSTACLES[index].radius + .5 ? Math.sin(state.bumpRemaining * 28) * .1 : 0;
    });
    host.dataset.phase = phase; host.dataset.motion = roaming ? state.motion : phase === 'approach' ? 'run' : 'idle';
    host.dataset.position = `${actor.position.x.toFixed(3)},${actor.position.z.toFixed(3)}`;
    host.dataset.bumps = String(state.bumpCount); host.dataset.scroll = scroll.toFixed(3);
    host.dataset.blink = idleFrame.blink.toFixed(3);
    renderer.render(scene, camera);
  };
  renderer.render(scene, camera); raf = requestAnimationFrame(tick);
  const skipIntro = () => {
    narrative.skipIntro(); sessionSkippedIntro = true; sessionDialogueIds = narrative.consumedDialogueIds; cancelSpeech();
    if (phase === 'roam') return;
    state = createCharacterState({ x: Math.min(2.6, bounds.maxX * .65) * .55, z: .42 }); lastBump = 0;
    target = null; targetRing.visible = false; phase = previousPhase = 'roam'; callbacks.onPhase('roam');
    actor.position.set(state.position.x, 0, state.position.z); actor.rotation.set(0, 0, 0); actor.scale.set(1, 1, 1);
    play('idle'); mixer.update(0); updateCamera(); renderer.render(scene, camera);
  };
  const wave = () => { if (paused) return; skipIntro(); target = null; targetRing.visible = false; waveUntil = elapsed + 2; pendingManualGreeting = true; };
  return {
    skipIntro,
    setSoundEnabled: async (enabled) => { if (!enabled) { audio.mute(); return false; } return audio.enableFromGesture(); },
    setPaused: (value) => { paused = value; last = 0; if (value) { narrative.update(scroll, { paused: true }); cancelSpeech(); } host.dataset.paused = String(value); },
    wave,
    reset: () => { skipIntro(); state = createCharacterState({ x: Math.min(2.6, bounds.maxX * .65) * .55, z: .42 }); target = null; paused = false; host.dataset.paused = 'false'; lastBump = 0; targetRing.visible = false; },
    key: (key) => {
      if (key === ' ') { wave(); return true; }
      if (key === 'Escape') { cancelSpeech(); stopMovement(); return true; }
      const deltas: Record<string, Vec2> = { ArrowLeft: { x: -.65, z: 0 }, ArrowRight: { x: .65, z: 0 }, ArrowUp: { x: 0, z: -.65 }, ArrowDown: { x: 0, z: .65 } };
      const delta = deltas[key]; if (!delta || paused) return false;
      if (phase !== 'roam') skipIntro();
      target = { x: clamp(state.position.x + delta.x, bounds.minX + .22, bounds.maxX - .22), z: clamp(state.position.z + delta.z, bounds.minZ + .22, bounds.maxZ - .22) };
      cancelSpeech(); waveUntil = 0; targetRing.visible = true; targetRing.position.set(target.x, -.01, target.z); return true;
    },
    dispose: () => {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf);
      resize.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', onDocumentVisibility);
      cancelSpeech(); void audio.dispose();
      inputSurface.removeEventListener('pointermove', pointerMove as EventListener); inputSurface.removeEventListener('pointerdown', pointerDown as EventListener); inputSurface.removeEventListener('pointerup', pointerUp as EventListener); inputSurface.removeEventListener('pointerleave', pointerLeave as EventListener);
      window.removeEventListener('scroll', onScroll); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      mixer.stopAllAction(); mixer.uncacheRoot(model); disposeObject(scene); shadowTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CharacterIdleController } from '@/lib/character/idle';
import { CharacterIntroController, type IntroPhase } from '@/lib/character/intro';
import { CharacterActivityController, type ActivityFrame } from '@/lib/character/activities';
import { createActivityProps } from '@/lib/character/activity-props';
import { CharacterAudio, utteranceDuration, type SfxName, type VoiceKind } from '@/lib/character/audio';
import { createFaceLayer } from '@/lib/character/face';
import { CharacterClickInput, CHARACTER_UI_SELECTOR, rayHitsSphere } from '@/lib/character/input';
import { createCharacterState, stepCharacter, resolveCharacterTarget, type Vec2 } from '@/lib/character/controller';
import { CharacterTourController, areaScrollPosition, type TourFrame, type TourPhase } from '@/lib/character/tour';
import { AFRO_LINES, AREA_ARRIVAL_LINES, BUMP_LINE, CHASE_LINE, JUMP_LINE, PORTRAIT_LINE, STATION_LINES, CharacterTidbitController } from '@/lib/character/narrative';
import type { WorldContent } from '@/lib/character/world-content';
import { createBedroom } from './world/bedroom';
import { createLab } from './world/lab';
import { createAbout } from './world/about';
import type { Station, WorldArea } from './world/types';

export interface CharacterScene {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  /** Voice and sound effects; call only from a click. */
  setSoundEnabled: (enabled: boolean) => Promise<boolean>;
  /** Background music; call only from a click. */
  setMusicEnabled: (enabled: boolean) => Promise<boolean>;
  skipIntro: () => void;
  wave: () => void;
  reset: () => void;
  key: (key: string) => boolean;
  /** Sends him to a station once he is settled in its area; scrolling that section into view brings him there. */
  visit: (stationId: string) => void;
}
export type CharacterSceneOptions = {
  content: WorldContent;
  onMessage: (message: string) => void;
  onGreeting: (line: string | null) => void;
  onPhase: (phase: IntroPhase) => void;
  onError: () => void;
};
type SpeechKind = 'idle' | 'chat' | 'event';

let sessionGreetingCount = 0;
let sessionTidbitCount = 0;
let sessionSkippedIntro = false;
const BUILDERS = [createBedroom, createLab, createAbout];
/** Area origins stack 18 units apart: bedroom, lab, about. */
const AREA_Y = [0, -18, -36];
const CHARACTER_HEIGHT = 2.45;
/** Measured on the GLB: the held 08_Sit_Relaxed frame rests its lowest seated vertices 0.13 below the pelvis bone. */
const SEAT_CLEARANCE = .13;
const CAMERA_DIRECTION = new THREE.Vector3(0, .42, 1).normalize();
/** Sound and seconds between repeats while performing at a station; each `type` call is itself a burst of clicks. */
const STATION_LOOPS: Record<string, [SfxName, number]> = { desk: ['type', .3], printer: ['printer', 2.2], rack: ['rack', 3], skills: ['poke', .9] };
const clamp = THREE.MathUtils.clamp;
const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
/** Ease a pose in over the first and out over the last eighth of a perform. */
const envelope = (progress: number) => smooth(progress / .12) * (1 - smooth((progress - .88) / .12));
const readSession = (key: string) => { try { return Number(window.sessionStorage.getItem(key)) || 0; } catch { return 0; } };
const writeSession = (key: string, value: number) => { try { window.sessionStorage.setItem(key, String(value)); } catch { /* In-memory count remains. */ } };

/** An imperative, disposable scene keeps the animation loop outside React. */
export async function createCharacterScene(host: HTMLElement, options: CharacterSceneOptions): Promise<CharacterScene> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  // Transparent clear: the dioramas float over the viewport's CSS gradient in either theme.
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 160);
  scene.add(new THREE.HemisphereLight(0xfff5e6, 0x95809f, 2.6));
  const keyLight = new THREE.DirectionalLight(0xffedd7, 3.2);
  keyLight.position.set(-3, 6, 4);
  scene.add(keyLight);
  const rim = new THREE.DirectionalLight(0xa995dc, 2);
  rim.position.set(4, 3, -3);
  scene.add(rim);

  // Cheap soft contact shadow: no second skinned/morph rendering pass.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const context = shadowCanvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(63,40,73,0.35)'); gradient.addColorStop(1, 'rgba(63,40,73,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .75), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(.10, .13, 32), new THREE.MeshBasicMaterial({ color: 0x8964b4, transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }));
  targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false;
  scene.add(targetRing);

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
  const origins = AREA_Y.map((y) => new THREE.Vector3(0, y, 0));
  const areas: WorldArea[] = [];
  const disposeAreas = () => { for (const area of areas.splice(0)) { area.group.removeFromParent(); area.dispose(); } };
  let gltf;
  try {
    gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/good-vibes-hero.glb');
    BUILDERS.forEach((build, index) => { const area = build(origins[index].clone(), options.content); areas.push(area); scene.add(area.group); });
  } catch (error) {
    disposeAreas(); disposeObject(scene); shadowTexture.dispose(); renderer.dispose(); renderer.domElement.remove(); throw error;
  }
  const actor = new THREE.Group();
  actor.rotation.order = 'YXZ'; // Yaw first, so trip and tumble pitch along his own heading.
  const model = gltf.scene;
  // Normalize once in bind pose; outer actor owns travel so clips stay in place.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = CHARACTER_HEIGHT / size.y;
  model.scale.multiplyScalar(scale);
  model.position.set(-(box.min.x + box.max.x) * .5 * scale, -box.min.y * scale, -(box.min.z + box.max.z) * .5 * scale);
  actor.add(model); scene.add(actor);
  actor.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
  const clips = { idle: '01_Idle_Breathe', walk: '06_Walk_InPlace', run: '07_Run_InPlace', wave: '02_Wave_Hello', sit: '08_Sit_Relaxed' };
  const head = model.getObjectByName('head');
  // The afro sphere sits on the head bone and reaches the top of the normalized model.
  const afroRadius = (CHARACTER_HEIGHT - (head?.getWorldPosition(new THREE.Vector3()).y ?? 1.27)) / 2;
  // Where the held sit frame puts his seat relative to his feet: the clip sits on the floor, chairs raise him by `seat` minus this.
  let seatBase = 0;
  const sitAction = actions.get(clips.sit), pelvis = model.getObjectByName('pelvis');
  if (sitAction && pelvis) {
    sitAction.play(); sitAction.paused = true; sitAction.time = 1.5; mixer.update(0); model.updateMatrixWorld(true);
    seatBase = pelvis.getWorldPosition(new THREE.Vector3()).y - SEAT_CLEARANCE;
    sitAction.stop();
  }
  let current: THREE.AnimationAction | undefined;
  const play = (name: keyof typeof clips) => {
    const next = actions.get(clips[name]);
    if (!next || current === next) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.22).play();
    current?.fadeOut(.22); current = next;
  };
  play('idle');

  const worldRoot = host.closest<HTMLElement>('.character-world');
  const sections = ['hero', 'lab', 'about'].map((id) => worldRoot?.querySelector<HTMLElement>(`#${id}`)).filter((section): section is HTMLElement => !!section);
  let scrollPosition = 0;
  const measureScroll = () => { scrollPosition = sections.length === areas.length ? areaScrollPosition(sections.map((section) => section.getBoundingClientRect()), window.innerHeight) : 0; };
  measureScroll();
  const viewArea = () => Math.round(scrollPosition);
  // The intro belongs to the top of the bedroom; arriving mid-page drops him straight into the viewed area.
  const midPage = scrollPosition > .2;
  let areaIndex = midPage ? viewArea() : 0;
  let area = areas[areaIndex];
  const restPoint = (index: number): Vec2 => {
    const { landing, obstacles, bounds } = areas[index];
    return resolveCharacterTarget({ x: landing.x, z: landing.z }, { x: landing.x, z: landing.z + .9 }, obstacles, bounds);
  };
  const introRest = restPoint(0);
  let state = createCharacterState(restPoint(areaIndex));
  let target: Vec2 | null = null;
  let paused = false;
  let visible = true;
  let audioSuspended = false;
  let last = 0;
  let lastRender = 0;
  let waveUntil = 0;
  let afroUntil = 0;
  let afroClicks = 0;
  let elapsed = 0;
  let lastBump = 0;
  let phase: IntroPhase = 'opening';
  let captionUntil = 0;
  let talkUntil = 0;
  let speechActive = false;
  let speechKind: SpeechKind | null = null;
  let pendingManualGreeting = false;
  let pendingVisit: string | null = null;
  let requestedStation: string | null = null;
  let nextStationLineAt = 0;
  let nextBumpLineAt = 0;
  const stationLineTurns: Record<string, number> = {};
  let lastActivityPhase = 'idle';
  let lastStep = -1;
  let lastBeat = -1;
  let tourFrame: TourFrame = { area: areaIndex, from: areaIndex, to: areaIndex, phase: 'settled', progress: 0, started: null };
  let lastTourPhase: TourPhase = 'settled';
  const tourFrom = new THREE.Vector3();
  let hopTo: Vec2 = state.position;
  sessionGreetingCount = Math.max(sessionGreetingCount, readSession('good-vibes-greetings-v1'));
  sessionTidbitCount = Math.max(sessionTidbitCount, readSession('good-vibes-tidbits-v1'));
  const idle = new CharacterIdleController({ greetingsShown: sessionGreetingCount });
  const tidbits = new CharacterTidbitController({ spoken: sessionTidbitCount });
  const audio = new CharacterAudio();
  const face = createFaceLayer(model, gltf.animations);
  const intro = new CharacterIntroController();
  const introSkipped = sessionSkippedIntro || midPage;
  if (introSkipped) intro.skip();
  const tour = new CharacterTourController({ areas: areas.length, start: areaIndex });
  const activities = new CharacterActivityController(area.stations);
  const activityProps = createActivityProps(areas[0].group, actor, model, areas[0].propRests!);
  const stationOf = (id: string | null): Station | undefined => id ? area.stations.find((station) => station.id === id) : undefined;
  const endCaption = () => { if (speechActive) options.onGreeting(null); speechActive = false; speechKind = null; captionUntil = talkUntil = 0; };
  const cancelSpeech = () => { pendingManualGreeting = false; idle.cancelGreeting(); audio.cancel(); endCaption(); };
  /** Caption plus babble; the mouth flaps for the babble's length and the caption stays readable a little longer. */
  const say = (line: string, voice: VoiceKind, kind: SpeechKind = 'event', caption = 0) => {
    const talk = utteranceDuration(line, voice);
    audio.speak(line, voice); options.onGreeting(line);
    speechActive = true; speechKind = kind; talkUntil = elapsed + talk; captionUntil = elapsed + Math.max(caption, talk + 1.2, 2);
  };
  const syncAudio = () => {
    const suspend = paused || !visible || document.hidden;
    if (suspend !== audioSuspended) { audioSuspended = suspend; audio.suspend(suspend); }
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const temp = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const afroCenter = new THREE.Vector3();
  const inputSurface = worldRoot ?? host;
  const wrapper = host.closest('.character-hero') as HTMLElement;
  wrapper.style.setProperty('--intro-black', introSkipped ? '0' : '1');

  // Camera framings per area: wide screens keep the diorama in the right ~60% beside the DOM panels.
  const framings = areas.map(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }));
  // Measured once in build pose: the builders' view radius undersells their slabs, walls and signs.
  const areaCorners = areas.map(({ group }) => {
    const { min, max } = new THREE.Box3().setFromObject(group);
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));
  });
  const probe = new THREE.PerspectiveCamera();
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const desired = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const look = new THREE.Vector3();
  let cameraPlaced = false;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let wide = true;
  const viewShift = () => wide ? { x: -.2 * canvasWidth, y: 0 } : { x: 0, y: -.1 * canvasHeight };
  const frameAreas = () => {
    wide = camera.aspect >= 1.05;
    probe.copy(camera);
    const shift = viewShift();
    probe.setViewOffset(canvasWidth, canvasHeight, shift.x, shift.y, canvasWidth, canvasHeight);
    // Free screen region in NDC: right of the DOM panels, between the eyebrow and the caption when wide; below the hero copy when narrow.
    const [left, right, bottom, top] = wide ? [-.12, .96, -.62, .72] : [-.98, .98, -.9, .25];
    areas.forEach(({ view }, index) => {
      const target = framings[index].target.set(view.center.x, view.center.y, view.center.z).add(origins[index]);
      let near = 1, far = 40;
      for (let step = 0; step < 18; step += 1) {
        const distance = (near + far) / 2;
        probe.position.copy(target).addScaledVector(CAMERA_DIRECTION, distance); probe.lookAt(target); probe.updateMatrixWorld();
        const fits = areaCorners[index].every((corner) => { temp.copy(corner).project(probe); return temp.x >= left && temp.x <= right && temp.y >= bottom && temp.y <= top; });
        if (fits) far = distance; else near = distance;
      }
      framings[index].position.copy(target).addScaledVector(CAMERA_DIRECTION, far);
    });
  };
  const placeCamera = (dt: number) => {
    const from = clamp(Math.floor(scrollPosition), 0, areas.length - 1), to = Math.min(from + 1, areas.length - 1);
    const t = smooth(scrollPosition - from);
    desired.position.lerpVectors(framings[from].position, framings[to].position, t);
    desired.target.lerpVectors(framings[from].target, framings[to].target, t);
    const k = cameraPlaced ? 1 - Math.exp(-dt * 5) : 1;
    cameraPosition.lerp(desired.position, k); cameraTarget.lerp(desired.target, k);
    cameraPlaced = true;
  };
  let introDepth = 0;
  let introShake = 0;
  const updateCamera = (depth = introDepth, shake = introShake) => {
    introDepth = depth; introShake = shake;
    const { bounds } = areas[0];
    const faceZ = bounds.maxZ + 1.6;
    // The lens meets the character's face, then returns to the world camera.
    const focus = clamp((depth - .45) / .55, 0, 1);
    camera.position.copy(cameraPosition).lerp(temp.set(0, 2.25, faceZ + 1.55), focus);
    camera.position.x += Math.sin(elapsed * 75) * shake * .065; camera.position.y += Math.cos(elapsed * 90) * shake * .045;
    camera.lookAt(look.copy(cameraTarget).lerp(temp.set(0, 1.98, faceZ), focus));
    if (canvasWidth) { const shift = viewShift(); camera.setViewOffset(canvasWidth, canvasHeight, shift.x * (1 - focus), shift.y * (1 - focus), canvasWidth, canvasHeight); }
    camera.updateProjectionMatrix();
  };
  const resizeScene = () => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (rect.width !== canvasWidth || rect.height !== canvasHeight) {
      canvasWidth = rect.width; canvasHeight = rect.height;
      renderer.setSize(rect.width, rect.height, false);
    }
    camera.aspect = rect.width / rect.height;
    frameAreas(); measureScroll(); placeCamera(0);
    updateCamera(); renderer.render(scene, camera);
  };
  const resize = new ResizeObserver(() => { cameraPlaced = false; resizeScene(); }); resize.observe(host); resizeScene();
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; if (!visible) cancelSpeech(); syncAudio(); }, { threshold: .01 }); visibility.observe(host);

  const cancelActivity = () => { activities.cancel(); activityProps.beforeMixer(); requestedStation = null; };
  const enterArea = (index: number, at = restPoint(index)) => {
    areaIndex = index; area = areas[index];
    activities.setStations(area.stations); activityProps.beforeMixer();
    target = null; targetRing.visible = false; state = createCharacterState(at); hopTo = state.position; lastBump = 0;
  };
  const command = (destination: Vec2) => {
    target = resolveCharacterTarget(state.position, destination, area.obstacles, area.bounds); cancelActivity(); cancelSpeech(); waveUntil = afroUntil = 0;
    targetRing.visible = true;
    options.onMessage('On my way. Click another spot to change course.');
  };
  const goToStation = (id: string) => {
    if (!activities.request(id)) return false;
    // Chatter stops for the new errand; an arrival or station line he is in the middle of may finish.
    target = null; targetRing.visible = false; waveUntil = afroUntil = 0; requestedStation = id;
    if (speechKind !== 'event') cancelSpeech();
    audio.sfx('select');
    options.onMessage(`Off to the ${stationOf(id)?.label ?? 'next thing'}.`);
    return true;
  };
  const pokeAfro = () => {
    target = null; targetRing.visible = false; cancelActivity(); cancelSpeech(); waveUntil = 0;
    afroUntil = elapsed + 1.5;
    audio.sfx('poke');
    say(AFRO_LINES[Math.min(afroClicks, AFRO_LINES.length - 1)].line, 'annoyed');
    afroClicks += 1;
  };
  const settled = () => phase === 'roam' && tourFrame.phase === 'settled';
  const sceneClick = (event: PointerEvent) => {
    if (paused || !settled()) return;
    const rect = host.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    // Priority: the afro, then a station in this area, then the floor under the pointer.
    if (head && rayHitsSphere(raycaster.ray.origin, raycaster.ray.direction, { center: head.getWorldPosition(afroCenter).addScaledVector(actor.up, afroRadius), radius: afroRadius })) { pokeAfro(); return; }
    const station = area.pick(raycaster);
    if (station && goToStation(station)) return;
    ground.constant = -origins[areaIndex].y;
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const { bounds } = area;
    // Areas stack on y only, so the hit's x and z are already area-local.
    command({ x: clamp(hit.x, bounds.minX + .22, bounds.maxX - .22), z: clamp(hit.z, bounds.minZ + .22, bounds.maxZ - .22) });
  };
  const clicks = new CharacterClickInput();
  const interactive = (event: PointerEvent) => !!(event.target as HTMLElement)?.closest?.(CHARACTER_UI_SELECTOR);
  const pointerDown = (event: PointerEvent) => clicks.down(event, interactive(event));
  const pointerUp = (event: PointerEvent) => { if (clicks.up(event, interactive(event))) sceneClick(event); };
  const pointerCancel = () => clicks.cancel();
  const stopMovement = () => { target = null; targetRing.visible = false; cancelActivity(); options.onMessage('Click the floor to send me exploring.'); };
  const onDocumentVisibility = () => { if (document.hidden) { cancelSpeech(); clicks.cancel(); } last = 0; syncAudio(); };
  document.addEventListener('visibilitychange', onDocumentVisibility);
  window.addEventListener('scroll', measureScroll, { passive: true });
  window.addEventListener('resize', measureScroll, { passive: true });
  const contextLost = (event: Event) => { event.preventDefault(); options.onError(); };
  inputSurface.addEventListener('pointerdown', pointerDown as EventListener);
  inputSurface.addEventListener('pointerup', pointerUp as EventListener);
  inputSurface.addEventListener('pointercancel', pointerCancel);
  inputSurface.addEventListener('pointerleave', pointerCancel);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);

  /** One-shot speech and sound for each tour beat; positions are sampled every frame below. */
  const startTourPhase = (frame: TourFrame) => {
    if (lastTourPhase === 'recover') state = createCharacterState(hopTo, state.heading);
    const started = frame.started!;
    if (started === 'chase' || started === 'jump') { cancelActivity(); cancelSpeech(); target = null; targetRing.visible = false; waveUntil = afroUntil = 0; }
    if (started === 'chase') say(CHASE_LINE.line, 'greeting');
    if (started === 'trip') { tourFrom.set(state.position.x, 0, state.position.z); audio.sfx('trip'); }
    if (started === 'fall') { tourFrom.set(areas[frame.from].exit.x, 0, areas[frame.from].exit.z).add(origins[frame.from]); audio.sfx('fall'); }
    if (started === 'jump') { tourFrom.copy(actor.position).setY(origins[frame.from].y); say(JUMP_LINE.line, 'greeting'); audio.sfx('jump'); }
    if (started === 'land') { audio.sfx('land'); say('Ow', 'bonk'); }
    if (started === 'recover') { hopTo = restPoint(frame.area); say(AREA_ARRIVAL_LINES[area.id].line, 'greeting'); }
    if (started === 'settled') { state = createCharacterState(hopTo, state.heading); options.onMessage('Click the floor, my things, or my afro.'); }
  };
  /** World-space pose for the scripted part of a transition. Returns the clip to play. */
  const poseTour = (frame: TourFrame): keyof typeof clips => {
    const p = frame.progress;
    const exit = areas[frame.from].exit;
    const landing = areas[frame.to].landing;
    const land = temp.set(landing.x, landing.y, landing.z).add(origins[frame.to]);
    let pitch = 0, squash = 1, yaw = state.heading;
    if (frame.phase === 'trip') {
      const x = THREE.MathUtils.lerp(tourFrom.x, exit.x, smooth(p)), z = THREE.MathUtils.lerp(tourFrom.z, exit.z, smooth(p));
      actor.position.set(x, 0, z).add(origins[frame.from]);
      if (Math.hypot(exit.x - tourFrom.x, exit.z - tourFrom.z) > 1e-3) yaw = Math.atan2(exit.x - tourFrom.x, exit.z - tourFrom.z);
      pitch = .9 * smooth(p) + .18 * Math.sin(p * Math.PI * 3) * (1 - p);
    } else if (frame.phase === 'fall') {
      actor.position.lerpVectors(tourFrom, land, smooth(p));
      actor.position.y = THREE.MathUtils.lerp(tourFrom.y, land.y, p * p) + 1.4 * p * (1 - p);
      yaw = Math.atan2(land.x - tourFrom.x, land.z - tourFrom.z);
      // One forward tumble that ends upright for the landing.
      pitch = .9 + (Math.PI * 2 - .9) * smooth(p);
    } else if (frame.phase === 'jump') {
      const q = clamp((p - .2) / .8, 0, 1);
      squash = p < .2 ? 1 - .22 * smooth(p / .2) : 1 + .08 * Math.sin(q * Math.PI);
      actor.position.lerpVectors(tourFrom, land, smooth(q));
      actor.position.y = THREE.MathUtils.lerp(tourFrom.y, land.y, 1 - (1 - q) ** 2) + 1.2 * Math.sin(q * Math.PI);
      if (q > 0) yaw = Math.atan2(land.x - tourFrom.x, land.z - tourFrom.z);
      pitch = -Math.PI * 2 * smooth(q);
    } else if (frame.phase === 'land') {
      actor.position.copy(land); actor.position.y += .3 * Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p);
      squash = 1 - .35 * Math.sin(Math.min(1, p * 2) * Math.PI) * (1 - p);
      yaw = 0;
    } else if (frame.phase === 'recover') {
      const q = clamp((p - .35) / .65, 0, 1);
      actor.position.set(THREE.MathUtils.lerp(landing.x, hopTo.x, smooth(q)), THREE.MathUtils.lerp(landing.y, 0, q) + .45 * Math.sin(q * Math.PI), THREE.MathUtils.lerp(landing.z, hopTo.z, smooth(q))).add(origins[frame.to]);
      yaw = 0;
    }
    state.heading = yaw;
    actor.rotation.set(pitch, yaw, 0); actor.scale.set(1, squash, 1);
    return frame.phase === 'trip' || frame.phase === 'fall' ? 'run' : 'idle';
  };

  const tick = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden || paused) { last = 0; return; }
    if (now - lastRender < 1000 / 30) return;
    const dt = last ? Math.min((now - last) / 1000, .1) : 1 / 30;
    last = lastRender = now; elapsed += dt;
    if (phase !== 'roam' && scrollPosition > .3) skipIntro();
    const story = intro.tick(dt);
    if (phase !== story.phase) {
      if (story.dialogueEnded) endCaption();
      if (story.phase === 'bonk') audio.sfx('bonk');
      phase = story.phase;
      if (phase === 'roam') { state = createCharacterState(restPoint(0)); lastBump = 0; sessionSkippedIntro = true; }
      options.onPhase(phase);
    }
    if (story.dialogueStarted) say(story.dialogueStarted.line, phase === 'recoil' ? 'bonk' : 'greeting', 'event', story.dialogueStarted.duration);
    wrapper.style.setProperty('--intro-black', String(story.blackOpacity));
    wrapper.style.setProperty('--intro-title', String(story.titleOpacity));
    const roaming = phase === 'roam';
    placeCamera(dt);
    updateCamera(roaming ? 0 : story.pose.depth, story.cameraShake);

    if (roaming) {
      tourFrame = tour.tick(dt, { viewArea: viewArea() });
      if (tourFrame.area !== areaIndex) enterArea(tourFrame.area);
      if (tourFrame.started) startTourPhase(tourFrame);
      lastTourPhase = tourFrame.phase;
    }
    const traveling = tourFrame.phase !== 'settled';
    if (pendingVisit && settled() && areas[areaIndex].stations.some((station) => station.id === pendingVisit)) { goToStation(pendingVisit); pendingVisit = null; }
    const afroGuard = elapsed < afroUntil;
    const manual = !!target || elapsed < waveUntil || pendingManualGreeting || afroGuard;
    const activityFrame: ActivityFrame = activities.tick(dt, {
      position: state.position, speed: state.speed, commanded: !roaming || traveling || manual,
      // Idle chatter holds the next routine so he never wanders off mid-sentence.
      paused: !manual && speechActive && speechKind !== 'event',
    });
    const station = stationOf(activityFrame.stationId);
    if (activityFrame.started) {
      const requested = requestedStation === activityFrame.started; requestedStation = null;
      if (activityFrame.kind === 'admire' || activityFrame.kind === 'play') audio.sfx('sparkle');
      const lines = STATION_LINES[activityFrame.started];
      // Visitor requests always talk; his own loop rotates lines and spaces them out.
      if (lines?.length && (requested || elapsed >= nextStationLineAt)) {
        const line = lines[(stationLineTurns[activityFrame.started] ?? 0) % lines.length];
        stationLineTurns[activityFrame.started] = (stationLineTurns[activityFrame.started] ?? 0) + 1;
        say(line.line, line === PORTRAIT_LINE ? 'wonder' : 'fact');
        nextStationLineAt = elapsed + 24;
      }
    }
    if (activityFrame.phase !== lastActivityPhase) {
      if (activityFrame.phase === 'pickup-ball' || activityFrame.phase === 'pickup-book') audio.sfx('pickup');
      if (activityFrame.phase === 'toss-ball') audio.sfx('toss');
      if (activityFrame.phase === 'catch-ball') audio.sfx('catch');
      lastActivityPhase = activityFrame.phase;
    }
    activityProps.beforeMixer();
    const origin = origins[areaIndex];
    let clip: keyof typeof clips;
    if (roaming && (!traveling || tourFrame.phase === 'chase')) {
      const exit = areas[tourFrame.from].exit;
      stepCharacter(state, tourFrame.phase === 'chase' ? exit : elapsed < waveUntil || afroGuard ? null : target ?? activityFrame.target, dt, area.obstacles, area.bounds);
      if (target && Math.hypot(target.x - state.position.x, target.z - state.position.z) < .13 && state.speed < .08) { target = null; targetRing.visible = false; options.onMessage('Click my things to see what I get up to.'); }
      if (target) targetRing.position.set(target.x, .01, target.z).add(origin);
      const seated = station?.seat !== undefined && activityFrame.animation === 'sit' && !target;
      const lift = seated ? (station!.seat! - seatBase) * smooth(activityFrame.sitProgress) : 0;
      actor.position.set(state.position.x, lift + (state.bumpRemaining > 0 ? Math.sin(state.bumpRemaining * 16) * .05 : 0), state.position.z).add(origin);
      if (activityFrame.heading !== null && state.speed < .08 && !target) {
        // Turn the short way: station headings sit on both sides of the ±π seam.
        const turn = Math.atan2(Math.sin(activityFrame.heading - state.heading), Math.cos(activityFrame.heading - state.heading));
        state.heading = THREE.MathUtils.damp(state.heading, state.heading + turn, 8, dt);
      }
      actor.rotation.set(0, state.heading, state.bumpRemaining > 0 ? Math.sin(state.bumpRemaining * 25) * .06 : 0);
      actor.scale.set(1, 1, 1);
      if (state.bumpCount !== lastBump) {
        lastBump = state.bumpCount; audio.sfx('bonk');
        // Furniture-dense rooms bump often: the bonk always plays, the apology only now and then and never over another line.
        if (!speechActive && elapsed >= nextBumpLineAt) { say(BUMP_LINE.line, 'bonk'); nextBumpLineAt = elapsed + 45; }
      }
      clip = elapsed < waveUntil ? 'wave' : activityFrame.animation === 'sit' && !target ? 'sit' : state.motion === 'run' ? 'run' : state.motion === 'walk' ? 'walk' : 'idle';
    } else if (roaming) {
      clip = poseTour(tourFrame);
    } else {
      const depth = story.pose.depth;
      const faceZ = areas[0].bounds.maxZ + 1.6;
      actor.position.set(THREE.MathUtils.lerp(introRest.x, 0, depth), story.pose.lift, THREE.MathUtils.lerp(introRest.z, faceZ, depth));
      actor.rotation.set(story.pose.lean, story.pose.turn, 0);
      actor.scale.set(1, story.pose.squash, 1);
      clip = phase === 'approach' ? 'run' : phase === 'recover' ? 'wave' : 'idle';
    }
    play(clip);
    if (current && (clip === 'walk' || clip === 'run')) current.timeScale = traveling ? 1.4 : clamp(state.speed / (clip === 'run' ? 2.4 : 1), .6, 1.6);
    if (current && clip === 'sit') { current.paused = true; current.time = activityFrame.sitProgress * 1.5; }
    // Real elapsed time drives every clip, independent of page scrolling.
    mixer.update(dt);
    activityProps.apply(activityFrame);
    if (afroGuard) {
      activityProps.pose({ kind: 'afro', reach: head!.getWorldPosition(afroCenter).addScaledVector(actor.up, afroRadius * .8), weight: envelope(1 - (afroUntil - elapsed) / 1.5), time: elapsed, progress: 0 });
    } else if (station && activityFrame.phase === 'perform') {
      const reach = temp.set(station.reach.x, station.reach.y, station.reach.z).add(origin);
      activityProps.pose({ kind: station.kind, reach, weight: envelope(activityFrame.progress), time: activityFrame.time, progress: activityFrame.progress });
    }
    const loop = station && activityFrame.phase === 'perform' ? STATION_LOOPS[station.id] : undefined;
    if (loop) {
      const beat = Math.floor(activityFrame.time / loop[1]);
      if (beat !== lastBeat) { lastBeat = beat; audio.sfx(loop[0], { pitch: .94 + beat % 3 * .05 }); }
    } else lastBeat = -1;
    if (current && (clip === 'walk' || clip === 'run')) {
      // Two footfalls per authored cycle.
      const step = Math.floor(current.time / current.getClip().duration * 2);
      if (step !== lastStep) { lastStep = step; audio.sfx('step', { volume: clip === 'run' ? .8 : .6 }); }
    } else lastStep = -1;
    const performing = activityFrame.phase !== 'idle' && !activityFrame.phase.startsWith('approach');
    areas.forEach((each, index) => {
      // Neighbours stay drawn for the scroll between them; areas two floors away are skipped.
      each.group.visible = Math.abs(cameraTarget.y - framings[index].target.y) < 20;
      if (each.group.visible) each.update(dt, elapsed, index === areaIndex && performing ? { stationId: activityFrame.stationId, progress: activityFrame.progress } : { stationId: null, progress: 0 });
    });
    const local = localPosition.copy(actor.position).sub(origin);
    shadow.visible = roaming && (!traveling || tourFrame.phase === 'chase' || tourFrame.phase === 'trip') && local.y < .3;
    shadow.position.set(actor.position.x, origin.y + .012, actor.position.z);

    const free = roaming && !traveling && state.motion === 'idle' && state.speed < .05 && !activityFrame.active && !manual;
    if (free && pendingManualGreeting) { idle.greetNow(); pendingManualGreeting = false; }
    const idleFrame = idle.tick(dt, free && (!speechActive || speechKind === 'idle'));
    if (free) actor.position.y += idleFrame.bob;
    if (idleFrame.greetingStarted) {
      say(idleFrame.greetingStarted.line, 'greeting', 'idle', idleFrame.greetingStarted.duration);
      sessionGreetingCount = idleFrame.greetingsShown; writeSession('good-vibes-greetings-v1', sessionGreetingCount);
    }
    if (idleFrame.greetingEnded && speechKind === 'idle') endCaption();
    const tidbit = tidbits.tick(dt, { area: area.id, ready: free && !speechActive && elapsed >= waveUntil });
    if (tidbit) { say(tidbit.line, 'fact', 'chat'); sessionTidbitCount = tidbits.spoken; writeSession('good-vibes-tidbits-v1', sessionTidbitCount); }
    if (speechActive && elapsed > captionUntil) endCaption();
    const mouth = elapsed < talkUntil ? Math.max(idleFrame.mouthOpen, .35 + .65 * Math.max(0, Math.sin(elapsed * 18))) : idleFrame.mouthOpen;
    // The face stays alive during locomotion, tours and station play, not only when idle.
    face.apply({ active: true, blink: idleFrame.blink, mouth, time: elapsed });
    host.dataset.phase = phase; host.dataset.motion = roaming ? traveling ? tourFrame.phase === 'chase' ? state.motion : 'tour' : state.motion : phase === 'approach' ? 'run' : 'idle';
    host.dataset.activity = activityFrame.phase;
    host.dataset.area = area.id; host.dataset.tour = tourFrame.phase; host.dataset.station = activityFrame.stationId ?? '';
    host.dataset.position = `${local.x.toFixed(3)},${local.z.toFixed(3)}`;
    host.dataset.bumps = String(state.bumpCount); host.dataset.introTime = story.elapsed.toFixed(3);
    host.dataset.blink = idleFrame.blink.toFixed(3); host.dataset.mouth = mouth.toFixed(3);
    renderer.render(scene, camera);
  };
  const skipIntro = () => {
    intro.skip(); sessionSkippedIntro = true; endCaption();
    wrapper.style.setProperty('--intro-black', '0'); wrapper.style.setProperty('--intro-title', '0');
    if (phase === 'roam') return;
    phase = 'roam'; options.onPhase('roam');
    // Skipping mid-page lands him straight in the viewed area.
    tour.jumpTo(viewArea()); tourFrame = { ...tourFrame, area: viewArea(), from: viewArea(), to: viewArea(), phase: 'settled', progress: 0, started: null };
    enterArea(viewArea());
    actor.position.set(state.position.x, 0, state.position.z).add(origins[areaIndex]); actor.rotation.set(0, 0, 0); actor.scale.set(1, 1, 1);
    play('idle'); mixer.update(0); updateCamera(0, 0); renderer.render(scene, camera);
  };
  // Loaded model, areas, and event handlers are all ready before intro time starts.
  if (introSkipped) { phase = 'roam'; enterArea(areaIndex); actor.position.set(state.position.x, 0, state.position.z).add(origins[areaIndex]); }
  options.onPhase(phase); renderer.render(scene, camera); raf = requestAnimationFrame(tick);
  const wave = () => { if (paused || (phase === 'roam' && !settled())) return; skipIntro(); stopMovement(); waveUntil = elapsed + 2; pendingManualGreeting = true; };
  return {
    skipIntro, wave,
    setSoundEnabled: async (enabled) => { if (!enabled) { audio.mute(); return false; } return audio.enableFromGesture(); },
    setMusicEnabled: (enabled) => audio.setMusic(enabled),
    setPaused: (value) => { paused = value; last = 0; clicks.cancel(); if (value) { intro.tick(0, { paused: true }); cancelSpeech(); } syncAudio(); host.dataset.paused = String(value); },
    reset: () => {
      skipIntro(); stopMovement(); paused = false; host.dataset.paused = 'false'; syncAudio();
      tour.jumpTo(viewArea()); tourFrame = { ...tourFrame, area: viewArea(), from: viewArea(), to: viewArea(), phase: 'settled', progress: 0, started: null };
      enterArea(viewArea()); activities.reset(); activityProps.reset(); pendingVisit = null;
    },
    visit: (id) => {
      if (paused || !areas.some((each) => each.stations.some((station) => station.id === id))) return;
      if (phase !== 'roam') skipIntro();
      pendingVisit = id;
    },
    key: (key) => {
      if (key === ' ') { wave(); return true; }
      if (key === 'Escape') { cancelSpeech(); stopMovement(); return true; }
      const deltas: Record<string, Vec2> = { ArrowLeft: { x: -.65, z: 0 }, ArrowRight: { x: .65, z: 0 }, ArrowUp: { x: 0, z: -.65 }, ArrowDown: { x: 0, z: .65 } };
      const delta = deltas[key]; if (!delta || paused) return false;
      if (phase !== 'roam') skipIntro();
      if (!settled()) return true;
      const { bounds } = area;
      command({ x: clamp(state.position.x + delta.x, bounds.minX + .22, bounds.maxX - .22), z: clamp(state.position.z + delta.z, bounds.minZ + .22, bounds.maxZ - .22) }); return true;
    },
    dispose: () => {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf);
      resize.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', onDocumentVisibility);
      window.removeEventListener('scroll', measureScroll); window.removeEventListener('resize', measureScroll);
      cancelSpeech(); void audio.dispose(); activityProps.dispose();
      inputSurface.removeEventListener('pointerdown', pointerDown as EventListener); inputSurface.removeEventListener('pointerup', pointerUp as EventListener); inputSurface.removeEventListener('pointercancel', pointerCancel); inputSurface.removeEventListener('pointerleave', pointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      mixer.stopAllAction(); mixer.uncacheRoot(model); disposeAreas(); disposeObject(scene); shadowTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}

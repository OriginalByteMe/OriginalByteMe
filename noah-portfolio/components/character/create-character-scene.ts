import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CharacterIdleController } from '@/lib/character/idle';
import { CharacterIntroController, type IntroPhase } from '@/lib/character/intro';
import { CharacterActivityController, type ActivityFrame } from '@/lib/character/activities';
import { createActivityProps } from '@/lib/character/activity-props';
import { CharacterAudio, utteranceDuration, type SfxName, type VoiceKind } from '@/lib/character/audio';
import { createFaceLayer, EXPRESSIONS, type ExpressionName } from '@/lib/character/face';
import { CharacterClickInput, CHARACTER_UI_SELECTOR, rayHitsSphere } from '@/lib/character/input';
import { createCharacterState, stepCharacter, resolveCharacterTarget, type Vec2 } from '@/lib/character/controller';
import { CharacterTourController, areaScrollPosition, type TourFrame, type TourPhase } from '@/lib/character/tour';
import { AFRO_LINES, AREA_ARRIVAL_LINES, BUMP_LINE, CHASE_LINE, PORTRAIT_LINE, STATION_LINES, CharacterTidbitController } from '@/lib/character/narrative';
import type { WorldContent } from '@/lib/character/world-content';
import { createAbout } from './world/about';
import { createBedroom } from './world/bedroom';
import { createGarage } from './world/garage';
import { createHall } from './world/hall';
import { createLab } from './world/lab';
import { createPostoffice } from './world/postoffice';
import { createToolshed } from './world/toolshed';
import { createStreet, LOT_SPACING, lotOrigin, STREET_Z } from './world/town';
import { LOTS, type AreaBuilder, type AreaId, type Station, type WorldArea } from './world/types';

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
}
/** Where the page shows the Visit link for the station he is presenting, in host pixels. */
export type CharacterSign = { url: string; label: string; x: number; y: number };
export type CharacterSceneOptions = {
  content: WorldContent;
  onMessage: (message: string) => void;
  onGreeting: (line: string | null) => void;
  onPhase: (phase: IntroPhase) => void;
  /** The Visit sign while he presents a station with a url; null takes it down. */
  onSign: (sign: CharacterSign | null) => void;
  onError: () => void;
};
type SpeechKind = 'idle' | 'chat' | 'event';

let sessionGreetingCount = 0;
let sessionTidbitCount = 0;
let sessionSkippedIntro = false;
const BUILDERS: Record<AreaId, AreaBuilder> = {
  home: createBedroom, hall: createHall, workshop: createLab, toolshed: createToolshed, gallery: createAbout, garage: createGarage, postoffice: createPostoffice,
};
const CHARACTER_HEIGHT = 2.45;
/** Measured on the GLB: the held 08_Sit_Relaxed frame rests its lowest seated vertices 0.13 below the pelvis bone. */
const SEAT_CLEARANCE = .13;
/** Dead-on down -z with a gentle downward tilt. */
const CAMERA_DIRECTION = new THREE.Vector3(0, .3, 1).normalize();
/** Host pixels the framing and the Visit sign keep clear: top chrome and eyebrow, sides, and the controls plus Ask bar at the bottom (two rows of controls when narrow). */
const CHROME = { top: 110, side: 24, bottom: 200, narrowBottom: 270 };
/** The Visit sign stands on the floor just in front of his feet; the page centres it below this point. */
const SIGN_OFFSET = new THREE.Vector3(0, 0, .6);
/** Widest the sign gets, in host pixels: its CSS max-width (16rem). Keeps it whole on screen. */
const SIGN_WIDTH = 256;
/** Sound and seconds between repeats while performing at a station; each `type` call is itself a burst of clicks. */
const STATION_LOOPS: Record<string, [SfxName, number]> = { desk: ['type', .3], printer: ['printer', 2.2], rack: ['rack', 3], skills: ['poke', .9] };
const clamp = THREE.MathUtils.clamp;
/** Skin colour he reddens toward at full anger. */
const FURY = new THREE.Color(0xe8392b);
const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
/** Ease a pose in over the first and out over the last eighth of a perform. */
const envelope = (progress: number) => smooth(progress / .12) * (1 - smooth((progress - .88) / .12));
const readSession = (key: string) => { try { return Number(window.sessionStorage.getItem(key)) || 0; } catch { return 0; } };
const writeSession = (key: string, value: number) => { try { window.sessionStorage.setItem(key, String(value)); } catch { /* In-memory count remains. */ } };

/** An imperative, disposable scene keeps the animation loop outside React. */
export async function createCharacterScene(host: HTMLElement, options: CharacterSceneOptions): Promise<CharacterScene> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  // Transparent clear: the page's dithered Backdrop shows through as the sky.
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
  const origins = LOTS.map((_, lot) => lotOrigin(lot));
  const areas: WorldArea[] = [];
  const disposeAreas = () => { for (const area of areas.splice(0)) { area.group.removeFromParent(); area.dispose(); } };
  let gltf;
  try {
    gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/good-vibes-hero.glb');
    LOTS.forEach(({ id }, lot) => { const area = BUILDERS[id](origins[lot].clone(), options.content); areas.push(area); scene.add(area.group); });
    scene.add(createStreet());
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
  // His face, ears and neck share one skin material with his arms; a private copy reddens only the face.
  const meshes: THREE.Mesh[] = [];
  model.traverse((node) => { if (node instanceof THREE.Mesh) meshes.push(node); });
  const skin = meshes.find((mesh) => mesh.name.startsWith('Head'))?.material;
  const blush = skin instanceof THREE.MeshStandardMaterial ? skin.clone() : null;
  const skinColor = blush?.color.clone() ?? new THREE.Color();
  for (const mesh of meshes) if (blush && mesh.material === skin && !mesh.name.startsWith('Arm')) mesh.material = blush;
  // Steam over the afro at the angriest levels: soft puffs drawn like the contact shadow, with a lilac rim so they read on light walls.
  const steamCanvas = document.createElement('canvas');
  steamCanvas.width = steamCanvas.height = 64;
  const steamContext = steamCanvas.getContext('2d')!;
  const puffGradient = steamContext.createRadialGradient(32, 32, 2, 32, 32, 31);
  puffGradient.addColorStop(0, 'rgba(255,255,255,1)'); puffGradient.addColorStop(.62, 'rgba(250,247,252,.95)');
  puffGradient.addColorStop(.82, 'rgba(160,146,182,.75)'); puffGradient.addColorStop(1, 'rgba(160,146,182,0)');
  steamContext.fillStyle = puffGradient; steamContext.fillRect(0, 0, 64, 64);
  const steamTexture = new THREE.CanvasTexture(steamCanvas);
  const steam = Array.from({ length: 6 }, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTexture, transparent: true, depthWrite: false })));
  for (const puff of steam) { puff.visible = false; scene.add(puff); }
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
  const sections = LOTS.map(({ section }) => worldRoot?.querySelector<HTMLElement>(`#${section}`)).filter((section): section is HTMLElement => !!section);
  let scrollPosition = 0;
  const measureScroll = () => { scrollPosition = sections.length === areas.length ? areaScrollPosition(sections.map((section) => section.getBoundingClientRect()), window.innerHeight) : 0; };
  measureScroll();
  const viewArea = () => Math.round(scrollPosition);
  // The intro belongs to the home lot; arriving mid-page (a deep link) puts him straight at the viewed lot.
  const midPage = scrollPosition > .2;
  let areaIndex = midPage ? viewArea() : 0;
  let area = areas[areaIndex];
  const introRest = { ...areas[0].entry };
  let state = createCharacterState({ ...area.entry });
  let target: Vec2 | null = null;
  let paused = false;
  let visible = true;
  let audioSuspended = false;
  let last = 0;
  let lastRender = 0;
  let waveUntil = 0;
  let afroUntil = 0;
  let afroClicks = 0;
  /** One level per afro poke, up to one per afro line; cools off gradually after a quiet spell. */
  let anger = 0;
  let lastPoke = -Infinity, shakeAt = -Infinity, stompAt = -Infinity;
  let surprisedUntil = 0, laughUntil = 0, winkAt = -Infinity, yawnAt = 0, lastInput = 0;
  /** Blend weights for facing the camera while he talks: whole body when standing free, head and neck at a station. */
  let faceBody = 0, faceHead = 0;
  const expressionGoals = Object.fromEntries(EXPRESSIONS.map((name) => [name, 0])) as Record<ExpressionName, number>;
  const expressions = { ...expressionGoals };
  let elapsed = 0;
  let lastBump = 0;
  let phase: IntroPhase = 'opening';
  let captionUntil = 0;
  let talkUntil = 0;
  let speechActive = false;
  let speechKind: SpeechKind | null = null;
  let pendingManualGreeting = false;
  let requestedStation: string | null = null;
  let nextStationLineAt = 0;
  let nextBumpLineAt = 0;
  const stationLineTurns: Record<string, number> = {};
  let lastActivityPhase = 'idle';
  let lastStep = -1;
  let lastBeat = -1;
  let tourFrame: TourFrame = { area: areaIndex, from: areaIndex, to: areaIndex, phase: 'settled', progress: 0, started: null };
  let lastTourPhase: TourPhase = 'settled';
  /** This leg's walk in world space: out to the street, along it and in to the lot's entry; `along` holds cumulative lengths. */
  const path = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const along = [0, 0, 0, 0];
  let travelSpeed = 0;
  /** The station he is presenting to the camera: what it says and links, when it began, when each line starts. */
  let presentation: { id: string; present: NonNullable<Station['present']>; start: number; cues: number[]; total: number; spoken: number } | null = null;
  /** Where the Visit sign was last reported; NaN while none is up. */
  let signX = NaN, signY = NaN;
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
  const gaze = new THREE.Vector3();
  const inputSurface = worldRoot ?? host;
  const wrapper = host.closest('.character-hero') as HTMLElement;
  wrapper.style.setProperty('--intro-black', introSkipped ? '0' : '1');

  // Camera framing per lot: dead-on, the whole lot inside the free screen area, the projection shifted so the lot sits mid-area.
  const framings = areas.map(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3(), shift: new THREE.Vector2() }));
  // Measured once in build pose: the builders' view centre undersells their slabs, walls and signs.
  const areaCorners = areas.map(({ group }) => {
    const { min, max } = new THREE.Box3().setFromObject(group);
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));
  });
  const probe = new THREE.PerspectiveCamera();
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const cameraShift = new THREE.Vector2();
  const desired = { position: new THREE.Vector3(), target: new THREE.Vector3(), shift: new THREE.Vector2() };
  const look = new THREE.Vector3();
  let cameraPlaced = false;
  let canvasWidth = 0;
  let canvasHeight = 0;
  const chromeBottom = () => camera.aspect >= 1.05 ? CHROME.bottom : CHROME.narrowBottom;
  const frameAreas = () => {
    const wide = camera.aspect >= 1.05;
    areas.forEach(({ view }, index) => {
      // The home lot also keeps clear of the hero copy: its left half when wide, its top half when narrow.
      const left = index === 0 && wide ? canvasWidth * .5 : CHROME.side;
      const top = index === 0 && !wide ? canvasHeight * .47 : CHROME.top;
      const minX = left / canvasWidth * 2 - 1, maxX = 1 - CHROME.side / canvasWidth * 2;
      const minY = chromeBottom() / canvasHeight * 2 - 1, maxY = 1 - top / canvasHeight * 2;
      const framing = framings[index];
      framing.shift.set(-(minX + maxX) / 4 * canvasWidth, (minY + maxY) / 4 * canvasHeight);
      probe.copy(camera);
      probe.setViewOffset(canvasWidth, canvasHeight, framing.shift.x, framing.shift.y, canvasWidth, canvasHeight);
      const target = framing.target.set(view.center.x, view.center.y, view.center.z).add(origins[index]);
      let near = 1, far = 90;
      for (let step = 0; step < 18; step += 1) {
        const distance = (near + far) / 2;
        probe.position.copy(target).addScaledVector(CAMERA_DIRECTION, distance); probe.lookAt(target); probe.updateMatrixWorld();
        const fits = areaCorners[index].every((corner) => { temp.copy(corner).project(probe); return temp.x >= minX && temp.x <= maxX && temp.y >= minY && temp.y <= maxY; });
        if (fits) far = distance; else near = distance;
      }
      framing.position.copy(target).addScaledVector(CAMERA_DIRECTION, far);
    });
  };
  /** Scrolling eases the camera along the street between neighbouring lots' framings. */
  const placeCamera = (dt: number) => {
    const from = clamp(Math.floor(scrollPosition), 0, areas.length - 1), to = Math.min(from + 1, areas.length - 1);
    const t = smooth(scrollPosition - from);
    desired.position.lerpVectors(framings[from].position, framings[to].position, t);
    desired.target.lerpVectors(framings[from].target, framings[to].target, t);
    desired.shift.lerpVectors(framings[from].shift, framings[to].shift, t);
    const k = cameraPlaced ? 1 - Math.exp(-dt * 5) : 1;
    cameraPosition.lerp(desired.position, k); cameraTarget.lerp(desired.target, k); cameraShift.lerp(desired.shift, k);
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
    if (canvasWidth) camera.setViewOffset(canvasWidth, canvasHeight, cameraShift.x * (1 - focus), cameraShift.y * (1 - focus), canvasWidth, canvasHeight);
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

  const endPresentation = () => {
    presentation = null;
    if (Number.isNaN(signX)) return;
    signX = signY = NaN; options.onSign(null);
  };
  const cancelActivity = () => { activities.cancel(); activityProps.beforeMixer(); requestedStation = null; endPresentation(); };
  const enterArea = (index: number) => {
    areaIndex = index; area = areas[index];
    activities.setStations(area.stations); activityProps.beforeMixer(); endPresentation();
    target = null; targetRing.visible = false; state = createCharacterState({ ...area.entry }, state.heading); lastBump = 0;
  };
  const command = (destination: Vec2) => {
    target = resolveCharacterTarget(state.position, destination, area.obstacles, area.bounds); cancelActivity(); cancelSpeech(); waveUntil = afroUntil = 0;
    targetRing.visible = true;
    options.onMessage('On my way. Click another spot to change course.');
  };
  const goToStation = (id: string) => {
    if (!activities.request(id)) return false;
    endPresentation();
    // Chatter stops for the new errand; an arrival or station line he is in the middle of may finish.
    target = null; targetRing.visible = false; waveUntil = afroUntil = 0; requestedStation = id;
    if (speechKind !== 'event') cancelSpeech();
    audio.sfx('select');
    options.onMessage(`Off to the ${stationOf(id)?.label ?? 'next thing'}.`);
    return true;
  };
  const wake = () => { lastInput = elapsed; };
  const pokeAfro = () => {
    target = null; targetRing.visible = false; cancelActivity(); cancelSpeech(); waveUntil = 0;
    afroUntil = elapsed + 1.5;
    audio.sfx('poke');
    say(AFRO_LINES[Math.min(afroClicks, AFRO_LINES.length - 1)].line, 'annoyed');
    afroClicks += 1;
    // Each poke is one level angrier: a head shake while annoyed, a stomp at the angriest levels.
    anger = Math.min(AFRO_LINES.length, Math.floor(anger) + 1); lastPoke = elapsed;
    if (anger > 2) stompAt = elapsed; else shakeAt = elapsed;
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
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const { bounds } = area, origin = origins[areaIndex];
    command({ x: clamp(hit.x - origin.x, bounds.minX + .22, bounds.maxX - .22), z: clamp(hit.z - origin.z, bounds.minZ + .22, bounds.maxZ - .22) });
  };
  const clicks = new CharacterClickInput();
  const interactive = (event: PointerEvent) => !!(event.target as HTMLElement)?.closest?.(CHARACTER_UI_SELECTOR);
  const pointerDown = (event: PointerEvent) => { wake(); clicks.down(event, interactive(event)); };
  const pointerUp = (event: PointerEvent) => { if (clicks.up(event, interactive(event))) sceneClick(event); };
  const pointerCancel = () => clicks.cancel();
  const stopMovement = () => { target = null; targetRing.visible = false; cancelActivity(); options.onMessage('Click the floor to send me exploring.'); };
  const onDocumentVisibility = () => { if (document.hidden) { cancelSpeech(); clicks.cancel(); } last = 0; syncAudio(); };
  document.addEventListener('visibilitychange', onDocumentVisibility);
  const onScroll = () => { measureScroll(); wake(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measureScroll, { passive: true });
  const contextLost = (event: Event) => { event.preventDefault(); options.onError(); };
  inputSurface.addEventListener('pointerdown', pointerDown as EventListener);
  inputSurface.addEventListener('pointerup', pointerUp as EventListener);
  inputSurface.addEventListener('pointercancel', pointerCancel);
  inputSurface.addEventListener('pointerleave', pointerCancel);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);

  /** A new leg from wherever he is: out to the street, along it, and in to the lot's entry. The first leg drops whatever he was doing. */
  const startTravel = (frame: TourFrame) => {
    if (lastTourPhase === 'settled') { cancelActivity(); cancelSpeech(); target = null; targetRing.visible = false; waveUntil = afroUntil = 0; say(CHASE_LINE.line, 'greeting'); }
    const lot = origins[frame.to], { entry } = areas[frame.to];
    path[0].set(actor.position.x, 0, actor.position.z);
    path[1].set(path[0].x, 0, STREET_Z);
    path[3].set(lot.x + entry.x, 0, lot.z + entry.z);
    path[2].set(path[3].x, 0, STREET_Z);
    for (let leg = 1; leg < path.length; leg += 1) along[leg] = along[leg - 1] + path[leg].distanceTo(path[leg - 1]);
  };
  /** Samples the leg by eased progress and turns him smoothly into each stretch. */
  const poseTravel = (frame: TourFrame, dt: number) => {
    const distance = along[3] * smooth(frame.progress);
    let leg = 1;
    while (leg < 3 && along[leg] < distance) leg += 1;
    const span = along[leg] - along[leg - 1];
    temp.copy(actor.position);
    actor.position.lerpVectors(path[leg - 1], path[leg], span > 1e-6 ? (distance - along[leg - 1]) / span : 1);
    travelSpeed = actor.position.distanceTo(temp) / dt;
    if (span > 1e-6) {
      const turn = Math.atan2(path[leg].x - path[leg - 1].x, path[leg].z - path[leg - 1].z) - state.heading;
      state.heading = THREE.MathUtils.damp(state.heading, state.heading + Math.atan2(Math.sin(turn), Math.cos(turn)), 10, dt);
    }
    actor.rotation.set(0, state.heading, 0); actor.scale.set(1, 1, 1);
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
      if (phase === 'roam') { state = createCharacterState({ ...areas[0].entry }); lastBump = 0; sessionSkippedIntro = true; }
      options.onPhase(phase);
    }
    if (story.dialogueStarted) say(story.dialogueStarted.line, phase === 'recoil' ? 'bonk' : 'greeting', 'event', story.dialogueStarted.duration);
    wrapper.style.setProperty('--intro-black', String(story.blackOpacity));
    wrapper.style.setProperty('--intro-title', String(story.titleOpacity));
    const roaming = phase === 'roam';
    placeCamera(dt);
    // The camera jolts when a stomp lands.
    const slam = elapsed - stompAt - .48;
    updateCamera(roaming ? 0 : story.pose.depth, Math.max(story.cameraShake, slam >= 0 && slam < .3 ? 1 - slam / .3 : 0));

    if (roaming) {
      tourFrame = tour.tick(dt, { viewArea: viewArea() });
      if (tourFrame.started === 'travel') startTravel(tourFrame);
      if (tourFrame.started === 'settled' || tourFrame.area !== areaIndex) enterArea(tourFrame.area);
      if (tourFrame.started === 'settled') { say(AREA_ARRIVAL_LINES[area.id].line, 'greeting'); options.onMessage('Click the floor, my things, or my afro.'); }
      lastTourPhase = tourFrame.phase;
    }
    const traveling = tourFrame.phase !== 'settled';
    const afroGuard = elapsed < afroUntil;
    const manual = !!target || elapsed < waveUntil || pendingManualGreeting || afroGuard;
    const activityFrame: ActivityFrame = activities.tick(dt, {
      position: state.position, speed: state.speed, commanded: !roaming || traveling || manual || !!presentation,
      // Idle chatter holds the next routine so he never wanders off mid-sentence.
      paused: !manual && speechActive && speechKind !== 'event',
    });
    const station = stationOf(activityFrame.stationId);
    // While he speaks he faces the visitor: his whole body when standing free, only his head and neck at a station or seated.
    const speaking = roaming && !traveling && speechActive && !target && state.speed < .08;
    faceBody = THREE.MathUtils.damp(faceBody, (speaking && !activityFrame.active) || presentation ? 1 : 0, 6, dt);
    faceHead = THREE.MathUtils.damp(faceHead, speaking && activityFrame.active && !activityFrame.phase.startsWith('approach') ? 1 : 0, 6, dt);
    if (activityFrame.started) {
      const requested = requestedStation === activityFrame.started; requestedStation = null;
      if (activityFrame.kind === 'admire' || activityFrame.kind === 'play') audio.sfx('sparkle');
      if (requested && station?.present) {
        // A presentation: he faces the camera and says its lines back to back, each holding its caption as long as say() does.
        let at = 0;
        const cues = station.present.lines.map(({ line }) => { const cue = at; at += Math.max(utteranceDuration(line, 'fact') + 1.2, 2); return cue; });
        presentation = { id: station.id, present: station.present, start: elapsed, cues, total: Math.max(at, 2), spoken: 0 };
      } else {
        const lines = STATION_LINES[activityFrame.started];
        // Visitor requests always talk; his own loop rotates lines and spaces them out.
        if (lines?.length && (requested || elapsed >= nextStationLineAt)) {
          const line = lines[(stationLineTurns[activityFrame.started] ?? 0) % lines.length];
          stationLineTurns[activityFrame.started] = (stationLineTurns[activityFrame.started] ?? 0) + 1;
          say(line.line, line === PORTRAIT_LINE ? 'wonder' : 'fact');
          nextStationLineAt = elapsed + 24;
        }
      }
    }
    if (presentation) {
      const { present, start, cues } = presentation;
      while (presentation.spoken < cues.length && elapsed - start >= cues[presentation.spoken]) say(present.lines[presentation.spoken++].line, 'fact');
    }
    if (activityFrame.phase !== lastActivityPhase) {
      if (activityFrame.phase === 'pickup-ball' || activityFrame.phase === 'pickup-book') audio.sfx('pickup');
      if (activityFrame.phase === 'toss-ball') audio.sfx('toss');
      if (activityFrame.phase === 'catch-ball') { audio.sfx('catch'); laughUntil = elapsed + 1.6; }
      lastActivityPhase = activityFrame.phase;
    }
    activityProps.beforeMixer();
    const origin = origins[areaIndex];
    let clip: keyof typeof clips;
    if (roaming && !traveling) {
      stepCharacter(state, elapsed < waveUntil || afroGuard ? null : target ?? activityFrame.target, dt, area.obstacles, area.bounds);
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
      const toCamera = Math.atan2(camera.position.x - actor.position.x, camera.position.z - actor.position.z) - state.heading;
      // Rendered only: his own heading, or the station's, comes back as the blend fades.
      actor.rotation.set(0, state.heading + Math.atan2(Math.sin(toCamera), Math.cos(toCamera)) * faceBody, state.bumpRemaining > 0 ? Math.sin(state.bumpRemaining * 25) * .06 : 0);
      actor.scale.set(1, 1, 1);
      if (state.bumpCount !== lastBump) {
        lastBump = state.bumpCount; audio.sfx('bonk'); surprisedUntil = elapsed + 1.2;
        // Furniture-dense rooms bump often: the bonk always plays, the apology only now and then and never over another line.
        if (!speechActive && elapsed >= nextBumpLineAt) { say(BUMP_LINE.line, 'bonk'); nextBumpLineAt = elapsed + 45; }
      }
      clip = elapsed < waveUntil ? 'wave' : activityFrame.animation === 'sit' && !target ? 'sit' : state.motion === 'run' ? 'run' : state.motion === 'walk' ? 'walk' : 'idle';
    } else if (roaming) {
      poseTravel(tourFrame, dt);
      clip = 'run';
    } else {
      const depth = story.pose.depth;
      const faceZ = areas[0].bounds.maxZ + 1.6;
      actor.position.set(THREE.MathUtils.lerp(introRest.x, 0, depth), story.pose.lift, THREE.MathUtils.lerp(introRest.z, faceZ, depth));
      actor.rotation.set(story.pose.lean, story.pose.turn, 0);
      actor.scale.set(1, story.pose.squash, 1);
      clip = phase === 'approach' ? 'run' : phase === 'recover' ? 'wave' : 'idle';
    }
    play(clip);
    if (current && (clip === 'walk' || clip === 'run')) current.timeScale = traveling ? clamp(travelSpeed / 2.4, 1, 2.2) : clamp(state.speed / (clip === 'run' ? 2.4 : 1), .6, 1.6);
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
    // Stomp: knee up, a beat at the top, then a slam that thuds and jolts the camera.
    const stompTime = elapsed - stompAt;
    if (roaming && stompTime < .48) activityProps.pose({ kind: 'stomp', reach: temp, weight: Math.min(smooth(stompTime / .3), 1 - (stompTime - .4) / .08), time: elapsed, progress: 0 });
    if (stompTime >= .48 && stompTime - dt < .48) audio.sfx('land');
    const shakeTime = elapsed - shakeAt;
    if (roaming && !traveling && head) {
      if (faceHead > .001) activityProps.face(camera.position, faceHead);
      else if (shakeTime < 1.1) {
        const yaw = actor.rotation.y + Math.sin(shakeTime * 17) * .4 * Math.sin(Math.PI * shakeTime / 1.1);
        activityProps.face(head.getWorldPosition(gaze).add(temp.set(Math.sin(yaw), 0, Math.cos(yaw))), 1);
      }
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
    const activity = presentation ? { stationId: presentation.id, progress: clamp((elapsed - presentation.start) / presentation.total, 0, 1) }
      : { stationId: performing ? activityFrame.stationId : null, progress: performing ? activityFrame.progress : 0 };
    areas.forEach((each, index) => {
      // Neighbouring lots stay drawn for the pan between them; lots further along the street are skipped.
      each.group.visible = Math.abs(cameraTarget.x - framings[index].target.x) < LOT_SPACING * 1.6;
      if (each.group.visible) each.update(dt, elapsed, index === areaIndex ? activity : { stationId: null, progress: 0 });
    });
    const local = localPosition.copy(actor.position).sub(origin);
    shadow.visible = roaming && local.y < .3;
    shadow.position.set(actor.position.x, origin.y + .012, actor.position.z);

    // A wave and its pending greeting still count as free: Say hi greets right away.
    const free = roaming && !traveling && state.motion === 'idle' && state.speed < .05 && !activityFrame.active && !target && !afroGuard && !presentation;
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
    // Expressions blend in priority order (face.ts): anger > surprised > laugh/wink > sleepy > focused > his default happy face.
    if (anger > 0 && elapsed - lastPoke > 10) { anger = Math.max(0, anger - dt * .8); if (!anger) afroClicks = 0; }
    if (phase === 'bonk' || phase === 'recoil') surprisedUntil = elapsed + .5;
    const sleepy = roaming && elapsed - lastInput > 45;
    if (sleepy && free && !speechActive && elapsed - yawnAt > 12 + 3 * Math.sin(yawnAt)) yawnAt = elapsed;
    const focused = !!station && activityFrame.phase === 'perform' && (station.kind === 'type' || station.kind === 'watch' || station.kind === 'tinker');
    expressionGoals.annoyed = clamp(anger, 0, 1); expressionGoals.angry = clamp((anger - 1) / 3, 0, 1);
    expressionGoals.surprised = +(elapsed < surprisedUntil); expressionGoals.laugh = +(elapsed < laughUntil);
    expressionGoals.wink = +(elapsed - winkAt > .5 && elapsed - winkAt < 1.1);
    expressionGoals.sleepy = +sleepy; expressionGoals.yawn = +(sleepy && elapsed - yawnAt < 2.4); expressionGoals.focused = +focused;
    for (const name of EXPRESSIONS) expressions[name] = THREE.MathUtils.damp(expressions[name], expressionGoals[name], 10, dt);
    // Red face and steam at the two angriest levels.
    const fury = clamp(expressions.angry * 2 - 1, 0, 1);
    blush?.color.copy(skinColor).lerp(FURY, fury * .6);
    if (head) head.getWorldPosition(afroCenter).addScaledVector(actor.up, afroRadius * 2);
    steam.forEach((puff, index) => {
      const rise = (elapsed * .8 + index / steam.length) % 1;
      puff.visible = fury > 0;
      puff.position.copy(afroCenter).add(temp.set(Math.sin(index * 2.4) * .3 * (.3 + rise), rise * .9, 0));
      puff.scale.setScalar(.26 + .4 * rise);
      puff.material.opacity = fury * smooth(rise / .15) * (1 - smooth((rise - .55) / .45));
    });
    // The face stays alive during locomotion, tours and station play, not only when idle.
    face.apply({ active: true, blink: idleFrame.blink, mouth, time: elapsed, expressions });
    host.dataset.phase = phase; host.dataset.motion = roaming ? traveling ? 'run' : state.motion : phase === 'approach' ? 'run' : 'idle';
    host.dataset.activity = activityFrame.phase;
    host.dataset.area = area.id; host.dataset.tour = tourFrame.phase; host.dataset.station = activityFrame.stationId ?? presentation?.id ?? '';
    host.dataset.presenting = presentation?.id ?? '';
    host.dataset.position = `${local.x.toFixed(3)},${local.z.toFixed(3)}`;
    host.dataset.bumps = String(state.bumpCount); host.dataset.introTime = story.elapsed.toFixed(3);
    host.dataset.blink = idleFrame.blink.toFixed(3); host.dataset.mouth = mouth.toFixed(3);
    host.dataset.expression = anger > 0 ? 'angry' : expressionGoals.surprised ? 'surprised' : expressionGoals.laugh ? 'laugh' : expressionGoals.wink ? 'wink'
      : expressionGoals.yawn ? 'yawn' : sleepy ? 'sleepy' : focused ? 'focused' : 'happy';
    host.dataset.anger = String(Math.ceil(anger));
    const present = presentation?.present;
    if (present?.url && canvasWidth) {
      camera.updateMatrixWorld();
      temp.copy(actor.position).add(SIGN_OFFSET).project(camera);
      const half = Math.min(SIGN_WIDTH, canvasWidth - 2 * CHROME.side) / 2;
      const x = Math.round(clamp((temp.x + 1) / 2 * canvasWidth, CHROME.side + half, canvasWidth - CHROME.side - half));
      const y = Math.round(clamp((1 - temp.y) / 2 * canvasHeight, CHROME.top, canvasHeight - chromeBottom() - 48));
      if (x !== signX || y !== signY) { signX = x; signY = y; options.onSign({ url: present.url, label: present.linkLabel ?? 'Visit', x, y }); }
    }
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
  const wave = () => { if (paused || (phase === 'roam' && !settled())) return; wake(); skipIntro(); stopMovement(); waveUntil = elapsed + 2; winkAt = elapsed; pendingManualGreeting = true; };
  return {
    skipIntro, wave,
    setSoundEnabled: async (enabled) => { if (!enabled) { audio.mute(); return false; } return audio.enableFromGesture(); },
    setMusicEnabled: (enabled) => audio.setMusic(enabled),
    setPaused: (value) => { paused = value; last = 0; clicks.cancel(); if (value) { intro.tick(0, { paused: true }); cancelSpeech(); } syncAudio(); host.dataset.paused = String(value); },
    reset: () => {
      skipIntro(); stopMovement(); paused = false; host.dataset.paused = 'false'; syncAudio();
      tour.jumpTo(viewArea()); tourFrame = { ...tourFrame, area: viewArea(), from: viewArea(), to: viewArea(), phase: 'settled', progress: 0, started: null };
      enterArea(viewArea()); activities.reset(); activityProps.reset();
    },
    key: (key) => {
      wake();
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
      window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measureScroll);
      cancelSpeech(); void audio.dispose(); activityProps.dispose();
      steamTexture.dispose(); for (const puff of steam) puff.material.dispose();
      inputSurface.removeEventListener('pointerdown', pointerDown as EventListener); inputSurface.removeEventListener('pointerup', pointerUp as EventListener); inputSurface.removeEventListener('pointercancel', pointerCancel); inputSurface.removeEventListener('pointerleave', pointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      mixer.stopAllAction(); mixer.uncacheRoot(model); disposeAreas(); disposeObject(scene); shadowTexture.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}

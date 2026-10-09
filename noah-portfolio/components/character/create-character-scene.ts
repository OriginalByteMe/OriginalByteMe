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
import { CHARACTER_CONFIG, CLIP_SPEED, createCharacterState, runningGait, stepCharacter, resolveCharacterTarget, type Vec2 } from '@/lib/character/controller';
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
  /** Sends him to a station once he is settled in its area; a station with something to present, he presents. */
  visit: (stationId: string) => void;
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
  /** He has just turned to point at the Ask bar at the end of the intro; called once each time the intro plays. */
  onAskPromoted: () => void;
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
/** Dead-on in x, from above the open front. */
const CAMERA_DIRECTION = new THREE.Vector3(0, .42, 1).normalize();
/** His eyes in the idle pose, measured on the GLB: height, and how far they sit in front of his feet. */
const EYES = { y: 1.65, forward: .48 };
/** Metres from his eyes to the lens when he bonks it: his face fills the frame. */
const LENS_GAP = 1.1;
/** The intro run starts this far behind the bedroom's back door, on the stoop behind it. */
const DOOR_RUN_UP = 1.2;
/** Metres from the exit at which his chase counts as there; the trip carries him the rest of the way. */
const EXIT_REACHED = .13;
/** Radians a second he turns on the spot to face a station. */
const STATION_TURN = 4;
/** How fast he turns his whole body to the camera to talk: radians a second at the steepest point of the ease. */
const FACE_TURN = 2.8;
/** Seconds a clip takes to fade fully in. */
const CLIP_FADE = .22;
/** Render at the display rate up to 60 fps; the 2 ms slack keeps a steady beat despite timestamp jitter. */
const FRAME_MS = 1000 / 60 - 2;
/** Seconds he guards his afro after a poke, and how long his hands take to rise and to drop. */
const AFRO_GUARD = 2;
const AFRO_RAMP = .8;
/** A bump into furniture: how far he dips and how far he rolls, both eased in and out over the bump. */
const BUMP_DIP = .03;
const BUMP_ROLL = .06;
/** Where he points at the Ask bar: its height on screen in NDC, just under the bottom edge. */
const BAR_Y = -1.1;
/** Host pixels the framing and the Visit sign keep clear: top chrome and eyebrow, sides, and the controls plus Ask bar at the bottom (two rows of controls when narrow). */
const CHROME = { top: 110, side: 24, bottom: 200, narrowBottom: 270 };
/** The Visit sign stands on the floor just in front of his feet; the page centres it below this point. */
const SIGN_OFFSET = new THREE.Vector3(0, 0, .6);
/** Widest the sign gets, in host pixels: its CSS max-width (16rem). Keeps it whole on screen. */
const SIGN_WIDTH = 256;
/** Sound and seconds between repeats while performing at a station; each `type` call is itself a burst of clicks. */
const STATION_LOOPS: Record<string, [SfxName, number]> = { desk: ['type', .3], printer: ['printer', 2.2], rack: ['rack', 3] };
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
  const origins = AREA_Y.map((y) => new THREE.Vector3(0, y, 0));
  const areas: WorldArea[] = [];
  const disposeAreas = () => { for (const area of areas.splice(0)) { area.group.removeFromParent(); area.dispose(); } };
  let gltf;
  try {
    gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/good-vibes-hero.glb');
    BUILDERS.forEach((build, index) => { const area = build(origins[index].clone(), options.content, () => { if (paused) redraw = true; }); areas.push(area); scene.add(area.group); });
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
  const clips = { idle: '01_Idle_Breathe', walk: '06_Walk_InPlace', run: '07_Run_InPlace', wave: '02_Wave_Hello', sit: '08_Sit_Relaxed' } as const;
  type ClipName = keyof typeof clips;
  const clipNames = Object.keys(clips) as ClipName[];
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
  const pelvis = model.getObjectByName('pelvis');
  /**
   * Clip weights eased every frame: the current clip rises at a fixed rate and the others
   * shrink in proportion to fill the rest, so the weights always sum to one and an
   * interrupted fade never jumps. Walk and run keep step with each other.
   */
  const weights = Object.fromEntries(clipNames.map((name) => [name, 0])) as Record<ClipName, number>;
  let clip: ClipName = 'idle';
  const gait = (name: ClipName): name is 'walk' | 'run' => name === 'walk' || name === 'run';
  const play = (name: ClipName, snap = false) => {
    const next = actions.get(clips[name]), previous = actions.get(clips[clip]);
    if (name !== clip && next && !weights[name]) {
      next.reset().play();
      // Both start with the feet together and the left foot first: the incoming one joins at the same point in the stride.
      if (previous && gait(name) && gait(clip)) next.time = previous.time / previous.getClip().duration * next.getClip().duration;
    }
    clip = name;
    if (snap) for (const each of clipNames) weights[each] = +(each === name);
  };
  const blendClips = (dt: number) => {
    const rest = 1 - weights[clip];
    const rising = Math.min(1, weights[clip] + dt / CLIP_FADE);
    for (const name of clipNames) {
      weights[name] = name === clip ? rising : rest > 1e-6 ? weights[name] * (1 - rising) / rest : 0;
      const action = actions.get(clips[name]);
      if (weights[name] > 1e-4) action?.setEffectiveWeight(weights[name]);
      else { weights[name] = 0; if (action?.isScheduled()) action.stop(); }
    }
    // While walk and run blend, the outgoing one follows the incoming one's stride.
    const leading = actions.get(clips[clip]), other = clip === 'walk' ? 'run' : 'walk';
    const following = actions.get(clips[other]);
    if (gait(clip) && leading && following && weights[other]) following.time = leading.time / leading.getClip().duration * following.getClip().duration;
  };
  actions.get(clips.idle)?.play(); play('idle', true); blendClips(0);

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
  let state = createCharacterState(restPoint(areaIndex));
  let target: Vec2 | null = null;
  let paused = false;
  /** A room image landed while he is paused: draw one frame so the frozen view shows it. */
  let redraw = false;
  let visible = true;
  let audioSuspended = false;
  let last = 0;
  let lastRender = 0;
  let waveUntil = 0;
  let afroUntil = 0;
  /** 0..1 how far his hands are up guarding the afro; eased so a second poke never drops them. */
  let afroHands = 0;
  let afroClicks = 0;
  /** One level per afro poke, up to one per afro line; cools off gradually after a quiet spell. */
  let anger = 0;
  let lastPoke = -Infinity, shakeAt = -Infinity, stompAt = -Infinity;
  let surprisedUntil = 0, laughUntil = 0, winkAt = -Infinity, yawnAt = 0, lastInput = 0;
  /** Blend weights for facing the camera while he talks: whole body when standing free, head and neck at a station. */
  let faceBody = 0, faceHead = 0;
  /** His idle bob, eased in and out as he stops and starts. */
  let bob = 0;
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
  /** He has run to the exit he is chasing; the tour hears it on its next tick. */
  let chaseArrived = false;
  /** The intro's gait while he runs at the lens. */
  let introRunning = false;
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
  const screenUp = new THREE.Vector3();
  const lastActor = new THREE.Vector3();
  const inputSurface = worldRoot ?? host;
  const wrapper = host.closest('.character-hero') as HTMLElement;
  wrapper.style.setProperty('--intro-black', introSkipped ? '0' : '1');

  // Camera framings per area, all looking along CAMERA_DIRECTION with one view offset that centres each area in the free screen region.
  const framings = areas.map(() => ({ position: new THREE.Vector3(), target: new THREE.Vector3() }));
  // Measured once in build pose: the builders' view centre undersells their slabs, walls and signs.
  const areaCorners = areas.map(({ group }) => {
    const { min, max } = new THREE.Box3().setFromObject(group);
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));
  });
  const probe = new THREE.PerspectiveCamera();
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const desired = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const look = new THREE.Vector3();
  const shift = new THREE.Vector2();
  /** The screen region, in host pixels, that the areas and the Visit sign keep inside. */
  const region = { left: 0, right: 0, top: 0, bottom: 0 };
  /** The intro's close shot (camera and the point it looks at, his eyes at the bonk) and his run, from behind the back door to where he hits the lens. */
  const lensTarget = new THREE.Vector3(), lensPosition = new THREE.Vector3();
  const introStart = new THREE.Vector3(), introEnd = new THREE.Vector3();
  /** The bedroom's back door, if it has one: a hinge he swings open as he runs through. */
  const door = areas[0].group.getObjectByName('back-door');
  let cameraPlaced = false;
  let canvasWidth = 0;
  let canvasHeight = 0;
  const frameAreas = () => {
    const wide = camera.aspect >= 1.05;
    // Right of the DOM panels and between the eyebrow and the controls plus Ask bar when wide; below the hero copy and above them when narrow.
    region.left = wide ? canvasWidth * .44 : CHROME.side; region.right = canvasWidth - CHROME.side;
    region.top = wide ? CHROME.top : canvasHeight * .375; region.bottom = canvasHeight - (wide ? CHROME.bottom : CHROME.narrowBottom);
    const minX = region.left / canvasWidth * 2 - 1, maxX = region.right / canvasWidth * 2 - 1;
    const minY = 1 - region.bottom / canvasHeight * 2, maxY = 1 - region.top / canvasHeight * 2;
    shift.set(-(minX + maxX) / 4 * canvasWidth, (minY + maxY) / 4 * canvasHeight);
    probe.copy(camera);
    probe.setViewOffset(canvasWidth, canvasHeight, shift.x, shift.y, canvasWidth, canvasHeight);
    areas.forEach(({ view }, index) => {
      const target = framings[index].target.set(view.center.x, view.center.y, view.center.z).add(origins[index]);
      let near = 1, far = 90;
      for (let step = 0; step < 18; step += 1) {
        const distance = (near + far) / 2;
        probe.position.copy(target).addScaledVector(CAMERA_DIRECTION, distance); probe.lookAt(target); probe.updateMatrixWorld();
        const fits = areaCorners[index].every((corner) => { temp.copy(corner).project(probe); return temp.x >= minX && temp.x <= maxX && temp.y >= minY && temp.y <= maxY; });
        if (fits) far = distance; else near = distance;
      }
      framings[index].position.copy(target).addScaledVector(CAMERA_DIRECTION, far);
    });
    // The intro's lens sits on the bedroom framing's own axis at his eye height, so pulling back to roam is a pure dolly.
    lensTarget.copy(framings[0].target).addScaledVector(CAMERA_DIRECTION, (EYES.y - framings[0].target.y) / CAMERA_DIRECTION.y);
    lensPosition.copy(lensTarget).addScaledVector(CAMERA_DIRECTION, LENS_GAP);
    introEnd.set(lensTarget.x, 0, lensTarget.z - EYES.forward);
    // He runs in from the stoop behind the back door, or from the back wall if the bedroom has no door.
    introStart.set(lensTarget.x, 0, door ? door.getWorldPosition(temp).z - DOOR_RUN_UP : origins[0].z + areas[0].bounds.minZ + .5);
  };
  /** Scrolling eases the camera between neighbouring areas' framings. */
  const placeCamera = (dt: number) => {
    const from = clamp(Math.floor(scrollPosition), 0, areas.length - 1), to = Math.min(from + 1, areas.length - 1);
    const t = smooth(scrollPosition - from);
    desired.position.lerpVectors(framings[from].position, framings[to].position, t);
    desired.target.lerpVectors(framings[from].target, framings[to].target, t);
    const k = cameraPlaced ? 1 - Math.exp(-dt * 5) : 1;
    cameraPosition.lerp(desired.position, k); cameraTarget.lerp(desired.target, k);
    cameraPlaced = true;
  };
  let introLens = introSkipped ? 0 : 1;
  let introShake = 0;
  /** `lens` 1 is the intro's close shot, 0 the roaming camera; both look along CAMERA_DIRECTION with the same view offset. */
  const updateCamera = (lens = introLens, shake = introShake) => {
    introLens = lens; introShake = shake;
    camera.position.lerpVectors(cameraPosition, lensPosition, lens);
    camera.position.x += Math.sin(elapsed * 75) * shake * .065; camera.position.y += Math.cos(elapsed * 90) * shake * .045;
    camera.lookAt(look.lerpVectors(cameraTarget, lensTarget, lens));
    if (canvasWidth) camera.setViewOffset(canvasWidth, canvasHeight, shift.x, shift.y, canvasWidth, canvasHeight);
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
  const enterArea = (index: number, at = restPoint(index)) => {
    areaIndex = index; area = areas[index];
    activities.setStations(area.stations); activityProps.beforeMixer(); endPresentation();
    target = null; targetRing.visible = false; state = createCharacterState(at); hopTo = state.position; lastBump = 0;
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
    afroUntil = elapsed + AFRO_GUARD;
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
    ground.constant = -origins[areaIndex].y;
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const { bounds } = area;
    // Areas stack on y only, so the hit's x and z are already area-local.
    command({ x: clamp(hit.x, bounds.minX + .22, bounds.maxX - .22), z: clamp(hit.z, bounds.minZ + .22, bounds.maxZ - .22) });
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

  /** One-shot speech and sound for each tour beat; positions are sampled every frame below. */
  const startTourPhase = (frame: TourFrame) => {
    if (lastTourPhase === 'recover') state = createCharacterState(hopTo, state.heading);
    const started = frame.started!;
    if (started === 'chase' || started === 'jump') { cancelActivity(); cancelSpeech(); target = null; targetRing.visible = false; waveUntil = afroUntil = 0; }
    if (started === 'chase') {
      say(CHASE_LINE.line, 'greeting');
      // He sets off from whichever way he faces (the camera, if he was talking) and turns before he speeds up.
      state.heading = actor.rotation.y; faceBody = 0; chaseArrived = false;
    }
    if (started === 'trip') { tourFrom.set(state.position.x, 0, state.position.z); audio.sfx('trip'); }
    if (started === 'fall') { tourFrom.set(areas[frame.from].exit.x, 0, areas[frame.from].exit.z).add(origins[frame.from]); audio.sfx('fall'); }
    if (started === 'jump') { tourFrom.copy(actor.position).setY(origins[frame.from].y); say(JUMP_LINE.line, 'greeting'); audio.sfx('jump'); }
    if (started === 'land') { audio.sfx('land'); say('Ow', 'bonk'); }
    if (started === 'recover') { hopTo = restPoint(frame.area); say(AREA_ARRIVAL_LINES[area.id].line, 'greeting'); }
    if (started === 'settled') { state = createCharacterState(hopTo, state.heading); options.onMessage('Click the floor, my things, or my afro.'); }
  };
  /** World-space pose for the timed part of a transition. Returns the clip to play. */
  const poseTour = (frame: TourFrame): ClipName => {
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
    if (!visible || document.hidden || paused) {
      last = 0;
      if (redraw && visible && !document.hidden) { redraw = false; renderer.render(scene, camera); }
      return;
    }
    if (now - lastRender < FRAME_MS) return;
    const dt = last ? Math.min((now - last) / 1000, .1) : 1 / 30;
    last = lastRender = now; elapsed += dt;
    if (phase !== 'roam' && scrollPosition > .3) skipIntro();
    const story = intro.tick(dt);
    if (phase !== story.phase) {
      if (story.dialogueEnded) endCaption();
      if (story.phase === 'bonk') audio.sfx('bonk');
      phase = story.phase;
      // Roaming starts exactly where the intro left him: no jump.
      if (phase === 'roam') { state = createCharacterState({ x: actor.position.x - origins[0].x, z: actor.position.z - origins[0].z }, actor.rotation.y); lastBump = 0; sessionSkippedIntro = true; if (door) door.rotation.y = 0; }
      options.onPhase(phase);
      if (phase === 'point') options.onAskPromoted();
    }
    if (story.dialogueStarted) say(story.dialogueStarted.line, phase === 'recoil' ? 'bonk' : 'greeting', 'event', story.dialogueStarted.duration);
    wrapper.style.setProperty('--intro-black', String(story.blackOpacity));
    wrapper.style.setProperty('--intro-title', String(story.titleOpacity));
    const roaming = phase === 'roam';
    placeCamera(dt);
    // The camera jolts when a stomp lands.
    const slam = elapsed - stompAt - .48;
    updateCamera(roaming ? 0 : story.lens, Math.max(story.cameraShake, slam >= 0 && slam < .3 ? 1 - slam / .3 : 0));

    if (roaming) {
      tourFrame = tour.tick(dt, { viewArea: viewArea(), arrived: chaseArrived });
      if (tourFrame.area !== areaIndex) enterArea(tourFrame.area);
      if (tourFrame.started) startTourPhase(tourFrame);
      lastTourPhase = tourFrame.phase;
    }
    const traveling = tourFrame.phase !== 'settled';
    const chasing = roaming && tourFrame.phase === 'chase';
    if (pendingVisit && settled() && areas[areaIndex].stations.some((station) => station.id === pendingVisit)) { goToStation(pendingVisit); pendingVisit = null; }
    const afroGuard = elapsed < afroUntil;
    afroHands = clamp(afroHands + (elapsed < afroUntil - AFRO_RAMP ? dt : -dt) / AFRO_RAMP, 0, 1);
    const manual = !!target || elapsed < waveUntil || pendingManualGreeting || afroGuard;
    const asked = stationOf(requestedStation);
    const activityFrame: ActivityFrame = activities.tick(dt, {
      position: state.position, speed: state.speed, commanded: !roaming || traveling || manual || !!presentation,
      // Idle chatter holds the next routine so he never wanders off mid-sentence.
      paused: !manual && speechActive && speechKind !== 'event',
      // A routine starts only once he faces its station; a presentation faces the camera instead.
      heading: asked?.present ? undefined : state.heading,
    });
    const station = stationOf(activityFrame.stationId);
    // While he speaks he faces the visitor: his whole body when standing free, only his head and neck at a station or seated.
    const speaking = roaming && !traveling && speechActive && !target && state.speed < .08;
    const facingCamera = (speaking && !activityFrame.active) || !!presentation;
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
    let groundSpeed = 0;
    /** The seat height he is lowering onto this frame, if any. */
    let seat: number | null = null;
    let wanted: ClipName;
    if (roaming && (!traveling || chasing)) {
      const exit = areas[tourFrame.from].exit;
      stepCharacter(state, chasing ? exit : elapsed < waveUntil || afroGuard ? null : target ?? activityFrame.target, dt, area.obstacles, area.bounds);
      chaseArrived = chasing && Math.hypot(exit.x - state.position.x, exit.z - state.position.z) < EXIT_REACHED;
      if (target && Math.hypot(target.x - state.position.x, target.z - state.position.z) < .13 && state.speed < .08) { target = null; targetRing.visible = false; options.onMessage('Click my things to see what I get up to.'); }
      if (target) targetRing.position.set(target.x, .01, target.z).add(origin);
      groundSpeed = state.speed;
      // A bump dips and rolls him, both easing in and out over the bump, while he keeps walking or running.
      const bumped = state.bumpRemaining > 0 ? 1 - state.bumpRemaining / CHARACTER_CONFIG.bumpDuration : 0;
      const jolt = Math.sin(bumped * Math.PI);
      actor.position.set(state.position.x, -BUMP_DIP * jolt, state.position.z).add(origin);
      if (activityFrame.heading !== null && state.speed < .08 && !target) {
        // Turn the short way (station headings sit on both sides of the ±π seam), at a steady pace that eases into place.
        const turn = Math.atan2(Math.sin(activityFrame.heading - state.heading), Math.cos(activityFrame.heading - state.heading));
        state.heading += Math.sign(turn) * Math.min(STATION_TURN * dt, Math.abs(turn) * (1 - Math.exp(-8 * dt)));
      }
      const bearing = Math.atan2(camera.position.x - actor.position.x, camera.position.z - actor.position.z) - state.heading;
      const toCamera = Math.atan2(Math.sin(bearing), Math.cos(bearing));
      // He turns his body to the camera at a pace that does not depend on how far he has to turn.
      faceBody = clamp(faceBody + (facingCamera ? dt : -dt) * FACE_TURN / Math.max(Math.abs(toCamera), .5), 0, 1);
      // Rendered only: his own heading, or the station's, comes back as the blend fades.
      actor.rotation.set(0, state.heading + toCamera * smooth(faceBody), BUMP_ROLL * jolt * Math.sin(bumped * Math.PI * 2));
      actor.scale.set(1, 1, 1);
      if (state.bumpCount !== lastBump) {
        lastBump = state.bumpCount; audio.sfx('bonk'); surprisedUntil = elapsed + 1.2;
        // Furniture-dense rooms bump often: the bonk always plays, the apology only now and then and never over another line.
        if (!speechActive && elapsed >= nextBumpLineAt) { say(BUMP_LINE.line, 'bonk'); nextBumpLineAt = elapsed + 45; }
      }
      wanted = elapsed < waveUntil ? 'wave' : activityFrame.animation === 'sit' && !target ? 'sit' : state.motion === 'idle' ? 'idle' : state.running ? 'run' : 'walk';
      if (wanted === 'sit' && station?.seat !== undefined) seat = station.seat;
    } else if (roaming) {
      lastActor.copy(actor.position);
      wanted = poseTour(tourFrame);
      // The legs keep pace with however fast the scripted beat carries him.
      groundSpeed = Math.hypot(actor.position.x - lastActor.x, actor.position.z - lastActor.z) / dt;
    } else {
      const { travel, pace, slide, lift: hop, lean, turn, squash } = story.pose;
      actor.position.lerpVectors(introStart, introEnd, travel); actor.position.z -= slide; actor.position.y = hop;
      actor.rotation.set(lean, turn, 0);
      actor.scale.set(1, squash, 1);
      groundSpeed = pace * introStart.distanceTo(introEnd);
      introRunning = runningGait(groundSpeed, introRunning);
      wanted = phase === 'approach' && groundSpeed > .04 ? introRunning ? 'run' : 'walk' : phase === 'recover' ? 'wave' : 'idle';
      // The back door swings open as he comes up to it and shuts behind him.
      if (door) {
        const through = actor.position.z - door.getWorldPosition(temp).z;
        door.rotation.y = Math.PI / 2 * smooth((through + 1.15) / .6) * (1 - smooth((through - .6) / 1));
      }
    }
    play(wanted);
    blendClips(dt);
    // The walk and run clips play exactly as fast as he covers the ground, so a planted foot keeps pace with the floor.
    for (const name of ['walk', 'run'] as const) actions.get(clips[name])!.timeScale = clamp(groundSpeed / CLIP_SPEED[name], .3, 4);
    const sitAction = actions.get(clips.sit);
    if (sitAction && clip === 'sit') { sitAction.paused = true; sitAction.time = activityFrame.sitProgress * 1.5; }
    // Real elapsed time drives every clip, independent of page scrolling.
    mixer.update(dt);
    if (seat !== null && pelvis) {
      // He lowers onto the seat: the lift only makes up what the floor-sit clip drops his hips below it, so his feet stay down until then.
      model.updateWorldMatrix(true, true);
      actor.position.y += Math.max(0, seat + SEAT_CLEARANCE - (pelvis.getWorldPosition(temp).y - actor.position.y)) * smooth(activityFrame.sitProgress / .25);
    }
    activityProps.apply(activityFrame);
    if (afroHands > 0 && head) {
      // Hands on the afro's sides, low enough that the elbows stay bent.
      activityProps.pose({ kind: 'afro', reach: head.getWorldPosition(afroCenter).addScaledVector(actor.up, afroRadius * .35), weight: smooth(afroHands), time: elapsed, progress: 0 });
    } else if (station && activityFrame.phase === 'perform') {
      const reach = temp.set(station.reach.x, station.reach.y, station.reach.z).add(origin);
      activityProps.pose({ kind: station.kind, reach, weight: envelope(activityFrame.progress), time: activityFrame.time, progress: activityFrame.progress });
    } else if (!roaming && story.point > 0) {
      // He points at the Ask bar: from where he is on screen toward the bar's spot at the bottom middle, and out toward the visitor so the gesture reads.
      camera.updateMatrixWorld();
      const chest = afroCenter.copy(actor.position).setY(actor.position.y + 1.2);
      const onScreen = gaze.copy(chest).project(camera);
      const across = -onScreen.x * camera.aspect, down = BAR_Y - onScreen.y;
      const way = temp.copy(camera.position).sub(chest).normalize()
        .addScaledVector(gaze.set(1, 0, 0).applyQuaternion(camera.quaternion), across)
        .addScaledVector(screenUp.set(0, 1, 0).applyQuaternion(camera.quaternion), down).normalize();
      activityProps.pose({ kind: 'point', reach: way.multiplyScalar(5).add(chest), weight: story.point, time: elapsed, progress: 0 });
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
    const stepping = actions.get(clips[clip])!;
    if (gait(clip)) {
      // Two footfalls per authored cycle.
      const step = Math.floor(stepping.time / stepping.getClip().duration * 2);
      if (step !== lastStep) { lastStep = step; audio.sfx('step', { volume: clip === 'run' ? .8 : .6 }); }
    } else lastStep = -1;
    const performing = activityFrame.phase !== 'idle' && !activityFrame.phase.startsWith('approach');
    const activity = presentation ? { stationId: presentation.id, progress: clamp((elapsed - presentation.start) / presentation.total, 0, 1) }
      : { stationId: performing ? activityFrame.stationId : null, progress: performing ? activityFrame.progress : 0 };
    areas.forEach((each, index) => {
      // Neighbours stay drawn for the scroll between them; areas two floors away are skipped.
      each.group.visible = Math.abs(cameraTarget.y - framings[index].target.y) < 20;
      if (each.group.visible) each.update(dt, elapsed, index === areaIndex ? activity : { stationId: null, progress: 0 });
    });
    const local = localPosition.copy(actor.position).sub(origin);
    shadow.visible = (!roaming || !traveling || chasing || tourFrame.phase === 'trip') && local.y < .3;
    shadow.position.set(actor.position.x, origin.y + .012, actor.position.z);

    // A wave and its pending greeting still count as free: Say hi greets right away.
    const free = roaming && !traveling && state.motion === 'idle' && state.speed < .05 && !activityFrame.active && !target && !afroGuard && !presentation;
    if (free && pendingManualGreeting) { idle.greetNow(); pendingManualGreeting = false; }
    const idleFrame = idle.tick(dt, free && (!speechActive || speechKind === 'idle'));
    // The bob eases in and out as he stops and starts, rather than switching on and off.
    bob = THREE.MathUtils.damp(bob, free ? idleFrame.bob : 0, 8, dt);
    actor.position.y += bob;
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
    if (phase === 'bonk' || phase === 'recoil' || tourFrame.phase === 'trip' || tourFrame.phase === 'fall') surprisedUntil = elapsed + .5;
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
    host.dataset.phase = phase; host.dataset.motion = roaming ? !traveling || chasing ? state.motion : 'tour' : gait(clip) ? clip : 'idle';
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
      // The Visit sign at his feet, kept whole inside the free region: clear of the panels, the controls and the Ask bar.
      camera.updateMatrixWorld();
      temp.copy(actor.position).add(SIGN_OFFSET).project(camera);
      const half = Math.min(SIGN_WIDTH, region.right - region.left) / 2;
      const x = Math.round(clamp((temp.x + 1) / 2 * canvasWidth, region.left + half, region.right - half));
      const y = Math.round(clamp((1 - temp.y) / 2 * canvasHeight, region.top, region.bottom - 48));
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
    if (door) door.rotation.y = 0;
    play('idle', true); blendClips(0); mixer.update(0); updateCamera(0, 0); renderer.render(scene, camera);
  };
  // Loaded model, areas, and event handlers are all ready before intro time starts; the intro opens with him behind the back door, facing the lens.
  if (introSkipped) { phase = 'roam'; enterArea(areaIndex); actor.position.set(state.position.x, 0, state.position.z).add(origins[areaIndex]); }
  else actor.position.copy(introStart);
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
      enterArea(viewArea()); activities.reset(); activityProps.reset(); pendingVisit = null;
    },
    visit: (id) => {
      if (paused || !areas.some((each) => each.stations.some((station) => station.id === id))) return;
      if (phase !== 'roam') skipIntro();
      wake();
      pendingVisit = id;
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

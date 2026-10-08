import type * as THREE from 'three';
import type { Vec2 } from '@/lib/character/controller';
import type { CharacterLine } from '@/lib/character/narrative';
import type { WorldContent } from '@/lib/character/world-content';

/**
 * The street, in scroll order: each lot's building and the DOM section it sits under.
 * Lot i is built at origin (i * LOT_SPACING, 0, 0) (see town.ts). Plain data, so DOM
 * code can import it without pulling in three.js.
 */
export const LOTS = [
  { id: 'home', section: 'hero' },
  { id: 'hall', section: 'brief' },
  { id: 'workshop', section: 'built' },
  { id: 'toolshed', section: 'toolbox' },
  { id: 'gallery', section: 'about' },
  { id: 'garage', section: 'rig' },
  { id: 'postoffice', section: 'say-hi' },
] as const;
export type AreaId = (typeof LOTS)[number]['id'];
export type Vec3 = { x: number; y: number; z: number };

/** Circle collider on the area floor, the shape controller.ts already resolves against. */
export type Obstacle = { id: string; x: number; z: number; radius: number };

/** What the body does at a station. The scene maps each kind to clips and arm poses. */
export type StationKind = 'type' | 'watch' | 'tinker' | 'read' | 'ball' | 'admire' | 'play';

export type Station = {
  /** Unique within the town, e.g. desk, project:<corpus slug>, skills, portrait. */
  id: string;
  kind: StationKind;
  /** Accessible name, e.g. "MacBook" or "LLM Comparison exhibit". */
  label: string;
  /** Area-local floor point where the character stands; inside bounds and at least radius + .22 from every obstacle. */
  stand: Vec2;
  /** Actor yaw at the station; 0 faces +z, toward the camera. */
  heading: number;
  /** Area-local point the hands reach toward: keyboard, printer button, exhibit control. */
  reach: Vec3;
  /** Area-local seat surface height when the character sits here (desk chair, bed). */
  seat?: number;
  /**
   * When the visitor sends him here: he faces the camera and says the lines in order while
   * `update` gets this station id and the presentation's progress; with a url the page shows
   * a Visit sign beside him. A floor click, another station or a scroll ends it.
   */
  present?: { lines: readonly CharacterLine[]; url?: string; linkLabel?: string };
};

/**
 * One building on the street, an open-front dollhouse. All coordinates are area-local
 * with the floor at y = 0, +z toward the camera and the street, and the open front at
 * bounds.maxZ.
 */
export type WorldArea = {
  id: AreaId;
  /** Root of every mesh in this area, already positioned at the origin passed to the builder. Caller adds it to the scene. */
  group: THREE.Group;
  /** Walkable floor rectangle. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  obstacles: Obstacle[];
  stations: Station[];
  /** Floor point near the open front where he stops after walking in from the street; inside bounds by .22 and clear of obstacles. */
  entry: Vec2;
  /** Point the camera looks at; the scene fits the whole group around it. */
  view: { center: Vec3 };
  /** Home only: rest spots for the ball and book owned by lib/character/activity-props.ts. */
  propRests?: { ball: Vec3; book: Vec3 };
  /** Station id of the nearest interactive object the ray hits; null for floor, walls and background. */
  pick: (raycaster: THREE.Raycaster) => string | null;
  /** Ambient plus station-reactive animation. stationId is the station in this area the character is performing or presenting at, else null. */
  update: (dt: number, elapsed: number, activity: { stationId: string | null; progress: number }) => void;
  /** Frees every geometry, material and texture the builder created. */
  dispose: () => void;
};

/** Builds one lot at `origin`; it must stay inside x in [-7, 7], y in [-3, 7], z in [-4.5, 4.5] around it. */
export type AreaBuilder = (origin: THREE.Vector3, content: WorldContent) => WorldArea;

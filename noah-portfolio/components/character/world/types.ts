import type * as THREE from 'three';
import type { Vec2 } from '@/lib/character/controller';
import type { CharacterLine } from '@/lib/character/narrative';
import type { WorldContent } from '@/lib/character/world-content';

export type AreaId = 'bedroom' | 'lab' | 'about';
export type Vec3 = { x: number; y: number; z: number };

/** Circle collider on the area floor, the shape controller.ts already resolves against. */
export type Obstacle = { id: string; x: number; z: number; radius: number };

/** What the body does at a station. The scene maps each kind to clips and arm poses. */
export type StationKind = 'type' | 'watch' | 'tinker' | 'read' | 'ball' | 'admire' | 'play';

export type Station = {
  /** Bedroom: desk, printer, rack, ball, bed. Lab: project:<corpus slug>, skills:<group> (skillStationId). About: portrait, skyline, career:<company>. */
  id: string;
  kind: StationKind;
  /** Accessible name, e.g. "MacBook" or "LLM Comparison exhibit". */
  label: string;
  /** Area-local floor point where the character stands; inside bounds and at least radius + .22 from every obstacle. */
  stand: Vec2;
  /** Actor yaw at the station; 0 faces +z, toward the default camera. */
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
 * One floating diorama. All coordinates are area-local with the floor at y = 0,
 * +z toward the camera, and the open front edge at bounds.maxZ.
 */
export type WorldArea = {
  id: AreaId;
  /** Root of every mesh in this area, already positioned at the origin passed to the builder. Caller adds it to the scene. */
  group: THREE.Group;
  /** Walkable floor rectangle. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  obstacles: Obstacle[];
  stations: Station[];
  /** Floor point near the open front edge where the character trips before falling to the next area. */
  exit: Vec2;
  /** Top surface the character lands on when arriving from another area. */
  landing: Vec3;
  /** Point the camera looks at; the scene fits the whole group around it. */
  view: { center: Vec3 };
  /** Bedroom only: rest spots for the ball and book owned by lib/character/activity-props.ts. */
  propRests?: { ball: Vec3; book: Vec3 };
  /** Station id of the nearest interactive object the ray hits; null for floor, walls and background. */
  pick: (raycaster: THREE.Raycaster) => string | null;
  /** Ambient plus station-reactive animation. stationId is the station in this area the character is performing at, else null. */
  update: (dt: number, elapsed: number, activity: { stationId: string | null; progress: number }) => void;
  /** Frees every geometry, material and texture the builder created. */
  dispose: () => void;
};

export type AreaBuilder = (origin: THREE.Vector3, content: WorldContent) => WorldArea;

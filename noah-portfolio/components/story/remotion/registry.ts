import type { ComponentType } from "react";

import type { ScenePattern } from "@/lib/story/types";
import type { SceneCompositionProps } from "@/components/story/remotion/contract";
import HeroStatement from "@/components/story/remotion/compositions/HeroStatement";
import ProjectSpotlight from "@/components/story/remotion/compositions/ProjectSpotlight";
import EvidenceLedger from "@/components/story/remotion/compositions/EvidenceLedger";
import NightDrive from "@/components/story/remotion/compositions/NightDrive";
import JourneyMap from "@/components/story/remotion/compositions/JourneyMap";
import SystemAssembly from "@/components/story/remotion/compositions/SystemAssembly";
import ClosingSynthesis from "@/components/story/remotion/compositions/ClosingSynthesis";

interface SceneCompositionEntry {
  component: ComponentType<SceneCompositionProps>;
  durationInFrames: number;
}

/**
 * Every Scene pattern maps to a dedicated Remotion composition.
 * Imports are static on purpose: this module is only reachable through the
 * lazily loaded ScenePlayer chunk, and a nested React.lazy suspending inside
 * the Player stalls Remotion's playback loop at frame 0.
 */
export const SCENE_COMPOSITIONS: Record<ScenePattern, SceneCompositionEntry> = {
  "hero-statement": { component: HeroStatement, durationInFrames: 300 },
  "project-spotlight": { component: ProjectSpotlight, durationInFrames: 360 },
  "evidence-ledger": { component: EvidenceLedger, durationInFrames: 360 },
  timeline: { component: NightDrive, durationInFrames: 480 },
  "capability-map": { component: JourneyMap, durationInFrames: 480 },
  "system-diagram": { component: SystemAssembly, durationInFrames: 420 },
  "closing-synthesis": { component: ClosingSynthesis, durationInFrames: 360 },
};

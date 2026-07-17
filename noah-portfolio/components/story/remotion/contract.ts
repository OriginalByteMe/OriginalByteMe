import type { StoryPlan, StoryScene } from "@/lib/story/types";

/**
 * Input props every Scene composition receives from the Remotion Player.
 * `plan` is the full Story plan so multi-beat templates (journey map,
 * night drive) can traverse every planned Scene, not just their own.
 */
export type SceneCompositionProps = {
  scene: StoryScene;
  plan: StoryPlan;
};

export const SCENE_COMPOSITION_FPS = 30;
export const SCENE_COMPOSITION_WIDTH = 1280;
export const SCENE_COMPOSITION_HEIGHT = 720;

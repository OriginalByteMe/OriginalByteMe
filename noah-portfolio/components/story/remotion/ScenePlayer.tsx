"use client";

import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";

import type { StoryPlan, StoryScene } from "@/lib/story/types";
import {
  SCENE_COMPOSITION_FPS,
  SCENE_COMPOSITION_HEIGHT,
  SCENE_COMPOSITION_WIDTH,
  type SceneCompositionProps,
} from "@/components/story/remotion/contract";
import { SCENE_COMPOSITIONS } from "@/components/story/remotion/registry";

export interface ScenePlayerProps {
  scene: StoryScene;
  plan: StoryPlan;
  evidence: SceneCompositionProps["evidence"];
  playing: boolean;
}

/**
 * Typed Player call site, isolated in its own module so the Remotion runtime
 * stays a lazily loaded chunk. `lazy()` cannot carry Player's generic, so the
 * generic is bound here instead of in RemotionScene.
 */
export default function ScenePlayer({ scene, plan, evidence, playing }: ScenePlayerProps) {
  const playerRef = useRef<PlayerRef>(null);
  const entry = SCENE_COMPOSITIONS[scene.pattern];
  const inputProps: SceneCompositionProps = { scene, plan, evidence };

  // Playback is driven imperatively from visibility. `autoPlay` is snapshotted
  // once at mount, so it can never track visibility changes.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.play();
    else player.pause();
  }, [playing]);

  return (
    <Player
      ref={playerRef}
      component={entry.component}
      inputProps={inputProps}
      durationInFrames={entry.durationInFrames}
      fps={SCENE_COMPOSITION_FPS}
      compositionWidth={SCENE_COMPOSITION_WIDTH}
      compositionHeight={SCENE_COMPOSITION_HEIGHT}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
      loop
      autoPlay={false}
      // Compositions carry no audio. Left unmuted, play() blocks the frame
      // loop on an AudioContext resume that never resolves without a user
      // gesture (e.g. direct story-URL loads), freezing playback at frame 0.
      initiallyMuted
      numberOfSharedAudioTags={0}
      controls={false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
    />
  );
}

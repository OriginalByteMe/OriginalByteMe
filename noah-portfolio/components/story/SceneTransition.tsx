"use client";

import { useRef, type ComponentType } from "react";
import { useReducedMotion, useScroll } from "framer-motion";

import type { StoryScene } from "@/lib/story/types";
import type { TransitionVariantProps } from "@/components/story/transitions/contract";
import SnakeTrail from "@/components/story/transitions/SnakeTrail";
import CometArc from "@/components/story/transitions/CometArc";
import ArrowConvoy from "@/components/story/transitions/ArrowConvoy";
import PawPrints from "@/components/story/transitions/PawPrints";
import PaperPlane from "@/components/story/transitions/PaperPlane";
import NightConvoy from "@/components/story/transitions/NightConvoy";
import Constellation from "@/components/story/transitions/Constellation";
import StitchSeam from "@/components/story/transitions/StitchSeam";
import DitherWave from "@/components/story/transitions/DitherWave";
import BoardHop from "@/components/story/transitions/BoardHop";

const VARIANTS: readonly ComponentType<TransitionVariantProps>[] = [
  SnakeTrail,
  CometArc,
  ArrowConvoy,
  PawPrints,
  PaperPlane,
  NightConvoy,
  Constellation,
  StitchSeam,
  DitherWave,
  BoardHop,
];

export interface SceneTransitionProps {
  /** Index of the scene the transition leads into; offsets within the Story. */
  index: number;
  /** Story-stable string (e.g. the question) rotating the variant cycle across Stories. */
  seed: string;
  from: StoryScene;
  to: StoryScene;
}

/**
 * Scroll-driven interstitial between two Story scenes. Stories hold at most
 * five scenes, so `index` alone would strand variants 4-9; hashing a
 * story-stable seed rotates the cycle so every variant appears across
 * Stories while staying unique within one.
 */
export function SceneTransition({ index, seed, from, to }: SceneTransitionProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({
    target: hostRef,
    offset: ["start end", "end start"],
  });

  if (reducedMotion) {
    return <div className="story-transition story-transition--static" aria-hidden="true" />;
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const Variant = VARIANTS[(hash + index) % VARIANTS.length];

  return (
    <div ref={hostRef} className="story-transition" aria-hidden="true">
      <Variant progress={scrollYProgress} from={from} to={to} />
    </div>
  );
}

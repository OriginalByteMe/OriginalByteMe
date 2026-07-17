import type { MotionValue } from "framer-motion";

import type { StoryScene } from "@/lib/story/types";

/**
 * Props every scroll-driven transition variant receives from SceneTransition.
 * `progress` is 0 when the strip enters the viewport bottom and 1 when it
 * leaves the top; variants map it with framer-motion `useTransform`.
 */
export type TransitionVariantProps = {
  progress: MotionValue<number>;
  from: StoryScene;
  to: StoryScene;
};

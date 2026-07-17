"use client";

import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

import type { StoryPlan, StoryScene } from "@/lib/story/types";

// Runtime-gated chunk: reduced-motion Stories never pay for the Remotion runtime.
const LazyScenePlayer = lazy(() => import("@/components/story/remotion/ScenePlayer"));

interface RemotionSceneProps {
  scene: StoryScene;
  plan: StoryPlan;
  /** Static rendering used for reduced motion, runtime failure, and Suspense. */
  fallback: ReactNode;
}

class CompositionBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Plays a Scene's pattern composition while it is on screen; pauses off screen. */
export function RemotionScene({ scene, plan, fallback }: RemotionSceneProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || reducedMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [reducedMotion]);

  if (reducedMotion) return <>{fallback}</>;

  // The canvas re-renders the scene's title/claim visually; the DOM h2 and
  // detail block below the stage stay the canonical accessible content.
  return (
    <div
      ref={hostRef}
      className="story-scene__composition"
      data-scene-pattern={scene.pattern}
      aria-hidden="true"
    >
      <CompositionBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <LazyScenePlayer scene={scene} plan={plan} playing={inView} />
        </Suspense>
      </CompositionBoundary>
    </div>
  );
}

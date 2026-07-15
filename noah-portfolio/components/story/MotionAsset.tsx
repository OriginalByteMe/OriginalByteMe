"use client";

import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react";
import { useReducedMotion } from "framer-motion";
import {
  getMotionAsset,
  type MotionAssetId,
  type MotionAssetRecord,
} from "@/lib/motion-assets/catalog";
import {
  MOTION_STATIC_RENDERERS,
  MOTION_SVG_RENDERERS,
  type MotionPlaybackState,
} from "@/lib/motion-assets/svg-assets";

// Runtime-gated chunk: a static import would charge SVG-only and
// reduced-motion Stories for the dotLottie/WASM runtime they never render.
const LazyDotLottie = lazy(() =>
  import("@lottiefiles/dotlottie-react").then(({ DotLottieReact }) => ({
    default: DotLottieReact,
  })),
);

export type MotionAssetProps = {
  assetId: MotionAssetId;
  label?: string;
};

type DotLottiePlayer = Exclude<
  Parameters<NonNullable<DotLottieReactProps["dotLottieRefCallback"]>>[0],
  null
>;

type MotionRuntimeBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError: () => void;
};

class MotionRuntimeBoundary extends Component<
  MotionRuntimeBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function DotLottieAsset({
  renderer,
  replay,
  playbackState,
  onRuntimeError,
}: {
  renderer: Extract<
    MotionAssetRecord["renderer"],
    { kind: "dotlottie" }
  >;
  replay: MotionAssetRecord["playback"]["replay"];
  playbackState: MotionPlaybackState;
  onRuntimeError: () => void;
}) {
  const playerRef = useRef<DotLottiePlayer | null>(null);
  const playbackStateRef = useRef(playbackState);
  playbackStateRef.current = playbackState;
  const handleLoadError = useCallback(() => onRuntimeError(), [onRuntimeError]);
  const setPlayerRef = useCallback(
    (nextPlayer: DotLottiePlayer | null) => {
      playerRef.current?.removeEventListener("loadError", handleLoadError);
      playerRef.current = nextPlayer;
      if (!nextPlayer) return;

      nextPlayer.addEventListener("loadError", handleLoadError);
      if (playbackStateRef.current === "playing") {
        nextPlayer.play();
      } else {
        nextPlayer.pause();
      }
    },
    [handleLoadError],
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (playbackState === "playing") {
      player.play();
    } else {
      player.pause();
    }
  }, [playbackState]);

  useEffect(
    () => () => {
      playerRef.current?.removeEventListener("loadError", handleLoadError);
      playerRef.current = null;
    },
    [handleLoadError],
  );

  return (
    <LazyDotLottie
      src={renderer.src}
      animationId={renderer.animationId}
      autoplay={false}
      loop={replay === "loop"}
      dotLottieRefCallback={setPlayerRef}
      renderConfig={{ autoResize: true }}
      className="size-full"
    />
  );
}

function MotionAssetVisual({
  asset,
  playbackState,
  onRuntimeError,
}: {
  asset: MotionAssetRecord;
  playbackState: MotionPlaybackState;
  onRuntimeError: () => void;
}) {
  const StaticAsset =
    MOTION_STATIC_RENDERERS[asset.reducedMotion.staticRenderer];
  if (playbackState === "static") {
    return <StaticAsset playbackState="static" />;
  }

  if (asset.renderer.kind === "dotlottie") {
    return (
      <Suspense fallback={<StaticAsset playbackState="static" />}>
        <DotLottieAsset
          renderer={asset.renderer}
          replay={asset.playback.replay}
          playbackState={playbackState}
          onRuntimeError={onRuntimeError}
        />
      </Suspense>
    );
  }

  const SvgAsset = MOTION_SVG_RENDERERS[asset.renderer.component];
  return <SvgAsset playbackState={playbackState} />;
}

export function MotionAsset({ assetId, label }: MotionAssetProps) {
  const asset = getMotionAsset(assetId);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [isVisible, setIsVisible] = useState(false);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const handleRuntimeError = useCallback(() => setRuntimeFailed(true), []);

  useEffect(() => {
    setIsVisible(false);
    setRuntimeFailed(false);
  }, [asset?.id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!asset || !container || prefersReducedMotion) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((candidate) => candidate.target === container);
        if (entry) setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.15 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [asset, prefersReducedMotion]);

  if (!asset) return null;

  const playbackState: MotionPlaybackState =
    prefersReducedMotion || runtimeFailed
      ? "static"
      : isVisible
        ? "playing"
        : "paused";
  const meaningful = asset.accessibility.kind === "meaningful";
  const accessibleLabel =
    asset.accessibility.kind === "meaningful"
      ? label?.trim() || asset.accessibility.defaultLabel
      : undefined;
  const StaticAsset =
    MOTION_STATIC_RENDERERS[asset.reducedMotion.staticRenderer];

  return (
    <div
      ref={containerRef}
      role={meaningful ? "img" : undefined}
      aria-label={accessibleLabel}
      aria-hidden={meaningful ? undefined : true}
      data-motion-asset={asset.id}
      data-motion-renderer={asset.renderer.kind}
      data-motion-state={playbackState}
      data-motion-runtime-fallback={runtimeFailed ? "true" : undefined}
      data-motion-min-width={asset.bounds.minWidth}
      data-motion-max-width={asset.bounds.maxWidth}
      className="relative isolate mx-auto grid w-full place-items-center overflow-hidden rounded-xl border border-border/60 bg-card/40 p-4 text-foreground sm:p-6"
      style={{
        aspectRatio: asset.bounds.aspectRatio,
        maxWidth: `${asset.bounds.maxWidth}px`,
        minWidth: `min(100%, ${asset.bounds.minWidth}px)`,
      }}
    >
      <div aria-hidden="true" className="size-full">
        <MotionRuntimeBoundary
          key={asset.id}
          fallback={<StaticAsset playbackState="static" />}
          onError={handleRuntimeError}
        >
          <MotionAssetVisual
            asset={asset}
            playbackState={playbackState}
            onRuntimeError={handleRuntimeError}
          />
        </MotionRuntimeBoundary>
      </div>
    </div>
  );
}

import { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { SceneCompositionProps } from "@/components/story/remotion/contract";

const DOT_COUNT = 80;

export default function HeroStatement({ scene }: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = scene.title.trim().split(/\s+/);
  const dots = useMemo(() => {
    let seed = 2166136261;
    for (let index = 0; index < scene.id.length; index += 1) {
      seed ^= scene.id.charCodeAt(index);
      seed = Math.imul(seed, 16777619);
    }

    return Array.from({ length: DOT_COUNT }, (_, index) => {
      const xHash = Math.imul(seed ^ (index + 1), 2246822519) >>> 0;
      const yHash = Math.imul(seed ^ (index + 97), 3266489917) >>> 0;
      return {
        x: (xHash % 10000) / 100,
        y: (yHash % 10000) / 100,
        depth: 1 + (index % 3),
        opacity: 0.12 + (index % 5) * 0.045,
      };
    });
  }, [scene.id]);
  const seamOpacity = interpolate(frame, [0, 18, 270, 299], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const idleY = frame > 90 ? Math.sin((frame - 90) / 34) * 4 : 0;
  const claimOpacity = interpolate(frame, [82, 112], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const claimY = interpolate(frame, [82, 112], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleProgress = interpolate(frame, [88, 126], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleSize = scene.title.length > 78 ? 72 : scene.title.length > 48 ? 88 : 112;
  const claimSize = scene.claim.length > 280 ? 24 : scene.claim.length > 160 ? 27 : 31;

  return (
    <AbsoluteFill
      aria-hidden="true"
      style={{
        overflow: "hidden",
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
      }}
    >
      <Sequence from={0}>
        <AbsoluteFill style={{ opacity: seamOpacity }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 72% 28%, hsl(var(--primary) / 0.12), transparent 38%), radial-gradient(circle at 20% 78%, hsl(var(--foreground) / 0.06), transparent 34%)",
            }}
          />
          {dots.map((dot, index) => {
            const driftX = Math.sin(frame / (92 + dot.depth * 16) + index) * dot.depth * 5;
            const driftY = Math.cos(frame / (112 + dot.depth * 12) + index * 0.7) * dot.depth * 4;
            return (
              <span
                key={`${dot.x}-${dot.y}`}
                style={{
                  position: "absolute",
                  left: `${dot.x}%`,
                  top: `${dot.y}%`,
                  width: 2,
                  height: 2,
                  backgroundColor: "hsl(var(--primary))",
                  opacity: dot.opacity,
                  transform: `translate3d(${driftX}px, ${driftY}px, 0)`,
                }}
              />
            );
          })}
        </AbsoluteFill>
      </Sequence>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          padding: "72px 96px",
          opacity: seamOpacity,
          transform: `translateY(${idleY}px)`,
        }}
      >
        <h1
          style={{
            display: "flex",
            maxWidth: 1088,
            flexWrap: "wrap",
            columnGap: 24,
            rowGap: 0,
            margin: 0,
            fontFamily: "var(--story-display-font)",
            fontSize: titleSize,
            fontWeight: 500,
            letterSpacing: "-0.045em",
            lineHeight: 0.9,
            textWrap: "balance",
          }}
        >
          {words.map((word, index) => {
            const wordProgress = spring({
              frame,
              fps,
              delay: 14 + index * 4,
              durationInFrames: 42,
              config: { damping: 18, stiffness: 120, mass: 0.8 },
            });
            return (
              <span
                key={`${word}-${index}`}
                style={{
                  display: "inline-block",
                  opacity: interpolate(wordProgress, [0, 0.55, 1], [0, 0.9, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateY(${interpolate(wordProgress, [0, 1], [64, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </h1>

        <Sequence from={76} layout="none">
          <div
            style={{
              width: `${ruleProgress * 100}%`,
              maxWidth: 960,
              height: 1,
              marginTop: 48,
              backgroundColor: "hsl(var(--primary))",
              opacity: claimOpacity * 0.72,
              transformOrigin: "left center",
            }}
          />
          <p
            style={{
              maxWidth: 960,
              margin: "28px 0 0",
              color: "hsl(var(--muted-foreground))",
              fontSize: claimSize,
              fontWeight: 450,
              letterSpacing: "-0.012em",
              lineHeight: 1.4,
              opacity: claimOpacity,
              transform: `translateY(${claimY}px)`,
            }}
          >
            {scene.claim}
          </p>
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

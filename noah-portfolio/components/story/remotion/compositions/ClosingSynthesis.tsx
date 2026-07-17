import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { SceneCompositionProps } from "@/components/story/remotion/contract";

const CARD_WIDTH = 192;
const CARD_HEIGHT = 112;
const CARD_GAP = 24;
const DOCK_Y = 376;
const EDGE_POSITIONS = [
  { x: -136, y: 96, curveX: 96, curveY: -120, rotate: -9 },
  { x: 248, y: -120, curveX: -72, curveY: 104, rotate: 7 },
  { x: 568, y: 728, curveX: 88, curveY: -136, rotate: -6 },
  { x: 984, y: -128, curveX: -96, curveY: 112, rotate: 8 },
  { x: 1248, y: 520, curveX: -112, curveY: -96, rotate: -8 },
] as const;

export default function ClosingSynthesis({ scene, plan }: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = plan.scenes;
  const clusterWidth = beats.length * CARD_WIDTH + (beats.length - 1) * CARD_GAP;
  const clusterX = (1280 - clusterWidth) / 2;
  const seamOpacity = interpolate(frame, [0, 16, 330, 359], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleProgress = spring({
    frame,
    fps,
    delay: 132,
    durationInFrames: 54,
    config: { damping: 20, stiffness: 105, mass: 0.9 },
  });
  const titleOpacity = interpolate(titleProgress, [0, 0.5, 1], [0, 0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(titleProgress, [0, 1], [52, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const settled = interpolate(frame, [148, 188], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breath = settled * (0.68 + Math.sin(frame / 22) * 0.16);

  return (
    <AbsoluteFill
      aria-hidden="true"
      style={{
        overflow: "hidden",
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: seamOpacity,
          background:
            "radial-gradient(circle at 50% 56%, hsl(var(--primary) / 0.13), transparent 34%), radial-gradient(circle at 50% 56%, hsl(var(--foreground) / 0.045), transparent 58%)",
        }}
      />

      <Sequence from={72}>
        <svg
          viewBox="0 0 1280 720"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            opacity: seamOpacity,
          }}
        >
          {beats.slice(0, -1).map((beat, index) => {
            const lineProgress = spring({
              frame,
              fps,
              delay: 94 + index * 13,
              durationInFrames: 46,
              config: { damping: 20, stiffness: 110, mass: 0.8 },
            });
            const x1 = clusterX + index * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH;
            const x2 = clusterX + (index + 1) * (CARD_WIDTH + CARD_GAP);
            const y = DOCK_Y + CARD_HEIGHT / 2;
            return (
              <line
                key={beat.id}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                pathLength={1}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray={1}
                strokeDashoffset={1 - lineProgress}
                strokeLinecap="round"
                opacity={0.36 + lineProgress * 0.48}
              />
            );
          })}
        </svg>
      </Sequence>

      <Sequence from={0}>
        <div style={{ position: "absolute", inset: 0, opacity: seamOpacity }}>
          {beats.map((beat, index) => {
            const edge = EDGE_POSITIONS[index];
            const dockX = clusterX + index * (CARD_WIDTH + CARD_GAP);
            const joinProgress = spring({
              frame,
              fps,
              delay: 18 + index * 13,
              durationInFrames: 82,
              config: { damping: 18, stiffness: 76, mass: 1 },
            });
            const easedProgress = interpolate(joinProgress, [0, 1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const arc = Math.sin(easedProgress * Math.PI);
            const x = interpolate(easedProgress, [0, 1], [edge.x, dockX], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }) + arc * edge.curveX;
            const y = interpolate(easedProgress, [0, 1], [edge.y, DOCK_Y], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }) + arc * edge.curveY;
            const rotation = interpolate(easedProgress, [0, 1], [edge.rotate, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const chipScale = interpolate(easedProgress, [0, 0.82, 1], [0.88, 1.035, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <article
                key={beat.id}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  display: "flex",
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 16,
                  backgroundColor: "hsl(var(--background))",
                  padding: "18px 20px",
                  boxShadow: `0 0 ${24 + breath * 20}px hsl(var(--primary) / ${0.05 + breath * 0.13})`,
                  transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${chipScale})`,
                  transformOrigin: "center",
                }}
              >
                <span
                  style={{
                    color: "hsl(var(--primary))",
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                    fontSize: 14,
                    fontWeight: 650,
                    letterSpacing: "0.16em",
                    lineHeight: 1,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong
                  style={{
                    display: "-webkit-box",
                    overflow: "hidden",
                    color: "hsl(var(--foreground))",
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: "-0.018em",
                    lineHeight: 1.08,
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                  }}
                >
                  {beat.title}
                </strong>
              </article>
            );
          })}
        </div>
      </Sequence>

      <Sequence from={118} layout="none">
        <div
          style={{
            position: "absolute",
            top: 144,
            left: 96,
            right: 96,
            textAlign: "center",
            opacity: seamOpacity * titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "hsl(var(--muted-foreground))",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 15,
              fontWeight: 650,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Synthesis
          </p>
          <h2
            style={{
              maxWidth: 1040,
              margin: "18px auto 0",
              fontFamily: "var(--story-display-font)",
              fontSize: scene.title.length > 72 ? 64 : 78,
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 0.94,
              textWrap: "balance",
            }}
          >
            {scene.title}
          </h2>
        </div>
      </Sequence>

      <div
        style={{
          position: "absolute",
          left: clusterX - 32,
          top: DOCK_Y - 32,
          width: clusterWidth + 64,
          height: CARD_HEIGHT + 64,
          border: "1px solid hsl(var(--primary) / 0.18)",
          borderRadius: 32,
          opacity: seamOpacity * settled * (0.36 + breath * 0.22),
          boxShadow: `0 0 ${40 + breath * 32}px hsl(var(--primary) / ${0.06 + breath * 0.08})`,
        }}
      />
    </AbsoluteFill>
  );
}

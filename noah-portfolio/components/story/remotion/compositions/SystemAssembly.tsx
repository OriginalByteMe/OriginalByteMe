import type { SceneCompositionProps } from "@/components/story/remotion/contract";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface DiagramNodeProps {
  index: number;
  label: string;
  position: { x: number; y: number };
  isHub: boolean;
}

interface ConnectorProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const POSITIONS = [
  { x: 88, y: 200 },
  { x: 88, y: 432 },
  { x: 520, y: 316 },
  { x: 936, y: 200 },
  { x: 936, y: 432 },
  { x: 520, y: 536 },
] as const;

function DiagramNode({ index, label, position, isHub }: DiagramNodeProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrival = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 105, mass: 0.8 },
    durationInFrames: 54,
  });
  const horizontalOrigin = position.x < 320 ? -360 : position.x > 800 ? 360 : 0;
  const verticalOrigin = horizontalOrigin === 0 ? (index % 2 === 0 ? -260 : 260) : 0;
  const translateX = interpolate(arrival, [0, 1], [horizontalOrigin, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(arrival, [0, 1], [verticalOrigin, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: 256,
        minHeight: 88,
        display: "flex",
        alignItems: "center",
        padding: "16px 24px",
        boxSizing: "border-box",
        border: `2px solid hsl(var(${isHub ? "--story-accent" : "--story-border"}))`,
        borderRadius: "var(--story-radius-sm)",
        backgroundColor: `hsl(var(${isHub ? "--story-accent-soft" : "--story-surface-raised"}))`,
        color: "hsl(var(--story-ink))",
        boxShadow: "var(--story-shadow)",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: 20,
        fontWeight: 650,
        letterSpacing: "0.05em",
        lineHeight: 1.25,
        textTransform: "uppercase",
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${interpolate(arrival, [0, 1], [0.92, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })})`,
        opacity: interpolate(arrival, [0, 0.25, 1], [0, 1, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          marginRight: 16,
          flex: "0 0 auto",
          borderRadius: "var(--story-radius-pill)",
          backgroundColor: `hsl(var(${isHub ? "--story-accent" : "--story-muted"}))`,
        }}
      />
      {label}
    </div>
  );
}

function Connector({ from, to }: ConnectorProps) {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [0, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulseFrame = Math.max(0, frame - 38) % 84;
  const pulse = interpolate(pulseFrame, [0, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x1 = from.x + 128;
  const y1 = from.y + 44;
  const x2 = to.x + 128;
  const y2 = to.y + 44;

  return (
    <svg
      aria-hidden="true"
      width="1280"
      height="720"
      viewBox="0 0 1280 720"
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <path
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        pathLength={1}
        fill="none"
        stroke="hsl(var(--story-accent))"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
        opacity={0.72}
      />
      {frame >= 38 ? (
        <circle
          cx={interpolate(pulse, [0, 1], [x1, x2], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          cy={interpolate(pulse, [0, 1], [y1, y2], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          r={7}
          fill="hsl(var(--story-accent))"
          opacity={interpolate(pulse, [0, 0.12, 0.88, 1], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        />
      ) : null}
    </svg>
  );
}

export default function SystemAssembly({ scene, plan, evidence }: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const evidenceById = new Map(evidence.map(({ id, label }) => [id, label]));
  const evidenceLabels = scene.evidenceRefIds.flatMap((id) => {
    const label = evidenceById.get(id);
    return label ? [label] : [];
  });
  const otherSceneTitles = plan.scenes
    .filter(({ id }) => id !== scene.id)
    .map(({ title }) => title);
  const labels = [...new Set([...evidenceLabels, ...otherSceneTitles])].slice(
    0,
    POSITIONS.length,
  );
  const nodes = labels.map((label, index) => ({ label, position: POSITIONS[index] }));
  const hubIndex = Math.min(2, nodes.length - 1);
  const edges = nodes
    .map((node, index) => ({
      from: index < hubIndex ? node.position : nodes[hubIndex].position,
      to: index < hubIndex ? nodes[hubIndex].position : node.position,
      index,
    }))
    .filter(({ index }) => index !== hubIndex);
  const loopOpacity = interpolate(
    frame,
    [0, 16, durationInFrames - 24, durationInFrames - 1],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        backgroundColor: "hsl(var(--story-surface))",
        color: "hsl(var(--story-ink))",
        opacity: loopOpacity,
        backgroundImage:
          "radial-gradient(circle, hsl(var(--story-border) / 0.5) 1px, hsl(var(--story-surface) / 0) 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      <header style={{ position: "absolute", top: 48, left: 64, zIndex: 4, maxWidth: 880 }}>
        <p
          style={{
            margin: 0,
            color: "hsl(var(--story-muted))",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 16,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          System assembly
        </p>
        <h1
          style={{
            margin: "8px 0 0",
            fontFamily: "var(--story-display-font)",
            fontSize: 52,
            fontWeight: 500,
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          {scene.title}
        </h1>
      </header>

      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {edges.map((edge, index) => (
          <Sequence key={`${edge.index}-${index}`} from={112 + index * 12}>
            <Connector from={edge.from} to={edge.to} />
          </Sequence>
        ))}
      </div>

      <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        {nodes.map((node, index) => (
          <Sequence key={`${node.label}-${index}`} from={24 + index * 12}>
            <DiagramNode
              index={index}
              label={node.label}
              position={node.position}
              isHub={index === hubIndex}
            />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
}

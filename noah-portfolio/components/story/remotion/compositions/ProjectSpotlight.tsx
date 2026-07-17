import type { SceneCompositionProps } from "@/components/story/remotion/contract";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface SpotlightCardProps {
  card: {
    name: string;
    summary: string;
    technologies: string[];
  };
  index: number;
  count: number;
  spotlightX: number;
}

function SpotlightCard({ card, index, count, spotlightX }: SpotlightCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrival = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 110, mass: 0.9 },
    durationInFrames: 58,
  });
  const width = count === 1 ? 464 : 400;
  const spacing = count === 2 ? 360 : 304;
  const left = count === 1 ? 408 : 440 + (index - (count - 1) / 2) * spacing;
  const center = (left + width / 2) / 1280;
  const proximity = 1 - Math.min(1, Math.abs(spotlightX - center) * 4.5);
  const lift = interpolate(proximity, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entryX = interpolate(arrival, [0, 1], [(index % 2 === 0 ? -1 : 1) * 720, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entryY = interpolate(arrival, [0, 1], [64 + index * 16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dealtRotation = count === 1 ? 0 : (index - (count - 1) / 2) * 2.5;

  return (
    <article
      style={{
        position: "absolute",
        left,
        top: 248 + Math.abs(index - (count - 1) / 2) * 16,
        zIndex: index + Math.round(lift * 10),
        width,
        height: 304,
        boxSizing: "border-box",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        border: `2px solid hsl(var(--story-accent) / ${0.32 + lift * 0.68})`,
        borderRadius: "var(--story-radius-md)",
        backgroundColor: "hsl(var(--story-surface-raised))",
        boxShadow: "var(--story-shadow)",
        color: "hsl(var(--story-ink))",
        opacity: interpolate(arrival, [0, 0.18, 1], [0, 1, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(${entryX}px, ${entryY - lift * 16}px, 0) rotate(${dealtRotation}deg) scale(${1 + lift * 0.03})`,
        transformOrigin: "50% 75%",
      }}
    >
      <p
        style={{
          margin: 0,
          color: "hsl(var(--story-muted))",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 15,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Project {String(index + 1).padStart(2, "0")}
      </p>
      <h2
        style={{
          margin: "16px 0 0",
          fontFamily: "var(--story-display-font)",
          fontSize: count === 1 ? 44 : 38,
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
        }}
      >
        {card.name}
      </h2>
      <p
        style={{
          margin: "20px 0 0",
          overflow: "hidden",
          color: "hsl(var(--story-muted))",
          fontSize: 22,
          lineHeight: 1.4,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {card.summary}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: "auto",
        }}
      >
        {card.technologies.slice(0, 3).map((technology) => (
          <span
            key={technology}
            style={{
              padding: "8px 12px",
              border: "1px solid hsl(var(--story-border))",
              borderRadius: "var(--story-radius-pill)",
              backgroundColor: "hsl(var(--story-surface))",
              color: "hsl(var(--story-muted))",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 15,
              letterSpacing: "0.06em",
            }}
          >
            {technology}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function ProjectSpotlight({ scene }: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const cards = scene.projects?.length
    ? scene.projects.map((project) => {
        const summary = project.description.replace(/\s+/g, " ").trim();
        return {
          name: project.title,
          summary: summary.length > 148 ? `${summary.slice(0, 145).trimEnd()}…` : summary,
          technologies: project.technologies.map(({ name }) => name),
        };
      })
    : [
        {
          name: scene.title,
          summary:
            scene.claim.length > 148
              ? `${scene.claim.slice(0, 145).trimEnd()}…`
              : scene.claim,
          technologies: [],
        },
      ];
  const spotlightX = interpolate(frame, [40, durationInFrames - 44], [-0.12, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
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
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -48,
          left: `${spotlightX * 1280 - 400}px`,
          width: 800,
          height: 800,
          backgroundImage:
            "radial-gradient(ellipse at 50% 18%, hsl(var(--story-accent-soft) / 0.82) 0%, hsl(var(--story-accent-soft) / 0.32) 34%, hsl(var(--story-accent-soft) / 0) 72%)",
          clipPath: "polygon(45% 0, 55% 0, 86% 100%, 14% 100%)",
          opacity: 0.72,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(90deg, hsl(var(--story-border) / 0.2) 1px, hsl(var(--story-surface) / 0) 1px)",
          backgroundSize: "64px 64px",
          opacity: 0.45,
        }}
      />

      <header style={{ position: "absolute", top: 48, left: 64, zIndex: 20, maxWidth: 980 }}>
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
          Project spotlight
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

      {cards.map((card, index) => (
        <Sequence key={`${card.name}-${index}`} from={28 + index * 18}>
          <SpotlightCard
            card={card}
            index={index}
            count={cards.length}
            spotlightX={spotlightX}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

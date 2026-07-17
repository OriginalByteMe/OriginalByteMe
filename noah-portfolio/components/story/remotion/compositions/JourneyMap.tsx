import type { SceneCompositionProps } from "@/components/story/remotion/contract";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Point {
  x: number;
  y: number;
}

const JOURNEY_PATH =
  "M 130 515 C 195 345 305 345 370 470 C 445 615 565 605 630 455 C 700 290 805 275 875 395 C 950 530 1075 500 1160 330";
const JOURNEY_PATH_LENGTH = 2200;
const JOURNEY_SEGMENTS = [
  [{ x: 130, y: 515 }, { x: 195, y: 345 }, { x: 305, y: 345 }, { x: 370, y: 470 }],
  [{ x: 370, y: 470 }, { x: 445, y: 615 }, { x: 565, y: 605 }, { x: 630, y: 455 }],
  [{ x: 630, y: 455 }, { x: 700, y: 290 }, { x: 805, y: 275 }, { x: 875, y: 395 }],
  [{ x: 875, y: 395 }, { x: 950, y: 530 }, { x: 1075, y: 500 }, { x: 1160, y: 330 }],
] as const;

function getJourneyPoint(progress: number): Point {
  const scaled = Math.min(3.9999, Math.max(0, progress) * JOURNEY_SEGMENTS.length);
  const segment = JOURNEY_SEGMENTS[Math.floor(scaled)];
  const t = scaled - Math.floor(scaled);
  const inverse = 1 - t;
  const [start, controlOne, controlTwo, end] = segment;

  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * t * controlOne.x +
      3 * inverse * t ** 2 * controlTwo.x +
      t ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * t * controlOne.y +
      3 * inverse * t ** 2 * controlTwo.y +
      t ** 3 * end.y,
  };
}

export default function JourneyMap({ scene, plan }: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const stopCount = plan.scenes.length;
  const pathProgress = interpolate(frame, [18, 122], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleEntrance = spring({ frame, fps, config: { damping: 200 } });
  const travelStart = 108;
  const travelEnd = durationInFrames - 38;
  const phaseCount = Math.max(1, stopCount - 1);
  const travelPhase = interpolate(frame, [travelStart, travelEnd], [0, phaseCount], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const segmentIndex = Math.min(phaseCount - 1, Math.floor(travelPhase));
  const segmentProgress = travelPhase - segmentIndex;
  const glideProgress = interpolate(segmentProgress, [0, 0.72, 1], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const travelerProgress = frame < travelStart ? 0 : (segmentIndex + glideProgress) / phaseCount;
  const traveler = getJourneyPoint(travelerProgress);
  const seamOpacity = interpolate(
    frame,
    [0, 8, durationInFrames - 12, durationInFrames - 1],
    [1, 0, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const subtitle =
    scene.claim.length > 108 ? `${scene.claim.slice(0, 105).trimEnd()}…` : scene.claim;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        backgroundColor: "hsl(var(--story-shadow-color))",
        color: "hsl(var(--primary-foreground))",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="journey-dot-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1" fill="hsl(var(--backdrop-scene-faint) / 0.24)" />
          </pattern>
          <radialGradient id="journey-traveler-glow">
            <stop offset="0" stopColor="hsl(var(--primary-foreground))" />
            <stop offset="0.45" stopColor="hsl(var(--story-accent))" />
            <stop offset="1" stopColor="hsl(var(--story-accent) / 0)" />
          </radialGradient>
        </defs>
        <rect width="1280" height="720" fill="url(#journey-dot-grid)" />
        <path
          d={JOURNEY_PATH}
          fill="none"
          stroke="hsl(var(--backdrop-scene-faint) / 0.18)"
          strokeWidth="34"
          strokeLinecap="round"
        />
        <path
          d={JOURNEY_PATH}
          fill="none"
          stroke="hsl(var(--story-accent))"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={JOURNEY_PATH_LENGTH}
          strokeDashoffset={JOURNEY_PATH_LENGTH * (1 - pathProgress)}
        />
        <path
          d={JOURNEY_PATH}
          fill="none"
          stroke="hsl(var(--primary-foreground) / 0.34)"
          strokeWidth="1"
          strokeDasharray="5 15"
          strokeDashoffset={-frame * 0.7}
        />

        {plan.scenes.map((beat, index) => {
          const stopProgress = index / Math.max(1, stopCount - 1);
          const stop = getJourneyPoint(stopProgress);
          const arrivalFrame = 22 + stopProgress * 100;
          const stopEntrance = spring({
            frame: Math.max(0, frame - arrivalFrame),
            fps,
            config: { damping: 200 },
          });
          const proximity = interpolate(
            Math.abs(travelerProgress - stopProgress),
            [0, 0.16],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const isCurrent = beat.index === scene.index;

          return (
            <g
              key={beat.id}
              transform={`translate(${stop.x} ${stop.y}) scale(${stopEntrance})`}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {isCurrent ? (
                <circle
                  r="30"
                  fill="none"
                  stroke="hsl(var(--story-accent))"
                  strokeWidth="3"
                  opacity={0.7 + proximity * 0.3}
                />
              ) : null}
              <circle
                r={20 + proximity * 3}
                fill="hsl(var(--story-shadow-color))"
                stroke={proximity > 0.45 ? "hsl(var(--primary-foreground))" : "hsl(var(--backdrop-scene-faint))"}
                strokeWidth={proximity > 0.45 ? 4 : 2}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fill="hsl(var(--primary-foreground))"
                fontSize="18"
                fontWeight="700"
              >
                {index + 1}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${traveler.x} ${traveler.y})`}>
          <circle r="34" fill="url(#journey-traveler-glow)" opacity="0.78" />
          <path
            d="M 0 -18 C 10 -18 15 -10 15 -2 C 15 9 7 18 0 24 C -7 18 -15 9 -15 -2 C -15 -10 -10 -18 0 -18 Z"
            fill="hsl(var(--story-accent))"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="3"
          />
          <circle cy="-4" r="5" fill="hsl(var(--primary-foreground))" />
        </g>
      </svg>

      <Sequence from={0} durationInFrames={durationInFrames}>
        <header
          style={{
            position: "absolute",
            top: 42,
            left: 58,
            width: 920,
            opacity: interpolate(frame, [0, 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateX(${interpolate(titleEntrance, [0, 1], [-30, 0])}px)`,
          }}
        >
          <div
            style={{
              marginBottom: 10,
              color: "hsl(var(--story-accent))",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Capability map · {String(scene.index + 1).padStart(2, "0")}
          </div>
          <div
            style={{
              overflow: "hidden",
              color: "hsl(var(--primary-foreground))",
              fontFamily: "var(--story-display-font)",
              fontSize: 52,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {scene.title}
          </div>
          <div
            style={{
              maxWidth: 820,
              marginTop: 14,
              overflow: "hidden",
              color: "hsl(var(--backdrop-scene-faint))",
              fontSize: 19,
              lineHeight: 1.35,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        </header>
      </Sequence>

      {plan.scenes.map((beat, index) => {
        const stopProgress = index / Math.max(1, stopCount - 1);
        const stop = getJourneyPoint(stopProgress);
        const stopEntrance = spring({
          frame: Math.max(0, frame - (22 + stopProgress * 100)),
          fps,
          config: { damping: 200 },
        });
        const proximity = interpolate(
          Math.abs(travelerProgress - stopProgress),
          [0, 0.18],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const title = beat.title.length > 28 ? `${beat.title.slice(0, 27).trimEnd()}…` : beat.title;

        return (
          <div
            key={beat.id}
            style={{
              position: "absolute",
              top: stop.y + (index % 2 === 0 ? 42 : -100),
              left: stop.x - 95,
              width: 190,
              padding: "10px 12px",
              border: `1px solid hsl(var(--backdrop-scene-faint) / ${0.28 + proximity * 0.62})`,
              borderRadius: "var(--story-radius-sm)",
              backgroundColor: "hsl(var(--story-shadow-color) / 0.9)",
              boxShadow: proximity > 0.5 ? "0 0 24px hsl(var(--story-accent) / 0.35)" : "none",
              opacity: stopEntrance * (0.58 + proximity * 0.42),
              textAlign: "center",
              transform: `scale(${0.9 + stopEntrance * 0.1})`,
            }}
          >
            <div
              style={{
                overflow: "hidden",
                color: "hsl(var(--primary-foreground))",
                fontFamily: "var(--story-display-font)",
                fontSize: 18,
                lineHeight: 1.15,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 6,
                color: "hsl(var(--story-accent))",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {beat.role.replace("-", " ")}
            </div>
          </div>
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundColor: "hsl(var(--story-shadow-color))",
          opacity: seamOpacity,
        }}
      />
    </AbsoluteFill>
  );
}

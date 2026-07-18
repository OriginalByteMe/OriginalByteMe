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

const TRACK_START = { x: -80, y: 580 };
const TRACK_CONTROL_ONE = { x: 280, y: 300 };
const TRACK_CONTROL_TWO = { x: 720, y: 690 };
const TRACK_END = { x: 1360, y: 350 };
const TRACK_PATH = "M -80 580 C 280 300 720 690 1360 350";
const STARS = [
  { x: 72, y: 108, radius: 2, speed: 0.18 },
  { x: 206, y: 236, radius: 1.5, speed: 0.1 },
  { x: 365, y: 76, radius: 2.5, speed: 0.22 },
  { x: 548, y: 194, radius: 1.5, speed: 0.13 },
  { x: 744, y: 98, radius: 2, speed: 0.2 },
  { x: 928, y: 218, radius: 1.5, speed: 0.11 },
  { x: 1104, y: 82, radius: 2.5, speed: 0.24 },
  { x: 1240, y: 174, radius: 1.5, speed: 0.15 },
] as const;
const SKYLINE = [
  { x: -20, width: 98, height: 76 },
  { x: 66, width: 56, height: 126 },
  { x: 116, width: 114, height: 92 },
  { x: 220, width: 72, height: 156 },
  { x: 282, width: 132, height: 106 },
  { x: 405, width: 64, height: 178 },
  { x: 460, width: 108, height: 122 },
  { x: 558, width: 148, height: 88 },
  { x: 696, width: 70, height: 142 },
  { x: 756, width: 124, height: 110 },
  { x: 870, width: 62, height: 166 },
  { x: 922, width: 138, height: 94 },
  { x: 1050, width: 78, height: 136 },
  { x: 1118, width: 112, height: 108 },
  { x: 1218, width: 94, height: 152 },
] as const;

function getTrackPoint(progress: number): Point {
  const t = Math.min(1, Math.max(0, progress));
  const inverse = 1 - t;

  return {
    x:
      inverse ** 3 * TRACK_START.x +
      3 * inverse ** 2 * t * TRACK_CONTROL_ONE.x +
      3 * inverse * t ** 2 * TRACK_CONTROL_TWO.x +
      t ** 3 * TRACK_END.x,
    y:
      inverse ** 3 * TRACK_START.y +
      3 * inverse ** 2 * t * TRACK_CONTROL_ONE.y +
      3 * inverse * t ** 2 * TRACK_CONTROL_TWO.y +
      t ** 3 * TRACK_END.y,
  };
}

export default function NightDrive({ scene, plan }: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const titleEntrance = spring({ frame, fps, config: { damping: 200 } });
  const carProgress = interpolate(frame, [24, durationInFrames - 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const car = getTrackPoint(carProgress);
  const tangent = getTrackPoint(Math.min(1, carProgress + 0.004));
  const carAngle = Math.atan2(tangent.y - car.y, tangent.x - car.x) * (180 / Math.PI);
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
        background:
          "linear-gradient(180deg, hsl(var(--backdrop-scene-violet) / 0.2) 0%, hsl(var(--story-shadow-color)) 58%)",
        color: "hsl(var(--primary-foreground))",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="night-headlight" x1="0" x2="1">
            <stop offset="0" stopColor="hsl(var(--primary-foreground))" stopOpacity="0.38" />
            <stop offset="1" stopColor="hsl(var(--primary-foreground))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="night-road-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--backdrop-scene-faint) / 0.5)" />
            <stop offset="1" stopColor="hsl(var(--story-accent) / 0.22)" />
          </linearGradient>
        </defs>

        {STARS.map((star, index) => {
          const x = ((star.x - frame * star.speed + 20) % 1320 + 1320) % 1320 - 20;
          return (
            <circle
              key={`${star.x}-${star.y}`}
              cx={x}
              cy={star.y}
              r={star.radius}
              fill="hsl(var(--primary-foreground))"
              opacity={0.26 + ((index + frame / 30) % 3) * 0.08}
            />
          );
        })}

        <g transform={`translate(${-frame * 0.04} 0)`}>
          {SKYLINE.map((building, index) => (
            <g key={`${building.x}-${building.width}`}>
              <rect
                x={building.x}
                y={340 - building.height}
                width={building.width}
                height={building.height}
                fill="hsl(var(--story-shadow-color) / 0.86)"
                stroke="hsl(var(--backdrop-scene-faint) / 0.16)"
              />
              {Array.from({ length: Math.max(1, Math.floor(building.width / 30)) }).map((_, windowIndex) => (
                <rect
                  key={windowIndex}
                  x={building.x + 14 + windowIndex * 26}
                  y={356 - building.height + (windowIndex % 3) * 24}
                  width="5"
                  height="9"
                  fill={
                    (index + windowIndex) % 3 === 0
                      ? "hsl(var(--story-accent) / 0.42)"
                      : "hsl(var(--primary-foreground) / 0.12)"
                  }
                />
              ))}
            </g>
          ))}
        </g>

        <path
          d={TRACK_PATH}
          fill="none"
          stroke="url(#night-road-edge)"
          strokeWidth="158"
          strokeLinecap="round"
        />
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="hsl(var(--story-shadow-color))"
          strokeWidth="144"
          strokeLinecap="round"
        />
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="hsl(var(--primary-foreground) / 0.62)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="38 30"
          strokeDashoffset={-frame * 4.5}
        />
        <path
          d={TRACK_PATH}
          fill="none"
          stroke="hsl(var(--story-accent) / 0.38)"
          strokeWidth="1"
          strokeDasharray="3 13"
          strokeDashoffset={frame * 1.4}
        />

        <g transform={`translate(${car.x} ${car.y}) rotate(${carAngle})`}>
          <polygon points="18,-12 190,-72 190,72" fill="url(#night-headlight)" />
          <path
            d="M -31 -9 L -18 -24 L 18 -24 L 35 -8 L 39 11 L -39 11 Z"
            fill="hsl(var(--story-accent))"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="3"
          />
          <path d="M -13 -22 L -5 -36 L 14 -36 L 25 -22 Z" fill="hsl(var(--backdrop-scene-ink))" />
          <circle cx="-23" cy="13" r="10" fill="hsl(var(--story-shadow-color))" stroke="hsl(var(--backdrop-scene-faint))" strokeWidth="3" />
          <circle cx="25" cy="13" r="10" fill="hsl(var(--story-shadow-color))" stroke="hsl(var(--backdrop-scene-faint))" strokeWidth="3" />
          <circle cx="39" cy="-1" r="5" fill="hsl(var(--primary-foreground))" />
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
            Timeline · {String(scene.index + 1).padStart(2, "0")}
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
        const stopProgress = 0.1 + (index / Math.max(1, plan.scenes.length - 1)) * 0.8;
        const stop = getTrackPoint(stopProgress);
        const signTop = stop.y - 124 - (index % 2) * 14;
        const proximity = interpolate(
          Math.abs(carProgress - stopProgress),
          [0, 0.15],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const entrance = spring({
          frame: Math.max(0, frame - (24 + index * 16)),
          fps,
          config: { damping: 200 },
        });
        const title = beat.title.length > 25 ? `${beat.title.slice(0, 24).trimEnd()}…` : beat.title;
        const isCurrent = beat.index === scene.index;

        return (
          <div
            key={beat.id}
            style={{
              position: "absolute",
              top: signTop,
              left: stop.x - 82,
              width: 164,
              opacity: entrance * (0.42 + proximity * 0.58),
              filter: proximity > 0.08 ? `drop-shadow(0 0 ${8 + proximity * 20}px hsl(var(--primary-foreground) / ${0.12 + proximity * 0.36}))` : "none",
              transform: `translateY(${(1 - entrance) * 18}px)`,
            }}
          >
            {isCurrent ? (
              <div
                style={{
                  position: "absolute",
                  top: -30,
                  right: -6,
                  display: "flex",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ width: 3, height: 42, backgroundColor: "hsl(var(--story-accent))" }} />
                <div
                  style={{
                    width: 28,
                    height: 18,
                    backgroundColor: "hsl(var(--story-accent))",
                    clipPath: "polygon(0 0, 100% 18%, 72% 100%, 0 82%)",
                  }}
                />
              </div>
            ) : null}
            <div
              style={{
                position: "relative",
                zIndex: 1,
                padding: "10px 12px",
                border: `2px solid hsl(var(--primary-foreground) / ${0.28 + proximity * 0.72})`,
                borderRadius: "var(--story-radius-sm)",
                backgroundColor: "hsl(var(--story-shadow-color) / 0.94)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  color: "hsl(var(--primary-foreground))",
                  fontFamily: "var(--story-display-font)",
                  fontSize: 17,
                  lineHeight: 1.15,
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 5,
                  color: "hsl(var(--story-accent))",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                }}
              >
                Checkpoint {String(index + 1).padStart(2, "0")} · {beat.role.replace("-", " ")}
              </div>
            </div>
            <div
              style={{
                width: 4,
                height: Math.max(34, stop.y - signTop - 52),
                margin: "0 auto",
                backgroundColor: "hsl(var(--backdrop-scene-faint) / 0.64)",
              }}
            />
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

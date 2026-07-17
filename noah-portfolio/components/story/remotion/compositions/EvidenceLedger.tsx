import type { SceneCompositionProps } from "@/components/story/remotion/contract";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface LedgerRowProps {
  index: number;
  label: string;
}

function LedgerRow({ index, label }: LedgerRowProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamp = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 170, mass: 0.72 },
    durationInFrames: 42,
  });
  const underline = interpolate(frame, [12, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(stamp, [0, 0.68, 1], [0.94, 1.06, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <li
      style={{
        position: "relative",
        height: 52,
        display: "grid",
        gridTemplateColumns: "72px 1fr 112px",
        alignItems: "center",
        margin: 0,
        color: "hsl(var(--story-ink))",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        opacity: interpolate(stamp, [0, 0.26, 1], [0, 1, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(0, ${interpolate(stamp, [0, 1], [28, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}px, 0) scale(${scale})`,
        transformOrigin: "16% 50%",
      }}
    >
      <span
        style={{
          color: "hsl(var(--story-accent))",
          fontSize: 17,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.12em",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        style={{
          overflow: "hidden",
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textOverflow: "ellipsis",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          justifySelf: "end",
          color: "hsl(var(--story-muted))",
          fontSize: 14,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        matched
      </span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          left: 0,
          height: 2,
          backgroundColor: "hsl(var(--story-accent))",
          opacity: 0.72,
          transform: `scaleX(${underline})`,
          transformOrigin: "left center",
        }}
      />
    </li>
  );
}

function VerifiedMark() {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [0, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg
      aria-label="Verified"
      width="52"
      height="52"
      viewBox="0 0 52 52"
      style={{ flex: "0 0 auto", overflow: "visible" }}
    >
      <path
        d="M 8 27 L 21 40 L 45 11"
        pathLength={1}
        fill="none"
        stroke="hsl(var(--story-success))"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
}

export default function EvidenceLedger({ scene }: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rows = scene.evidenceRefIds
    .slice(0, 8)
    .map((id) => id.replaceAll("-", " "));
  const firstRowFrame = 42;
  const rowStagger = 22;
  const finalBeatFrame = firstRowFrame + rows.length * rowStagger + 28;
  const verifiedCount = Math.floor(
    interpolate(
      frame,
      [firstRowFrame, firstRowFrame + rows.length * rowStagger],
      [0, rows.length],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ),
  );
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
          "linear-gradient(hsl(var(--story-border) / 0.24) 1px, hsl(var(--story-surface) / 0) 1px)",
        backgroundSize: "100% 32px",
      }}
    >
      <header
        style={{
          position: "absolute",
          top: 48,
          right: 64,
          left: 64,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          gap: 24,
        }}
      >
        <div style={{ minWidth: 0, maxWidth: 1000, flex: "1 1 auto" }}>
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
            Evidence ledger
          </p>
          <h1
            style={{
              margin: "8px 0 0",
              fontFamily: "var(--story-display-font)",
              fontSize: 50,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1,
            }}
          >
            {scene.title}
          </h1>
        </div>
        <Sequence from={finalBeatFrame} layout="none">
          <VerifiedMark />
        </Sequence>
      </header>

      <aside
        aria-label={`${verifiedCount} of ${rows.length} evidence references matched`}
        style={{
          position: "absolute",
          top: 176,
          right: 64,
          width: 176,
          padding: "20px 24px",
          boxSizing: "border-box",
          border: "1px solid hsl(var(--story-border))",
          borderRadius: "var(--story-radius-sm)",
          backgroundColor: "hsl(var(--story-surface-raised))",
          boxShadow: "var(--story-shadow)",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        <strong style={{ display: "block", color: "hsl(var(--story-accent))", fontSize: 36 }}>
          {String(verifiedCount).padStart(2, "0")}
        </strong>
        <span
          style={{
            color: "hsl(var(--story-muted))",
            fontSize: 13,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          of {String(rows.length).padStart(2, "0")} matched
        </span>
      </aside>

      <ol
        style={{
          position: "absolute",
          top: 176,
          right: 288,
          left: 64,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {rows.map((label, index) => (
          <Sequence key={`${label}-${index}`} from={firstRowFrame + index * rowStagger} layout="none">
            <LedgerRow index={index} label={label} />
          </Sequence>
        ))}
      </ol>
    </AbsoluteFill>
  );
}

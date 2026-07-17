"use client";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";
import { motion, useTransform } from "framer-motion";

const COLUMN_COUNT = 40;
const ROW_COUNT = 8;
const DOTS = Array.from({ length: COLUMN_COUNT * ROW_COUNT }, (_, index) => {
  const column = index % COLUMN_COUNT;
  const row = Math.floor(index / COLUMN_COUNT);
  return {
    column,
    row,
    x: 100 + column * 20.5,
    y: 88 + row * 20.5,
    phase: Math.sin((row / (ROW_COUNT - 1)) * Math.PI * 2) * 0.018,
  };
});

function DitherDot({
  progress,
  column,
  row,
  x,
  y,
  phase,
}: Pick<TransitionVariantProps, "progress"> & {
  column: number;
  row: number;
  x: number;
  y: number;
  phase: number;
}) {
  const crest = 0.08 + (column / (COLUMN_COUNT - 1)) * 0.78 + phase;
  const opacity = useTransform(progress, [crest - 0.07, crest, crest + 0.08], [0.03, 0.96, 0.035]);
  const scale = useTransform(progress, [crest - 0.07, crest, crest + 0.08], [0.6, 1.8, 0.65]);

  return (
    <motion.circle
      cx={x}
      cy={y}
      r={row % 3 === 0 ? 1.5 : 1.25}
      fill={(column + row) % 5 === 0
        ? "hsl(var(--foreground) / 0.9)"
        : "hsl(var(--primary) / 0.86)"}
      style={{ opacity, scale, transformBox: "fill-box", transformOrigin: "center" }}
    />
  );
}

export default function DitherWave({ progress }: TransitionVariantProps) {
  const crestX = useTransform(progress, [0, 1], [-100, 1000]);
  const underlineOpacity = useTransform(progress, [0, 0.08, 0.88, 1], [0, 0.42, 0.34, 0]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 320"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <line
          x1="100"
          y1="252"
          x2="900"
          y2="252"
          stroke="hsl(var(--muted-foreground) / 0.18)"
          strokeWidth="1"
          strokeDasharray="2 14"
        />
        {DOTS.map((dot) => (
          <DitherDot
            key={`${dot.column}-${dot.row}`}
            progress={progress}
            column={dot.column}
            row={dot.row}
            x={dot.x}
            y={dot.y}
            phase={dot.phase}
          />
        ))}
        <motion.line
          x1="0"
          y1="260"
          x2="78"
          y2="260"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ x: crestX, opacity: underlineOpacity }}
        />
      </svg>
    </div>
  );
}

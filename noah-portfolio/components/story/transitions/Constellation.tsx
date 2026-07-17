"use client";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";
import { motion, useTransform } from "framer-motion";

const STARS = [
  { x: 132, y: 204 },
  { x: 244, y: 112 },
  { x: 360, y: 168 },
  { x: 470, y: 76 },
  { x: 584, y: 148 },
  { x: 706, y: 98 },
  { x: 820, y: 190 },
  { x: 900, y: 126 },
] as const;

const LINKS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [2, 6],
] as const;

const JOINED_PATH = LINKS.map(([startIndex, endIndex]) => {
  const start = STARS[startIndex];
  const end = STARS[endIndex];
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}).join(" ");

function StarDot({
  progress,
  x,
  y,
  index,
}: Pick<TransitionVariantProps, "progress"> & { x: number; y: number; index: number }) {
  const entrance = 0.06 + index * 0.025;
  const opacity = useTransform(progress, [entrance, entrance + 0.12], [0, 0.82]);
  const scale = useTransform(progress, [entrance, entrance + 0.12], [0.35, 1]);

  return (
    <motion.g style={{ opacity, scale, transformBox: "fill-box", transformOrigin: "center" }}>
      <circle cx={x} cy={y} r="9" fill="hsl(var(--primary) / 0.14)" />
      <circle cx={x} cy={y} r={index % 3 === 0 ? 3.2 : 2.4} fill="hsl(var(--foreground))" />
    </motion.g>
  );
}

function ConstellationLine({
  progress,
  startIndex,
  endIndex,
  index,
}: Pick<TransitionVariantProps, "progress"> & {
  startIndex: number;
  endIndex: number;
  index: number;
}) {
  const startWindow = 0.34 + index * 0.075;
  const endWindow = index === LINKS.length - 1 ? 1 : startWindow + 0.16;
  const pathLength = useTransform(progress, [startWindow, endWindow], [0, 1]);
  const start = STARS[startIndex];
  const end = STARS[endIndex];

  return (
    <motion.path
      d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
      fill="none"
      stroke="hsl(var(--primary) / 0.82)"
      strokeWidth="1.6"
      strokeLinecap="round"
      style={{ pathLength }}
    />
  );
}

export default function Constellation({ progress }: TransitionVariantProps) {
  const glowOpacity = useTransform(progress, [0, 0.88, 0.96, 1], [0, 0, 0.58, 0.28]);
  const glowWidth = useTransform(progress, [0.88, 0.96, 1], [2, 5, 3]);

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
        <path
          d={JOINED_PATH}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.2)"
          strokeWidth="1"
          strokeDasharray="3 9"
        />
        <motion.path
          d={JOINED_PATH}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeLinecap="round"
          style={{
            opacity: glowOpacity,
            strokeWidth: glowWidth,
            filter: "drop-shadow(0 0 10px hsl(var(--primary) / 0.42))",
          }}
        />
        {LINKS.map(([startIndex, endIndex], index) => (
          <ConstellationLine
            key={`${startIndex}-${endIndex}`}
            progress={progress}
            startIndex={startIndex}
            endIndex={endIndex}
            index={index}
          />
        ))}
        {STARS.map((star, index) => (
          <StarDot
            key={`${star.x}-${star.y}`}
            progress={progress}
            x={star.x}
            y={star.y}
            index={index}
          />
        ))}
      </svg>
    </div>
  );
}

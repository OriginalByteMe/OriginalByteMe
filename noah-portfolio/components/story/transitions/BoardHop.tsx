"use client";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";
import { motion, useTransform } from "framer-motion";

const SQUARES = [
  { x: 170, y: 190 },
  { x: 302, y: 128 },
  { x: 434, y: 188 },
  { x: 566, y: 122 },
  { x: 698, y: 180 },
  { x: 830, y: 112 },
] as const;
const ROUTE = SQUARES.map((square) => `${square.x},${square.y}`).join(" ");

function BoardSquare({
  progress,
  x,
  y,
  number,
}: Pick<TransitionVariantProps, "progress"> & {
  x: number;
  y: number;
  number: number;
}) {
  const visitThreshold = 0.06 + (number - 1) * 0.16;
  const visitedOpacity = useTransform(
    progress,
    [visitThreshold - 0.03, visitThreshold + 0.06],
    [0, 1],
  );

  return (
    <g>
      <rect
        x={x - 34}
        y={y - 34}
        width="68"
        height="68"
        rx="5"
        fill="hsl(var(--foreground) / 0.025)"
        stroke="hsl(var(--muted-foreground) / 0.46)"
        strokeWidth="1"
      />
      <motion.rect
        x={x - 33}
        y={y - 33}
        width="66"
        height="66"
        rx="4"
        fill="hsl(var(--primary) / 0.26)"
        style={{ opacity: visitedOpacity }}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="22"
        fontWeight="700"
      >
        {number}
      </text>
    </g>
  );
}

export default function BoardHop({ progress }: TransitionVariantProps) {
  const routeLength = useTransform(progress, [0.04, 0.9], [0, 1]);
  const pawnX = useTransform(progress, (value) => {
    const travel = Math.min(1, Math.max(0, (value - 0.08) / 0.84));
    const scaled = travel * (SQUARES.length - 1);
    const segment = Math.min(SQUARES.length - 2, Math.floor(scaled));
    const localProgress = scaled - segment;
    const start = SQUARES[segment];
    const end = SQUARES[segment + 1];
    return start.x + (end.x - start.x) * localProgress;
  });
  const pawnY = useTransform(progress, (value) => {
    const travel = Math.min(1, Math.max(0, (value - 0.08) / 0.84));
    const scaled = travel * (SQUARES.length - 1);
    const segment = Math.min(SQUARES.length - 2, Math.floor(scaled));
    const localProgress = scaled - segment;
    const start = SQUARES[segment];
    const end = SQUARES[segment + 1];
    const hop = 4 * localProgress * (1 - localProgress);
    return start.y + (end.y - start.y) * localProgress - 48 - hop * 38;
  });
  const pawnOpacity = useTransform(progress, [0, 0.05, 1], [0, 1, 1]);
  const flagOpacity = useTransform(progress, [0.86, 0.94, 1], [0, 1, 1]);
  const flagScale = useTransform(progress, [0.86, 0.94, 1], [0.45, 1, 1]);
  const finalSquare = SQUARES[SQUARES.length - 1];

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
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <polyline
          points={ROUTE}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.28)"
          strokeWidth="1"
          strokeDasharray="3 9"
        />
        <motion.polyline
          points={ROUTE}
          fill="none"
          stroke="hsl(var(--primary) / 0.62)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength: routeLength }}
        />

        {SQUARES.map((square, index) => (
          <BoardSquare
            key={square.x}
            progress={progress}
            x={square.x}
            y={square.y}
            number={index + 1}
          />
        ))}

        <motion.g
          transform={`translate(${finalSquare.x + 22} ${finalSquare.y - 34})`}
          style={{
            opacity: flagOpacity,
            scale: flagScale,
            transformBox: "fill-box",
            transformOrigin: "bottom left",
          }}
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="-38"
            stroke="hsl(var(--foreground) / 0.76)"
            strokeWidth="1.5"
          />
          <path d="M 1 -37 L 22 -31 L 1 -24 Z" fill="hsl(var(--primary) / 0.82)" />
        </motion.g>

        <motion.g style={{ x: pawnX, y: pawnY, opacity: pawnOpacity }}>
          <circle
            cx="0"
            cy="-5"
            r="8"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--foreground) / 0.78)"
            strokeWidth="1.5"
          />
          <path
            d="M -11 15 C -9 4 9 4 11 15 Z"
            fill="hsl(var(--primary) / 0.78)"
            stroke="hsl(var(--foreground) / 0.68)"
            strokeWidth="1.5"
          />
          <line
            x1="-13"
            y1="16"
            x2="13"
            y2="16"
            stroke="hsl(var(--foreground) / 0.76)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </motion.g>
      </svg>
    </div>
  );
}

"use client";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";
import { motion, useTransform } from "framer-motion";

const POSTS = [
  { x: 260, threshold: 0.28 },
  { x: 500, threshold: 0.48 },
  { x: 740, threshold: 0.68 },
] as const;

function RoadsidePost({
  progress,
  x,
  threshold,
}: Pick<TransitionVariantProps, "progress"> & { x: number; threshold: number }) {
  const lightOpacity = useTransform(
    progress,
    [threshold - 0.06, threshold, threshold + 0.12],
    [0.12, 1, 0.42],
  );
  const lightScale = useTransform(
    progress,
    [threshold - 0.06, threshold, threshold + 0.12],
    [0.72, 1.18, 1],
  );

  return (
    <g transform={`translate(${x} 0)`}>
      <line
        x1="0"
        y1="196"
        x2="0"
        y2="229"
        stroke="hsl(var(--muted-foreground) / 0.62)"
        strokeWidth="2"
      />
      <motion.circle
        cx="0"
        cy="194"
        r="8"
        fill="hsl(var(--primary) / 0.22)"
        style={{ opacity: lightOpacity, scale: lightScale, transformOrigin: "center" }}
      />
      <motion.circle
        cx="0"
        cy="194"
        r="2.5"
        fill="hsl(var(--primary))"
        style={{ opacity: lightOpacity }}
      />
    </g>
  );
}

export default function NightConvoy({ progress }: TransitionVariantProps) {
  const carX = useTransform(progress, [0, 0.08, 0.92, 1], [-120, -82, 1030, 1080]);
  const carOpacity = useTransform(progress, [0, 0.06, 0.94, 1], [0, 1, 1, 0]);
  const roadGlowOpacity = useTransform(progress, [0, 0.14, 0.82, 1], [0, 0.42, 0.24, 0]);

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
          x1="0"
          y1="230"
          x2="1000"
          y2="230"
          stroke="hsl(var(--muted-foreground) / 0.32)"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="236"
          x2="1000"
          y2="236"
          stroke="hsl(var(--muted-foreground) / 0.2)"
          strokeWidth="1"
          strokeDasharray="2 12"
        />

        {POSTS.map((post) => (
          <RoadsidePost
            key={post.x}
            progress={progress}
            x={post.x}
            threshold={post.threshold}
          />
        ))}

        <motion.g style={{ x: carX, opacity: carOpacity }}>
          <motion.path
            d="M 28 202 L 188 222 L 28 229 Z"
            fill="hsl(var(--primary) / 0.18)"
            style={{ opacity: roadGlowOpacity }}
          />
          <motion.line
            x1="30"
            y1="227"
            x2="174"
            y2="227"
            stroke="hsl(var(--primary) / 0.62)"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ opacity: roadGlowOpacity }}
          />
          <path
            d="M -24 216 L -14 203 L 9 203 L 22 215 L 30 218 L 29 227 L -29 227 L -31 220 Z"
            fill="hsl(var(--primary) / 0.9)"
            stroke="hsl(var(--foreground) / 0.88)"
            strokeWidth="1.5"
          />
          <path
            d="M -10 203 L -4 194 L 11 194 L 20 213 L 9 203 Z"
            fill="hsl(var(--background) / 0.86)"
            stroke="hsl(var(--foreground) / 0.34)"
            strokeWidth="1"
          />
          <circle
            cx="-17"
            cy="228"
            r="6"
            fill="hsl(var(--background))"
            stroke="hsl(var(--muted-foreground) / 0.7)"
            strokeWidth="2"
          />
          <circle
            cx="19"
            cy="228"
            r="6"
            fill="hsl(var(--background))"
            stroke="hsl(var(--muted-foreground) / 0.7)"
            strokeWidth="2"
          />
          <circle cx="30" cy="219" r="2.5" fill="hsl(var(--foreground))" />
        </motion.g>
      </svg>
    </div>
  );
}

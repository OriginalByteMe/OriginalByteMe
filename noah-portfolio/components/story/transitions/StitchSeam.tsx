"use client";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";
import { motion, useTransform } from "framer-motion";

const STITCH_POINTS = Array.from({ length: 17 }, (_, index) => ({
  x: 72 + index * 54,
  y: index % 2 === 0 ? 148 : 172,
}));
const STITCH_PATH = STITCH_POINTS.map((point, index) =>
  `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
).join(" ");
const CROSS_STITCHES = Array.from({ length: 11 }, (_, index) => ({
  x: 92 + index * 78,
  threshold: 0.18 + index * 0.065,
}));

function CrossStitch({
  progress,
  x,
  threshold,
}: Pick<TransitionVariantProps, "progress"> & { x: number; threshold: number }) {
  const opacity = useTransform(progress, [threshold - 0.04, threshold + 0.05], [0, 0.72]);
  const scaleX = useTransform(progress, [threshold - 0.04, threshold + 0.07], [1.7, 1]);
  const scaleY = useTransform(progress, [threshold - 0.04, threshold + 0.07], [0.55, 1]);

  return (
    <motion.g
      style={{
        opacity,
        scaleX,
        scaleY,
        transformBox: "fill-box",
        transformOrigin: "center",
      }}
    >
      <path
        d={`M ${x - 7} 153 L ${x + 7} 167 M ${x + 7} 153 L ${x - 7} 167`}
        fill="none"
        stroke="hsl(var(--muted-foreground) / 0.7)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </motion.g>
  );
}

export default function StitchSeam({ progress }: TransitionVariantProps) {
  const leftPanelX = useTransform(progress, [0, 1], [-12, -3]);
  const rightPanelX = useTransform(progress, [0, 1], [12, 3]);
  const pathLength = useTransform(progress, [0.08, 0.92], [0, 1]);
  const needleX = useTransform(progress, [0.08, 0.92], [72, 936]);
  const needleY = useTransform(progress, (value) => {
    const stitchProgress = Math.min(1, Math.max(0, (value - 0.08) / 0.84));
    return 160 + Math.sin(stitchProgress * Math.PI * 16) * 12;
  });
  const needleOpacity = useTransform(progress, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          insetBlock: 0,
          left: 0,
          width: "50%",
          x: leftPanelX,
          borderRight: "1px solid hsl(var(--border) / 0.52)",
          background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.018))",
        }}
      />
      <motion.div
        style={{
          position: "absolute",
          insetBlock: 0,
          right: 0,
          width: "50%",
          x: rightPanelX,
          borderLeft: "1px solid hsl(var(--border) / 0.52)",
          background: "linear-gradient(90deg, hsl(var(--foreground) / 0.018), transparent)",
        }}
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 1000 320"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <line
          x1="500"
          y1="24"
          x2="500"
          y2="296"
          stroke="hsl(var(--muted-foreground) / 0.24)"
          strokeWidth="1"
          strokeDasharray="2 10"
        />
        <path
          d={STITCH_PATH}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.3)"
          strokeWidth="1.2"
          strokeDasharray="3 8"
        />
        <motion.path
          d={STITCH_PATH}
          fill="none"
          stroke="hsl(var(--primary) / 0.9)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength }}
        />

        {CROSS_STITCHES.map((stitch) => (
          <CrossStitch
            key={stitch.x}
            progress={progress}
            x={stitch.x}
            threshold={stitch.threshold}
          />
        ))}

        <motion.g style={{ x: needleX, y: needleY, opacity: needleOpacity, rotate: 18 }}>
          <line
            x1="-18"
            y1="0"
            x2="19"
            y2="0"
            stroke="hsl(var(--foreground) / 0.9)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <ellipse
            cx="-13"
            cy="0"
            rx="4"
            ry="2.2"
            fill="hsl(var(--background))"
            stroke="hsl(var(--foreground) / 0.72)"
            strokeWidth="1"
          />
          <path d="M 19 0 L 14 -2.5 L 14 2.5 Z" fill="hsl(var(--foreground) / 0.9)" />
        </motion.g>
      </svg>
    </div>
  );
}

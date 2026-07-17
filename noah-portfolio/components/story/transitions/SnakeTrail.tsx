"use client";

import { motion, useTransform } from "framer-motion";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";

const SEGMENT_COUNT = 10;

function SnakeSegment({
  progress,
  index,
}: Pick<TransitionVariantProps, "progress"> & { index: number }) {
  const delayedProgress = useTransform(progress, (value) =>
    Math.max(0, Math.min(1, (value - index * 0.018) / (1 - index * 0.018))),
  );
  const left = useTransform(delayedProgress, (value) => `${-5 + value * 110}%`);
  const top = useTransform(
    delayedProgress,
    (value) => `${50 + Math.sin(value * Math.PI * 4.5) * 22}%`,
  );
  const rotate = useTransform(
    delayedProgress,
    (value) => Math.cos(value * Math.PI * 4.5) * 22,
  );
  const opacity = useTransform(delayedProgress, [0, 0.04, 0.94, 1], [0, 0.85, 0.85, 0]);
  const tongueOpacity = useTransform(
    progress,
    [0, 0.89, 0.92, 0.95, 0.975, 1],
    [0, 0, 0.8, 0.08, 0.7, 0],
  );
  const isHead = index === 0;
  const size = isHead ? 12 : 10 - index * 0.22;

  return (
    <motion.div
      style={{
        position: "absolute",
        left,
        top,
        rotate,
        width: size,
        height: isHead ? size * 0.78 : size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        border: "1px solid hsl(var(--primary) / 0.82)",
        borderRadius: "9999px",
        background: isHead
          ? "hsl(var(--primary) / 0.72)"
          : `hsl(var(--primary) / ${0.5 - index * 0.025})`,
        boxShadow: isHead ? "0 0 12px hsl(var(--primary) / 0.24)" : "none",
        opacity,
      }}
    >
      {isHead ? (
        <motion.span
          style={{
            position: "absolute",
            left: "88%",
            top: "48%",
            width: 8,
            height: 1,
            borderRadius: "9999px",
            background: "hsl(var(--muted-foreground) / 0.8)",
            transformOrigin: "left center",
            opacity: tongueOpacity,
          }}
        />
      ) : null}
    </motion.div>
  );
}

export default function SnakeTrail({ progress }: TransitionVariantProps) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
        <SnakeSegment key={index} progress={progress} index={index} />
      ))}
    </div>
  );
}

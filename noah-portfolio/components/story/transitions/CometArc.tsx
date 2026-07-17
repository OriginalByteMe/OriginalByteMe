"use client";

import { motion, useTransform } from "framer-motion";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";

const ARC_PATH = "M 35 222 C 260 270 680 30 965 42";
const TRAIL_DOTS = 8;
const SPARKLES = [
  { left: "23%", top: "72%", threshold: 0.24 },
  { left: "39%", top: "55%", threshold: 0.4 },
  { left: "57%", top: "33%", threshold: 0.56 },
  { left: "72%", top: "19%", threshold: 0.7 },
  { left: "86%", top: "12%", threshold: 0.84 },
] as const;

function getArcPoint(value: number) {
  const inverse = 1 - value;
  return {
    x: inverse ** 3 * 3.5 + 3 * inverse ** 2 * value * 26 + 3 * inverse * value ** 2 * 68 + value ** 3 * 96.5,
    y: inverse ** 3 * 85 + 3 * inverse ** 2 * value * 104 + 3 * inverse * value ** 2 * 11.5 + value ** 3 * 16,
  };
}

function CometDot({
  progress,
  index,
}: Pick<TransitionVariantProps, "progress"> & { index: number }) {
  const delayedProgress = useTransform(progress, (value) =>
    Math.max(0, Math.min(1, (value - index * 0.025) / (1 - index * 0.025))),
  );
  const left = useTransform(delayedProgress, (value) => `${getArcPoint(value).x}%`);
  const top = useTransform(delayedProgress, (value) => `${getArcPoint(value).y}%`);
  const opacity = useTransform(delayedProgress, [0, 0.035, 0.94, 1], [0, 1, 1, 0]);
  const isHead = index === 0;
  const size = isHead ? 12 : Math.max(2.5, 7 - index * 0.65);

  return (
    <motion.div
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "9999px",
        background: isHead
          ? "radial-gradient(circle, hsl(var(--foreground) / 0.95) 0 18%, hsl(var(--primary) / 0.92) 38%, hsl(var(--primary) / 0) 76%)"
          : "hsl(var(--primary) / 0.5)",
        boxShadow: isHead ? "0 0 16px hsl(var(--primary) / 0.38)" : "none",
        opacity,
      }}
    />
  );
}

function Sparkle({
  progress,
  left,
  top,
  threshold,
}: Pick<TransitionVariantProps, "progress"> & (typeof SPARKLES)[number]) {
  const opacity = useTransform(
    progress,
    [threshold - 0.05, threshold, threshold + 0.08, threshold + 0.22],
    [0, 0.7, 0.35, 0],
  );
  const scale = useTransform(
    progress,
    [threshold - 0.05, threshold, threshold + 0.1],
    [0.4, 1, 0.65],
  );

  return (
    <motion.span
      style={{
        position: "absolute",
        left,
        top,
        width: 3,
        height: 3,
        borderRadius: "9999px",
        background: "hsl(var(--muted-foreground) / 0.72)",
        boxShadow: "0 0 8px hsl(var(--primary) / 0.28)",
        opacity,
        scale,
      }}
    />
  );
}

export default function CometArc({ progress }: TransitionVariantProps) {
  const strokeDashoffset = useTransform(progress, [0, 0.94], [1, 0]);
  const arcOpacity = useTransform(progress, [0, 0.06, 0.9, 1], [0, 0.5, 0.5, 0.12]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 260"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <motion.path
          d={ARC_PATH}
          pathLength={1}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.42)"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeDasharray="1"
          style={{ strokeDashoffset, opacity: arcOpacity }}
        />
      </svg>
      {SPARKLES.map((sparkle) => (
        <Sparkle key={`${sparkle.left}-${sparkle.top}`} progress={progress} {...sparkle} />
      ))}
      {Array.from({ length: TRAIL_DOTS }, (_, index) => (
        <CometDot key={index} progress={progress} index={index} />
      ))}
    </div>
  );
}

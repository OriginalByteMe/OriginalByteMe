"use client";

import { motion, useTransform } from "framer-motion";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";

const ARROW_COUNT = 6;

function ConvoyArrow({
  progress,
  index,
}: Pick<TransitionVariantProps, "progress"> & { index: number }) {
  const delayedProgress = useTransform(progress, (value) =>
    Math.max(0, Math.min(1, (value - index * 0.065) / (1 - index * 0.065))),
  );
  const left = useTransform(delayedProgress, [0, 1], ["11%", "89%"]);
  const top = useTransform(delayedProgress, [0, 1], ["9%", "91%"]);
  const opacity = useTransform(delayedProgress, [0, 0.07, 0.86, 1], [0, 0.82, 0.82, 0]);
  const scale = useTransform(delayedProgress, [0, 0.16, 0.84, 1], [0.72, 1, 1, 0.76]);
  const isLead = index === 0;

  return (
    <motion.div
      style={{
        position: "absolute",
        left,
        top,
        width: isLead ? 19 : 16,
        height: isLead ? 19 : 16,
        marginLeft: isLead ? -9.5 : -8,
        marginTop: isLead ? -9.5 : -8,
        color: isLead
          ? "hsl(var(--primary) / 0.92)"
          : `hsl(var(--muted-foreground) / ${0.72 - index * 0.06})`,
        filter: isLead ? "drop-shadow(0 0 6px hsl(var(--primary) / 0.24))" : "none",
        opacity,
        rotate: 19,
        scale,
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" style={{ width: "100%", height: "100%" }}>
        <path
          d="M 3 2 L 10 8 L 3 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {isLead ? (
          <path
            d="M 7 2 L 14 8 L 7 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
        ) : null}
      </svg>
    </motion.div>
  );
}

export default function ArrowConvoy({ progress }: TransitionVariantProps) {
  const laneLength = useTransform(progress, [0, 0.88], [0, 1]);
  const laneOpacity = useTransform(progress, [0, 0.08, 0.9, 1], [0, 0.38, 0.38, 0.1]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 260"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <motion.path
          d="M 110 24 L 890 236"
          pathLength={1}
          fill="none"
          stroke="hsl(var(--border) / 0.72)"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeDasharray="0.02 0.024"
          style={{ pathLength: laneLength, opacity: laneOpacity }}
        />
      </svg>
      {Array.from({ length: ARROW_COUNT }, (_, index) => (
        <ConvoyArrow key={index} progress={progress} index={index} />
      ))}
    </div>
  );
}

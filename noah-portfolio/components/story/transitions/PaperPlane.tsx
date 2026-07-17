"use client";

import { motion, useTransform } from "framer-motion";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";

const FLIGHT_PATH = [
  "M -40 182",
  "C 130 90 300 58 430 120",
  "C 525 166 565 226 510 224",
  "C 420 220 420 98 500 58",
  "C 600 8 655 98 620 126",
  "C 720 85 850 62 1040 55",
].join(" ");
const FLIGHT_TIMES = [0, 0.14, 0.28, 0.4, 0.48, 0.56, 0.63, 0.7, 0.84, 1];

export default function PaperPlane({ progress }: TransitionVariantProps) {
  const left = useTransform(
    progress,
    FLIGHT_TIMES,
    ["-4%", "13%", "32%", "45%", "52%", "46%", "51%", "61%", "79%", "104%"],
  );
  const top = useTransform(
    progress,
    FLIGHT_TIMES,
    ["70%", "45%", "35%", "46%", "70%", "75%", "38%", "23%", "33%", "21%"],
  );
  const rotate = useTransform(
    progress,
    FLIGHT_TIMES,
    [-22, -15, 0, 25, 80, 155, 225, 375, 352, 348],
  );
  const planeOpacity = useTransform(progress, [0, 0.035, 0.96, 1], [0, 0.88, 0.88, 0]);
  const trailLength = useTransform(progress, [0, 0.94], [0, 1]);
  const trailOpacity = useTransform(progress, [0, 0.08, 0.88, 1], [0, 0.46, 0.46, 0.1]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 260"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <motion.path
          d={FLIGHT_PATH}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.48)"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeDasharray="8 12"
          style={{ pathLength: trailLength, opacity: trailOpacity }}
        />
      </svg>

      <motion.div
        style={{
          position: "absolute",
          left,
          top,
          width: 31,
          height: 25,
          marginLeft: -15.5,
          marginTop: -12.5,
          color: "hsl(var(--primary) / 0.9)",
          filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.2))",
          opacity: planeOpacity,
          rotate,
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 34 26" style={{ width: "100%", height: "100%" }}>
          <polygon
            points="2,12 32,2 21,24 15,15"
            fill="hsl(var(--primary) / 0.2)"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path
            d="M 2 12 L 15 15 L 32 2 M 15 15 L 20.5 18.5"
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.74)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}

"use client";

import { motion, useTransform } from "framer-motion";

import type { TransitionVariantProps } from "@/components/story/transitions/contract";

const PRINTS = [
  { left: "9%", top: "78%", rotate: -20 },
  { left: "21%", top: "64%", rotate: 12 },
  { left: "33%", top: "70%", rotate: -14 },
  { left: "45%", top: "49%", rotate: 16 },
  { left: "57%", top: "56%", rotate: -12 },
  { left: "69%", top: "35%", rotate: 14 },
  { left: "81%", top: "42%", rotate: -16 },
  { left: "92%", top: "22%", rotate: 12 },
] as const;

function PawPrint({
  progress,
  index,
  left,
  top,
  rotate,
}: Pick<TransitionVariantProps, "progress"> &
  (typeof PRINTS)[number] & { index: number }) {
  const threshold = 0.08 + index * 0.1;
  const opacity = useTransform(progress, (value) => {
    const entrance = Math.max(0, Math.min(1, (value - threshold) / 0.045));
    const fade = Math.max(0.14, 1 - Math.max(0, value - threshold - 0.3) / 0.2);
    return entrance * fade * (0.82 - index * 0.025);
  });
  const scale = useTransform(progress, (value) => {
    const stamp = Math.max(0, Math.min(1, (value - threshold) / 0.055));
    return stamp < 0.7 ? 0.55 + stamp * 0.78 : 1.096 - (stamp - 0.7) * 0.32;
  });

  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 30 28"
      style={{
        position: "absolute",
        left,
        top,
        width: 25,
        height: 23,
        marginLeft: -12.5,
        marginTop: -11.5,
        color: index % 2 === 0
          ? "hsl(var(--primary) / 0.78)"
          : "hsl(var(--muted-foreground) / 0.7)",
        filter: "drop-shadow(0 0 5px hsl(var(--primary) / 0.12))",
        opacity,
        rotate,
        scale,
      }}
    >
      <ellipse cx="6.5" cy="7" rx="3" ry="4" transform="rotate(-24 6.5 7)" fill="currentColor" />
      <ellipse cx="12.5" cy="4.5" rx="3" ry="4" transform="rotate(-8 12.5 4.5)" fill="currentColor" />
      <ellipse cx="18.5" cy="4.5" rx="3" ry="4" transform="rotate(8 18.5 4.5)" fill="currentColor" />
      <ellipse cx="24" cy="7" rx="3" ry="4" transform="rotate(24 24 7)" fill="currentColor" />
      <path
        d="M 7.5 20 C 7.5 14.5 11 10.5 15.25 10.5 C 19.5 10.5 23 14.5 23 20 C 23 24 19.8 26 15.25 26 C 10.7 26 7.5 24 7.5 20 Z"
        fill="currentColor"
      />
    </motion.svg>
  );
}

export default function PawPrints({ progress }: TransitionVariantProps) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {PRINTS.map((paw, index) => (
        <PawPrint
          key={`${paw.left}-${paw.top}`}
          progress={progress}
          index={index}
          {...paw}
        />
      ))}
    </div>
  );
}

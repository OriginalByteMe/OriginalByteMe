"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * A trailing ring that chases the cursor (desktop only). The native cursor
 * stays visible; this is just an accent. mix-blend-difference keeps it
 * legible on both light and dark surfaces.
 */
export default function CursorTrail() {
  const [active, setActive] = useState(false);
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { stiffness: 260, damping: 24, mass: 0.6 });
  const y = useSpring(my, { stiffness: 260, damping: 24, mass: 0.6 });

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      setActive(true);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  if (!active) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[70] hidden h-9 w-9 rounded-full border border-white mix-blend-difference md:block"
      style={{ x, y, translateX: "-50%", translateY: "-50%" }}
    />
  );
}

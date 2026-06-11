"use client";

import { useRef, useState } from "react";
import { useAnimationFrame } from "framer-motion";

/**
 * Interactive demo for the AI Image Cutout project: the image is grayscale,
 * and a circular "segmentation lens" with marching-ants edges reveals the
 * full-color subject. Follows the cursor; demos itself on a slow drift when
 * idle.
 */
export default function CutoutDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState({ x: 0.5, y: 0.45 });
  const [hovering, setHovering] = useState(false);

  useAnimationFrame((t) => {
    if (hovering) return;
    setLens({
      x: 0.5 + Math.sin(t * 0.0006) * 0.26,
      y: 0.45 + Math.cos(t * 0.00085) * 0.2,
    });
  });

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLens({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const r = 21; // lens radius, % of width
  const cx = lens.x * 100;
  const cy = lens.y * 100;

  return (
    <div className="group">
      <div
        ref={containerRef}
        onMouseMove={onMouseMove}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="relative aspect-[4/3] cursor-crosshair overflow-hidden rounded-sm border border-zinc-300 dark:border-zinc-800"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cutout_project.jpeg"
          alt="AI image cutout demo"
          className="absolute inset-0 h-full w-full object-cover opacity-70 grayscale"
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cutout_project.jpeg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          style={{ clipPath: `circle(${r}% at ${cx}% ${cy}%)` }}
        />
        {/* marching ants */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 75"
          preserveAspectRatio="none"
        >
          {/* clip-path circle(%) resolves against the diagonal reference
              box (factor 0.884 for 4:3), so match the radius here */}
          <circle
            cx={cx}
            cy={cy * 0.75}
            r={r * 0.884}
            fill="none"
            stroke="white"
            strokeWidth="0.45"
            strokeDasharray="2.2 2.2"
            className="marching-ants mix-blend-difference"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <p className="mt-3 font-mono text-xs text-zinc-400 dark:text-zinc-600">
        $ segment --interactive{" "}
        <span className="text-zinc-500">
          — {hovering ? "tracking cursor" : "hover to take over the lens"}
        </span>
      </p>
    </div>
  );
}

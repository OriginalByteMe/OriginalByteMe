"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
} from "framer-motion";
import type { BaseComponentProps } from "@json-render/react";
import { cn } from "@/lib/utils";
import { enter } from "../motion";

/**
 * Story primitives — the shipping catalog versions of the scene-prototype
 * components proven under #37 (see docs/design-contract.md §9, §11.3).
 *
 * A generated answer is a Story: an array of Scenes (full-height, scroll-driven
 * chapters) or, for short answers, a single StaticComposition reading column.
 * Both are json-render container components — their children are the leaf
 * blocks (ChapterHeading / NarrativeBeat / StatReveal / SequencedTimeline)
 * placed in the spec tree, so array/child order is scene order.
 *
 * Motion model (contract §9):
 * - Scene is VIEWPORT-TRIGGERED (whileInView, once, amount 0.3); its inner
 *   column carries a staggerChildren orchestration so blocks cascade in on
 *   scroll entry. Blocks reuse the shared `enter` variant (§9.1) and set no
 *   initial/animate of their own, so they inherit hidden→show from whichever
 *   container drives them (Scene on scroll, StaticComposition on mount).
 * - StaticComposition is MOUNT-driven (initial→animate) with the same enter
 *   stagger — no scroll dependency (§9.5).
 * All surfaces are matte pastel tokens (§2); no FrostedGlassBox, no blur.
 */

/* ------------------------------------------------------------------ */
/* Motion orchestration (local; leaves reuse the shared `enter`)       */
/* ------------------------------------------------------------------ */

// A Scene's inner column: no visual of its own, it just staggers the blocks
// once the scene scrolls into view (contract §9.2).
const sceneStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

// StaticComposition's mount stagger — the §9.1 60ms rhythm, no scroll (§9.5).
const staticStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

// The timeline is both a revealing block AND a stagger parent for its rows;
// same spring as `enter` (stiffness 220 / damping 24).
const timelineContainer: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 220,
      damping: 24,
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const timelineRow: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 220, damping: 24 },
  },
};

// Scene accent rule — violet emphasis / mint secondary from the fixed
// allowlist (contract §2.2, §9.4); never a free-form hue.
const accentBar: Record<"violet" | "mint", string> = {
  violet: "bg-[#5646a8] dark:bg-[#9d8ff2]",
  mint: "bg-[#5646a8] dark:bg-[#7fe0bd]",
};

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

/**
 * A full-height chapter. The outer <section> is the viewport trigger; the
 * inner column carries the stagger variant so its blocks cascade in (§9.2).
 */
function Scene({
  props,
  children,
}: BaseComponentProps<{
  id?: string | null;
  align?: "center" | "start" | null;
  accent?: "violet" | "mint" | null;
}>) {
  const centered = (props.align ?? "center") === "center";
  return (
    <motion.section
      id={props.id ?? undefined}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      className={cn(
        "relative flex min-h-screen flex-col justify-center px-6 text-[#37304a] md:px-10 dark:text-[#eae6f2]",
        centered ? "items-center text-center" : "items-start text-left",
      )}
    >
      <motion.div
        variants={sceneStagger}
        className={cn(
          "flex w-full max-w-3xl flex-col gap-6",
          centered ? "items-center" : "items-start",
        )}
      >
        {props.accent ? (
          <motion.div
            aria-hidden
            variants={enter}
            className={cn("h-1 w-16 rounded-full", accentBar[props.accent])}
          />
        ) : null}
        {children}
      </motion.div>
    </motion.section>
  );
}

/** Serif display chapter heading + optional mono kicker (§6.1, §6.3). */
function ChapterHeading({
  props,
}: BaseComponentProps<{ text: string; kicker?: string | null }>) {
  return (
    <motion.div variants={enter} className="flex flex-col gap-2">
      {props.kicker ? (
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#6f6885] dark:text-[#a9a2bd]">
          {props.kicker}
        </span>
      ) : null}
      <h2 className="font-serif text-4xl tracking-tight text-[#37304a] md:text-6xl dark:text-[#eae6f2]">
        {props.text}
      </h2>
    </motion.div>
  );
}

/** One concise prose paragraph beat in a max-w-2xl reading measure (§6.3). */
function NarrativeBeat({ props }: BaseComponentProps<{ text: string }>) {
  return (
    <motion.p
      variants={enter}
      className="max-w-2xl text-lg leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]"
    >
      {props.text}
    </motion.p>
  );
}

/**
 * A big metric that counts up from 0 → `value` the first time it scrolls into
 * view. The count-up is gated on its own `useInView` (tighter amount 0.6, §9.2)
 * so the number never animates while barely visible, independent of the scene
 * stagger that reveals the block itself.
 */
function StatReveal({
  props,
}: BaseComponentProps<{
  value: number;
  suffix?: string | null;
  caption: string;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) =>
    Math.round(latest).toLocaleString(),
  );

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, props.value, {
      duration: 1.2,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [inView, props.value, count]);

  return (
    <motion.div ref={ref} variants={enter} className="flex flex-col gap-1">
      <span className="font-serif text-5xl tracking-tight text-[#37304a] md:text-6xl dark:text-[#eae6f2]">
        <motion.span>{rounded}</motion.span>
        {props.suffix ?? ""}
      </span>
      <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#6f6885] dark:text-[#a9a2bd]">
        {props.caption}
      </span>
    </motion.div>
  );
}

/**
 * A vertical timeline whose rows reveal sequentially via nested
 * staggerChildren (§9.2). Inherits its show/hidden label from whatever
 * container drives it, then cascades to its own rows.
 */
function SequencedTimeline({
  props,
}: BaseComponentProps<{
  rows: { period: string; role: string; company: string }[];
}>) {
  return (
    <motion.ul
      variants={timelineContainer}
      className="relative flex flex-col gap-6 border-l border-[#37304a]/10 pl-6 text-left dark:border-white/10"
    >
      {props.rows.map((row, i) => (
        <motion.li key={i} variants={timelineRow} className="relative">
          <span
            aria-hidden
            className="absolute -left-[1.9rem] top-1.5 size-3 rounded-full border-2 border-[#fffdf8] bg-[#7a5fa0] dark:border-[#2b2830] dark:bg-[#c9b3ec]"
          />
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#6f6885] dark:text-[#a9a2bd]">
            {row.period}
          </div>
          <div className="text-lg font-semibold tracking-tight text-[#37304a] dark:text-[#eae6f2]">
            {row.role}
          </div>
          <div className="text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
            {row.company}
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}

/**
 * Short-answer fallback (§8.4, §9.5): no scenes, no scroll dependency. Renders
 * its child blocks in a centered max-w-3xl reading column with a plain mount
 * stagger driven by the shared `enter` variant.
 */
function StaticComposition({
  children,
}: BaseComponentProps<Record<string, never>>) {
  return (
    <motion.div
      variants={staticStagger}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-16 text-center text-[#37304a] dark:text-[#eae6f2]"
    >
      {children}
    </motion.div>
  );
}

export const storyComponents = {
  Scene,
  ChapterHeading,
  NarrativeBeat,
  StatReveal,
  SequencedTimeline,
  StaticComposition,
};

"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
} from "framer-motion";
import clsx from "clsx";
import { enter } from "@/lib/jsonui/motion";

/**
 * Scene-prototype playground for wayfinder ticket #37.
 *
 * A THROWAWAY sandbox proving the mechanics of a scroll-driven "story"
 * renderer for the ask-me portfolio:
 *
 *   Story  = a generated answer presented as narrative.
 *   Scene  = one full-height chapter with scroll-triggered motion.
 *   Block  = one animated primitive inside a scene (heading, beat, stat...).
 *
 * The load-bearing idea being tested: a Story is authored as a plain,
 * serializable spec object (see `workStory` below) and rendered by a small
 * block-type switch (`renderBlock`) — NOT hand-written JSX per scene. That is
 * the exact shape an LLM would emit at answer-generation time.
 *
 * Two trigger models are demonstrated side by side:
 *   - Scenes are VIEWPORT-TRIGGERED (whileInView, once) — a one-shot reveal.
 *   - SceneProgress is SCROLL-SCRUBBED (useScroll) — bound to scroll position.
 * See SceneProgress for the tradeoff notes.
 */

/* ------------------------------------------------------------------ */
/* Motion variants (local to the prototype; the shared `enter` from    */
/* motion.ts is reused only for the static fallback path).             */
/* ------------------------------------------------------------------ */

// A scene's inner column: no visual change of its own, it just orchestrates
// an in-scene stagger so children reveal one after another once the scene
// scrolls into view.
const sceneVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

// A single block reveal. Same spring as the shared `enter` (stiffness 220,
// damping 24) but with a larger travel that reads better at full-height scale.
const blockVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 220, damping: 24 },
  },
};

// The timeline is both a revealing block AND a stagger parent for its rows.
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

/* ------------------------------------------------------------------ */
/* Prototype primitives                                                */
/* ------------------------------------------------------------------ */

export type SceneProps = {
  id?: string;
  /** Vertical/horizontal anchoring of the scene column. */
  align?: "center" | "start";
  /** Optional tint hint (any CSS color) used for a per-scene accent rule. */
  accent?: string;
  children: React.ReactNode;
};

/**
 * A full-height chapter. The outer <section> is the viewport trigger; the
 * inner column carries the stagger variant so its blocks cascade in.
 */
export function Scene({ id, align = "center", accent, children }: SceneProps) {
  return (
    <motion.section
      id={id}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      className={clsx(
        "flex min-h-screen flex-col justify-center",
        align === "center" ? "items-center text-center" : "items-start text-left",
      )}
    >
      <motion.div
        variants={sceneVariants}
        className="container mx-auto flex flex-col gap-6 px-4"
      >
        {accent ? (
          <motion.div
            variants={blockVariants}
            className={clsx(
              "h-1 w-16 rounded-full",
              align === "center" && "mx-auto",
            )}
            style={{ backgroundColor: accent }}
          />
        ) : null}
        {children}
      </motion.div>
    </motion.section>
  );
}

export type ChapterHeadingProps = {
  kicker?: string;
  heading: string;
  /** When false the block is inert and an outer wrapper animates it. */
  reveal?: boolean;
};

export function ChapterHeading({ kicker, heading, reveal = true }: ChapterHeadingProps) {
  const v = reveal ? { variants: blockVariants } : {};
  return (
    <motion.div {...v} className="flex flex-col gap-2">
      {kicker ? (
        <span className="text-sm font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {kicker}
        </span>
      ) : null}
      <h2 className="text-4xl font-bold text-gray-900 md:text-6xl dark:text-gray-50">
        {heading}
      </h2>
    </motion.div>
  );
}

export type NarrativeBeatProps = {
  text: string;
  reveal?: boolean;
};

export function NarrativeBeat({ text, reveal = true }: NarrativeBeatProps) {
  const v = reveal ? { variants: blockVariants } : {};
  return (
    <motion.p {...v} className="max-w-2xl text-lg text-gray-700 dark:text-gray-300">
      {text}
    </motion.p>
  );
}

export type StatRevealProps = {
  /** Numeric target the value counts up to when it enters view. */
  value: number;
  /** Rendered immediately after the number, e.g. "+", "yrs". */
  suffix?: string;
  caption: string;
  reveal?: boolean;
};

/**
 * A big metric that counts up from 0 → `value` the first time it scrolls into
 * view. The count-up is gated on its own `useInView` (independent of the
 * scene stagger) so the number never animates while off-screen.
 */
export function StatReveal({ value, suffix = "", caption, reveal = true }: StatRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, value, { duration: 1.2, ease: "easeOut" });
    return () => controls.stop();
  }, [inView, value, count]);

  const v = reveal ? { variants: blockVariants } : {};
  return (
    <motion.div {...v} ref={ref} className="flex flex-col gap-1">
      <span className="text-5xl font-bold text-gray-900 dark:text-gray-50">
        <motion.span>{rounded}</motion.span>
        {suffix}
      </span>
      <span className="text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {caption}
      </span>
    </motion.div>
  );
}

export type TimelineRow = { period: string; role: string; company: string };
export type SequencedTimelineProps = { rows: TimelineRow[] };

/**
 * A vertical timeline whose rows reveal sequentially via nested
 * staggerChildren. Inherits its show/hidden label from whatever parent drives
 * it (a Scene, or the static-fallback wrapper), then cascades to its own rows.
 */
export function SequencedTimeline({ rows }: SequencedTimelineProps) {
  return (
    <motion.ul
      variants={timelineContainer}
      className="relative flex flex-col gap-6 border-l border-gray-300 pl-6 text-left dark:border-gray-700"
    >
      {rows.map((row, i) => (
        <motion.li key={i} variants={timelineRow} className="relative">
          <span className="absolute -left-[1.9rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-400 dark:border-gray-950 dark:bg-gray-500" />
          <div className="text-sm font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {row.period}
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {row.role}
          </div>
          <div className="text-gray-600 dark:text-gray-400">{row.company}</div>
        </motion.li>
      ))}
    </motion.ul>
  );
}

/**
 * A fixed scroll-progress rail on the right edge. This is the SCROLL-SCRUBBED
 * counterpart to the viewport-triggered scenes.
 *
 * Trigger vs. scrub:
 *   - TRIGGER (whileInView + viewport.amount): fires a one-shot animation the
 *     moment an element crosses a threshold into view, then plays on its own
 *     timeline. Best for discrete reveals — a chapter animating in once.
 *   - SCRUB (useScroll → scaleY): binds a value directly to scroll offset
 *     (0 → 1), updating every frame both forward and backward. Best for
 *     continuous indicators — a progress bar, parallax, pinned sequences.
 * Rule of thumb: reveals want triggers (cheaper, feel intentional); anything
 * that must track the finger/wheel position wants a scrub.
 */
export function SceneProgress() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  });
  return (
    <motion.div
      aria-hidden
      style={{ scaleY }}
      className="fixed right-2 top-0 bottom-0 z-50 w-1 origin-top rounded-full bg-gray-400/60 dark:bg-gray-500/60"
    />
  );
}

/* ------------------------------------------------------------------ */
/* JSON spec shape — the key deliverable                               */
/* ------------------------------------------------------------------ */

export type StoryBlock =
  | { type: "chapterHeading"; props: Omit<ChapterHeadingProps, "reveal"> }
  | { type: "narrativeBeat"; props: Omit<NarrativeBeatProps, "reveal"> }
  | { type: "statReveal"; props: Omit<StatRevealProps, "reveal"> }
  | { type: "timeline"; props: SequencedTimelineProps };

export type SceneSpec = {
  id: string;
  accent?: string;
  align?: "center" | "start";
  blocks: StoryBlock[];
};

export type StorySpec = {
  /** "scenes" → full-height scroll story; "static" → short-answer fallback. */
  mode: "scenes" | "static";
  scenes: SceneSpec[];
};

/**
 * The block-type switch. `reveal` is threaded to leaf blocks: in a Scene they
 * self-animate (reveal=true); in the static fallback an outer `enter` wrapper
 * animates them (reveal=false) so motion isn't doubled.
 */
function renderBlock(block: StoryBlock, key: React.Key, reveal: boolean) {
  switch (block.type) {
    case "chapterHeading":
      return <ChapterHeading key={key} {...block.props} reveal={reveal} />;
    case "narrativeBeat":
      return <NarrativeBeat key={key} {...block.props} reveal={reveal} />;
    case "statReveal":
      return <StatReveal key={key} {...block.props} reveal={reveal} />;
    case "timeline":
      // Self-driving stagger parent; inherits its label from the wrapper.
      return <SequencedTimeline key={key} {...block.props} />;
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

/**
 * Maps a StorySpec → a sequence of full-height Scenes. Array order IS scene
 * order — no separate ordering field.
 */
export function StoryRenderer({ spec }: { spec: StorySpec }) {
  return (
    <>
      {spec.scenes.map((scene) => (
        <Scene key={scene.id} id={scene.id} accent={scene.accent} align={scene.align}>
          {scene.blocks.map((block, j) => renderBlock(block, `${scene.id}-${j}`, true))}
        </Scene>
      ))}
    </>
  );
}

/**
 * Short-answer fallback: no scenes, no scroll dependency. All blocks flatten
 * into one centered column that reveals with a plain mount stagger driven by
 * the shared `enter` variant (custom index → cascading delay).
 */
export function StaticComposition({ spec }: { spec: StorySpec }) {
  const blocks = spec.scenes.flatMap((scene) => scene.blocks);
  return (
    <motion.div
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center"
    >
      {blocks.map((block, i) => (
        <motion.div key={i} variants={enter} custom={i} className="flex w-full flex-col items-center">
          {renderBlock(block, i, false)}
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Benchmark story — "What does Noah do for work?" (from content/about-me) */
/* Pure serializable data; no JSX. This is what an LLM would emit.     */
/* ------------------------------------------------------------------ */

const workStory: StorySpec = {
  mode: "scenes",
  scenes: [
    {
      id: "intro",
      accent: "#6366f1",
      blocks: [
        {
          type: "chapterHeading",
          props: { kicker: "The question", heading: "What does Noah do for work?" },
        },
        {
          type: "narrativeBeat",
          props: {
            text: "Noah is a full-stack software engineer based in Kuala Lumpur, Malaysia, working across backend, infra, and frontend.",
          },
        },
      ],
    },
    {
      id: "day-job",
      accent: "#0ea5e9",
      blocks: [
        {
          type: "chapterHeading",
          props: { kicker: "Chapter 02", heading: "The day job" },
        },
        {
          type: "narrativeBeat",
          props: {
            text: "At Supa he's a Full-Stack Developer (2020 – Present), shipping product across the whole stack.",
          },
        },
        {
          type: "statReveal",
          props: { value: 6, suffix: "+", caption: "years shipping full-stack" },
        },
      ],
    },
    {
      id: "side-hustle",
      accent: "#f59e0b",
      blocks: [
        {
          type: "chapterHeading",
          props: { kicker: "Chapter 03", heading: "The side hustle" },
        },
        {
          type: "narrativeBeat",
          props: {
            text: "At Bowiq he's a CAD Designer & 3D Printing Engineer (2023 – Present) — designing for FDM printing in high-end materials.",
          },
        },
      ],
    },
    {
      id: "how-he-works",
      accent: "#10b981",
      align: "start",
      blocks: [
        {
          type: "chapterHeading",
          props: { kicker: "Chapter 04", heading: "How he works" },
        },
        {
          type: "timeline",
          props: {
            rows: [
              { period: "2020 – Present", role: "Full-Stack Developer", company: "Supa" },
              {
                period: "2023 – Present",
                role: "CAD Designer & 3D Printing Engineer",
                company: "Bowiq",
              },
            ],
          },
        },
        {
          type: "narrativeBeat",
          props: {
            text: "He leans toward self-hosting — Proxmox + Unraid, Docker — and pragmatic, scalable systems.",
          },
        },
      ],
    },
  ],
};

// Trimmed short-answer variant: same data model, single scene, static mode.
const shortStory: StorySpec = {
  mode: "static",
  scenes: [
    {
      id: "short",
      blocks: [
        {
          type: "chapterHeading",
          props: { kicker: "Short answer", heading: "What does Noah do for work?" },
        },
        {
          type: "narrativeBeat",
          props: {
            text: "Full-stack software engineer in Kuala Lumpur — Full-Stack Developer at Supa by day, CAD Designer & 3D Printing Engineer at Bowiq on the side.",
          },
        },
        {
          type: "statReveal",
          props: { value: 6, suffix: "+", caption: "years shipping full-stack" },
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Playground page                                                     */
/* ------------------------------------------------------------------ */

function DemoDivider({ label }: { label: string }) {
  return (
    <div className="border-y border-gray-200 py-8 text-center text-sm font-medium uppercase tracking-widest text-gray-500 dark:border-gray-800 dark:text-gray-400">
      {label}
    </div>
  );
}

export function ScenePrototype() {
  return (
    <main className="relative bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <SceneProgress />
      <DemoDivider label="Demo A: scroll-driven scenes" />
      <StoryRenderer spec={workStory} />
      <DemoDivider label="Demo B: rich static fallback" />
      <StaticComposition spec={shortStory} />
    </main>
  );
}

export default ScenePrototype;

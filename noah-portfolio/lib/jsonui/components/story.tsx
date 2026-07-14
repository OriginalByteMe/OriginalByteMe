"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { useStateValue, type BaseComponentProps } from "@json-render/react";
import { cn, isSvgSrc } from "@/lib/utils";

/**
 * Story primitives — the shipping catalog versions of the scene-prototype
 * components proven under #37 (see docs/design-contract.md §9, §11.3).
 *
 * These json-render containers now serve the curated homeSpec only. Generated
 * answers use the versioned Scene Story renderer and never enter this registry.
 * Story blocks render visibly by default rather than inheriting a one-shot
 * animation state from their container.
 *
 * StatReveal retains its independently meaningful in-view count-up. All
 * surfaces are matte pastel tokens (§2); no FrostedGlassBox, no blur.
 */

// Scene accent rule — violet emphasis / mint secondary from the fixed
// allowlist (contract §2.2, §9.4); never a free-form hue.
const accentBar: Record<"violet" | "mint", string> = {
  violet: "bg-[#7a5fa0] dark:bg-[#c9b3ec]",
  mint: "bg-[#5646a8] dark:bg-[#7fe0bd]",
};

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

/** A full-height curated home chapter (§9.2). */
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
    <section
      id={props.id ?? undefined}
      className={cn(
        "relative flex min-h-screen supports-[height:100svh]:min-h-[100svh] flex-col px-6 text-[#37304a] md:px-10 dark:text-[#eae6f2]",
        centered
          ? "items-center justify-center py-24 text-center md:py-28"
          : "items-start justify-center py-24 text-left md:py-32",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-4xl flex-col gap-6 md:gap-7",
          centered ? "items-center" : "items-start",
        )}
      >
        {props.accent ? (
          <div
            aria-hidden
            className={cn("h-1 w-16 rounded-full", accentBar[props.accent])}
          />
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** Serif display chapter heading + optional mono kicker (§6.1, §6.3). */
function ChapterHeading({
  props,
}: BaseComponentProps<{ text: string; kicker?: string | null }>) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {props.kicker ? (
        <span className="font-mono text-xs uppercase tracking-[0.32em] text-[#6f6885] dark:text-[#a9a2bd]">
          {props.kicker}
        </span>
      ) : null}
      <h2 className="text-balance font-serif text-4xl leading-[0.95] tracking-tight text-[#37304a] md:text-6xl dark:text-[#eae6f2]">
        {props.text}
      </h2>
    </div>
  );
}

/** One concise prose paragraph beat in a max-w-2xl reading measure (§6.3). */
function NarrativeBeat({ props }: BaseComponentProps<{ text: string }>) {
  return (
    <p
      className="max-w-2xl text-pretty text-lg leading-8 text-[#5d5673] md:text-xl dark:text-[#bdb6d0]"
    >
      {props.text}
    </p>
  );
}

/**
 * A big metric that counts up from 0 → `value` the first time it scrolls into
 * view. The count-up is gated on its own `useInView` (tighter amount 0.6,
 * §9.2), so the number never animates while barely visible.
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
    <div
      ref={ref}
      className="relative flex max-w-md flex-col overflow-hidden rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] px-7 py-6 shadow-[0_18px_46px_-24px_rgba(58,51,69,0.42)] dark:border-white/10 dark:bg-[#2b2830]"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7a5fa0]/40 to-transparent dark:via-[#c9b3ec]/40"
      />
      <span className="block font-serif text-5xl leading-none tracking-tight text-[#37304a] md:text-6xl dark:text-[#eae6f2]">
        <motion.span>{rounded}</motion.span>
        {props.suffix ?? ""}
      </span>
      <span className="mt-2 block font-mono text-xs uppercase tracking-[0.3em] text-[#6f6885] dark:text-[#a9a2bd]">
        {props.caption}
      </span>
    </div>
  );
}

/**
 * A vertical timeline of curated career rows. Rows are visible immediately
 * so home content does not depend on an ancestor animation label.
 */
type TimelineRow = {
  period: string;
  role: string;
  company: string;
  /** Optional company mark and official site (corpus careerTimeline rows carry both). */
  logo?: string;
  url?: string;
};

function StateBoundTimeline({ statePath }: { statePath: string }) {
  const rows = useStateValue<TimelineRow[]>(statePath);
  return <TimelineRows rows={rows ?? []} />;
}

function SequencedTimeline({
  props,
}: BaseComponentProps<{
  rows?: TimelineRow[];
  statePath?: string | null;
}>) {
  return props.statePath ? (
    <StateBoundTimeline statePath={props.statePath} />
  ) : (
    <TimelineRows rows={props.rows ?? []} />
  );
}

function TimelineRows({ rows }: { rows: TimelineRow[] }) {
  return (
    <ul
      className="grid w-full max-w-3xl gap-4 rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] p-5 text-left shadow-[0_18px_46px_-24px_rgba(58,51,69,0.42)] md:p-6 dark:border-white/10 dark:bg-[#2b2830]"
    >
      {rows.map((row, i) => (
        <li
          key={i}
          className="relative overflow-hidden rounded-2xl border border-[#37304a]/10 bg-[#f4ecdf] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:border-white/10 dark:bg-[#26232c]"
        >
          <span
            aria-hidden
            className="absolute left-5 top-5 size-2.5 rounded-full bg-[#7a5fa0] dark:bg-[#c9b3ec]"
          />
          <div className="ml-6 flex flex-wrap items-center gap-2">
            {row.logo ? (
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#37304a]/10 bg-[#fffdf8] dark:border-white/10 dark:bg-[#2b2830]">
                <Image
                  src={row.logo}
                  alt={`${row.company} logo`}
                  width={32}
                  height={32}
                  className="size-7 object-contain"
                  unoptimized={isSvgSrc(row.logo)}
                />
              </span>
            ) : null}
            <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#6f6885] dark:text-[#a9a2bd]">
              {row.period}
            </span>
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Visit ${row.company} website`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#37304a]/10 bg-[#fffdf8] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#5646a8] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fa0]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4ecdf] dark:border-white/10 dark:bg-[#2b2830] dark:text-[#9d8ff2] dark:focus-visible:ring-offset-[#26232c]"
              >
                {row.company}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                  strokeWidth={1.5}
                />
              </a>
            ) : (
              <span className="rounded-full border border-[#37304a]/10 bg-[#fffdf8] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6f6885] dark:border-white/10 dark:bg-[#2b2830] dark:text-[#a9a2bd]">
                {row.company}
              </span>
            )}
          </div>
          <div className="ml-6 mt-3 text-lg font-semibold tracking-tight text-[#37304a] dark:text-[#eae6f2]">
            {row.role}
          </div>
        </li>
      ))}
    </ul>
  );
}


export const storyComponents = {
  Scene,
  ChapterHeading,
  NarrativeBeat,
  StatReveal,
  SequencedTimeline,
};

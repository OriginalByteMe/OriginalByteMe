"use client";

import type { BaseComponentProps } from "@json-render/react";
import { useStateValue } from "@json-render/react";
import { cn } from "@/lib/utils";


// Matte Callout left-rule accents use only the fixed violet/mint allowlist
// (contract §2.2/§3.1); mint collapses to violet emphasis in light mode.
const toneClasses: Record<"info" | "success" | "warn", string> = {
  info: "border-l-[#7a5fa0] dark:border-l-[#c9b3ec]",
  success: "border-l-[#5646a8] dark:border-l-[#7fe0bd]",
  warn: "border-l-[#5646a8] dark:border-l-[#9d8ff2]",
};

// Tailwind only generates classes it can see as literal strings in source, so
// responsive column counts map through these tables instead of template
// strings like `md:grid-cols-${count}` (design contract §2.4).
const columnsClasses: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

const gridClasses: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

const titleMbClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "mb-4",
  md: "mb-8",
  lg: "mb-12",
};

function ProseParagraph({ text }: { text: string }) {
  return (
    <p className="mb-6 max-w-2xl text-pretty text-lg leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
      {text}
    </p>
  );
}

/**
 * Prose bound to a corpus state path. Split from the static branch so
 * `useStateValue` (which requires a StateProvider) is only mounted when a
 * statePath is actually given — static Prose keeps working in tests and the
 * /design-contract storyboard without a provider.
 */
function BoundProse({ path, fallback }: { path: string; fallback: string }) {
  const value = useStateValue<string>(path);
  return <ProseParagraph text={typeof value === "string" && value ? value : fallback} />;
}

export const primitiveComponents = {
  Section: ({
    props,
    children,
  }: BaseComponentProps<{
    title?: string | null;
    height?: "auto" | "screen" | null;
    centered?: boolean | null;
    titleMb?: "sm" | "md" | "lg" | null;
  }>) => (
    <section
      className={cn(
        "relative scroll-mt-24 text-[#37304a] dark:text-[#eae6f2]",
        props.height === "screen"
          ? "min-h-screen supports-[height:100svh]:min-h-[100svh] py-16 md:py-24"
          : "py-20 md:py-24",
        props.centered ? "flex flex-col items-center justify-center text-center" : null,
      )}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        {props.title ? (
          <h2
            className={cn(
              "font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]",
              titleMbClasses[props.titleMb ?? "md"],
            )}
          >
            {props.title}
          </h2>
        ) : null}
        {children}
      </div>
    </section>
  ),
  Stack: ({ props, children }: BaseComponentProps<{ gap?: "sm" | "md" | "lg" | null }>) => (
    <div className={{ sm: "space-y-4", md: "space-y-6", lg: "space-y-12" }[props.gap ?? "md"]}>
      {children}
    </div>
  ),
  Columns: ({ props, children }: BaseComponentProps<{ count: number }>) => (
    <div className={cn("grid gap-4 md:gap-5", columnsClasses[Math.min(3, Math.max(1, Math.round(props.count)))])}>
      {children}
    </div>
  ),
  Grid: ({ props, children }: BaseComponentProps<{ cols: number }>) => (
    <div className={cn("grid grid-cols-1 gap-4 md:gap-5", gridClasses[Math.min(4, Math.max(1, Math.round(props.cols)))])}>
      {children}
    </div>
  ),
  Prose: ({ props }: BaseComponentProps<{ text: string; statePath?: string | null }>) =>
    props.statePath ? (
      <BoundProse path={props.statePath} fallback={props.text} />
    ) : (
      <ProseParagraph text={props.text} />
    ),
  Heading: ({ props }: BaseComponentProps<{ text: string; level: number }>) => {
    const Tag = `h${Math.min(4, Math.max(1, props.level))}` as "h1";
    return <Tag className="mb-4 font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">{props.text}</Tag>;
  },
  Callout: ({ props }: BaseComponentProps<{ text: string; tone?: "info" | "success" | "warn" | null }>) => (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-l-4 border-[#37304a]/10 bg-[#fffdf8] p-8 text-sm leading-relaxed text-[#5d5673] shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#2b2830] dark:text-[#bdb6d0]",
        toneClasses[props.tone ?? "info"],
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7a5fa0]/40 to-transparent dark:via-[#c9b3ec]/40"
      />
      {props.text}
    </div>
  ),
  Quote: ({ props }: BaseComponentProps<{ text: string; cite?: string | null }>) => (
    <blockquote className="border-l-2 border-[#7a5fa0] pl-4 italic text-[#5d5673] dark:border-[#c9b3ec] dark:text-[#bdb6d0]">
      {props.text}
      {props.cite ? (
        <footer className="mt-3 text-sm text-[#6f6885] dark:text-[#a9a2bd]">— {props.cite}</footer>
      ) : null}
    </blockquote>
  ),
};

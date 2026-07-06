"use client";

import { motion } from "framer-motion";
import type { BaseComponentProps } from "@json-render/react";
import { useStateValue } from "@json-render/react";
import { cn } from "@/lib/utils";
import { enter } from "../motion";

const toneClasses: Record<"info" | "success" | "warn", string> = {
  info: "border-blue-500 bg-blue-500/10",
  success: "border-green-500 bg-green-500/10",
  warn: "border-amber-500 bg-amber-500/10",
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
    <motion.p
      variants={enter}
      initial="hidden"
      animate="show"
      className="text-gray-700 dark:text-gray-300 mb-6 max-w-2xl"
    >
      {text}
    </motion.p>
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
    <motion.section
      variants={enter}
      initial="hidden"
      animate="show"
      className={cn(
        "relative",
        props.height === "screen" ? "min-h-screen" : "py-20",
        props.centered ? "flex flex-col items-center justify-center" : null,
      )}
    >
      <div className="container mx-auto px-4">
        {props.title ? (
          <h2 className={cn("text-3xl font-bold", titleMbClasses[props.titleMb ?? "md"])}>
            {props.title}
          </h2>
        ) : null}
        {children}
      </div>
    </motion.section>
  ),
  Stack: ({ props, children }: BaseComponentProps<{ gap?: "sm" | "md" | "lg" | null }>) => (
    <motion.div
      variants={enter}
      initial="hidden"
      animate="show"
      className={{ sm: "space-y-3", md: "space-y-6", lg: "space-y-12" }[props.gap ?? "md"]}
    >
      {children}
    </motion.div>
  ),
  Columns: ({ props, children }: BaseComponentProps<{ count: number }>) => (
    <div className={cn("grid gap-12", columnsClasses[Math.min(3, Math.max(1, Math.round(props.count)))])}>{children}</div>
  ),
  Grid: ({ props, children }: BaseComponentProps<{ cols: number }>) => (
    <div className={cn("grid gap-6 grid-cols-1", gridClasses[Math.min(4, Math.max(1, Math.round(props.cols)))])}>
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
    return <Tag className="text-2xl font-semibold mb-4">{props.text}</Tag>;
  },
  Callout: ({ props }: BaseComponentProps<{ text: string; tone?: "info" | "success" | "warn" | null }>) => (
    <motion.div
      variants={enter}
      initial="hidden"
      animate="show"
      className={`rounded-xl border-l-4 p-4 ${toneClasses[props.tone ?? "info"]}`}
    >
      {props.text}
    </motion.div>
  ),
  Quote: ({ props }: BaseComponentProps<{ text: string; cite?: string | null }>) => (
    <blockquote className="border-l-2 border-gray-300 dark:border-gray-700 pl-4 italic">
      {props.text}
      {props.cite ? <footer className="text-sm text-gray-500">— {props.cite}</footer> : null}
    </blockquote>
  ),
};

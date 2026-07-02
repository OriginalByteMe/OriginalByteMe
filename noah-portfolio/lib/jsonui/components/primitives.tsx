"use client";

import { motion } from "framer-motion";
import type { BaseComponentProps } from "@json-render/react";
import { enter } from "../motion";

const toneClasses: Record<"info" | "success" | "warn", string> = {
  info: "border-blue-500 bg-blue-500/10",
  success: "border-green-500 bg-green-500/10",
  warn: "border-amber-500 bg-amber-500/10",
};

export const primitiveComponents = {
  Section: ({ props, children }: BaseComponentProps<{ title?: string | null }>) => (
    <motion.section variants={enter} initial="hidden" animate="show" className="relative py-20">
      <div className="container mx-auto px-4">
        {props.title ? <h2 className="text-3xl font-bold mb-8">{props.title}</h2> : null}
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
    <div className={`grid gap-12 md:grid-cols-${Math.min(3, props.count)}`}>{children}</div>
  ),
  Grid: ({ props, children }: BaseComponentProps<{ cols: number }>) => (
    <div className={`grid gap-6 grid-cols-1 md:grid-cols-${Math.min(4, props.cols)}`}>{children}</div>
  ),
  Prose: ({ props }: BaseComponentProps<{ text: string }>) => (
    <motion.p
      variants={enter}
      initial="hidden"
      animate="show"
      className="text-gray-700 dark:text-gray-300 mb-6 max-w-2xl"
    >
      {props.text}
    </motion.p>
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

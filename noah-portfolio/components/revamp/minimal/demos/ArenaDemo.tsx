"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/**
 * Interactive demo for the LLM Comparison Arena: two models type out
 * answers to a prompt side by side, then a verdict lands. Auto-runs when
 * scrolled into view; the rerun button cycles through rounds.
 */

const ROUNDS = [
  {
    prompt: "explain my homelab to my landlord",
    a: "It is a small collection of quiet, energy-efficient computers used for learning purposes.",
    b: "Sir, the server rack is load-bearing now. Removing it would void the apartment.",
    winner: "B" as const,
    scoreA: 62,
    scoreB: 91,
  },
  {
    prompt: "name this deployment strategy",
    a: "Blue-green deployment with progressive canary rollout and automated rollback.",
    b: "Push to main on Friday and turn off notifications.",
    winner: "A" as const,
    scoreA: 88,
    scoreB: 34,
  },
  {
    prompt: "write a haiku about agents",
    a: "Plans within plans loop / tools call tools call tools call tools / context window full",
    b: "I have completed the haiku by deploying 14 subagents. Total cost: $47.",
    winner: "A" as const,
    scoreA: 79,
    scoreB: 55,
  },
];

function useTyped(text: string, active: boolean, runId: number, speed = 18) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!active) return;
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, active, runId, speed]);
  return { typed: text.slice(0, count), done: count >= text.length };
}

function ModelPanel({
  label,
  text,
  active,
  runId,
  winner,
  showVerdict,
  score,
}: {
  label: string;
  text: string;
  active: boolean;
  runId: number;
  winner: boolean;
  showVerdict: boolean;
  score: number;
}) {
  const { typed, done } = useTyped(text, active, runId);
  return (
    <div className="flex flex-col border border-zinc-300 p-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">
          {label}
        </span>
        {showVerdict && winner && (
          <motion.span
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 16 }}
            className="bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            winner
          </motion.span>
        )}
      </div>
      <p className="min-h-[72px] flex-1 font-mono text-xs leading-5 text-zinc-700 dark:text-zinc-300">
        {typed}
        {!done && active && <span className="terminal-cursor" />}
      </p>
      <div className="mt-3 h-px w-full bg-zinc-200 dark:bg-zinc-800">
        <motion.div
          className="h-px bg-zinc-900 dark:bg-zinc-100"
          initial={{ width: 0 }}
          animate={{ width: showVerdict ? `${score}%` : 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
        {showVerdict ? `score ${score}/100` : " "}
      </p>
    </div>
  );
}

export default function ArenaDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-100px", once: false });
  const [round, setRound] = useState(0);
  const [runId, setRunId] = useState(0);
  const [verdict, setVerdict] = useState(false);

  const data = ROUNDS[round];

  // Verdict appears once the longer answer has finished typing.
  useEffect(() => {
    setVerdict(false);
    if (!inView) return;
    const longest = Math.max(data.a.length, data.b.length);
    const id = setTimeout(() => setVerdict(true), longest * 18 + 600);
    return () => clearTimeout(id);
  }, [inView, runId, data]);

  const rerun = () => {
    setRound((r) => (r + 1) % ROUNDS.length);
    setRunId((n) => n + 1);
  };

  return (
    <div ref={ref}>
      <div className="rounded-sm border border-zinc-300 p-4 dark:border-zinc-800">
        <p className="mb-3 font-mono text-xs text-zinc-500">
          <span className="text-zinc-400 dark:text-zinc-600">prompt:</span>{" "}
          {data.prompt}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ModelPanel
            label="atlas-70b"
            text={data.a}
            active={inView}
            runId={runId + round * 100}
            winner={data.winner === "A"}
            showVerdict={verdict}
            score={data.scoreA}
          />
          <ModelPanel
            label="nimbus-8b"
            text={data.b}
            active={inView}
            runId={runId + round * 100}
            winner={data.winner === "B"}
            showVerdict={verdict}
            score={data.scoreB}
          />
        </div>
      </div>
      <button
        onClick={rerun}
        className="mt-3 font-mono text-xs text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-600 dark:hover:text-zinc-100"
      >
        ↻ rerun with next prompt
      </button>
    </div>
  );
}

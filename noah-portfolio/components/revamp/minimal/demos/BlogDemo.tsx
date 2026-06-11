"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

/**
 * Interactive demo for the blog: a tiny feed that types out post titles on
 * loop. Hovering pauses the feed (so it's readable), leaving resumes it.
 */

const POSTS = [
  "why my homelab has more uptime than my sleep schedule",
  "evals are unit tests for vibes",
  "self-hosting an LLM on a 3D-printed shelf",
  "docker compose is my love language",
  "the agent rewrote my agent",
];

export default function BlogDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-100px" });
  const [lineIndex, setLineIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!inView || paused) return;
    const current = POSTS[lineIndex];
    const id = setInterval(() => {
      setCharCount((c) => {
        if (c < current.length) return c + 1;
        return c;
      });
    }, 28);
    return () => clearInterval(id);
  }, [inView, paused, lineIndex]);

  // Advance to the next post a beat after the current one finishes.
  useEffect(() => {
    if (!inView || paused) return;
    if (charCount < POSTS[lineIndex].length) return;
    const id = setTimeout(() => {
      setLineIndex((i) => (i + 1) % POSTS.length);
      setCharCount(0);
    }, 1600);
    return () => clearTimeout(id);
  }, [charCount, inView, paused, lineIndex]);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="rounded-sm border border-zinc-300 p-4 dark:border-zinc-800"
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-600">
        tail -f ~/blog/drafts.log {paused && "· paused"}
      </p>
      <div className="space-y-1.5 font-mono text-xs leading-6">
        {POSTS.slice(0, lineIndex).map((post) => (
          <p key={post} className="text-zinc-400 dark:text-zinc-600">
            › {post}
          </p>
        ))}
        <p className="text-zinc-800 dark:text-zinc-200">
          › {POSTS[lineIndex].slice(0, charCount)}
          <span className="terminal-cursor" />
        </p>
      </div>
      <p className="mt-4 font-mono text-xs text-zinc-500">
        full feed → blog.noahrijkaard.com
      </p>
    </div>
  );
}

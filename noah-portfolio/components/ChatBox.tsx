"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { useAskMe } from "./AskMeProvider";

const SUGGESTIONS = [
  "What does Noah do for a living?",
  "How does the AI cutout tool work?",
  "What is Noah good at?",
];

/**
 * Chat input that drives the whole page (hero panel + floating dock).
 * Submitting a question hands off to the shared canvas hook, which streams
 * the answer into <PortfolioCanvas/>. `onSubmitted` fires as soon as a
 * question is dispatched so hosts (the dock) can close their panel and let
 * the takeover streaming view shine.
 */
export default function ChatBox({
  autoFocus = false,
  onSubmitted,
}: {
  autoFocus?: boolean;
  onSubmitted?: () => void;
}) {
  const { ask, mode, goHome, question } = useAskMe();
  const [value, setValue] = useState("");
  const loading = mode === "streaming";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q || loading) return;
    setValue("");
    const pending = ask(q);
    onSubmitted?.();
    await pending;
  }

  return (
    <div className="mt-4 w-full min-w-0">
      <form onSubmit={onSubmit} className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={280}
          disabled={loading}
          placeholder="Ask me anything about Noah…"
          aria-label="Ask a question about Noah"
          autoFocus={autoFocus}
          className="min-h-14 w-full rounded-full border border-[#d8cfbf] bg-[#fffdf8] px-5 py-3 pr-14 text-[#37304a] shadow-[0_18px_45px_rgba(55,48,74,0.14)] outline-hidden transition placeholder:text-[#6f6885] focus:border-[#5646a8] focus:ring-2 focus:ring-[#c9b3ec]/60 disabled:opacity-60 dark:border-[#5b506d] dark:bg-[#241f32] dark:text-[#eae6f2] dark:placeholder:text-[#b8b0c7] dark:shadow-[0_18px_45px_rgba(0,0,0,0.35)] dark:focus:border-[#c9b3ec] dark:focus:ring-[#5646a8]/50"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          aria-label="Send question"
          className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#5646a8] text-white transition hover:bg-[#473795] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5646a8] disabled:opacity-50 dark:bg-[#9d8ff2] dark:text-[#241f32] dark:hover:bg-[#c9b3ec]"
        >
          {loading ? <Loader2 strokeWidth={1.5} className="size-5 animate-spin" /> : <Send strokeWidth={1.5} className="size-5" />}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {(mode === "answer" || question) && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={goHome}
            className="min-h-11 rounded-full border border-[#d8cfbf] bg-[#fffdf8] px-3 py-2 text-xs text-[#5646a8] transition hover:bg-[#f6f4f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5646a8] dark:border-[#5b506d] dark:bg-[#241f32] dark:text-[#c9b3ec] dark:hover:bg-[#302a42]"
          >
            ↺ Home
          </motion.button>
        )}
        {mode === "home" &&
          SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => {
                void ask(s);
                onSubmitted?.();
              }}
              className="min-h-11 rounded-full border border-[#d8cfbf] bg-[#fffdf8] px-3 py-2 text-xs text-[#6f6885] transition hover:bg-[#f6f4f9] hover:text-[#5646a8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5646a8] disabled:opacity-50 dark:border-[#5b506d] dark:bg-[#241f32] dark:text-[#b8b0c7] dark:hover:bg-[#302a42] dark:hover:text-[#c9b3ec]"
            >
              {s}
            </button>
          ))}
      </div>
    </div>
  );
}

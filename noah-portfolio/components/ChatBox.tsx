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
 * Hero chat input that drives the whole page. Submitting a question hands off
 * to the shared canvas hook, which streams the answer into <PortfolioCanvas/>.
 */
export default function ChatBox() {
  const { ask, mode, reset, question } = useAskMe();
  const [value, setValue] = useState("");
  const loading = mode === "loading";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q || loading) return;
    setValue("");
    await ask(q);
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-8">
      <form onSubmit={onSubmit} className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={280}
          disabled={loading}
          placeholder="Ask me anything about Noah…"
          aria-label="Ask a question about Noah"
          className="w-full rounded-full border border-white/30 bg-white/10 backdrop-blur px-6 py-4 pr-14 text-white placeholder:text-gray-300 outline-hidden focus:border-blue-400 focus:ring-2 focus:ring-blue-400/40 transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          aria-label="Send question"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {(mode === "answer" || question) && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={reset}
            className="text-xs px-3 py-1 rounded-full bg-white/10 text-gray-200 hover:bg-white/20 transition"
          >
            ↺ Home
          </motion.button>
        )}
        {mode !== "answer" &&
          SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => ask(s)}
              className="text-xs px-3 py-1 rounded-full bg-white/10 text-gray-300 hover:bg-white/20 transition disabled:opacity-50"
            >
              {s}
            </button>
          ))}
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { Renderer } from "@json-render/react";
import { registry } from "@/lib/jsonui/registry";
import { useAskMe } from "./AskMeProvider";

/**
 * The single json-render canvas below the hero. Renders either `homeSpec`
 * (default view) or a generated answer spec through one <Renderer/>, cross-
 * fading between them via AnimatePresence. In streaming mode the partial spec
 * is rendered as patches arrive so components self-assemble; on a failed
 * generation the hook falls back to homeSpec and sets `error`, so this never
 * shows a blank page (issue #19).
 */
export default function PortfolioCanvas() {
  const { spec, mode, question, error } = useAskMe();
  const isAnswer = mode === "answer" || mode === "streaming";
  // Key the animated wrapper on the current view so home <-> answer cross-
  // fades, but streaming and the final answer share the same key so the
  // progressive assembly isn't interrupted by an exit/enter animation.
  const viewKey = mode === "home" ? "home" : `q:${question}`;

  return (
    <div className="relative">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={viewKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          layout
          // Generated answers are prose-shaped (a paragraph + a block or two),
          // so give them a centered reading column. The home view keeps its
          // full-width design (its sections own their own grids/containers).
          className={isAnswer ? "mx-auto w-full max-w-3xl px-4 py-16" : undefined}
        >
          {mode === "streaming" && (
            <div className="flex items-center justify-center gap-2 py-8 text-[#6f6885] dark:text-[#b8b0c7]">
              <Loader2 className="h-5 w-5 animate-spin text-[#5646a8] dark:text-[#c9b3ec]" />
              <span className="text-sm">Composing an answer to &ldquo;{question}&rdquo;&hellip;</span>
            </div>
          )}
          <Renderer spec={spec} registry={registry} />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="alert"
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#f2b8b5] bg-[#fff4f2] px-4 py-3 text-sm text-[#8a2f2a] shadow-lg dark:border-[#9f5a54] dark:bg-[#392322] dark:text-[#ffd7d3]"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Couldn&apos;t generate that answer — showing the home view instead.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

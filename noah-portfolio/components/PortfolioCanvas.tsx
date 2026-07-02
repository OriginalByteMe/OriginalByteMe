"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { Renderer } from "@json-render/react";
import { registry } from "@/lib/jsonui/registry";
import { useAskMe } from "./AskMeProvider";

/**
 * The single json-render canvas below the hero. Renders either `homeSpec`
 * (default view) or a generated answer spec through one <Renderer/>, cross-
 * fading between them via AnimatePresence. On a failed generation the hook
 * falls back to homeSpec and sets `error`, so this never shows a blank page
 * (issue #19).
 */
export default function PortfolioCanvas() {
  const { spec, mode, question, error } = useAskMe();
  // Key the animated wrapper on the current view so home <-> answer cross-fades.
  const viewKey = mode === "answer" ? `answer:${question}` : "home";

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {mode === "loading" ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-32 text-gray-300"
          >
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-sm">Composing an answer to “{question}”…</p>
          </motion.div>
        ) : (
          <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
            layout
          >
            <Renderer spec={spec} registry={registry} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="alert"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-3 text-sm text-white shadow-lg backdrop-blur"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Couldn&apos;t generate that answer — showing the home view instead.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

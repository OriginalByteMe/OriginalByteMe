"use client";

import { motion } from "framer-motion";
import { DESIGN_VARIANTS, useDesign } from "@/lib/design-context";

export default function DesignSwitcher() {
  const { design, setDesign } = useDesign();

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6, ease: [0.21, 0.6, 0.35, 1] }}
        className="flex items-center gap-1 rounded-full border border-white/15 bg-black/60 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        {DESIGN_VARIANTS.map((variant) => {
          const active = design === variant.id;
          return (
            <button
              key={variant.id}
              onClick={() => setDesign(variant.id)}
              title={variant.hint}
              className={`relative rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-300 ${
                active ? "text-white" : "text-white/40 hover:text-white/75"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="design-switcher-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-full border border-white/25 bg-white/15"
                />
              )}
              <span className="relative">{variant.label}</span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}

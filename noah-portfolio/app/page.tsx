"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { DesignProvider, useDesign } from "@/lib/design-context";
import SmoothScroll from "@/components/revamp/SmoothScroll";
import DesignSwitcher from "@/components/revamp/DesignSwitcher";

const TerminalDesign = dynamic(
  () => import("@/components/revamp/terminal/TerminalDesign"),
  { ssr: false }
);
const NeuralDesign = dynamic(
  () => import("@/components/revamp/neural/NeuralDesign"),
  { ssr: false }
);
const MinimalDesign = dynamic(
  () => import("@/components/revamp/minimal/MinimalDesign"),
  { ssr: false }
);

function ActiveDesign() {
  const { design } = useDesign();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={design}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {design === "terminal" && <TerminalDesign />}
        {design === "neural" && <NeuralDesign />}
        {design === "minimal" && <MinimalDesign />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Home() {
  return (
    <DesignProvider>
      <SmoothScroll />
      <main className="relative">
        <ActiveDesign />
      </main>
      <DesignSwitcher />
    </DesignProvider>
  );
}

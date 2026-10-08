"use client";

import { createContext, useContext, useState } from "react";
import { usePortfolioCanvas, type PortfolioCanvas } from "@/lib/hooks/usePortfolioCanvas";
import type { PublicStory } from "@/lib/story/types";

export type AskMe = PortfolioCanvas & {
  /** While true an arrow points at the Ask bar (the character sets it when he points at the bar). */
  askPromoted: boolean;
  setAskPromoted: (active: boolean) => void;
};

const AskMeContext = createContext<AskMe | null>(null);

/** Shares one home/Story state machine between the Ask bar, the character and the canvas. */
export function AskMeProvider({
  children,
  initialStory,
}: {
  children: React.ReactNode;
  initialStory?: PublicStory;
}) {
  const canvas = usePortfolioCanvas(initialStory);
  const [askPromoted, setAskPromoted] = useState(false);
  return (
    <AskMeContext.Provider value={{ ...canvas, askPromoted, setAskPromoted }}>
      {children}
    </AskMeContext.Provider>
  );
}

export function useAskMe(): AskMe {
  const ctx = useContext(AskMeContext);
  if (!ctx) throw new Error("useAskMe must be used within <AskMeProvider>");
  return ctx;
}

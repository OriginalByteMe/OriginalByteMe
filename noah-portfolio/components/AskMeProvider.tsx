"use client";

import { createContext, useContext } from "react";
import { usePortfolioCanvas, type PortfolioCanvas } from "@/lib/hooks/usePortfolioCanvas";
import type { PublicStory } from "@/lib/story/types";

const AskMeContext = createContext<PortfolioCanvas | null>(null);

/** Shares one home/Story state machine between every Ask entry point and canvas. */
export function AskMeProvider({
  children,
  initialStory,
}: {
  children: React.ReactNode;
  initialStory?: PublicStory;
}) {
  const canvas = usePortfolioCanvas(initialStory);
  return <AskMeContext.Provider value={canvas}>{children}</AskMeContext.Provider>;
}

export function useAskMe(): PortfolioCanvas {
  const ctx = useContext(AskMeContext);
  if (!ctx) throw new Error("useAskMe must be used within <AskMeProvider>");
  return ctx;
}

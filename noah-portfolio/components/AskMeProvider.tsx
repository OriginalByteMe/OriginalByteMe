"use client";

import { createContext, useContext } from "react";
import { usePortfolioCanvas, type PortfolioCanvas } from "@/lib/hooks/usePortfolioCanvas";

const AskMeContext = createContext<PortfolioCanvas | null>(null);

/**
 * Provides a single `usePortfolioCanvas` instance to the whole page so the
 * hero `ChatBox` (which submits questions) and the body `PortfolioCanvas`
 * (which renders the resulting spec) share one canvas state.
 */
export function AskMeProvider({
  children,
  initialQuery = "",
}: {
  children: React.ReactNode;
  initialQuery?: string;
}) {
  const canvas = usePortfolioCanvas(initialQuery);
  return <AskMeContext.Provider value={canvas}>{children}</AskMeContext.Provider>;
}

export function useAskMe(): PortfolioCanvas {
  const ctx = useContext(AskMeContext);
  if (!ctx) throw new Error("useAskMe must be used within <AskMeProvider>");
  return ctx;
}

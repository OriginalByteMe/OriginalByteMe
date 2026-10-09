"use client";

import dynamic from "next/dynamic";

import SiteTakeover from "@/components/site/SiteTakeover";
import { useAskMe } from "./AskMeProvider";

const HomePortfolioCanvas = dynamic(() => import("./HomePortfolioCanvas"), {
  loading: () => (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-16 text-sm text-[var(--story-ink-muted)]"
      role="status"
    >
      Loading Noah&apos;s portfolio…
    </div>
  ),
});

/** Renders json-render only for home; every generated answer takes over the screen as a site. */
export default function PortfolioCanvas() {
  const { mode, spec, question, site, evidence, story, error, ask, goHome } = useAskMe();

  if (mode === "home") {
    return <HomePortfolioCanvas spec={spec} />;
  }

  return (
    <SiteTakeover
      mode={mode}
      question={question}
      site={site}
      evidence={evidence}
      story={story}
      error={error}
      onRetry={() => void ask(question)}
      onAsk={(relatedQuestion) => void ask(relatedQuestion, { history: "push" })}
      onBack={goHome}
    />
  );
}

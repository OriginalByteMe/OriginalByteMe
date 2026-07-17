"use client";

import dynamic from "next/dynamic";

import StoryExperience from "@/components/story/StoryExperience";
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

/** Renders json-render only for home; every generated answer is a typed Story. */
export default function PortfolioCanvas() {
  const {
    mode,
    spec,
    question,
    phase,
    plan,
    scenes,
    evidence,
    story,
    error,
    ask,
  } = useAskMe();

  if (mode === "home") {
    return <HomePortfolioCanvas spec={spec} />;
  }

  return (
    <StoryExperience
      question={question}
      phase={phase}
      plan={plan}
      scenes={scenes}
      evidence={evidence}
      story={story}
      error={error}
      onRetry={() => void ask(question)}
      onRelatedQuestion={(relatedQuestion) =>
        void ask(relatedQuestion, { history: "push" })
      }
    />
  );
}

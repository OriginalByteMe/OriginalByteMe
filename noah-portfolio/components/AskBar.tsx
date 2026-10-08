"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useAskMe } from "./AskMeProvider";

const SUGGESTIONS = [
  "What does Noah do for a living?",
  "How does the AI cutout tool work?",
  "What is Noah good at?",
];

/**
 * The one Ask entry point: an always-open question box pinned to the bottom of
 * the viewport in home and answer modes. Submitting hands the question to the
 * shared canvas hook, which streams the answer into the Story takeover; a newer
 * question may replace one that is still streaming. While the character
 * promotes the bar, an arrow points at it.
 */
export default function AskBar() {
  const { ask, mode, goHome, question, askPromoted } = useAskMe();
  const [value, setValue] = useState("");
  const loading = mode === "streaming";

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue("");
    void ask(trimmed);
  }

  return (
    <section id="ask-me" aria-label="Ask-Me" className="ask-bar">
      {askPromoted && (
        <div className="ask-bar__arrow" data-testid="ask-bar-arrow" aria-hidden="true">
          <span>Ask me anything!</span>
          <svg viewBox="0 0 48 56" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4c18 4 28 18 22 44" />
            <path d="M22 40l10 10 9-12" />
          </svg>
        </div>
      )}
      <form onSubmit={onSubmit} className="ask-bar__form" aria-busy={loading}>
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={280}
          placeholder="Ask me anything about Noah…"
          aria-label="Ask a question about Noah"
          enterKeyHint="send"
          className="ask-bar__input"
        />
        <button type="submit" disabled={!value.trim()} aria-label="Send question" className="ask-bar__submit">
          {loading ? (
            <Loader2 strokeWidth={1.5} className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send strokeWidth={1.5} className="size-5" aria-hidden="true" />
          )}
        </button>
      </form>
      <div className="ask-bar__routes">
        {(mode === "answer" || question) && (
          <button type="button" onClick={goHome} className="ask-bar__route ask-bar__route--home">
            ↺ Home
          </button>
        )}
        {mode === "home" &&
          SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="ask-bar__route">
              {suggestion}
            </button>
          ))}
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { autoFixSpec } from "@json-render/core";
import type { Spec } from "@json-render/react";
import { homeSpec } from "@/lib/jsonui/homeSpec";

export type CanvasMode = "home" | "loading" | "answer";

export interface PortfolioCanvas {
  /** Current view: default home, loading a generation, or a generated answer. */
  mode: CanvasMode;
  /** The spec currently driving the <Renderer/> (homeSpec by default). */
  spec: Spec;
  /** The question backing the current answer (empty in home mode). */
  question: string;
  /** Transient error message; auto-clears a few seconds after a failed ask(). */
  error: string | null;
  /** Ask a question: POST /api/generate, render the returned spec. */
  ask: (question: string) => Promise<void>;
  /** Restore the default home canvas and clear the ?q= param. */
  reset: () => void;
}

const MAX_QUESTION = 280;

function setQueryParam(q: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  window.history.replaceState({}, "", url.toString());
}

/**
 * Owns the Ask-Me canvas state: the active json-render spec, the view mode,
 * ?q= URL sync, and graceful fallback to homeSpec on any generation failure
 * (issue #19 — the canvas never goes blank).
 *
 * The route (`/api/generate`) returns a complete, server-validated spec
 * (`{ spec }`), so this hook fetches once per question rather than consuming a
 * token stream. `autoFixSpec` is re-applied client-side as a second guard
 * before the spec reaches the renderer.
 */
export function usePortfolioCanvas(): PortfolioCanvas {
  const [mode, setMode] = useState<CanvasMode>("home");
  const [spec, setSpec] = useState<Spec>(homeSpec);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss a transient error a few seconds after it appears.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const ask = useCallback(async (raw: string) => {
    const trimmed = raw.trim().slice(0, MAX_QUESTION);
    if (!trimmed) return;

    setQuestion(trimmed);
    setError(null);
    setMode("loading");
    setQueryParam(trimmed);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `Generation failed (${res.status})`);
      }
      const data: unknown = await res.json();
      const candidate = (data as { spec?: unknown } | null)?.spec;
      if (!candidate || typeof candidate !== "object") {
        throw new Error("No spec returned");
      }
      const { spec: fixed } = autoFixSpec(candidate as Spec);
      setSpec(fixed);
      setMode("answer");
    } catch (err) {
      // Resilience: keep the home content on screen, surface a transient error.
      setSpec(homeSpec);
      setQuestion("");
      setMode("home");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }, []);

  const reset = useCallback(() => {
    setQuestion("");
    setError(null);
    setSpec(homeSpec);
    setMode("home");
    setQueryParam(null);
  }, []);

  // Auto-run a shared ?q= link exactly once on first mount.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q && q.trim()) void ask(q);
  }, [ask]);

  return { mode, spec, question, error, ask, reset };
}

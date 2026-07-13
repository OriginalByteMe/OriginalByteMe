"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import {
  autoFixSpec,
  createSpecStreamCompiler,
  formatSpecIssues,
  validateSpec,
  type Spec,
  type JsonPatch,
} from "@json-render/core";
import { buildSpecFromParts, type DataPart } from "@json-render/react";
import { homeSpec } from "@/lib/jsonui/homeSpec";
import { specToPatches } from "@/lib/jsonui/spec-patches";
import { isBackdropPresetName } from "@/lib/backdrop/presets";
import { resetBackdropPreset, setBackdropPreset } from "@/lib/store/slices/backdrop-slice";
import { normalizePortfolioQuery } from "@/lib/portfolio-query";

export type CanvasMode = "home" | "streaming" | "answer";

/** Delay between local patch replays (goHome's rebuild), ms. */
const LOCAL_PATCH_DELAY_MS = 35;

export interface PortfolioCanvas {
  /** Current view: default home, streaming a generation, or a generated answer. */
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
  /** Like reset, but replays the home spec patch-by-patch so the home story visibly rebuilds. */
  goHome: () => void;
}


function setQueryParam(q: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (q) {
    if (url.searchParams.get("q") === q) return;
    url.searchParams.set("q", q);
  } else {
    if (!url.searchParams.has("q")) return;
    url.searchParams.delete("q");
  }
  // Next wraps the history instance to start an RSC navigation. This query is
  // local canvas state, so preserve Next's state and use the native method to
  // avoid remounting the provider while a generation is in flight.
  History.prototype.replaceState.call(window.history, window.history.state, "", url.toString());
}

const PATCH_OPS: Record<JsonPatch["op"], true> = {
  add: true,
  remove: true,
  replace: true,
  move: true,
  copy: true,
  test: true,
};

function parsePatchLine(line: string): JsonPatch {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error("The generated answer contained malformed patch data");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The generated answer contained malformed patch data");
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.op !== "string" ||
    !Object.prototype.hasOwnProperty.call(PATCH_OPS, candidate.op) ||
    typeof candidate.path !== "string" ||
    (candidate.path !== "" && !candidate.path.startsWith("/"))
  ) {
    throw new Error("The generated answer contained malformed patch data");
  }

  if (
    (candidate.op === "add" || candidate.op === "replace" || candidate.op === "test") &&
    !("value" in candidate)
  ) {
    throw new Error("The generated answer contained malformed patch data");
  }

  if (
    (candidate.op === "move" || candidate.op === "copy") &&
    (typeof candidate.from !== "string" ||
      (candidate.from !== "" && !candidate.from.startsWith("/")))
  ) {
    throw new Error("The generated answer contained malformed patch data");
  }

  return candidate as unknown as JsonPatch;
}

function patchPart(patch: JsonPatch): DataPart {
  return { type: "data-spec", data: { type: "patch", patch } };
}

function snapshotSpec(spec: Spec): Spec {
  return {
    ...spec,
    elements: { ...spec.elements },
    ...(spec.state ? { state: { ...spec.state } } : {}),
  };
}

function generatedBackdropPreset(spec: Spec): string | null {
  const state = spec.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const preset = state["/backdrop/preset"];
  return isBackdropPresetName(preset) ? preset : null;
}

function finalizeSpec(candidate: Spec): Spec {
  const { spec: fixed } = autoFixSpec(candidate);
  const validation = validateSpec(fixed);
  if (!validation.valid) {
    throw new Error(formatSpecIssues(validation.issues) || "Invalid spec");
  }
  return fixed;
}

/**
 * Owns the Ask-Me canvas state: the active json-render spec, the view mode,
 * ?q= URL sync, and graceful fallback to homeSpec on any generation failure
 * (issue #19 — the canvas never goes blank).
 *
 * The route (`/api/generate`) streams the answer as newline-delimited RFC 6902
 * JSON Patch lines on a cache miss, or returns the stored full spec as JSON on
 * a cache hit. This hook assembles the spec incrementally with
 * `createSpecStreamCompiler` and validates the final frame with
 * `buildSpecFromParts` + `autoFixSpec`/`validateSpec`.
 */
export function usePortfolioCanvas(initialQuery = ""): PortfolioCanvas {
  const normalizedInitialQuery = normalizePortfolioQuery(initialQuery);
  const hasInitialQuery = normalizedInitialQuery.length > 0;
  const dispatch = useDispatch();
  const [mode, setMode] = useState<CanvasMode>(hasInitialQuery ? "streaming" : "home");
  const [spec, setSpec] = useState<Spec>(() =>
    hasInitialQuery ? { root: "", elements: {} } : homeSpec,
  );
  const [question, setQuestion] = useState(normalizedInitialQuery);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  // Timer driving a local patch replay (goHome's live home rebuild).
  const localStreamTimer = useRef<number | null>(null);

  const cancelLocalStream = useCallback(() => {
    if (localStreamTimer.current !== null) {
      window.clearTimeout(localStreamTimer.current);
      localStreamTimer.current = null;
    }
  }, []);

  // Auto-dismiss a transient error a few seconds after it appears.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const ask = useCallback(async (raw: string) => {
    const normalized = normalizePortfolioQuery(raw);
    if (!normalized) return;

    requestRef.current?.abort();
    cancelLocalStream();
    const request = new AbortController();
    requestRef.current = request;

    setQuestion(normalized);
    setError(null);
    setMode("streaming");
    setSpec({ root: "", elements: {} });
    setQueryParam(normalized);
    dispatch(resetBackdropPreset());

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: normalized }),
        signal: request.signal,
      });
      if (!res.ok) {
        const detail: unknown = await res.json().catch(() => null);
        let message = `Generation failed (${res.status})`;
        if (detail && typeof detail === "object" && "error" in detail && typeof detail.error === "string") {
          message = detail.error;
        }
        throw new Error(message);
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        // Cache hit: server returns the stored full spec instantly.
        const data: unknown = await res.json();
        if (!data || typeof data !== "object" || !("spec" in data)) {
          throw new Error("No spec returned");
        }
        const candidate = data.spec;
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          throw new Error("No spec returned");
        }
        const fixed = finalizeSpec(candidate as Spec);
        if (request.signal.aborted || requestRef.current !== request) return;
        setSpec(fixed);
        const preset = generatedBackdropPreset(fixed);
        if (preset) dispatch(setBackdropPreset(preset));
        setMode("answer");
        return;
      }

      if (!contentType.includes("application/x-ndjson")) {
        throw new Error("Unexpected generation response");
      }

      // Cache miss: stream of RFC 6902 JSON Patch lines.
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const compiler = createSpecStreamCompiler<Spec>({ root: "", elements: {} });
      const decoder = new TextDecoder();
      const parts: DataPart[] = [];
      let buffer = "";

      const consumeLine = (line: string) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const patch = parsePatchLine(trimmedLine);
        const { result, newPatches } = compiler.push(`${trimmedLine}\n`);
        parts.push(patchPart(patch));
        if (newPatches.length > 0 && !request.signal.aborted && requestRef.current === request) {
          setSpec(snapshotSpec(result));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) consumeLine(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeLine(buffer);

      const assembled = buildSpecFromParts(parts) ?? compiler.getResult();
      const fixed = finalizeSpec(assembled);
      if (request.signal.aborted || requestRef.current !== request) return;
      setSpec(fixed);
      const preset = generatedBackdropPreset(fixed);
      if (preset) dispatch(setBackdropPreset(preset));
      setMode("answer");
    } catch (err) {
      if (request.signal.aborted || requestRef.current !== request) return;
      // Resilience: keep the home content on screen, surface a transient error.
      dispatch(resetBackdropPreset());
      setSpec(homeSpec);
      setQuestion("");
      setMode("home");
      setQueryParam(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (requestRef.current === request) requestRef.current = null;
    }
  }, [dispatch, cancelLocalStream]);

  const reset = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    cancelLocalStream();
    dispatch(resetBackdropPreset());
    setQuestion("");
    setError(null);
    setSpec(homeSpec);
    setMode("home");
    setQueryParam(null);
  }, [dispatch, cancelLocalStream]);

  // Like reset, but the home story assembles patch-by-patch in front of the
  // visitor — the same "built live" feel as a streamed answer.
  const goHome = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    cancelLocalStream();
    dispatch(resetBackdropPreset());
    setQuestion("");
    setError(null);
    setMode("home");
    setQueryParam(null);
    // The rebuild starts from the hero — bring the visitor with it.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const patches = [...specToPatches(homeSpec)];
    const compiler = createSpecStreamCompiler<Spec>({ root: "", elements: {} });
    setSpec({ root: "", elements: {} });
    let index = 0;
    const step = () => {
      const { result } = compiler.push(`${JSON.stringify(patches[index])}\n`);
      index += 1;
      if (index < patches.length) {
        setSpec(snapshotSpec(result));
        localStreamTimer.current = window.setTimeout(step, LOCAL_PATCH_DELAY_MS);
      } else {
        // Land on the canonical object so home mode compares by identity.
        localStreamTimer.current = null;
        setSpec(homeSpec);
      }
    };
    step();
  }, [dispatch, cancelLocalStream]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      cancelLocalStream();
    },
    [cancelLocalStream],
  );

  // Defer the server-seeded shared query until after StrictMode's effect
  // replay. Its cleanup cancels the first timer; the live effect issues once.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!normalizedInitialQuery || autoRan.current) return;

    const timer = window.setTimeout(() => {
      if (autoRan.current) return;
      autoRan.current = true;
      void ask(normalizedInitialQuery);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [ask, normalizedInitialQuery]);

  return { mode, spec, question, error, ask, reset, goHome };
}

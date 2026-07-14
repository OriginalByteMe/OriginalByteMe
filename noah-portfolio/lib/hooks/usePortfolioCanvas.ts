"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { createSpecStreamCompiler, type Spec } from "@json-render/core";

import { homeSpec } from "@/lib/jsonui/homeSpec";
import { specToPatches } from "@/lib/jsonui/spec-patches";
import { normalizeQuestion } from "@/lib/story/normalize";
import {
  assertValidPublicStory,
  assertValidStreamPlan,
  assertValidStreamScene,
} from "@/lib/story/public-validation";
import {
  PublishStoryResponseSchema,
  StoryQuestionSchema,
  StoryStreamEventSchema,
  type EvidenceRef,
  type PublicStory,
  type StoryPlan,
  type StoryScene,
  type StoryPublicationToken,
  type StoryStreamEvent,
} from "@/lib/story/types";
import { resetBackdropPreset, setBackdropPreset } from "@/lib/store/slices/backdrop-slice";

export type CanvasMode = "home" | "streaming" | "answer" | "error";
export type StoryPhase = Extract<StoryStreamEvent, { type: "phase" }>["phase"];
export type StoryHistoryMode = "replace" | "push";

export interface AskOptions {
  /** Related Questions push a new document; ordinary asks replace the current one. */
  history?: StoryHistoryMode;
}

export interface PortfolioCanvas {
  mode: CanvasMode;
  /** json-render is retained only for the home Tableau. */
  spec: Spec;
  question: string;
  phase: StoryPhase | null;
  plan: StoryPlan | null;
  scenes: StoryScene[];
  evidence: EvidenceRef[];
  /** Present only after the server validates, persists, and publishes the Story. */
  story: PublicStory | null;
  error: string | null;
  ask: (question: string, options?: AskOptions) => Promise<void>;
  reset: () => void;
  goHome: () => void;
}

interface StoryHistoryEntry {
  id: string;
  scrollY: number;
}

type StoryStreamTerminal =
  | { kind: "complete"; story: PublicStory }
  | { kind: "publish"; publicationToken: StoryPublicationToken };

const STORY_PHASE_INDEX: Record<StoryPhase, number> = {
  planning: 0,
  composing: 1,
  validating: 2,
  publishing: 3,
};

const STORY_HISTORY_KEY = "__noahPortfolioStory";
const LOCAL_PATCH_DELAY_MS = 35;

function historyStateWith(entry: StoryHistoryEntry | null): Record<string, unknown> {
  const current = window.history.state;
  const state =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  state[STORY_HISTORY_KEY] = entry;
  return state;
}

function writeStoryHistory(
  method: StoryHistoryMode,
  entry: StoryHistoryEntry | null,
  url?: string,
) {
  if (typeof window === "undefined") return;
  const state = historyStateWith(entry);
  const destination = url ?? window.location.href;
  if (method === "push") {
    History.prototype.pushState.call(window.history, state, "", destination);
  } else {
    History.prototype.replaceState.call(window.history, state, "", destination);
  }
}

function readStoryHistory(state: unknown): StoryHistoryEntry | null {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const entry = (state as Record<string, unknown>)[STORY_HISTORY_KEY];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const candidate = entry as Record<string, unknown>;
  return typeof candidate.id === "string" &&
    typeof candidate.scrollY === "number" &&
    Number.isFinite(candidate.scrollY)
    ? { id: candidate.id, scrollY: Math.max(0, candidate.scrollY) }
    : null;
}

function parseStoryEvent(line: string): StoryStreamEvent {
  if (!line.trim()) {
    throw new Error("The Story stream contained an empty event");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error("The Story stream contained malformed JSON");
  }

  const result = StoryStreamEventSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("The Story stream contained an invalid event");
  }
  return result.data;
}

function samePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseCompletePublicStory(value: unknown): PublicStory {
  assertValidPublicStory(value);
  return value;
}

function snapshotSpec(spec: Spec): Spec {
  return {
    ...spec,
    elements: { ...spec.elements },
    ...(spec.state ? { state: { ...spec.state } } : {}),
  };
}

export function usePortfolioCanvas(initialStory?: PublicStory): PortfolioCanvas {
  const validatedInitialStory = useMemo(
    () => (initialStory ? parseCompletePublicStory(initialStory) : undefined),
    [initialStory],
  );
  const dispatch = useDispatch();
  const [mode, setMode] = useState<CanvasMode>(validatedInitialStory ? "answer" : "home");
  const [spec, setSpec] = useState<Spec>(homeSpec);
  const [question, setQuestion] = useState(validatedInitialStory?.displayQuestion ?? "");
  const [phase, setPhase] = useState<StoryPhase | null>(null);
  const [plan, setPlan] = useState<StoryPlan | null>(validatedInitialStory?.plan ?? null);
  const [scenes, setScenes] = useState<StoryScene[]>(validatedInitialStory?.scenes ?? []);
  const [evidence, setEvidence] = useState<EvidenceRef[]>(validatedInitialStory?.evidence ?? []);
  const [story, setStory] = useState<PublicStory | null>(validatedInitialStory ?? null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const localStreamTimer = useRef<number | null>(null);
  const storyRef = useRef<PublicStory | null>(validatedInitialStory ?? null);
  const startedFromPublicRoute = useRef(Boolean(validatedInitialStory));
  const storyCacheRef = useRef<Map<string, PublicStory> | null>(null);
  if (!storyCacheRef.current) {
    storyCacheRef.current = new Map(
      validatedInitialStory ? [[validatedInitialStory.id, validatedInitialStory]] : [],
    );
  }
  const storyCache = storyCacheRef.current;

  const cancelLocalStream = useCallback(() => {
    if (localStreamTimer.current !== null) {
      window.clearTimeout(localStreamTimer.current);
      localStreamTimer.current = null;
    }
  }, []);

  const adoptCompleteStory = useCallback(
    (nextStory: PublicStory) => {
      storyCache.set(nextStory.id, nextStory);
      storyRef.current = nextStory;
      setQuestion(nextStory.displayQuestion);
      setPlan(nextStory.plan);
      setScenes(nextStory.scenes);
      setEvidence(nextStory.evidence);
      setStory(nextStory);
      setError(null);
      setMode("answer");
      dispatch(setBackdropPreset(nextStory.plan.backdropPreset));
    },
    [dispatch, storyCache],
  );

  useEffect(() => {
    if (!validatedInitialStory) return;
    if (storyRef.current?.id !== validatedInitialStory.id && !requestRef.current) {
      adoptCompleteStory(validatedInitialStory);
    } else {
      storyCache.set(validatedInitialStory.id, validatedInitialStory);
      dispatch(setBackdropPreset(validatedInitialStory.plan.backdropPreset));
    }
    writeStoryHistory("replace", {
      id: validatedInitialStory.id,
      scrollY: window.scrollY,
    });
  }, [adoptCompleteStory, dispatch, storyCache, validatedInitialStory]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const entry = readStoryHistory(event.state);
      if (!entry) {
        if (window.location.pathname !== "/") return;
        requestRef.current?.abort();
        requestRef.current = null;
        cancelLocalStream();
        if (startedFromPublicRoute.current) {
          window.location.assign("/");
          return;
        }
        storyRef.current = null;
        setMode("home");
        setSpec(homeSpec);
        setQuestion("");
        setPhase(null);
        setPlan(null);
        setScenes([]);
        setEvidence([]);
        setStory(null);
        setError(null);
        dispatch(resetBackdropPreset());
        return;
      }

      const cached = storyCache.get(entry.id);
      if (!cached) return;
      requestRef.current?.abort();
      requestRef.current = null;
      cancelLocalStream();
      adoptCompleteStory(cached);
      const restore = () =>
        window.scrollTo({ top: entry.scrollY, left: 0, behavior: "auto" });
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => window.requestAnimationFrame(restore));
      } else {
        window.setTimeout(restore, 0);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [adoptCompleteStory, cancelLocalStream, dispatch, storyCache]);

  const ask = useCallback(
    async (raw: string, options: AskOptions = {}) => {
      const parsedQuestion = StoryQuestionSchema.safeParse(raw);
      if (!parsedQuestion.success) return;
      const normalized = parsedQuestion.data;

      const historyMode = options.history ?? "replace";
      if (historyMode === "push" && storyRef.current) {
        writeStoryHistory("replace", {
          id: storyRef.current.id,
          scrollY: window.scrollY,
        });
      }

      requestRef.current?.abort();
      cancelLocalStream();
      const request = new AbortController();
      requestRef.current = request;
      storyRef.current = null;

      setQuestion(normalized);
      setPhase(null);
      setPlan(null);
      setScenes([]);
      setEvidence([]);
      setStory(null);
      setError(null);
      setMode("streaming");
      setSpec(homeSpec);
      dispatch(resetBackdropPreset());

      if (historyMode === "push") {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }

      let streamPlan: StoryPlan | null = null;
      let streamEvidence: EvidenceRef[] = [];
      const streamScenes: StoryScene[] = [];
      let phaseIndex = -1;
      let terminal: StoryStreamTerminal | null = null;

      const isCurrentRequest = () =>
        !request.signal.aborted && requestRef.current === request;

      const validateCompletion = (
        value: unknown,
        source: "stream" | "publish",
      ): PublicStory => {
        const completed = parseCompletePublicStory(value);
        if (
          normalizeQuestion(completed.displayQuestion) !==
          normalizeQuestion(normalized)
        ) {
          throw new Error("The published Story question differs from the requested question");
        }
        if (source === "publish") {
          return completed;
        }
        if (
          !streamPlan ||
          streamScenes.length !== streamPlan.scenes.length ||
          !samePayload(completed.plan, streamPlan) ||
          !samePayload(completed.scenes, streamScenes) ||
          !samePayload(completed.evidence, streamEvidence)
        ) {
          throw new Error("The cached Story did not match its replayed draft");
        }
        return completed;
      };

      const consumeEvent = (line: string): StoryStreamTerminal | null => {
        if (!isCurrentRequest()) return null;
        if (terminal) {
          throw new Error("The Story stream continued after its terminal event");
        }

        const event = parseStoryEvent(line);
        switch (event.type) {
          case "phase": {
            const nextPhaseIndex = STORY_PHASE_INDEX[event.phase];
            if (nextPhaseIndex !== phaseIndex + 1) {
              throw new Error("The Story stream sent lifecycle phases out of order");
            }
            if (event.phase === "composing" && !streamPlan) {
              throw new Error("The Story stream started composing before its Plan");
            }
            if (
              event.phase === "validating" &&
              (!streamPlan || streamScenes.length !== streamPlan.scenes.length)
            ) {
              throw new Error("The Story stream started validation before every Scene arrived");
            }
            phaseIndex = nextPhaseIndex;
            setPhase(event.phase);
            return event.phase === "publishing"
              ? { kind: "publish", publicationToken: event.publicationToken }
              : null;
          }
          case "plan":
            if (phaseIndex !== STORY_PHASE_INDEX.planning || streamPlan) {
              throw new Error("The Story stream sent its Plan outside the planning phase");
            }
            assertValidStreamPlan(event.plan, event.evidence, normalized);
            streamPlan = event.plan;
            streamEvidence = event.evidence;
            setPlan(event.plan);
            setEvidence(event.evidence);
            dispatch(setBackdropPreset(event.plan.backdropPreset));
            return null;
          case "scene": {
            if (!streamPlan || phaseIndex !== STORY_PHASE_INDEX.composing) {
              throw new Error("The Story stream sent a Scene outside the composing phase");
            }
            const expectedIndex = streamScenes.length;
            if (event.index !== expectedIndex || event.scene.index !== expectedIndex) {
              throw new Error("The Story stream sent Scenes out of order");
            }
            const lockedScene = streamPlan.scenes[expectedIndex];
            if (!lockedScene) {
              throw new Error("The Story stream sent an unplanned Scene");
            }
            assertValidStreamScene(event.scene, lockedScene, streamEvidence);
            streamScenes.push(event.scene);
            setScenes([...streamScenes]);
            return null;
          }
          case "complete":
            if (!streamPlan || phaseIndex !== STORY_PHASE_INDEX.validating) {
              throw new Error("The cached Story bypassed its validated lifecycle");
            }
            return {
              kind: "complete",
              story: validateCompletion(event.story, "stream"),
            };
          case "error":
            throw new Error(event.message);
        }
      };

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: normalized }),
          signal: request.signal,
        });
        if (!response.ok) {
          const detail: unknown = await response.json().catch(() => null);
          let message = `Generation failed (${response.status})`;
          if (
            detail &&
            typeof detail === "object" &&
            "error" in detail &&
            typeof detail.error === "string"
          ) {
            message = detail.error;
          }
          throw new Error(message);
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/x-ndjson")) {
          throw new Error("Unexpected generation response");
        }

        reader = response.body?.getReader() ?? null;
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const nextTerminal = consumeEvent(line);
            if (nextTerminal) terminal = nextTerminal;
          }
        }
        buffer += decoder.decode();
        if (buffer) {
          const nextTerminal = consumeEvent(buffer);
          if (nextTerminal) terminal = nextTerminal;
        }
        if (!terminal) {
          throw new Error("The Story stream ended before publication");
        }
        if (!isCurrentRequest()) return;

        let completedStory: PublicStory;
        if (terminal.kind === "complete") {
          completedStory = terminal.story;
        } else {
          const publishResponse = await fetch("/api/generate/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicationToken: terminal.publicationToken }),
            signal: request.signal,
          });
          if (!publishResponse.ok) {
            const detail: unknown = await publishResponse.json().catch(() => null);
            let message = `Publication failed (${publishResponse.status})`;
            if (
              detail &&
              typeof detail === "object" &&
              "error" in detail &&
              typeof detail.error === "string"
            ) {
              message = detail.error;
            }
            throw new Error(message);
          }
          const publishContentType = publishResponse.headers.get("content-type") ?? "";
          if (!publishContentType.includes("application/json")) {
            throw new Error("Unexpected Story publication response");
          }
          const publishPayload: unknown = await publishResponse.json().catch(() => null);
          const published = PublishStoryResponseSchema.safeParse(publishPayload);
          if (!published.success) {
            throw new Error("The Story publication response was invalid");
          }
          completedStory = validateCompletion(published.data.story, "publish");
        }

        if (!isCurrentRequest()) return;
        adoptCompleteStory(completedStory);
        writeStoryHistory(
          historyMode,
          { id: completedStory.id, scrollY: 0 },
          `/ask/${encodeURIComponent(completedStory.id)}`,
        );
      } catch (caught) {
        if (!isCurrentRequest()) return;
        request.abort();
        void reader?.cancel().catch(() => undefined);
        storyRef.current = null;
        setStory(null);
        setError(caught instanceof Error ? caught.message : "Something went wrong");
        setMode("error");
      } finally {
        if (requestRef.current === request) requestRef.current = null;
      }
    },
    [adoptCompleteStory, cancelLocalStream, dispatch],
  );

  const reset = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    cancelLocalStream();
    storyRef.current = null;
    dispatch(resetBackdropPreset());
    setMode("home");
    setSpec(homeSpec);
    setQuestion("");
    setPhase(null);
    setPlan(null);
    setScenes([]);
    setEvidence([]);
    setStory(null);
    setError(null);
    writeStoryHistory("replace", null, "/");
  }, [cancelLocalStream, dispatch]);

  const goHome = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    cancelLocalStream();
    const currentStory = storyRef.current;
    if (startedFromPublicRoute.current) {
      window.location.assign("/");
      return;
    }
    if (currentStory) {
      writeStoryHistory("replace", {
        id: currentStory.id,
        scrollY: window.scrollY,
      });
    }
    storyRef.current = null;
    dispatch(resetBackdropPreset());
    setMode("home");
    setQuestion("");
    setPhase(null);
    setPlan(null);
    setScenes([]);
    setEvidence([]);
    setStory(null);
    setError(null);
    writeStoryHistory("push", null, "/");
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });

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
        localStreamTimer.current = null;
        setSpec(homeSpec);
      }
    };
    step();
  }, [cancelLocalStream, dispatch]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      cancelLocalStream();
    },
    [cancelLocalStream],
  );

  return {
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
    reset,
    goHome,
  };
}

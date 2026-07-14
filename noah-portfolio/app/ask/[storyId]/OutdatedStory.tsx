"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  PublishStoryRequestSchema,
  PublishStoryResponseSchema,
  StoryStreamEventSchema,
  type EvidenceRef,
  type StoryPlan,
  type StoryScene,
} from "@/lib/story/types";
import {
  assertValidPublicStory,
  assertValidStreamPlan,
  assertValidStreamScene,
} from "@/lib/story/public-validation";

interface OutdatedStoryProps {
  displayQuestion: string;
}

type RegenerationOutcome =
  | { storyId: string }
  | { publicationToken: string };

type StreamStage = "start" | "planning" | "planned" | "composing" | "validated";

function samePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readRegenerationOutcome(
  response: Response,
  expectedQuestion: string,
): Promise<RegenerationOutcome> {
  if (!response.ok) {
    throw new Error("The Story could not be regenerated. Please try again.");
  }
  if (!(response.headers.get("Content-Type") ?? "").includes("application/x-ndjson")) {
    throw new Error("The regeneration response was invalid.");
  }
  if (!response.body) {
    throw new Error("The regeneration stream ended before the Story was ready.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let stage: StreamStage = "start";
  let plan: StoryPlan | null = null;
  let evidence: EvidenceRef[] = [];
  const scenes: StoryScene[] = [];

  const consumeLine = (line: string): RegenerationOutcome | null => {
    if (!line.trim()) return null;

    const event = StoryStreamEventSchema.parse(JSON.parse(line));
    if (event.type === "error") throw new Error(event.message);

    if (event.type === "phase") {
      if (event.phase === "planning") {
        if (stage !== "start") {
          throw new Error("The regeneration stream repeated its planning phase.");
        }
        stage = "planning";
        return null;
      }
      if (event.phase === "composing") {
        if (stage !== "planned") {
          throw new Error("The regeneration stream composed before its Plan.");
        }
        stage = "composing";
        return null;
      }
      if (event.phase === "validating") {
        if (stage !== "composing" || !plan || scenes.length !== plan.scenes.length) {
          throw new Error("The regeneration stream validated before every Scene was ready.");
        }
        stage = "validated";
        return null;
      }
      if (event.phase !== "publishing") {
        throw new Error("The regeneration stream sent an unknown phase.");
      }
      if (stage !== "validated") {
        throw new Error("The regeneration stream published before validation.");
      }
      return { publicationToken: event.publicationToken };
    }

    if (event.type === "plan") {
      if (stage !== "planning" || plan) {
        throw new Error("The regeneration stream sent its Plan out of order.");
      }
      assertValidStreamPlan(event.plan, event.evidence, expectedQuestion);
      plan = event.plan;
      evidence = event.evidence;
      stage = "planned";
      return null;
    }

    if (event.type === "scene") {
      if (stage !== "composing" || !plan || event.index !== scenes.length) {
        throw new Error("The regeneration stream sent Scenes out of order.");
      }
      const lockedScene = plan.scenes[event.index];
      if (!lockedScene) {
        throw new Error("The regeneration stream sent an unplanned Scene.");
      }
      assertValidStreamScene(event.scene, lockedScene, evidence);
      scenes.push(event.scene);
      return null;
    }

    assertValidPublicStory(event.story);
    if (
      stage !== "validated" ||
      !plan ||
      !samePayload(event.story.plan, plan) ||
      !samePayload(event.story.scenes, scenes) ||
      !samePayload(event.story.evidence, evidence)
    ) {
      throw new Error("The completed Story did not match its validated stream.");
    }
    return { storyId: event.story.id };
  };

  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });

    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const outcome = consumeLine(line);
      if (outcome) {
        await reader.cancel();
        return outcome;
      }
    }

    if (done) break;
  }

  const outcome = consumeLine(pending);
  if (outcome) return outcome;
  throw new Error("The regeneration stream ended before the Story was ready.");
}

async function publishStory(
  publicationToken: string,
  signal: AbortSignal,
  expectedQuestion: string,
): Promise<string> {
  const request = PublishStoryRequestSchema.parse({ publicationToken });
  const response = await fetch("/api/generate/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    throw new Error("The regenerated Story could not be published. Please try again.");
  }
  if (!(response.headers.get("Content-Type") ?? "").includes("application/json")) {
    throw new Error("The publication response was invalid.");
  }

  const event = PublishStoryResponseSchema.parse(await response.json());
  assertValidPublicStory(event.story);
  assertValidStreamPlan(event.story.plan, event.story.evidence, expectedQuestion);
  return event.story.id;
}

export default function OutdatedStory({ displayQuestion }: OutdatedStoryProps) {
  const router = useRouter();
  const requestRef = useRef<AbortController | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function regenerate() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setError(null);
    setIsRegenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: displayQuestion }),
        signal: controller.signal,
      });
      const outcome = await readRegenerationOutcome(response, displayQuestion);
      const storyId = "storyId" in outcome
        ? outcome.storyId
        : await publishStory(outcome.publicationToken, controller.signal, displayQuestion);
      if (controller.signal.aborted) return;
      router.replace(`/ask/${encodeURIComponent(storyId)}`);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "The Story could not be regenerated.");
      setIsRegenerating(false);
    }
  }

  return (
    <section
      className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-24 sm:px-10"
      aria-labelledby="outdated-story-title"
    >
      <div className="w-full rounded-[2rem] border border-current/15 bg-background/90 p-7 shadow-2xl backdrop-blur-xl sm:p-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]">Story unavailable</p>
        <h1 id="outdated-story-title" className="text-4xl font-semibold tracking-tight sm:text-6xl">
          This Story is outdated
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 sm:text-lg">
          Noah&apos;s portfolio facts or Story format have changed since this Story was made. Its old
          scenes are not shown as current.
        </p>
        <div className="mt-8 rounded-2xl border border-current/10 p-5">
          <p className="text-sm font-medium">Original question</p>
          <p className="mt-2 text-lg leading-7">{displayQuestion}</p>
        </div>
        {error ? (
          <p className="mt-6" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="min-h-11 rounded-full bg-foreground px-6 py-3 font-semibold text-background disabled:cursor-wait disabled:opacity-60"
            onClick={regenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Regenerating Story…" : "Regenerate with current facts"}
          </button>
          <Link className="min-h-11 rounded-full border border-current/20 px-6 py-3 font-semibold" href="/">
            Return home
          </Link>
        </div>
      </div>
    </section>
  );
}

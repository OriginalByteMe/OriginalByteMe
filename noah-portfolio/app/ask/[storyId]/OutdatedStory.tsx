"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  PublishStoryRequestSchema,
  PublishStoryResponseSchema,
} from "@/lib/story/types";
import { consumeStoryStream } from "@/lib/story/consume-story-stream";
import {
  assertValidPublicStory,
  assertValidStreamPlan,
} from "@/lib/story/public-validation";

interface OutdatedStoryProps {
  displayQuestion: string;
}

type RegenerationOutcome =
  | { storyId: string }
  | { publicationToken: string };


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

  const terminal = await consumeStoryStream({
    body: response.body,
    expectedQuestion,
    context: "regeneration",
  });
  return terminal.kind === "complete"
    ? { storyId: terminal.story.id }
    : { publicationToken: terminal.publicationToken };
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

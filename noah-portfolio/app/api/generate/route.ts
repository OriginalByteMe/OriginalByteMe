import { NextRequest, NextResponse } from "next/server";
import { streamText, type ModelMessage, type TelemetrySettings } from "ai";
import { getModel } from "@/lib/llm/openrouter";
import { storyTelemetry, withStoryTrace } from "@/lib/observability/langfuse";
import {
  buildSceneRepairMessage,
  buildSceneSystemPrompt,
  buildSceneUserMessage,
  buildSystemPrompt,
  buildUserMessage,
} from "@/lib/llm/prompt";
import {
  CORPUS_EVIDENCE_REFS,
  resolveStoryProjects,
} from "@/lib/story/evidence";
import {
  MAX_STORY_QUESTION_LENGTH,
  StoryQuestionSchema,
  toPublicStory,
} from "@/lib/story/types";
import { findCurrentStory, findPreparedStory, prepareCompleteStory } from "@/lib/story/store";
import type {
  ScenePlan,
  StoryPlan,
  StoryPublicationToken,
  StoryRecord,
  StoryScene,
  StoryStreamEvent,
} from "@/lib/story/types";
import {
  assertValidStoryPlan,
  assertValidStoryPlanWithEvidence,
  assertValidStoryRecord,
  assertValidStorySceneWithEvidence,
  validateCanonicalStoryEvidence,
  type ValidatedStoryEvidence,
} from "@/lib/story/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PLAN_ATTEMPTS = 2;
const MAX_SCENE_ATTEMPTS = 2;
const RESPONSE_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Generation aborted", "AbortError");
  }
}

async function collectModelText(
  system: string,
  messages: ModelMessage[],
  signal: AbortSignal,
  telemetry: TelemetrySettings,
): Promise<string> {
  abortIfNeeded(signal);
  const result = streamText({
    model: getModel(),
    system,
    messages,
    abortSignal: signal,
    experimental_telemetry: telemetry,
  });
  let text = "";
  for await (const delta of result.textStream) {
    abortIfNeeded(signal);
    text += delta;
  }
  abortIfNeeded(signal);
  return text;
}

async function generatePlan(question: string, signal: AbortSignal): Promise<StoryPlan> {
  const messages: ModelMessage[] = [{ role: "user", content: buildUserMessage(question) }];
  let lastError = "The model did not return a valid Story Plan.";

  for (let attempt = 0; attempt < MAX_PLAN_ATTEMPTS; attempt += 1) {
    let output = "";
    try {
      output = await collectModelText(
        buildSystemPrompt(),
        messages,
        signal,
        storyTelemetry("story-plan", { attempt }),
      );
      const parsed: unknown = JSON.parse(stripFences(output));
      assertValidStoryPlan(parsed, CORPUS_EVIDENCE_REFS, question);
      return parsed;
    } catch (error) {
      abortIfNeeded(signal);
      lastError = error instanceof Error ? error.message : lastError;
    }

    if (attempt + 1 < MAX_PLAN_ATTEMPTS) {
      messages.push({ role: "assistant", content: output });
      messages.push({
        role: "user",
        content: `The Story Plan was invalid: ${lastError}\nReturn only a corrected complete Plan. Do not invent Evidence Refs, Motion Asset IDs, or project slugs.`,
      });
    }
  }

  throw new Error(lastError);
}

function evidenceForPlan(
  plan: StoryPlan,
  expectedQuestion: string,
): ValidatedStoryEvidence {
  const usedIds = new Set(plan.scenes.flatMap((scene) => scene.evidenceRefIds));
  const evidence = validateCanonicalStoryEvidence(
    CORPUS_EVIDENCE_REFS.filter((ref) => usedIds.has(ref.id)),
  );
  assertValidStoryPlanWithEvidence(plan, evidence, expectedQuestion);
  return evidence;
}

function parseSceneBody(output: string): string {
  const parsed: unknown = JSON.parse(stripFences(output));
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !("body" in parsed) ||
    typeof parsed.body !== "string"
  ) {
    throw new Error('Scene composition must contain only a string "body" field.');
  }
  return parsed.body;
}

async function composeScene(
  question: string,
  scenes: readonly Pick<ScenePlan, "index" | "role" | "title" | "claim">[],
  lockedPlan: ScenePlan,
  storyEvidence: ValidatedStoryEvidence,
  signal: AbortSignal,
): Promise<StoryScene> {
  const lockedEvidence = storyEvidence.refs.filter((ref) => lockedPlan.evidenceRefIds.includes(ref.id));
  const resolvedProjects = resolveStoryProjects(lockedPlan.projectSlugs);
  const messages: ModelMessage[] = [{ role: "user", content: buildSceneUserMessage() }];
  let lastError = "The model did not return a valid Scene body.";

  for (let attempt = 0; attempt < MAX_SCENE_ATTEMPTS; attempt += 1) {
    let output = "";
    try {
      output = await collectModelText(
        buildSceneSystemPrompt(question, scenes, lockedPlan, lockedEvidence),
        messages,
        signal,
        storyTelemetry("story-scene", { sceneIndex: lockedPlan.index, attempt }),
      );
      const scene: unknown = {
        ...lockedPlan,
        body: parseSceneBody(output),
        ...(resolvedProjects ? { projects: resolvedProjects } : {}),
      };
      assertValidStorySceneWithEvidence(scene, lockedPlan, storyEvidence);
      return scene;
    } catch (error) {
      abortIfNeeded(signal);
      lastError = error instanceof Error ? error.message : lastError;
    }

    if (attempt + 1 < MAX_SCENE_ATTEMPTS) {
      messages.push({ role: "assistant", content: output });
      messages.push({ role: "user", content: buildSceneRepairMessage(output, lastError) });
    }
  }

  const fallback: unknown = {
    ...lockedPlan,
    body: lockedPlan.claim.trim(),
    ...(resolvedProjects ? { projects: resolvedProjects } : {}),
  };
  assertValidStorySceneWithEvidence(fallback, lockedPlan, storyEvidence);
  return fallback;
}

function replayStory(
  story: StoryRecord,
  requestSignal: AbortSignal,
  pendingPublicationToken?: StoryPublicationToken,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: StoryStreamEvent) => {
        abortIfNeeded(requestSignal);
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        emit({ type: "phase", phase: "planning" });
        emit({ type: "plan", plan: story.plan, evidence: story.evidence });
        emit({ type: "phase", phase: "composing" });
        for (const scene of story.scenes) {
          emit({ type: "scene", index: scene.index, scene });
        }
        emit({ type: "phase", phase: "validating" });
        if (pendingPublicationToken) {
          // A prior abort left this validated Story pending: replay its canonical
          // content and re-issue the token so the retry can publish it, instead of
          // recomposing a draft the publish ACK would then replace.
          emit({
            type: "phase",
            phase: "publishing",
            publicationToken: pendingPublicationToken,
          });
        } else {
          emit({ type: "complete", story: toPublicStory(story) });
        }
        controller.close();
      } catch {
        try {
          controller.close();
        } catch {
          // The canceled replay reader is already closed.
        }
      }
    },
  });
}

function generationStream(
  question: string,
  requestSignal: AbortSignal,
): ReadableStream<Uint8Array> {
  const generationAbort = new AbortController();
  const forwardRequestAbort = () => generationAbort.abort(requestSignal.reason);
  if (requestSignal.aborted) {
    forwardRequestAbort();
  } else {
    requestSignal.addEventListener("abort", forwardRequestAbort, { once: true });
  }

  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const signal = generationAbort.signal;
      const emit = (event: StoryStreamEvent) => {
        abortIfNeeded(signal);
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        try {
          await withStoryTrace(question, async (trace) => {
            emit({ type: "phase", phase: "planning" });
            const plan = await generatePlan(question, signal);
            const evidence = evidenceForPlan(plan, question);
            emit({ type: "plan", plan, evidence: evidence.refs });

            emit({ type: "phase", phase: "composing" });
            const scenes: StoryScene[] = [];
            for (const lockedScene of plan.scenes) {
              const scene = await composeScene(question, plan.scenes, lockedScene, evidence, signal);
              scenes.push(scene);
              emit({ type: "scene", index: scene.index, scene });
            }

            emit({ type: "phase", phase: "validating" });
            abortIfNeeded(signal);

            const prepared = await prepareCompleteStory(
              {
                displayQuestion: question,
                plan,
                scenes,
                evidence: evidence.refs,
              },
              { signal },
            );
            abortIfNeeded(signal);
            assertValidStoryRecord(prepared.story);

            const concurrentlyPublished = await findCurrentStory(question);
            abortIfNeeded(signal);
            if (concurrentlyPublished?.id === prepared.story.id) {
              assertValidStoryRecord(concurrentlyPublished);
              emit({ type: "complete", story: toPublicStory(concurrentlyPublished) });
            } else {
              emit({
                type: "phase",
                phase: "publishing",
                publicationToken: prepared.publicationToken,
              });
            }
            trace.setOutput({
              storyId: prepared.story.id,
              scenes: scenes.length,
              cache:
                concurrentlyPublished?.id === prepared.story.id
                  ? "published-concurrently"
                  : "prepared",
            });
            // No error handling here: when this callback rejects, the Langfuse
            // SDK marks the trace span ERROR with the message. Stream stays
            // open until withStoryTrace's span flush completes below; closing
            // here would let the serverless function freeze mid-flush and drop
            // the spans. Close after the await returns.
          });
          controller.close();
        } catch (error) {
          if (signal.aborted) {
            try {
              controller.close();
            } catch {
              // The disconnected consumer has already canceled its reader.
            }
          } else {
            const detail =
              error instanceof Error && error.message
                ? error.message
                : "Unable to create a grounded Story.";
            const message = detail.slice(0, 500);
            try {
              emit({ type: "error", message });
              controller.close();
            } catch {
              // The consumer disconnected between the error and close operations.
            }
          }
        } finally {
          requestSignal.removeEventListener("abort", forwardRequestAbort);
        }
      })();
    },
    cancel(reason) {
      generationAbort.abort(reason);
      requestSignal.removeEventListener("abort", forwardRequestAbort);
    },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  const parsedQuestion =
    body && typeof body === "object" && "question" in body
      ? StoryQuestionSchema.safeParse(body.question)
      : null;
  if (!parsedQuestion?.success) {
    return NextResponse.json(
      {
        error: `question must be a string between 1 and ${MAX_STORY_QUESTION_LENGTH} characters`,
      },
      { status: 400 },
    );
  }
  const question = parsedQuestion.data;

  if (req.signal.aborted) {
    return new Response(null, {
      headers: { ...RESPONSE_HEADERS, "x-cache": "miss" },
    });
  }

  try {
    const cached = await findCurrentStory(question);
    if (cached) {
      assertValidStoryRecord(cached);
      return new Response(replayStory(cached, req.signal), {
        headers: { ...RESPONSE_HEADERS, "x-cache": "hit" },
      });
    }

    const pending = await findPreparedStory(question);
    if (pending) {
      assertValidStoryRecord(pending.story);
      return new Response(
        replayStory(pending.story, req.signal, pending.publicationToken),
        { headers: { ...RESPONSE_HEADERS, "x-cache": "pending" } },
      );
    }
  } catch (error) {
    if (req.signal.aborted) {
      return new Response(null, {
        headers: { ...RESPONSE_HEADERS, "x-cache": "miss" },
      });
    }
    // Invalid or unavailable cache entries regenerate through the normal pipeline.
    console.error("Story cache lookup failed; regenerating without cache:", error);
  }

  return new Response(generationStream(question, req.signal), {
    headers: { ...RESPONSE_HEADERS, "x-cache": "miss" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { generateSite } from "@/lib/llm/generate-site";
import { withStoryTrace } from "@/lib/observability/langfuse";
import {
  MAX_STORY_QUESTION_LENGTH,
  StoryQuestionSchema,
  toPublicStory,
} from "@/lib/story/types";
import { findCurrentStory, findPreparedStory, prepareCompleteStory } from "@/lib/story/store";
import type {
  StoryPublicationToken,
  StoryRecord,
  StoryStreamEvent,
} from "@/lib/story/types";
import { assertValidStoryRecord } from "@/lib/story/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

const RESPONSE_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Generation aborted", "AbortError");
  }
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
        emit({ type: "phase", phase: "generating" });
        emit({ type: "site", site: story.site, evidence: story.evidence });
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
            emit({ type: "phase", phase: "generating" });
            let attempts = 0;
            const { site, evidence } = await generateSite(question, {
              signal,
              onAttempt: () => {
                attempts += 1;
              },
            });
            emit({ type: "site", site, evidence });

            emit({ type: "phase", phase: "validating" });
            abortIfNeeded(signal);

            const prepared = await prepareCompleteStory(
              { displayQuestion: question, site, evidence },
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
              layout: site.layout,
              sections: site.sections.length,
              attempts,
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

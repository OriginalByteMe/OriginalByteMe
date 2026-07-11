import { NextRequest, NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";
import {
  validateSpec,
  autoFixSpec,
  formatSpecIssues,
  type Spec,
  type JsonPatch,
} from "@json-render/core";
import { getModel } from "@/lib/llm/openrouter";
import { buildSystemPrompt, buildUserMessage } from "@/lib/llm/prompt";
import { cacheKey } from "@/lib/cache/key";
import { kvGet, kvPut } from "@/lib/cache/kv";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 3;
const PATCH_DELAY_MS = 30;

/** Strip ```json / ``` fences some models wrap output in despite instructions not to. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function looksLikeSpec(parsed: unknown): parsed is Spec {
  return (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "root" in parsed &&
    typeof parsed.root === "string" &&
    "elements" in parsed &&
    typeof parsed.elements === "object" &&
    parsed.elements !== null &&
    !Array.isArray(parsed.elements)
  );
}

function escapePointerToken(token: string): string {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

/** Generate one RFC 6902 JSON Patch per element so the UI self-assembles. */
function* specToPatches(spec: Spec): Generator<JsonPatch> {
  yield { op: "add", path: "/root", value: spec.root };
  if (spec.state && typeof spec.state === "object" && !Array.isArray(spec.state)) {
    yield { op: "add", path: "/state", value: spec.state };
  }
  for (const [key, element] of Object.entries(spec.elements)) {
    yield { op: "add", path: `/elements/${escapePointerToken(key)}`, value: element };
  }
}

/** Stream a validated spec as newline-delimited JSON Patch lines. */
function patchStream(spec: Spec, delayMs = PATCH_DELAY_MS): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for (const patch of specToPatches(spec)) {
        controller.enqueue(encoder.encode(JSON.stringify(patch) + "\n"));
        if (delayMs > 0) {
          await delay(delayMs);
        }
      }
      controller.close();
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !("question" in body)) {
      return NextResponse.json(
        { error: "question must be a string between 1 and 280 characters" },
        { status: 400 },
      );
    }
    const question = body.question;
    if (typeof question !== "string" || question.length === 0 || question.length > 280) {
      return NextResponse.json(
        { error: "question must be a string between 1 and 280 characters" },
        { status: 400 },
      );
    }

    const key = cacheKey(question);
    const cached = await kvGet(key);
    if (cached) {
      return NextResponse.json(JSON.parse(cached), { status: 200, headers: { "x-cache": "hit" } });
    }

    const model = getModel();
    const messages: ModelMessage[] = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserMessage(question) },
    ];

    let lastError = "Failed to generate a valid spec.";
    let lastOutput = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await streamText({ model, messages });
        let text = "";
        for await (const delta of result.textStream) {
          text += delta;
        }
        lastOutput = text;

        const parsed = JSON.parse(stripFences(text));
        if (!looksLikeSpec(parsed)) {
          throw new Error('Spec must be a JSON object with a string "root" field and an "elements" object.');
        }

        const { spec: fixed } = autoFixSpec(parsed);
        const validation = validateSpec(fixed);
        if (validation.valid) {
          const payload = JSON.stringify({ spec: fixed });
          await kvPut(key, payload);
          return new Response(patchStream(fixed, PATCH_DELAY_MS), {
            headers: {
              "Content-Type": "application/x-ndjson",
              "x-cache": "miss",
            },
          });
        }
        lastError = formatSpecIssues(validation.issues) || "Spec failed validation.";
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Output was not valid JSON.";
      }

      if (attempt < MAX_ATTEMPTS) {
        messages.push({ role: "assistant", content: lastOutput });
        messages.push({
          role: "user",
          content: `Your previous output was invalid: ${lastError}. Return ONLY the corrected JSON spec.`,
        });
      }
    }

    return NextResponse.json({ error: lastError }, { status: 422 });
  } catch (error) {
    console.error("Error in /api/generate:", error);
    return NextResponse.json({ error: "Failed to generate spec" }, { status: 500 });
  }
}

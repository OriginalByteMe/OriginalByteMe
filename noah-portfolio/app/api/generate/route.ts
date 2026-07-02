import { NextRequest, NextResponse } from "next/server";
import { generateText, type ModelMessage } from "ai";
import { validateSpec, autoFixSpec, formatSpecIssues, type Spec } from "@json-render/core";
import { getModel } from "@/lib/llm/openrouter";
import { buildSystemPrompt, buildUserMessage } from "@/lib/llm/prompt";
import { cacheKey } from "@/lib/cache/key";
import { kvGet, kvPut } from "@/lib/cache/kv";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 3;

/** Strip ```json / ``` fences some models wrap output in despite instructions not to. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const question = (body as { question?: unknown } | null)?.question;
    if (typeof question !== "string" || question.length === 0 || question.length > 280) {
      return NextResponse.json({ error: "question must be a string between 1 and 280 characters" }, { status: 400 });
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
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { text } = await generateText({ model, messages });

      try {
        const parsed = JSON.parse(stripFences(text));
        const looksLikeSpec =
          parsed !== null &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          typeof parsed.root === "string" &&
          typeof parsed.elements === "object" &&
          parsed.elements !== null &&
          !Array.isArray(parsed.elements);
        if (!looksLikeSpec) {
          throw new Error('Spec must be a JSON object with a string "root" field and an "elements" object.');
        }

        const { spec: fixed } = autoFixSpec(parsed as Spec);
        const validation = validateSpec(fixed);
        if (validation.valid) {
          const payload = JSON.stringify({ spec: fixed });
          await kvPut(key, payload);
          return NextResponse.json({ spec: fixed }, { status: 200, headers: { "x-cache": "miss" } });
        }
        lastError = formatSpecIssues(validation.issues) || "Spec failed validation.";
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Output was not valid JSON.";
      }

      if (attempt < MAX_ATTEMPTS) {
        messages.push({ role: "assistant", content: text });
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

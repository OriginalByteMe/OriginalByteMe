import { afterEach, describe, expect, it, vi } from "vitest";

import { SITE_EXAMPLE } from "@/lib/llm/examples";
import { SITE_RESPONSE_JSON_SCHEMA, generateSite } from "@/lib/llm/generate-site";
import { buildSiteSystemPrompt } from "@/lib/llm/prompt";
import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** An OpenRouter chat-completions SSE stream that sends `content` in one delta. */
function openRouterStream(content: string): Response {
  const base = { id: "gen", object: "chat.completion.chunk", created: 0, model: "anthropic/claude-haiku-5.5" };
  const chunk = (data: object) => `data: ${JSON.stringify({ ...base, ...data })}\n\n`;
  const body =
    chunk({ choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] }) +
    chunk({
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }) +
    "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("generateSite", () => {
  // Without the breakpoint every visitor pays full input price for the shared system prompt.
  it("marks the system prompt as an ephemeral cache breakpoint on the first and the repair request", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("OPENROUTER_PROVIDER_ORDER", undefined);
    vi.stubEnv("OPENROUTER_FALLBACK_MODELS", undefined);
    vi.stubEnv("OPENROUTER_BASE_URL", undefined);
    vi.stubEnv("OPENROUTER_REASONING_EFFORT", undefined);
    const replies = ["{not json", JSON.stringify(SITE_EXAMPLE)];
    const requests: { messages: unknown[] }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return openRouterStream(replies[requests.length - 1]);
    });
    const attempts: boolean[] = [];

    await generateSite("What did Noah build?", {
      signal: new AbortController().signal,
      onAttempt: (attempt) => attempts.push(attempt.ok),
    });

    expect(attempts).toEqual([false, true]);
    const cachedSystem = {
      role: "system",
      content: [{ type: "text", text: buildSiteSystemPrompt(), cache_control: { type: "ephemeral" } }],
    };
    expect(requests.map((request) => request.messages[0])).toEqual([cachedSystem, cachedSystem]);
  });
});

describe("SITE_RESPONSE_JSON_SCHEMA", () => {
  it("lets the model cite only Evidence ids from the active Corpus, on the hero and on every section", () => {
    const citation = { items: { type: "string", enum: CORPUS_EVIDENCE_REFS.map((ref) => ref.id) } };

    expect(SITE_RESPONSE_JSON_SCHEMA).toMatchObject({
      properties: {
        hero: { properties: { evidenceRefIds: citation } },
        sections: { items: { properties: { evidenceRefIds: citation } } },
      },
    });
  });
});

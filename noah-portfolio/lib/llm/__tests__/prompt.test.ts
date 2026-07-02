import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "@/lib/llm/prompt";

describe("buildSystemPrompt", () => {
  it("system prompt carries corpus rules + knowledge", () => {
    const p = buildSystemPrompt();
    expect(p).toContain("/corpus/");
    expect(p).toMatch(/off-topic/i);
    expect(p).toMatch(/Kuala Lumpur/);
  });

  it("instructs a single non-streamed JSON object with no fences", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/single.*JSON object/i);
    expect(p).toMatch(/no markdown/i);
  });
});

describe("buildUserMessage", () => {
  it("includes the visitor's question", () => {
    const msg = buildUserMessage("What projects have you built?");
    expect(msg).toContain("What projects have you built?");
  });

  it("includes a snapshot of the corpus state for grounding", () => {
    const msg = buildUserMessage("Tell me about your career");
    expect(msg).toContain("careerTimeline");
    expect(msg).toContain("Supa");
  });
});

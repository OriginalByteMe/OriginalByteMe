import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "@/lib/llm/prompt";

describe("buildSystemPrompt", () => {
  it("still carries the corpus grounding rules + knowledge", () => {
    const p = buildSystemPrompt();
    expect(p).toContain("/corpus/");
    expect(p).toMatch(/Kuala Lumpur/);
  });

  it("instructs a single non-streamed JSON object with no fences", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/single.*JSON object/i);
    expect(p).toMatch(/no markdown/i);
  });

  it("steers the model to chapter answers into Scenes (2-3 blocks)", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/CHAPTER SUBSTANTIAL ANSWERS INTO SCENES/i);
    expect(p).toMatch(/2-3 child blocks/);
    expect(p).toMatch(/Child order.*reveal order/i);
    expect(p).toMatch(/Scene order.*chapter order/i);
  });

  it("mandates StaticComposition for short answers", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/StaticComposition FOR SHORT ANSWERS/i);
  });

  it("teaches the backdrop preset allowlist via the state path", () => {
    const p = buildSystemPrompt();
    expect(p).toContain("/backdrop/preset");
    expect(p).toContain("softField");
    expect(p).toContain("nightMatte");
    expect(p).toMatch(/allowlist/i);
    // Free-form shader params are explicitly forbidden.
    expect(p).toMatch(/never emit free-form shader parameters/i);
  });

  it("requires first-person Noah voice in connective text", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/first person as Noah/i);
    expect(p).toMatch(/Noah's voice/);
  });

  it("calls out display moments (StatReveal, Quote)", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/DISPLAY MOMENTS/i);
    expect(p).toContain("StatReveal");
    expect(p).toContain("Quote");
  });

  it("keeps the off-topic redirect rule", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/off-topic/i);
  });

  it("injects the few-shot story examples (scenes + static)", () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/Story-shaped spec examples/i);
    // Example A: the benchmark story in scenes mode.
    expect(p).toMatch(/Example A.*scenes mode/i);
    expect(p).toContain("What does Noah do for work?");
    expect(p).toContain('"type": "Scene"');
    expect(p).toContain('"type": "ChapterHeading"');
    expect(p).toContain('"type": "NarrativeBeat"');
    expect(p).toContain('"type": "StatReveal"');
    expect(p).toContain('"type": "SequencedTimeline"');
    // Example B: the short static-mode answer.
    expect(p).toMatch(/Example B.*static mode/i);
    expect(p).toContain('"type": "StaticComposition"');
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

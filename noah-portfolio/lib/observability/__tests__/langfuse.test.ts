import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withStoryTrace } from "@/lib/observability/langfuse";
import type { StoryTrace } from "@/lib/observability/langfuse";

beforeEach(() => {
  vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
  vi.stubEnv("LANGFUSE_SECRET_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Langfuse observability", () => {
  it("runs the Story callback once with a no-op trace when disabled", async () => {
    const fn = vi.fn(async (trace: StoryTrace) => {
      expect(trace.setOutput).toEqual(expect.any(Function));
      expect(() => trace.setOutput({ storyId: "story-1" })).not.toThrow();
      return "generated-story";
    });

    await expect(withStoryTrace("Tell me a story", fn)).resolves.toBe("generated-story");
    expect(fn).toHaveBeenCalledOnce();
  });
});

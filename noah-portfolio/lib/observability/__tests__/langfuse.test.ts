import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLangfuseEnabled,
  storyTelemetry,
  withStoryTrace,
} from "@/lib/observability/langfuse";
import type { StoryTrace } from "@/lib/observability/langfuse";

beforeEach(() => {
  vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
  vi.stubEnv("LANGFUSE_SECRET_KEY", "");
  vi.stubEnv("LANGFUSE_BASE_URL", "");
  vi.stubEnv("LANGFUSE_BASEURL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Langfuse observability", () => {
  it("reports whether Langfuse credentials are configured", () => {
    expect(isLangfuseEnabled()).toBe(false);

    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "public-key");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "secret-key");

    expect(isLangfuseEnabled()).toBe(true);
  });

  it("disables Story telemetry when Langfuse is unconfigured", () => {
    expect(storyTelemetry("story-scene", { scene: 2 })).toEqual({
      isEnabled: false,
    });
  });

  it("configures Story telemetry with optional metadata when enabled", () => {
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "public-key");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "secret-key");

    expect(storyTelemetry("story-scene", { scene: 2 })).toEqual({
      isEnabled: true,
      functionId: "story-scene",
      metadata: { scene: 2 },
    });
    expect(storyTelemetry("story-scene")).toEqual({
      isEnabled: true,
      functionId: "story-scene",
    });
  });

  it("runs the Story callback once with a no-op trace when disabled", async () => {
    const fn = vi.fn(async (trace: StoryTrace) => {
      expect(trace.setOutput).toEqual(expect.any(Function));
      expect(() => trace.setOutput({ storyId: "story-1" })).not.toThrow();
      return "generated-story";
    });

    await expect(withStoryTrace("Tell me a story", fn)).resolves.toBe("generated-story");
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ setOutput: expect.any(Function) }),
    );
  });
});

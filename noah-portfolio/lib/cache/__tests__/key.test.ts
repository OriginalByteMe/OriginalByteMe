import { describe, it, expect } from "vitest";
import { normalizeQuestion, cacheKey } from "@/lib/cache/key";
import { CATALOG_VERSION } from "@/lib/jsonui/catalogVersion";

describe("normalizeQuestion", () => {
  it("normalizes case + whitespace", () => {
    expect(normalizeQuestion("  What  Does Noah DO? ")).toBe("what does noah do?");
  });
});

describe("cacheKey", () => {
  it("namespaces by catalog version", () => {
    expect(cacheKey("x")).toMatch(/:v\d+$/);
  });

  it("uses the current CATALOG_VERSION", () => {
    expect(cacheKey("x")).toBe(`x:${CATALOG_VERSION}`);
  });

  it("maps equivalent questions to the same key", () => {
    expect(cacheKey("What projects have you built?")).toBe(cacheKey("  what projects have you built?  "));
  });
});

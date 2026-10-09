import { describe, expect, it } from "vitest";
import { costUsdPer1000Sites, type BenchmarkModel } from "@/lib/benchmark/data";

const model = { meanPromptTokens: 10_000, meanCompletionTokens: 600 } as BenchmarkModel;

describe("costUsdPer1000Sites", () => {
  it("prices input and output tokens per million at their own rates", () => {
    // 1,000 sites × (10,000 × $1 + 600 × $5) / 1,000,000 = $13.
    const pricing = { inputUsdPerMTok: 1, outputUsdPerMTok: 5, pricedAt: "2026-10-09" };
    expect(costUsdPer1000Sites({ ...model, pricing })).toBeCloseTo(13);
  });

  it("is zero for a self-hosted model with no price", () => {
    expect(costUsdPer1000Sites(model)).toBe(0);
  });
});

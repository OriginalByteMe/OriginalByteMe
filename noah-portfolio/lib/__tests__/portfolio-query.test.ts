import { describe, expect, it } from "vitest";

import { normalizePortfolioQuery } from "@/lib/portfolio-query";

describe("normalizePortfolioQuery", () => {
  it("uses and trims only the first query value", () => {
    expect(normalizePortfolioQuery(["  first question  ", "second question"])).toBe(
      "first question",
    );
  });

  it("limits normalized questions to the supported input length", () => {
    expect(normalizePortfolioQuery(`  ${"q".repeat(281)}  `)).toHaveLength(280);
  });

  it("normalizes missing and whitespace-only values to no query", () => {
    expect(normalizePortfolioQuery(undefined)).toBe("");
    expect(normalizePortfolioQuery(null)).toBe("");
    expect(normalizePortfolioQuery("   ")).toBe("");
  });
});

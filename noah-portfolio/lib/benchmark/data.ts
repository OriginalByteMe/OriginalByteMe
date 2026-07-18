import raw from "./results.json";

export type ModelVerdict = "default" | "finalist" | "eliminated" | "candidate";

export interface ModelPricing {
  /** USD per single prompt token (OpenRouter units). */
  promptUsdPerTok: number;
  /** USD per single completion token (OpenRouter units). */
  completionUsdPerTok: number;
  /** ISO date this model's OpenRouter pricing snapshot was taken. */
  pricedAt: string;
}

export interface BenchmarkModel {
  /** OpenRouter slug, e.g. "z-ai/glm-5.2". */
  id: string;
  /** Human display name. */
  label: string;
  /** Stories attempted for this model (denominator for plan rates). */
  stories: number;
  /** Fraction of Stories whose plan validated on attempt 1 (0–1). */
  planFirstTryValid: number;
  /** Fraction of Stories whose plan validated after repair (0–1). */
  planFinalValid: number;
  /** Fraction of scene cases that validated (0–1). */
  scenesValid: number;
  /** Worst cross-scene body-token Jaccard similarity; lower is better. */
  repetitionMax: number;
  /** Mean cross-scene body-token Jaccard similarity; lower is better. */
  repetitionMean: number;
  /** Banned filler-phrase occurrences across all scene bodies. */
  bannedPhrases: number;
  /** Mean wall-clock milliseconds per Story. */
  meanStoryMs: number;
  /** Prompt tokens across the whole run (all stories). */
  promptTokens: number;
  /** Completion tokens across the whole run (all stories). */
  completionTokens: number;
  /** OpenRouter pricing snapshot; absent for local/free models. */
  pricing?: ModelPricing;
  verdict: ModelVerdict;
  note: string;
  /** ISO date this model's pipeline run was measured. */
  runDate: string;
}

export interface BenchmarkResults {
  benchmark: string;
  /** Why the $ figures are estimates, not measured spend. Surface wherever cost is charted. */
  pricingNote: string;
  source: string;
  models: BenchmarkModel[];
}

/** Unique pricing-snapshot dates across models, oldest first (for chart footnotes). */
export function pricingSnapshotDates(results: BenchmarkResults): string[] {
  const dates = new Set<string>();
  for (const model of results.models) if (model.pricing) dates.add(model.pricing.pricedAt);
  return [...dates].sort();
}

/** Unique measurement dates across models, oldest first (for page copy). */
export function runDates(results: BenchmarkResults): string[] {
  const dates = new Set<string>();
  for (const model of results.models) dates.add(model.runDate);
  return [...dates].sort();
}

/** Unique per-model story sample sizes, ascending (for page copy). */
export function storySampleSizes(results: BenchmarkResults): number[] {
  const sizes = new Set<number>();
  for (const model of results.models) sizes.add(model.stories);
  return [...sizes].sort((a, b) => a - b);
}

export const benchmark = raw as BenchmarkResults;

/**
 * Estimated USD per Story: run token totals × the pricing snapshot, over
 * stories attempted. An estimate — see {@link BenchmarkResults.pricingNote}.
 */
export function costUsdPerStory(model: BenchmarkModel): number | undefined {
  if (!model.pricing || !model.stories) return undefined;
  const runCost =
    model.promptTokens * model.pricing.promptUsdPerTok +
    model.completionTokens * model.pricing.completionUsdPerTok;
  return runCost / model.stories;
}


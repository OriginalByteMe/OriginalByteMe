import raw from "./results.json";

export interface ModelPricing {
  /** List price in USD per million input tokens. */
  inputUsdPerMTok: number;
  /** List price in USD per million output tokens. */
  outputUsdPerMTok: number;
  /** ISO date the list price was checked. */
  pricedAt: string;
}

/**
 * One model's run of the full site eval, upserted by `scripts/story-model-eval.ts --results`.
 * `label`, `host` and `pricing` are written by hand and kept across reruns; the rest is measured.
 */
export interface BenchmarkModel {
  /** Model id the eval called, e.g. "qwen3.5:0.8b". */
  id: string;
  label: string;
  /** Where the model ran. */
  host: string;
  /** Absent for self-hosted models, which cost nothing per site. */
  pricing?: ModelPricing;
  /** ISO time the run finished. */
  runAt: string;
  questions: number;
  firstTryValid: number;
  /** Valid after at most one repair call. */
  finalValid: number;
  /** Valid sites in the expected mode: grounded for answerable questions, boundary otherwise. */
  rightMode: number;
  boundaryQuestions: number;
  /** Boundary questions answered with an honest boundary page. */
  boundaryRight: number;
  /** Questions with an expected layout, and the valid sites among them that used it. */
  layoutTagged: number;
  layoutFit: number;
  bannedPhrases: number;
  /** Mean wall-clock milliseconds per site, repair included. */
  meanMs: number;
  /** Mean tokens per site, summed over every attempt. */
  meanPromptTokens: number;
  meanCompletionTokens: number;
}

export interface BenchmarkResults {
  /** The eval command that produced these rows. */
  source: string;
  /** How the paid reference's cost was estimated. Shown beside the cost column. */
  pricingNote: string;
  /** Questions with no single expected layout, left out of layout fit. */
  untaggedLayoutQuestions: string[];
  models: BenchmarkModel[];
}

export const benchmark = raw as BenchmarkResults;

/** Estimated USD per 1,000 sites at list price, without prompt caching; zero for self-hosted models. */
export function costUsdPer1000Sites(model: BenchmarkModel): number {
  if (!model.pricing) return 0;
  const { inputUsdPerMTok, outputUsdPerMTok } = model.pricing;
  return (model.meanPromptTokens * inputUsdPerMTok + model.meanCompletionTokens * outputUsdPerMTok) / 1000;
}

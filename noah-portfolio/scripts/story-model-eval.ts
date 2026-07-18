// Refresh benchmark data: npm run eval -- --pipeline --models <slug> --out lib/benchmark/results.json

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import {
  BANNED_PHRASES,
  buildSceneRepairMessage,
  buildSceneSystemPrompt,
  buildSceneUserMessage,
  buildSystemPrompt,
  buildUserMessage,
} from "../lib/llm/prompt";
import {
  CORPUS_EVIDENCE_REFS,
  resolveStoryProjects,
} from "../lib/story/evidence";
import type { ScenePlan, StoryPlan } from "../lib/story/types";
import type { BenchmarkModel, BenchmarkResults, ModelPricing } from "../lib/benchmark/data";
import {
  assertValidStoryPlan,
  assertValidStoryPlanWithEvidence,
  assertValidStorySceneWithEvidence,
  validateCanonicalStoryEvidence,
  type ValidatedStoryEvidence,
} from "../lib/story/validation";

type ModelConfig = {
  name: string;
  model: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type TaskName = "plan" | "scene";
type AttemptTotals = {
  attempts: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
};

type Metrics = AttemptTotals & {
  model: string;
  task: TaskName;
  cases: number;
  jsonParsed: number;
  firstTryValid: number;
  finalValid: number;
  repairRescued: number;
  fallbackNeeded: number;
  sampleBody?: string;
  note?: string;
  bodies?: string[];
};

const MODELS: ModelConfig[] = [
  {
    name: "deepseek",
    model: "deepseek/deepseek-v4-flash",
  },
];

const QUESTIONS = [
  "How does Noah turn complex systems into products?",
  "Which projects best show Noah's technical range?",
  "What experience does Noah bring to product engineering?",
  "How does Noah combine design thinking with engineering?",
  "Which technologies and systems does Noah work with?",
] as const;

// Copied from the canonical Story fixture so scene quality is compared against one locked Plan.
const SCENE_PLAN_FIXTURE = {
  question: "How does Noah turn complex systems into products?",
  mode: "grounded",
  backdropPreset: "ditherTide",
  scenes: [
    {
      id: "direct-answer",
      index: 0,
      role: "direct-answer",
      pattern: "hero-statement",
      register: "editorial",
      title: "Systems become usable products",
      claim: "Noah turns complex systems into products by pairing technical depth with a clear product narrative.",
      assetId: "circuit-mind",
      evidenceRefIds: ["bio-headline"],
      cue: { phase: "intro", focus: "center", intensity: "quiet" },
    },
    {
      id: "grounded-evidence",
      index: 1,
      role: "evidence",
      pattern: "evidence-ledger",
      register: "technical",
      title: "Evidence from shipped work",
      claim: "Shipped project evidence connects product decisions to concrete implementation work.",
      assetId: "print-layers",
      evidenceRefIds: ["bio-location", "bio-summary"],
      projectSlugs: ["ask-me-portfolio", "llm-comparison"],
      cue: { phase: "develop", focus: "left", intensity: "strong" },
    },
    {
      id: "closing-view",
      index: 2,
      role: "synthesis",
      pattern: "closing-synthesis",
      register: "reflective",
      title: "Craft meets delivery",
      claim: "The result is practical systems work shaped around what people need to understand and use.",
      assetId: "morning-coffee",
      evidenceRefIds: ["bio-headline", "bio-summary"],
      projectSlugs: ["moodify"],
      cue: { phase: "resolve", focus: "right", intensity: "medium" },
    },
  ],
  relatedQuestions: [
    "Which projects best show Noah's technical range?",
    "How does Noah balance engineering and design?",
  ],
} satisfies StoryPlan;

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function complete(
  model: ModelConfig,
  system: string,
  messages: ChatMessage[],
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const result = await generateText({
    model: createOpenRouter({ apiKey })(model.model),
    system,
    messages,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(120_000),
  });
  return {
    text: result.text,
    promptTokens: result.usage.inputTokens ?? 0,
    completionTokens: result.usage.outputTokens ?? 0,
  };
}

async function modelAttempt(
  model: ModelConfig,
  system: string,
  messages: ChatMessage[],
  metrics: AttemptTotals,
): Promise<string> {
  metrics.attempts += 1;
  const started = performance.now();
  try {
    const result = await complete(model, system, messages);
    metrics.promptTokens += result.promptTokens;
    metrics.completionTokens += result.completionTokens;
    return result.text;
  } finally {
    metrics.latencyMs += performance.now() - started;
  }
}

function parseSceneBody(parsed: unknown): string {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !("body" in parsed) ||
    typeof parsed.body !== "string"
  ) {
    throw new Error('Scene composition must contain only a string "body" field.');
  }
  return parsed.body;
}

function fixtureEvidence(): ValidatedStoryEvidence {
  assertValidStoryPlan(SCENE_PLAN_FIXTURE, CORPUS_EVIDENCE_REFS, SCENE_PLAN_FIXTURE.question);
  const usedIds = new Set(SCENE_PLAN_FIXTURE.scenes.flatMap((scene) => scene.evidenceRefIds));
  const evidence = validateCanonicalStoryEvidence(
    CORPUS_EVIDENCE_REFS.filter((ref) => usedIds.has(ref.id)),
  );
  assertValidStoryPlanWithEvidence(SCENE_PLAN_FIXTURE, evidence, SCENE_PLAN_FIXTURE.question);
  return evidence;
}
function evidenceForPlan(plan: StoryPlan, expectedQuestion: string): ValidatedStoryEvidence {
  const usedIds = new Set(plan.scenes.flatMap((scene) => scene.evidenceRefIds));
  const evidence = validateCanonicalStoryEvidence(
    CORPUS_EVIDENCE_REFS.filter((ref) => usedIds.has(ref.id)),
  );
  assertValidStoryPlanWithEvidence(plan, evidence, expectedQuestion);
  return evidence;
}

function emptyMetrics(model: ModelConfig, task: TaskName, cases: number): Metrics {
  return {
    model: `${model.name} (${model.model})`,
    task,
    cases,
    attempts: 0,
    jsonParsed: 0,
    firstTryValid: 0,
    finalValid: 0,
    repairRescued: 0,
    fallbackNeeded: 0,
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
  };
}

async function evaluatePlans(model: ModelConfig, questions: readonly string[]): Promise<Metrics> {
  const metrics = emptyMetrics(model, "plan", questions.length);

  for (const question of questions) {
    const messages: ChatMessage[] = [{ role: "user", content: buildUserMessage(question) }];
    let output = "";
    let lastError = "The model did not return a valid Story Plan.";
    let passed = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        output = await modelAttempt(model, buildSystemPrompt(), messages, metrics);
        const parsed: unknown = JSON.parse(stripFences(output));
        metrics.jsonParsed += 1;
        assertValidStoryPlan(parsed, CORPUS_EVIDENCE_REFS, question);
        if (attempt === 0) metrics.firstTryValid += 1;
        else metrics.repairRescued += 1;
        metrics.finalValid += 1;
        passed = true;
        break;
      } catch (error) {
        lastError = errorMessage(error);
      }

      if (attempt === 0) {
        messages.push({ role: "assistant", content: output });
        messages.push({
          role: "user",
          content: `The Story Plan was invalid: ${lastError}\nReturn only a corrected complete Plan. Do not invent Evidence Refs, Motion Asset IDs, or project slugs.`,
        });
      }
    }

    if (!passed) {
      metrics.fallbackNeeded += 1;
      metrics.note = lastError;
    }
  }

  return metrics;
}

async function evaluateScenes(
  model: ModelConfig,
  question: string,
  storyOutline: readonly Pick<ScenePlan, "index" | "role" | "title" | "claim">[],
  scenes: readonly ScenePlan[],
  storyEvidence: ValidatedStoryEvidence,
): Promise<Metrics & { bodies: string[] }> {
  const metrics = { ...emptyMetrics(model, "scene", scenes.length), bodies: [] as string[] };

  for (const lockedPlan of scenes) {
    const lockedEvidence = storyEvidence.refs.filter((ref) => lockedPlan.evidenceRefIds.includes(ref.id));
    const resolvedProjects = resolveStoryProjects(lockedPlan.projectSlugs);
    const system = buildSceneSystemPrompt(question, storyOutline, lockedPlan, lockedEvidence);
    const messages: ChatMessage[] = [{ role: "user", content: buildSceneUserMessage() }];
    let output = "";
    let lastError = "The model did not return a valid Scene body.";
    let passed = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        output = await modelAttempt(model, system, messages, metrics);
        const parsed: unknown = JSON.parse(stripFences(output));
        metrics.jsonParsed += 1;
        const body = parseSceneBody(parsed);
        const scene: unknown = {
          ...lockedPlan,
          body,
          ...(resolvedProjects ? { projects: resolvedProjects } : {}),
        };
        assertValidStorySceneWithEvidence(scene, lockedPlan, storyEvidence);
        if (attempt === 0) metrics.firstTryValid += 1;
        else metrics.repairRescued += 1;
        metrics.finalValid += 1;
        metrics.sampleBody ??= body;
        metrics.bodies.push(body);
        passed = true;
        break;
      } catch (error) {
        lastError = errorMessage(error);
      }

      if (attempt === 0) {
        messages.push({ role: "assistant", content: output });
        messages.push({ role: "user", content: buildSceneRepairMessage(output, lastError) });
      }
    }

    if (!passed) {
      metrics.fallbackNeeded += 1;
      metrics.sampleBody ??= lockedPlan.claim;
      metrics.note = lastError;
      metrics.bodies.push(lockedPlan.claim.trim());
    }
  }

  return metrics;
}
type PipelineMetrics = AttemptTotals & {
  model: string;
  modelId: string;
  stories: number;
  planFirstTryValid: number;
  planFinalValid: number;
  sceneCases: number;
  scenesValid: number;
  measuredStories: number;
  repetitionMaxTotal: number;
  repetitionMeanTotal: number;
  bannedPhraseCount: number;
  storyLatencyMs: number;
};


type OpenRouterPricing = Omit<ModelPricing, "pricedAt">;
type PricingByModel = Readonly<Partial<Record<string, OpenRouterPricing>>>;

const DEFAULT_PRICING_NOTE =
  "Costs are estimates: run token totals × one OpenRouter price snapshot per model. The eval used auto-routing, and per-provider endpoint prices vary.";

function benchmarkLabel(modelId: string): string {
  return (modelId.split("/").at(-1) ?? modelId)
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function benchmarkModel(
  metrics: PipelineMetrics,
  existing: BenchmarkModel | undefined,
  pricing: ModelPricing | undefined,
  runDate: string,
): BenchmarkModel {
  return {
    id: metrics.modelId,
    label: existing?.label ?? benchmarkLabel(metrics.modelId),
    stories: metrics.stories,
    planFirstTryValid: metrics.stories ? metrics.planFirstTryValid / metrics.stories : 0,
    planFinalValid: metrics.stories ? metrics.planFinalValid / metrics.stories : 0,
    scenesValid: metrics.sceneCases ? metrics.scenesValid / metrics.sceneCases : 0,
    repetitionMax: metrics.measuredStories
      ? metrics.repetitionMaxTotal / metrics.measuredStories
      : 0,
    repetitionMean: metrics.measuredStories
      ? metrics.repetitionMeanTotal / metrics.measuredStories
      : 0,
    bannedPhrases: metrics.bannedPhraseCount,
    meanStoryMs: metrics.stories ? Math.round(metrics.storyLatencyMs / metrics.stories) : 0,
    promptTokens: metrics.promptTokens,
    completionTokens: metrics.completionTokens,
    ...(pricing ? { pricing } : {}),
    verdict: existing?.verdict ?? "candidate",
    note: existing?.note ?? "",
    runDate,
  };
}

export function mergePipelineResults(
  metrics: readonly PipelineMetrics[],
  existing: BenchmarkResults | undefined,
  pricing: PricingByModel,
  runDate: string,
): BenchmarkResults {
  const measured = new Map(
    metrics.map((result) => {
      const freshPricing = pricing[result.modelId];
      const existingModel = existing?.models.find((model) => model.id === result.modelId);
      return [
        result.modelId,
        benchmarkModel(
          result,
          existingModel,
          freshPricing
            ? { ...freshPricing, pricedAt: runDate }
            : existingModel?.pricing,
          runDate,
        ),
      ];
    }),
  );
  const existingIds = new Set(existing?.models.map((model) => model.id));
  const models = [
    ...(existing?.models.map((model) => measured.get(model.id) ?? model) ?? []),
    ...metrics
      .filter((result) => !existingIds.has(result.modelId))
      .map((result) => measured.get(result.modelId)!),
  ];
  return {
    benchmark: existing?.benchmark ?? "story-pipeline",
    pricingNote: existing?.pricingNote ?? DEFAULT_PRICING_NOTE,
    source: existing?.source ?? "scripts/story-model-eval.ts --pipeline",
    models,
  };
}

async function openRouterPricing(modelIds: readonly string[]): Promise<PricingByModel> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as {
      data?: Array<{
        id?: string;
        pricing?: { prompt?: string; completion?: string };
      }>;
    };
    const pricing: Partial<Record<string, OpenRouterPricing>> = {};
    for (const modelId of modelIds) {
      const match = payload.data?.find((model) => model.id === modelId);
      const promptUsdPerTok = Number(match?.pricing?.prompt);
      const completionUsdPerTok = Number(match?.pricing?.completion);
      if (
        match &&
        Number.isFinite(promptUsdPerTok) &&
        Number.isFinite(completionUsdPerTok)
      ) {
        pricing[modelId] = { promptUsdPerTok, completionUsdPerTok };
      } else {
        console.error(`Warning: Fresh OpenRouter pricing not found for ${modelId}.`);
      }
    }
    return pricing;
  } catch (error) {
    console.error(
      `Warning: OpenRouter pricing fetch failed (${errorMessage(error)}); no fresh pricing for ${modelIds.join(", ")}.`,
    );
    return {};
  }
}

async function readBenchmarkResults(path: string): Promise<BenchmarkResults | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as BenchmarkResults;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function repetitionMetrics(sceneBodies: readonly string[]): { max: number; mean: number } {
  const trigrams = sceneBodies.map((body) => {
    const words = body.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    return new Set(words.slice(0, -2).map((_, index) => words.slice(index, index + 3).join(" ")));
  });
  const similarities: number[] = [];
  for (let left = 0; left < trigrams.length; left += 1) {
    for (let right = left + 1; right < trigrams.length; right += 1) {
      let intersection = 0;
      for (const gram of trigrams[left]) {
        if (trigrams[right].has(gram)) intersection += 1;
      }
      const union = trigrams[left].size + trigrams[right].size - intersection;
      similarities.push(union ? intersection / union : 0);
    }
  }
  return {
    max: similarities.length ? Math.max(...similarities) : 0,
    mean: similarities.length
      ? similarities.reduce((total, similarity) => total + similarity, 0) / similarities.length
      : 0,
  };
}

function bannedPhraseOccurrences(sceneBodies: readonly string[]): number {
  return sceneBodies.reduce((storyTotal, body) => {
    const lower = body.toLowerCase();
    return storyTotal + BANNED_PHRASES.reduce(
      (bodyTotal, phrase) => bodyTotal + lower.split(phrase.toLowerCase()).length - 1,
      0,
    );
  }, 0);
}

function emptyPipelineMetrics(model: ModelConfig, stories: number): PipelineMetrics {
  return {
    model: `${model.name} (${model.model})`,
    modelId: model.model,
    stories,
    attempts: 0,
    latencyMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    planFirstTryValid: 0,
    planFinalValid: 0,
    sceneCases: 0,
    scenesValid: 0,
    measuredStories: 0,
    repetitionMaxTotal: 0,
    repetitionMeanTotal: 0,
    bannedPhraseCount: 0,
    storyLatencyMs: 0,
  };
}

async function generatePipelinePlan(
  model: ModelConfig,
  question: string,
  metrics: PipelineMetrics,
): Promise<StoryPlan | undefined> {
  const messages: ChatMessage[] = [{ role: "user", content: buildUserMessage(question) }];
  let output = "";
  let lastError = "The model did not return a valid Story Plan.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      output = await modelAttempt(model, buildSystemPrompt(), messages, metrics);
      const parsed: unknown = JSON.parse(stripFences(output));
      assertValidStoryPlan(parsed, CORPUS_EVIDENCE_REFS, question);
      if (attempt === 0) metrics.planFirstTryValid += 1;
      metrics.planFinalValid += 1;
      return parsed;
    } catch (error) {
      lastError = errorMessage(error);
    }

    if (attempt === 0) {
      messages.push({ role: "assistant", content: output });
      messages.push({
        role: "user",
        content: `The Story Plan was invalid: ${lastError}\nReturn only a corrected complete Plan. Do not invent Evidence Refs, Motion Asset IDs, or project slugs.`,
      });
    }
  }
  return undefined;
}

async function evaluatePipeline(
  model: ModelConfig,
  questions: readonly string[],
): Promise<PipelineMetrics> {
  const metrics = emptyPipelineMetrics(model, questions.length);

  for (const question of questions) {
    const storyStarted = performance.now();
    try {
      const plan = await generatePipelinePlan(model, question, metrics);
      if (!plan) continue;
      const evidence = evidenceForPlan(plan, question);
      if (plan.mode === "boundary") continue;
      const sceneMetrics = await evaluateScenes(
        model,
        question,
        plan.scenes,
        plan.scenes,
        evidence,
      );
      metrics.attempts += sceneMetrics.attempts;
      metrics.latencyMs += sceneMetrics.latencyMs;
      metrics.promptTokens += sceneMetrics.promptTokens;
      metrics.completionTokens += sceneMetrics.completionTokens;
      metrics.sceneCases += sceneMetrics.cases;
      metrics.scenesValid += sceneMetrics.finalValid;
      metrics.measuredStories += 1;
      const repetition = repetitionMetrics(sceneMetrics.bodies);
      metrics.repetitionMaxTotal += repetition.max;
      metrics.repetitionMeanTotal += repetition.mean;
      metrics.bannedPhraseCount += bannedPhraseOccurrences(sceneMetrics.bodies);
    } finally {
      metrics.storyLatencyMs += performance.now() - storyStarted;
    }
  }
  return metrics;
}

function pipelineTable(metrics: PipelineMetrics[]): string {
  const rows = metrics.map((result) => {
    const repetitionMax = result.measuredStories
      ? (result.repetitionMaxTotal / result.measuredStories).toFixed(3)
      : "—";
    const repetitionMean = result.measuredStories
      ? (result.repetitionMeanTotal / result.measuredStories).toFixed(3)
      : "—";
    return `| ${result.model} | ${percent(result.planFirstTryValid, result.stories)} | ${percent(result.planFinalValid, result.stories)} | ${percent(result.scenesValid, result.sceneCases)} | ${repetitionMax} | ${repetitionMean} | ${result.bannedPhraseCount} | ${result.stories ? Math.round(result.storyLatencyMs / result.stories) : "—"} | ${result.promptTokens} | ${result.completionTokens} |`;
  });
  return [
    "| Model | Plan first-try valid | Plan final valid | Scenes valid | Repetition max | Repetition mean | Banned phrases | Mean story ms | Prompt tokens | Completion tokens |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows,
  ].join("\n");
}

function percent(count: number, total: number): string {
  return total ? `${((count / total) * 100).toFixed(0)}%` : "—";
}

function table(metrics: Metrics[]): string {
  const rows = metrics.map((result) => {
    const sample = [result.note, result.sampleBody]
      .filter((value) => value !== undefined)
      .join(" — ")
      .replace(/\s+/g, " ")
      .replaceAll("|", "\\|")
      .slice(0, 120) || "—";
    return `| ${result.model} | ${result.task} | ${result.cases} | ${result.attempts} | ${percent(result.jsonParsed, result.attempts)} | ${percent(result.finalValid, result.attempts)} | ${percent(result.firstTryValid, result.cases)} | ${percent(result.finalValid, result.cases)} | ${result.repairRescued} | ${result.fallbackNeeded} | ${result.attempts ? Math.round(result.latencyMs / result.attempts) : "—"} | ${sample} |`;
  });
  return [
    "| Model | Task | Cases | Attempts | JSON parse/attempt | Valid/attempt | First-try valid (cases) | Final valid (cases) | Repair rescued | Fallback needed | Mean ms | Sample / note |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...rows,
  ].join("\n");
}

function resolveModels(requested?: string): ModelConfig[] {
  const names = requested?.split(",").map((name) => name.trim()).filter(Boolean);
  if (!names?.length) return MODELS;
  return names.map((name) => {
    const configured = MODELS.find((model) => model.name === name);
    if (configured) return configured;
    if (name.includes("/")) return { name, model: name };
    throw new Error(
      `Unknown model "${name}". Choose ${MODELS.map((model) => model.name).join(", ")} or pass an OpenRouter slug containing "/".`,
    );
  });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      models: { type: "string" },
      out: { type: "string" },
      quick: { type: "boolean" },
      pipeline: { type: "boolean" },
      "self-test": { type: "boolean" },
    },
  });
  if (values.out && !values.pipeline) throw new Error("--out requires --pipeline");
  if (values.out && values.quick) throw new Error("--quick cannot be combined with --out");
  if (values["self-test"]) {
    const bodies = [
      "One two three four.",
      "One two three five.",
      "Nothing shared here now.",
    ];
    const first = repetitionMetrics(bodies);
    const second = repetitionMetrics(bodies);
    const slug = "qwen/qwen3-30b-a3b";
    const selected = resolveModels(slug);
    const pipelineMetrics: PipelineMetrics[] = [
      {
        model: "Existing (vendor/existing)",
        modelId: "vendor/existing",
        stories: 2,
        attempts: 5,
        latencyMs: 100,
        promptTokens: 120,
        completionTokens: 80,
        planFirstTryValid: 1,
        planFinalValid: 2,
        sceneCases: 4,
        scenesValid: 3,
        measuredStories: 2,
        repetitionMaxTotal: 0.4,
        repetitionMeanTotal: 0.2,
        bannedPhraseCount: 3,
        storyLatencyMs: 201,
      },
      {
        model: "New (vendor/new-model)",
        modelId: "vendor/new-model",
        stories: 0,
        attempts: 0,
        latencyMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        planFirstTryValid: 0,
        planFinalValid: 0,
        sceneCases: 0,
        scenesValid: 0,
        measuredStories: 0,
        repetitionMaxTotal: 0,
        repetitionMeanTotal: 0,
        bannedPhraseCount: 0,
        storyLatencyMs: 0,
      },
    ];
    const existingResults: BenchmarkResults = {
      benchmark: "story-pipeline",
      pricingNote: "Existing pricing note",
      source: "existing source",
      models: [
        {
          id: "vendor/existing",
          label: "Existing Label",
          stories: 5,
          planFirstTryValid: 0,
          planFinalValid: 0,
          scenesValid: 0,
          repetitionMax: 0,
          repetitionMean: 0,
          bannedPhrases: 0,
          meanStoryMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          pricing: {
            promptUsdPerTok: 0.003,
            completionUsdPerTok: 0.004,
            pricedAt: "2026-07-17",
          },
          verdict: "finalist",
          note: "Keep this note",
          runDate: "2026-07-17",
        },
      ],
    };
    const merged = mergePipelineResults(
      pipelineMetrics,
      existingResults,
      {
        "vendor/existing": {
          promptUsdPerTok: 0.001,
          completionUsdPerTok: 0.002,
        },
      },
      "2026-07-18",
    );
    const withoutFreshPricing = mergePipelineResults(
      pipelineMetrics,
      existingResults,
      {},
      "2026-07-18",
    );
    const partialExistingResults: BenchmarkResults = {
      ...existingResults,
      models: [
        ...existingResults.models,
        {
          ...existingResults.models[0]!,
          id: "vendor/untouched",
          label: "Untouched",
        },
      ],
    };
    const partialMerge = mergePipelineResults(
      [pipelineMetrics[0]!],
      partialExistingResults,
      {},
      "2026-07-18",
    );
    const retainedPricing = withoutFreshPricing.models.find(
      (model) => model.id === "vendor/existing",
    )?.pricing;
    const existingModel = merged.models.find((model) => model.id === "vendor/existing");
    const candidate = merged.models.find((model) => model.id === "vendor/new-model");
    assert.deepEqual(
      {
        planFirstTryValid: existingModel?.planFirstTryValid,
        planFinalValid: existingModel?.planFinalValid,
        scenesValid: existingModel?.scenesValid,
        repetitionMax: existingModel?.repetitionMax,
        repetitionMean: existingModel?.repetitionMean,
        meanStoryMs: existingModel?.meanStoryMs,
      },
      {
        planFirstTryValid: 0.5,
        planFinalValid: 1,
        scenesValid: 0.75,
        repetitionMax: 0.2,
        repetitionMean: 0.1,
        meanStoryMs: 101,
      },
    );
    assert.equal(existingModel?.verdict, "finalist");
    assert.equal(existingModel?.note, "Keep this note");
    assert.equal(candidate?.verdict, "candidate");
    assert.equal(candidate?.note, "");
    assert.equal(candidate?.label, "New Model");
    assert.equal(candidate?.planFirstTryValid, 0);
    assert.equal(candidate?.scenesValid, 0);
    assert.equal(candidate?.repetitionMax, 0);
    assert.equal(existingModel?.runDate, "2026-07-18");
    assert.equal(candidate?.runDate, "2026-07-18");
    assert.deepEqual(existingModel?.pricing, {
      promptUsdPerTok: 0.001,
      completionUsdPerTok: 0.002,
      pricedAt: "2026-07-18",
    });
    assert.equal(
      partialMerge.models.find((model) => model.id === "vendor/untouched")?.runDate,
      "2026-07-17",
    );
    assert.deepEqual(retainedPricing, {
      promptUsdPerTok: 0.003,
      completionUsdPerTok: 0.004,
      pricedAt: "2026-07-17",
    });
    assert.equal(candidate?.pricing, undefined);
    if (
      JSON.stringify(first) !== JSON.stringify(second) ||
      first.max !== 1 / 3 ||
      selected[0]?.name !== slug ||
      selected[0]?.model !== slug
    ) {
      throw new Error("repetition metric self-test failed");
    }
    console.log(`repetition metric self-test passed: ${JSON.stringify(first)}`);
    console.log("benchmark merge self-test passed");
    return;
  }
  const models = resolveModels(values.models);
  const questions = values.quick ? QUESTIONS.slice(0, 1) : QUESTIONS;
  if (values.pipeline) {
    const results: PipelineMetrics[] = [];
    for (const model of models) results.push(await evaluatePipeline(model, questions));
    console.log(`\n# Story model pipeline eval${values.quick ? " (quick)" : ""}\n`);
    console.log(pipelineTable(results));
    if (values.out) {
      const pricing = await openRouterPricing(results.map((result) => result.modelId));
      const existing = await readBenchmarkResults(values.out);
      const runDate = new Date().toISOString().slice(0, 10);
      const merged = mergePipelineResults(results, existing, pricing, runDate);
      await writeFile(values.out, `${JSON.stringify(merged, null, 2)}\n`);
      console.log(`\nWrote benchmark data to ${values.out}`);
    }
    return;
  }
  const evidence = fixtureEvidence();
  const scenes = values.quick ? SCENE_PLAN_FIXTURE.scenes.slice(0, 1) : SCENE_PLAN_FIXTURE.scenes;
  const results: Metrics[] = [];

  for (const model of models) {
    results.push(await evaluatePlans(model, questions));
    results.push(
      await evaluateScenes(model, SCENE_PLAN_FIXTURE.question, SCENE_PLAN_FIXTURE.scenes, scenes, evidence),
    );
  }

  console.log(`\n# Story model eval${values.quick ? " (quick)" : ""}\n`);
  console.log(table(results));
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});

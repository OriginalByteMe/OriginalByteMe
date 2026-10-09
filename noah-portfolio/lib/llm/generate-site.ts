import { jsonSchema, Output, streamText, type JSONSchema7, type ModelMessage } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/llm/openrouter";
import {
  buildSiteRepairMessage,
  buildSiteSystemPrompt,
  buildSiteUserMessage,
} from "@/lib/llm/prompt";
import { storyTelemetry } from "@/lib/observability/langfuse";
import { CORPUS_EVIDENCE_REFS, resolveStoryProjects } from "@/lib/story/evidence";
import { validationError } from "@/lib/story/public-validation";
import {
  EvidenceRefIdSchema,
  SiteDraftSchema,
  type EvidenceRef,
  type Site,
  type SitePalette,
} from "@/lib/story/types";
import { assertValidSite } from "@/lib/story/validation";

const MAX_SITE_ATTEMPTS = 2;
// A maximal site is about 3.5k tokens of JSON; the rest is headroom for reasoning models.
const MAX_SITE_OUTPUT_TOKENS = 8192;

/** Response format for constrained decoding: the draft schema with Evidence ids narrowed to the active Corpus. */
export const SITE_RESPONSE_JSON_SCHEMA = (() => {
  const evidenceIds = CORPUS_EVIDENCE_REFS.map((ref) => ref.id);
  const schema = z.toJSONSchema(SiteDraftSchema, {
    override: ({ zodSchema, jsonSchema: node }) => {
      if (zodSchema !== EvidenceRefIdSchema) return;
      for (const key of Object.keys(node)) delete node[key];
      Object.assign(node, { type: "string", enum: evidenceIds });
    },
  });
  delete schema.$schema;
  return schema as JSONSchema7;
})();

const siteOutput = Output.object({ schema: jsonSchema(SITE_RESPONSE_JSON_SCHEMA), name: "site" });

export interface SiteAttempt {
  ok: boolean;
  error?: string;
  text: string;
  ms: number;
  promptTokens: number;
  completionTokens: number;
}

export interface GenerateSiteOptions {
  signal: AbortSignal;
  onAttempt?: (attempt: SiteAttempt) => void;
}

export interface GeneratedSite {
  site: Site;
  /** The canonical Refs the site cites, in Corpus order. */
  evidence: EvidenceRef[];
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

// Palette follows the topic of the first citation; a small model picked one colour for nearly everything.
const PALETTE_BY_EVIDENCE: Record<string, SitePalette> = {
  "career-3": "ember",
  "fun-fact-1": "ember",
  "fun-fact-2": "forest",
  "skills-4": "forest",
  "career-2": "midnight",
  "skills-2": "midnight",
  "project-llm-comparison": "midnight",
  "project-story-model-benchmark": "midnight",
  "project-moodify": "studio",
  "project-ai-image-cutout": "studio",
  "project-ask-me-portfolio": "studio",
  "skills-1": "studio",
  "skills-3": "studio",
  "skills-5": "studio",
};

function paletteFor(firstCitation: string | undefined): SitePalette {
  if (!firstCitation) return "midnight";
  if (firstCitation.startsWith("operating-systems-")) return "forest";
  return PALETTE_BY_EVIDENCE[firstCitation] ?? "paper";
}

/** Parse model output into a server-validated Site with canonical project cards. */
function parseSite(text: string): Site {
  const draft = SiteDraftSchema.safeParse(JSON.parse(stripFences(text)));
  if (!draft.success) throw validationError("Site", draft.error);
  const { layout, brand, hero, sections, relatedQuestions } = draft.data;
  const site: Site = {
    mode: sections.length === 0 && hero.evidenceRefIds.length === 0 ? "boundary" : "grounded",
    layout,
    palette: paletteFor(hero.evidenceRefIds[0] ?? sections[0]?.evidenceRefIds[0]),
    brand,
    hero,
    sections: sections.map((section) =>
      section.projectSlugs ? { ...section, projects: resolveStoryProjects(section.projectSlugs) } : section,
    ),
    relatedQuestions,
  };
  assertValidSite(site, CORPUS_EVIDENCE_REFS);
  return site;
}

function citedEvidence(site: Site): EvidenceRef[] {
  const cited = new Set([
    ...site.hero.evidenceRefIds,
    ...site.sections.flatMap((section) => section.evidenceRefIds),
  ]);
  return CORPUS_EVIDENCE_REFS.filter((ref) => cited.has(ref.id));
}

async function completeAttempt(messages: ModelMessage[], signal: AbortSignal, attempt: number) {
  signal.throwIfAborted();
  let streamError: unknown;
  const result = streamText({
    model: getModel(),
    system: buildSiteSystemPrompt(),
    messages,
    output: siteOutput,
    maxOutputTokens: MAX_SITE_OUTPUT_TOKENS,
    abortSignal: signal,
    experimental_telemetry: storyTelemetry("story-site", { attempt }),
    onError: ({ error }) => {
      streamError ??= error;
    },
  });
  let text = "";
  for await (const delta of result.textStream) {
    signal.throwIfAborted();
    text += delta;
  }
  signal.throwIfAborted();
  if (streamError) throw streamError;
  const usage = await result.usage;
  return { text, promptTokens: usage.inputTokens ?? 0, completionTokens: usage.outputTokens ?? 0 };
}

/**
 * One model call per attempt, at most two attempts: the second gets the validation error but not
 * the rejected output, which would crowd a small model's context window. Throws the last error.
 */
export async function generateSite(
  question: string,
  { signal, onAttempt }: GenerateSiteOptions,
): Promise<GeneratedSite> {
  const messages: ModelMessage[] = [{ role: "user", content: buildSiteUserMessage(question) }];
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_SITE_ATTEMPTS; attempt += 1) {
    const started = performance.now();
    const report = { text: "", promptTokens: 0, completionTokens: 0 };
    try {
      Object.assign(report, await completeAttempt(messages, signal, attempt));
      const site = parseSite(report.text);
      onAttempt?.({ ok: true, ...report, ms: Math.round(performance.now() - started) });
      return { site, evidence: citedEvidence(site) };
    } catch (error) {
      signal.throwIfAborted();
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      onAttempt?.({ ok: false, error: message, ...report, ms: Math.round(performance.now() - started) });
      // Ollama's default 4096-token context truncated repairs that replayed the whole bad output.
      messages.push({ role: "user", content: buildSiteRepairMessage(message) });
    }
  }

  throw lastError;
}

import {
  EvidenceRefSchema,
  normalizeQuestion,
  PublicStorySchema,
  SiteSchema,
  type EvidenceRef,
  type PublicStory,
  type Site,
  type SiteSection,
} from "@/lib/story/types";
import { z } from "zod";

export function validationError(label: string, error: z.ZodError): Error {
  const details = error.issues
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
  return new Error(`Invalid ${label}: ${details}`);
}

export function parseEvidence(value: unknown): EvidenceRef[] {
  const result = z.array(EvidenceRefSchema).max(64).safeParse(value);
  if (!result.success) throw validationError("Evidence Refs", result.error);
  return result.data;
}

export function evidenceIdsFor(evidence: readonly EvidenceRef[]): ReadonlySet<string> {
  const seen = new Set<string>();
  for (const ref of evidence) {
    if (seen.has(ref.id)) throw new Error(`Invalid Evidence Refs: duplicate ID ${ref.id}`);
    seen.add(ref.id);
  }
  return seen;
}

function assertReferencesExist(
  evidenceRefIds: readonly string[],
  evidenceIds: ReadonlySet<string>,
  context: string,
): void {
  if (new Set(evidenceRefIds).size !== evidenceRefIds.length) {
    throw new Error(`Invalid ${context}: Evidence Ref IDs must be unique`);
  }
  for (const id of evidenceRefIds) {
    if (!evidenceIds.has(id)) {
      throw new Error(`Invalid ${context}: unknown Evidence Ref ID ${id}`);
    }
  }
}

function assertResolvedProjects(section: SiteSection, context: string): void {
  const { projectSlugs, projects } = section;
  if (!projectSlugs) {
    if (projects) throw new Error(`Invalid ${context}: projects require projectSlugs`);
    return;
  }
  if (
    !projects ||
    projects.length !== projectSlugs.length ||
    projectSlugs.some((slug, index) => projects[index].slug !== slug)
  ) {
    throw new Error(`Invalid ${context}: projects must correspond exactly to projectSlugs`);
  }
}

/**
 * Grounding rules for a schema-parsed Site against one Evidence vocabulary.
 * Grounded sites cite at least one known Ref on the hero and on every section;
 * boundary sites cite nothing and carry no sections.
 */
export function assertValidParsedSite(site: Site, evidenceIds: ReadonlySet<string>): void {
  if (site.mode === "boundary") {
    if (site.sections.length !== 0) {
      throw new Error("Invalid Site: boundary mode must not include sections");
    }
    if (site.hero.evidenceRefIds.length !== 0) {
      throw new Error("Invalid Site: boundary mode must not cite Evidence Refs");
    }
  } else if (site.sections.length < 2) {
    throw new Error("Invalid Site: grounded mode requires at least two sections");
  }

  const cited = [
    { label: "hero", ids: site.hero.evidenceRefIds },
    ...site.sections.map((section, index) => ({
      label: `section ${index + 1}`,
      ids: section.evidenceRefIds,
    })),
  ];
  for (const { label, ids } of cited) {
    if (site.mode === "grounded" && ids.length === 0) {
      throw new Error(`Invalid Site: grounded mode requires at least one Evidence Ref on the ${label}`);
    }
    assertReferencesExist(ids, evidenceIds, `Site ${label}`);
  }
  for (const [index, section] of site.sections.entries()) {
    assertResolvedProjects(section, `Site section ${index + 1}`);
  }

  const related = site.relatedQuestions.map(normalizeQuestion);
  if (new Set(related).size !== related.length) {
    throw new Error("Invalid Site: Related Questions must be unique");
  }
}

/** Client-safe validation for a streamed Site and the Evidence vocabulary sent with it. */
export function assertValidStreamSite(site: unknown, evidence: unknown): asserts site is Site {
  const parsed = SiteSchema.safeParse(site);
  if (!parsed.success) throw validationError("Site", parsed.error);
  const parsedEvidence = parseEvidence(evidence);
  if (parsed.data.mode === "boundary" && parsedEvidence.length !== 0) {
    throw new Error("Invalid Site: boundary mode must not include an Evidence vocabulary");
  }
  assertValidParsedSite(parsed.data, evidenceIdsFor(parsedEvidence));
}

/** Client-safe complete Public Story validation beyond structural Zod parsing. */
export function assertValidPublicStory(story: unknown): asserts story is PublicStory {
  const parsed = PublicStorySchema.safeParse(story);
  if (!parsed.success) throw validationError("Public Story", parsed.error);
  const { site, evidence } = parsed.data;
  if (site.mode === "boundary" && evidence.length !== 0) {
    throw new Error("Invalid Public Story: boundary mode must not include Evidence");
  }
  assertValidParsedSite(site, evidenceIdsFor(evidence));
}

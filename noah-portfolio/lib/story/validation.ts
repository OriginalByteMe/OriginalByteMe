import { CORPUS_EVIDENCE_REFS, assertCanonicalStoryProjects } from "@/lib/story/evidence";
import {
  assertValidParsedSite,
  evidenceIdsFor,
  parseEvidence,
  validationError,
} from "@/lib/story/public-validation";
import {
  SiteSchema,
  StoryRecordSchema,
  type EvidenceRef,
  type Site,
  type StoryRecord,
} from "@/lib/story/types";

const canonicalEvidenceById = new Map(CORPUS_EVIDENCE_REFS.map((ref) => [ref.id, ref]));

/** Unique Evidence ids, each Ref identical to its active-Corpus record. */
function canonicalEvidenceIds(evidence: readonly EvidenceRef[]): ReadonlySet<string> {
  const ids = evidenceIdsFor(evidence);
  for (const ref of evidence) {
    const canonical = canonicalEvidenceById.get(ref.id);
    if (
      !canonical ||
      canonical.path !== ref.path ||
      canonical.label !== ref.label ||
      canonical.excerpt !== ref.excerpt
    ) {
      throw new Error(`Invalid Evidence Refs: ${ref.id} is not in the active Corpus vocabulary`);
    }
  }
  return ids;
}

function assertValidParsedServerSite(site: Site, evidence: readonly EvidenceRef[]): void {
  assertValidParsedSite(site, canonicalEvidenceIds(evidence));
  for (const [index, section] of site.sections.entries()) {
    assertCanonicalStoryProjects(section, `Site section ${index + 1}`);
  }
}

/** Server validator: shared Site semantics, active-Corpus Evidence, and canonical project cards. */
export function assertValidSite(site: unknown, evidence: unknown): asserts site is Site {
  const parsed = SiteSchema.safeParse(site);
  if (!parsed.success) throw validationError("Site", parsed.error);
  assertValidParsedServerSite(parsed.data, parseEvidence(evidence));
}

/** Validate a schema-parsed private record without re-parsing it. */
export function assertValidParsedStoryRecord(record: StoryRecord): void {
  if (record.site.mode === "boundary" && record.evidence.length !== 0) {
    throw new Error("Invalid Story Record: boundary mode must not include Evidence");
  }
  assertValidParsedServerSite(record.site, record.evidence);
}

/** Complete private-record validation adds active-Corpus semantics to its strict schema. */
export function assertValidStoryRecord(record: unknown): asserts record is StoryRecord {
  const parsed = StoryRecordSchema.safeParse(record);
  if (!parsed.success) throw validationError("Story Record", parsed.error);
  assertValidParsedStoryRecord(parsed.data);
}

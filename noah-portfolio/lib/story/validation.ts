import {
  CORPUS_EVIDENCE_REFS,
  assertCanonicalStoryProjects,
  assertKnownStoryPlanProjectSlugs,
  resolveStoryProjects,
} from "@/lib/story/evidence";
import {
  assertValidParsedStreamPlan,
  assertValidParsedStreamScene,
  evidenceIdsFor,
  parseEvidence,
  validationError,
} from "@/lib/story/public-validation";
import {
  ScenePlanSchema,
  StoryPlanSchema,
  StoryRecordSchema,
  StorySceneSchema,
  type EvidenceRef,
  type ScenePlan,
  type StoryPlan,
  type StoryRecord,
  type StoryScene,
} from "@/lib/story/types";

const canonicalEvidenceById = new Map(CORPUS_EVIDENCE_REFS.map((ref) => [ref.id, ref]));

export interface ValidatedStoryEvidence {
  readonly refs: EvidenceRef[];
  readonly ids: ReadonlySet<string>;
}

function assertCanonicalEvidence(evidence: readonly EvidenceRef[]): void {
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
}

function validatedStoryEvidenceFromParsed(refs: EvidenceRef[]): ValidatedStoryEvidence {
  const ids = evidenceIdsFor(refs);
  assertCanonicalEvidence(refs);
  return { refs, ids };
}

/** Parse and validate one exact active-Corpus Evidence vocabulary at its boundary. */
export function validateCanonicalStoryEvidence(evidence: unknown): ValidatedStoryEvidence {
  return validatedStoryEvidenceFromParsed(parseEvidence(evidence));
}

export function assertValidStoryPlanWithEvidence(
  plan: unknown,
  evidence: ValidatedStoryEvidence,
  expectedQuestion: string,
): asserts plan is StoryPlan {
  assertKnownStoryPlanProjectSlugs(plan);
  const parsed = StoryPlanSchema.safeParse(plan);
  if (!parsed.success) throw validationError("Story Plan", parsed.error);
  assertValidParsedStreamPlan(parsed.data, evidence.ids, expectedQuestion);
  for (const scene of parsed.data.scenes) resolveStoryProjects(scene.projectSlugs);
}

/** Server validator: shared semantics plus exact active-Corpus Evidence records. */
export function assertValidStoryPlan(
  plan: unknown,
  evidence: unknown,
  expectedQuestion: string,
): asserts plan is StoryPlan {
  assertValidStoryPlanWithEvidence(
    plan,
    validateCanonicalStoryEvidence(evidence),
    expectedQuestion,
  );
}

export function assertValidStorySceneWithEvidence(
  scene: unknown,
  lockedPlan: ScenePlan,
  evidence: ValidatedStoryEvidence,
): asserts scene is StoryScene {
  const parsed = StorySceneSchema.safeParse(scene);
  if (!parsed.success) throw validationError("Story Scene", parsed.error);
  const locked = ScenePlanSchema.safeParse(lockedPlan);
  if (!locked.success) throw validationError("locked Scene Plan", locked.error);
  assertValidParsedStreamScene(parsed.data, locked.data, evidence.ids);
  assertCanonicalStoryProjects(parsed.data);
}

/** Server validator: shared locked-Scene semantics plus exact active-Corpus Evidence. */
export function assertValidStoryScene(
  scene: unknown,
  lockedPlan: ScenePlan,
  evidence: unknown,
): asserts scene is StoryScene {
  assertValidStorySceneWithEvidence(
    scene,
    lockedPlan,
    validateCanonicalStoryEvidence(evidence),
  );
}

/** Validate a schema-parsed private record without re-parsing its Evidence. */
export function assertValidParsedStoryRecord(record: StoryRecord): void {
  const { plan, scenes, evidence, displayQuestion } = record;
  const validatedEvidence = validatedStoryEvidenceFromParsed(evidence);
  assertKnownStoryPlanProjectSlugs(plan);
  assertValidParsedStreamPlan(plan, validatedEvidence.ids, displayQuestion);
  for (const scene of plan.scenes) resolveStoryProjects(scene.projectSlugs);
  if (scenes.length !== plan.scenes.length) {
    throw new Error("Invalid Story Record: Scene count differs from the locked Story Plan");
  }
  for (const [index, scene] of scenes.entries()) {
    assertValidParsedStreamScene(scene, plan.scenes[index], validatedEvidence.ids);
    assertCanonicalStoryProjects(scene);
  }
}

/** Complete private-record validation adds active-Corpus semantics to its strict schema. */
export function assertValidStoryRecord(record: unknown): asserts record is StoryRecord {
  const parsed = StoryRecordSchema.safeParse(record);
  if (!parsed.success) throw validationError("Story Record", parsed.error);
  assertValidParsedStoryRecord(parsed.data);
}

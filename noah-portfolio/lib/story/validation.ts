import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";
import { questionDigest } from "@/lib/story/identity";
import {
  assertKnownStoryPlanProjectSlugs,
  assertCanonicalStoryProjects,
  resolveStoryProjects,
} from "@/lib/story/projects.server";
import {
  assertValidStreamPlan,
  assertValidStreamScene,
} from "@/lib/story/public-validation";
import {
  EvidenceRefSchema,
  StoryRecordSchema,
  type EvidenceRef,
  type ScenePlan,
  type StoryPlan,
  type StoryRecord,
  type StoryScene,
} from "@/lib/story/types";
import { z } from "zod";

function validationError(label: string, error: z.ZodError): Error {
  const details = error.issues
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
  return new Error(`Invalid ${label}: ${details}`);
}

function assertCanonicalEvidence(value: unknown): asserts value is EvidenceRef[] {
  const parsed = z.array(EvidenceRefSchema).min(1).max(64).safeParse(value);
  if (!parsed.success) throw validationError("Evidence Refs", parsed.error);

  const vocabulary = new Map(CORPUS_EVIDENCE_REFS.map((ref) => [ref.id, ref]));
  for (const ref of parsed.data) {
    const canonical = vocabulary.get(ref.id);
    if (!canonical || JSON.stringify(canonical) !== JSON.stringify(ref)) {
      throw new Error(`Invalid Evidence Refs: ${ref.id} is not in the active Corpus vocabulary`);
    }
  }
}

/** Server validator: shared semantics plus exact active-Corpus Evidence records. */
export function assertValidStoryPlan(
  plan: unknown,
  evidence: unknown,
  expectedQuestion: string,
): asserts plan is StoryPlan {
  assertKnownStoryPlanProjectSlugs(plan);
  assertValidStreamPlan(plan, evidence, expectedQuestion);
  assertCanonicalEvidence(evidence);
  for (const scene of plan.scenes) resolveStoryProjects(scene.projectSlugs);
}

/** Server validator: shared locked-Scene semantics plus exact active-Corpus Evidence. */
export function assertValidStoryScene(
  scene: unknown,
  lockedPlan: ScenePlan,
  evidence: unknown,
): asserts scene is StoryScene {
  assertValidStreamScene(scene, lockedPlan, evidence);
  assertCanonicalEvidence(evidence);
  assertCanonicalStoryProjects(scene);
}

/** Complete private-record validation adds digest integrity to shared Public Story semantics. */
export function assertValidStoryRecord(record: unknown): asserts record is StoryRecord {
  const parsed = StoryRecordSchema.safeParse(record);
  if (!parsed.success) throw validationError("Story Record", parsed.error);

  const { plan, scenes, evidence, displayQuestion } = parsed.data;
  assertValidStoryPlan(plan, evidence, displayQuestion);
  if (scenes.length !== plan.scenes.length) {
    throw new Error("Invalid Story Record: Scene count differs from the locked Story Plan");
  }
  for (const [index, scene] of scenes.entries()) {
    assertValidStoryScene(scene, plan.scenes[index], evidence);
  }
  if (parsed.data.questionDigest !== questionDigest(displayQuestion)) {
    throw new Error("Invalid Story Record: question digest does not match display question");
  }
}

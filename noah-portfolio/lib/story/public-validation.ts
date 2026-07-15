import { getMotionAsset } from "@/lib/motion-assets/catalog";
import {
  ELIGIBLE_PATTERNS_BY_ROLE,
  EvidenceRefSchema,
  normalizeQuestion,
  PublicStorySchema,
  ScenePlanSchema,
  StoryPlanSchema,
  StoryQuestionSchema,
  StorySceneSchema,
  type EvidenceRef,
  type PublicStory,
  type ScenePlan,
  type StoryPlan,
  type StoryScene,
} from "@/lib/story/types";
import { z } from "zod";

const EXPECTED_CUE_PHASE_BY_ROLE = {
  "direct-answer": "intro",
  evidence: "develop",
  synthesis: "resolve",
} as const;

export function validationError(label: string, error: z.ZodError): Error {
  const details = error.issues
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
  return new Error(`Invalid ${label}: ${details}`);
}

export function parseEvidence(value: unknown): EvidenceRef[] {
  const result = z.array(EvidenceRefSchema).min(1).max(64).safeParse(value);
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

function assertGeneratorEligibleAsset(
  assetId: string,
  pattern: string,
  context: string,
): void {
  const asset = getMotionAsset(assetId);
  if (!asset || !asset.generatorEligible || asset.accessibility.kind !== "meaningful") {
    throw new Error(
      `Invalid ${context}: Motion Asset ${assetId} is not a meaningful generator-eligible focal asset`,
    );
  }
  if (!asset.eligibleScenePatterns.some((eligiblePattern) => eligiblePattern === pattern)) {
    throw new Error(
      `Invalid ${context}: Motion Asset ${assetId} is not eligible for pattern ${pattern}`,
    );
  }
}

function assertResolvedProjects(scene: StoryScene): void {
  if (scene.projectSlugs === undefined) {
    if (scene.projects !== undefined) {
      throw new Error(
        `Invalid Story Scene ${scene.index}: projects require locked projectSlugs`,
      );
    }
    return;
  }

  if (scene.projects === undefined) {
    throw new Error(
      `Invalid Story Scene ${scene.index}: locked projectSlugs require resolved projects`,
    );
  }
  if (scene.projects.length !== scene.projectSlugs.length) {
    throw new Error(
      `Invalid Story Scene ${scene.index}: projects must correspond exactly to locked projectSlugs`,
    );
  }
  for (const [index, slug] of scene.projectSlugs.entries()) {
    if (scene.projects[index].slug !== slug) {
      throw new Error(
        `Invalid Story Scene ${scene.index}: projects must correspond exactly to locked projectSlugs`,
      );
    }
  }
}

export function assertValidParsedStreamPlan(
  plan: StoryPlan,
  evidenceIds: ReadonlySet<string>,
  expectedQuestion: string,
): void {
  const expected = StoryQuestionSchema.safeParse(expectedQuestion);
  if (!expected.success) throw validationError("expected Story question", expected.error);
  if (normalizeQuestion(plan.question) !== normalizeQuestion(expected.data)) {
    throw new Error("Invalid Story Plan: question differs from the expected display question");
  }

  const scenes = plan.scenes;
  if (new Set(scenes.map((scene) => scene.id)).size !== scenes.length) {
    throw new Error("Invalid Story Plan: Scene IDs must be unique");
  }
  if (new Set(scenes.map((scene) => scene.pattern)).size !== scenes.length) {
    throw new Error("Invalid Story Plan: Scene Patterns must be unique");
  }
  if (new Set(scenes.map((scene) => scene.register)).size < 2) {
    throw new Error("Invalid Story Plan: at least two Registers are required");
  }

  const expectedLast = scenes.length - 1;
  for (const [index, scene] of scenes.entries()) {
    if (scene.index !== index) {
      throw new Error(`Invalid Story Plan: Scene index ${scene.index} must be ${index}`);
    }
    const expectedRole = index === 0
      ? "direct-answer"
      : index === expectedLast
        ? "synthesis"
        : "evidence";
    if (scene.role !== expectedRole) {
      throw new Error(`Invalid Story Plan: Scene ${index} must have role ${expectedRole}`);
    }
    if (!ELIGIBLE_PATTERNS_BY_ROLE[scene.role].some((pattern) => pattern === scene.pattern)) {
      throw new Error(`Invalid Story Plan: ${scene.pattern} is not eligible for role ${scene.role}`);
    }
    if (scene.cue.phase !== EXPECTED_CUE_PHASE_BY_ROLE[scene.role]) {
      throw new Error(
        `Invalid Story Plan: ${scene.role} Scene cue phase must be ${EXPECTED_CUE_PHASE_BY_ROLE[scene.role]}`,
      );
    }
    assertGeneratorEligibleAsset(scene.assetId, scene.pattern, "Story Plan");
    assertReferencesExist(scene.evidenceRefIds, evidenceIds, `Story Plan Scene ${index}`);
  }

  if (!scenes.slice(1, -1).some((scene) => scene.evidenceRefIds.length >= 2)) {
    throw new Error("Invalid Story Plan: an evidence-heavy middle Scene must cite at least two Evidence Refs");
  }
  const related = plan.relatedQuestions.map(normalizeQuestion);
  if (new Set(related).size !== related.length) {
    throw new Error("Invalid Story Plan: Related Questions must be unique");
  }
}

/** Client-safe semantic validation for a streamed Plan and its Evidence vocabulary. */
export function assertValidStreamPlan(
  plan: unknown,
  evidence: unknown,
  expectedQuestion: string,
): asserts plan is StoryPlan {
  const parsed = StoryPlanSchema.safeParse(plan);
  if (!parsed.success) throw validationError("Story Plan", parsed.error);
  assertValidParsedStreamPlan(
    parsed.data,
    evidenceIdsFor(parseEvidence(evidence)),
    expectedQuestion,
  );
}

const LOCKED_SCENE_FIELDS = Object.keys(ScenePlanSchema.shape) as (keyof ScenePlan)[];

export function assertValidParsedStreamScene(
  scene: StoryScene,
  lockedPlan: ScenePlan,
  evidenceIds: ReadonlySet<string>,
): void {
  for (const field of LOCKED_SCENE_FIELDS) {
    if (JSON.stringify(scene[field]) !== JSON.stringify(lockedPlan[field])) {
      throw new Error(`Invalid Story Scene: ${field} differs from the locked Story Plan`);
    }
  }
  assertGeneratorEligibleAsset(scene.assetId, scene.pattern, "Story Scene");
  assertReferencesExist(scene.evidenceRefIds, evidenceIds, `Story Scene ${scene.index}`);
  assertResolvedProjects(scene);
}

/** Client-safe semantic validation for one composed Scene against its locked Plan entry. */
export function assertValidStreamScene(
  scene: unknown,
  lockedPlan: ScenePlan,
  evidence: unknown,
): asserts scene is StoryScene {
  const parsed = StorySceneSchema.safeParse(scene);
  if (!parsed.success) throw validationError("Story Scene", parsed.error);
  const locked = ScenePlanSchema.safeParse(lockedPlan);
  if (!locked.success) throw validationError("locked Scene Plan", locked.error);
  assertValidParsedStreamScene(
    parsed.data,
    locked.data,
    evidenceIdsFor(parseEvidence(evidence)),
  );
}

/** Client-safe complete Public Story validation beyond structural Zod parsing. */
export function assertValidPublicStory(story: unknown): asserts story is PublicStory {
  const parsed = PublicStorySchema.safeParse(story);
  if (!parsed.success) throw validationError("Public Story", parsed.error);
  const { plan, scenes, evidence, displayQuestion } = parsed.data;
  const evidenceIds = evidenceIdsFor(evidence);
  assertValidParsedStreamPlan(plan, evidenceIds, displayQuestion);
  if (scenes.length !== plan.scenes.length) {
    throw new Error("Invalid Public Story: Scene count differs from the locked Story Plan");
  }
  for (const [index, scene] of scenes.entries()) {
    assertValidParsedStreamScene(scene, plan.scenes[index], evidenceIds);
  }
}

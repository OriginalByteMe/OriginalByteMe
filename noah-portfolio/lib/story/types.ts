import { isBackdropPresetName, type BackdropPresetName } from "@/lib/backdrop/presets";
import { isMotionAssetId, type MotionAssetId } from "@/lib/motion-assets/catalog";
import { z } from "zod";

/** Deliberate compatibility boundary for generated Story structure and behavior. */
export const STORY_CONTRACT_VERSION = "v5" as const;

/** Deliberate compatibility boundary for the authored Corpus used to ground Stories. */
export const CORPUS_REVISION = "2026-07-14" as const;

export const SCENE_PATTERNS = [
  "hero-statement",
  "project-spotlight",
  "evidence-ledger",
  "timeline",
  "capability-map",
  "system-diagram",
  "closing-synthesis",
] as const;

export const STORY_REGISTERS = [
  "editorial",
  "technical",
  "diagrammatic",
  "reflective",
] as const;

export const SCENE_ROLES = ["direct-answer", "evidence", "synthesis"] as const;

/** Client-safe vocabulary mirrored from the authored Corpus project filenames. */
export const PROJECT_SLUGS = [
  "ai-image-cutout",
  "ask-me-portfolio",
  "llm-comparison",
  "moodify",
] as const;
export const ELIGIBLE_PATTERNS_BY_ROLE = {
  "direct-answer": ["hero-statement"],
  evidence: [
    "project-spotlight",
    "evidence-ledger",
    "timeline",
    "capability-map",
    "system-diagram",
  ],
  synthesis: ["closing-synthesis"],
} as const satisfies Record<
  (typeof SCENE_ROLES)[number],
  readonly (typeof SCENE_PATTERNS)[number][]
>;
export const SCENE_CUE_PHASES = ["intro", "develop", "resolve"] as const;
export const SCENE_CUE_FOCUSES = ["center", "left", "right"] as const;
export const SCENE_CUE_INTENSITIES = ["quiet", "medium", "strong"] as const;
export const STORY_PHASES = ["planning", "composing", "validating", "publishing"] as const;
export const NON_PUBLISHING_STORY_PHASES = ["planning", "composing", "validating"] as const;
export const StoryPublicationTokenSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}$/,
    "Invalid Story publication token",
  );

export const MAX_STORY_QUESTION_LENGTH = 280;
export const StoryQuestionSchema = z
  .string()
  .trim()
  .min(1, "Story question must not be empty")
  .max(MAX_STORY_QUESTION_LENGTH, `Story question must be at most ${MAX_STORY_QUESTION_LENGTH} characters`);

const nonEmptyText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const EvidenceRefSchema = z
  .object({
    id: nonEmptyText(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    path: nonEmptyText(240).startsWith("/corpus/"),
    label: nonEmptyText(160),
    excerpt: nonEmptyText(1600),
  })
  .strict();

export const SceneCueSchema = z
  .object({
    phase: z.enum(SCENE_CUE_PHASES),
    focus: z.enum(SCENE_CUE_FOCUSES),
    intensity: z.enum(SCENE_CUE_INTENSITIES),
  })
  .strict();

const EvidenceRefIdsSchema = z
  .array(nonEmptyText(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
  .min(1)
  .max(12);

export const ProjectSlugSchema = z.enum(PROJECT_SLUGS, {
  message: "Unknown Corpus project slug",
});

const ProjectSlugsSchema = z
  .array(ProjectSlugSchema)
  .min(1)
  .max(3)
  .refine((slugs) => new Set(slugs).size === slugs.length, {
    message: "Project slugs must be unique",
  });

export const StoryProjectTechnologySchema = z
  .object({
    name: nonEmptyText(120),
    lightIcon: z.string().url(),
    darkIcon: z.string().url(),
  })
  .strict();

export const StoryProjectSchema = z
  .object({
    slug: ProjectSlugSchema,
    title: nonEmptyText(160),
    description: nonEmptyText(1200),
    image: nonEmptyText(500),
    url: z.string().url(),
    technologies: z.array(StoryProjectTechnologySchema).max(24),
  })
  .strict();

const AssetIdSchema = z.custom<MotionAssetId>(isMotionAssetId, {
  message: "Unknown Motion Asset ID",
});

export const ScenePlanSchema = z
  .object({
    id: nonEmptyText(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    index: z.number().int().min(0).max(4),
    role: z.enum(SCENE_ROLES),
    pattern: z.enum(SCENE_PATTERNS),
    register: z.enum(STORY_REGISTERS),
    title: nonEmptyText(120),
    claim: nonEmptyText(500),
    assetId: AssetIdSchema,
    evidenceRefIds: EvidenceRefIdsSchema,
    projectSlugs: ProjectSlugsSchema.optional(),
    cue: SceneCueSchema,
  })
  .strict();

export const StorySceneSchema = ScenePlanSchema
  .extend({
    body: nonEmptyText(1200),
    projects: z.array(StoryProjectSchema).min(1).max(3).optional(),
  })
  .strict();

export const StoryPlanSchema = z
  .object({
    question: StoryQuestionSchema,
    backdropPreset: z.custom<BackdropPresetName>(isBackdropPresetName, {
      message: "Unknown Backdrop Preset",
    }),
    scenes: z.array(ScenePlanSchema).min(3).max(5),
    relatedQuestions: z.array(StoryQuestionSchema).min(2).max(3),
  })
  .strict();

export const PublicStoryIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{24}$/, "Invalid opaque Story ID");

export const StoryRecordSchema = z
  .object({
    id: PublicStoryIdSchema,
    displayQuestion: StoryQuestionSchema,
    questionDigest: z.string().regex(/^[a-f0-9]{64}$/),
    corpusRevision: nonEmptyText(120),
    storyContractVersion: nonEmptyText(120),
    createdAt: z.string().datetime({ offset: true }),
    plan: StoryPlanSchema,
    scenes: z.array(StorySceneSchema).min(3).max(5),
    evidence: z.array(EvidenceRefSchema).min(1).max(64),
  })
  .strict();

export const PublicStorySchema = StoryRecordSchema.omit({
  questionDigest: true,
  corpusRevision: true,
  storyContractVersion: true,
}).strict();

export const NewStoryRecordSchema = StoryRecordSchema
  .omit({
    id: true,
    questionDigest: true,
    corpusRevision: true,
    storyContractVersion: true,
    createdAt: true,
  })
  .strict();

export const StoryPublishingEventSchema = z
  .object({
    type: z.literal("phase"),
    phase: z.literal("publishing"),
    publicationToken: StoryPublicationTokenSchema,
  })
  .strict();

export const PublishStoryRequestSchema = z
  .object({ publicationToken: StoryPublicationTokenSchema })
  .strict();

export const PublishStoryResponseSchema = z
  .object({ type: z.literal("complete"), story: PublicStorySchema })
  .strict();

export const StoryStreamEventSchema = z.union([
  z.object({ type: z.literal("phase"), phase: z.enum(NON_PUBLISHING_STORY_PHASES) }).strict(),
  StoryPublishingEventSchema,
  z.object({ type: z.literal("plan"), plan: StoryPlanSchema, evidence: z.array(EvidenceRefSchema).min(1) }).strict(),
  z.object({ type: z.literal("scene"), index: z.number().int().min(0).max(4), scene: StorySceneSchema }).strict(),
  PublishStoryResponseSchema,
  z.object({ type: z.literal("error"), message: nonEmptyText(500) }).strict(),
]);

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type SceneCue = z.infer<typeof SceneCueSchema>;
export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;
export type StoryProjectTechnology = z.infer<typeof StoryProjectTechnologySchema>;
export type StoryProject = z.infer<typeof StoryProjectSchema>;
export type ScenePlan = z.infer<typeof ScenePlanSchema>;
export type StoryScene = z.infer<typeof StorySceneSchema>;
export type StoryPlan = z.infer<typeof StoryPlanSchema>;
export type StoryRecord = z.infer<typeof StoryRecordSchema>;
export type PublicStory = z.infer<typeof PublicStorySchema>;
export type NewStoryRecord = z.infer<typeof NewStoryRecordSchema>;
export type StoryQuestion = z.infer<typeof StoryQuestionSchema>;
export type StoryStreamEvent = z.infer<typeof StoryStreamEventSchema>;
export type ScenePattern = (typeof SCENE_PATTERNS)[number];
export type StoryRegister = (typeof STORY_REGISTERS)[number];
export type StoryPublicationToken = z.infer<typeof StoryPublicationTokenSchema>;
export type StoryPublishingEvent = z.infer<typeof StoryPublishingEventSchema>;
export type PublishStoryRequest = z.infer<typeof PublishStoryRequestSchema>;
export type PublishStoryResponse = z.infer<typeof PublishStoryResponseSchema>;

/** Strip every server-only identity and compatibility field before serialization. */
export function toPublicStory(record: StoryRecord): PublicStory {
  return PublicStorySchema.parse({
    id: record.id,
    displayQuestion: record.displayQuestion,
    createdAt: record.createdAt,
    plan: record.plan,
    scenes: record.scenes,
    evidence: record.evidence,
  });
}

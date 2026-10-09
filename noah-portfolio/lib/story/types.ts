import { ART_IDS } from "@/lib/site/art";
import { z } from "zod";

/** Deliberate compatibility boundary for generated Story structure and behavior. */
export const STORY_CONTRACT_VERSION = "v7" as const;

/** Deliberate compatibility boundary for the authored Corpus used to ground Stories. */
export const CORPUS_REVISION = "2026-10-09" as const;

/** Whole-page arrangements the model chooses between. */
const SITE_LAYOUTS = ["bento", "editorial", "landing", "dossier", "cascade"] as const;
/** Colour schemes; each name maps to `--site-*` variables in `lib/site/art/art.css`. */
const SITE_PALETTES = ["midnight", "paper", "studio", "forest", "ember"] as const;
/** Visual shapes a section can take; the renderer handles any item count for each. */
const SECTION_KINDS = ["cards", "split", "list", "timeline", "quote", "banner"] as const;

/** Client-safe vocabulary mirrored from the authored Corpus project filenames. */
export const PROJECT_SLUGS = [
  "ai-image-cutout",
  "ask-me-portfolio",
  "llm-comparison",
  "moodify",
  "story-model-benchmark",
] as const;
export const NON_PUBLISHING_STORY_PHASES = ["generating", "validating"] as const;
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

/** Normalize user-equivalent Unicode, case, and whitespace without changing punctuation. */
export function normalizeQuestion(question: string): string {
  return question.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

const nonEmptyText = (maximum: number) => z.string().trim().min(1).max(maximum);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const EvidenceRefSchema = z
  .object({
    id: nonEmptyText(120).regex(SLUG_PATTERN),
    path: nonEmptyText(240).startsWith("/corpus/"),
    label: nonEmptyText(160),
    excerpt: nonEmptyText(1600),
  })
  .strict();

/** One cited Evidence Ref id. Exported so the server can narrow it to the active Corpus ids. */
export const EvidenceRefIdSchema = nonEmptyText(120).regex(SLUG_PATTERN);
const EvidenceRefIdsSchema = z.array(EvidenceRefIdSchema).max(6);

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

const ArtIdSchema = z.enum(ART_IDS, { message: "Unknown art id" });

const SiteItemSchema = z
  .object({
    title: nonEmptyText(60),
    text: nonEmptyText(220),
    art: ArtIdSchema.optional(),
  })
  .strict();

// Key order is generation order under constrained decoding: cite first, then write, then pick a picture.
const sectionShape = {
  kind: z.enum(SECTION_KINDS),
  // Sections exist only in grounded sites, so the grammar itself forces at least one citation.
  evidenceRefIds: EvidenceRefIdsSchema.min(1),
  title: nonEmptyText(80),
  nav: nonEmptyText(24),
  body: nonEmptyText(600),
  items: z.array(SiteItemSchema).max(4),
  art: ArtIdSchema.optional(),
  projectSlugs: ProjectSlugsSchema.optional(),
};

/** A section as the model writes it. */
const SiteSectionDraftSchema = z.object(sectionShape).strict();

/** A stored section: trusted code adds the canonical Corpus cards for its project slugs. */
const SiteSectionSchema = z
  .object({ ...sectionShape, projects: z.array(StoryProjectSchema).min(1).max(3).optional() })
  .strict();

const SiteHeroSchema = z
  .object({
    evidenceRefIds: EvidenceRefIdsSchema,
    eyebrow: nonEmptyText(60),
    headline: nonEmptyText(100),
    lede: nonEmptyText(320),
    art: ArtIdSchema,
  })
  .strict();

const SiteModeSchema = z.enum(["grounded", "boundary"]);
const RelatedQuestionsSchema = z.array(StoryQuestionSchema).min(2).max(3);

/**
 * The whole site as the model writes it. The server owns the question and the palette, and derives
 * `mode`: no sections and no hero citations is a boundary page, anything else is grounded. An
 * explicit mode field measured worse on the small model, which declared "boundary" at random and
 * then wrote grounded sections anyway.
 */
export const SiteDraftSchema = z
  .object({
    layout: z.enum(SITE_LAYOUTS),
    brand: nonEmptyText(40),
    hero: SiteHeroSchema,
    sections: z.array(SiteSectionDraftSchema).max(5),
    relatedQuestions: RelatedQuestionsSchema,
  })
  .strict();

export const SiteSchema = z
  .object({
    mode: SiteModeSchema,
    layout: z.enum(SITE_LAYOUTS),
    palette: z.enum(SITE_PALETTES),
    brand: nonEmptyText(40),
    hero: SiteHeroSchema,
    sections: z.array(SiteSectionSchema).max(5),
    relatedQuestions: RelatedQuestionsSchema,
  })
  .strict();

export const PublicStoryIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{24}$/, "Invalid opaque Story ID");

export const StoryRecordSchema = z
  .object({
    id: PublicStoryIdSchema,
    displayQuestion: StoryQuestionSchema,
    corpusRevision: nonEmptyText(120),
    storyContractVersion: nonEmptyText(120),
    createdAt: z.string().datetime({ offset: true }),
    site: SiteSchema,
    evidence: z.array(EvidenceRefSchema).max(64),
  })
  .strict();

export const PublicStorySchema = StoryRecordSchema.omit({
  corpusRevision: true,
  storyContractVersion: true,
}).strict();

export const NewStoryRecordSchema = StoryRecordSchema
  .omit({
    id: true,
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

/** Stream order: phase generating, site, phase validating, then publishing or complete. */
export const StoryStreamEventSchema = z.union([
  z.object({ type: z.literal("phase"), phase: z.enum(NON_PUBLISHING_STORY_PHASES) }).strict(),
  StoryPublishingEventSchema,
  z.object({ type: z.literal("site"), site: SiteSchema, evidence: z.array(EvidenceRefSchema).max(64) }).strict(),
  PublishStoryResponseSchema,
  z.object({ type: z.literal("error"), message: nonEmptyText(500) }).strict(),
]);

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;
export type StoryProjectTechnology = z.infer<typeof StoryProjectTechnologySchema>;
export type StoryProject = z.infer<typeof StoryProjectSchema>;
export type SiteItem = z.infer<typeof SiteItemSchema>;
export type SiteSection = z.infer<typeof SiteSectionSchema>;
export type SiteDraft = z.infer<typeof SiteDraftSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type SitePalette = (typeof SITE_PALETTES)[number];
export type StoryRecord = z.infer<typeof StoryRecordSchema>;
export type PublicStory = z.infer<typeof PublicStorySchema>;
export type NewStoryRecord = z.infer<typeof NewStoryRecordSchema>;
export type StoryQuestion = z.infer<typeof StoryQuestionSchema>;
export type StoryStreamEvent = z.infer<typeof StoryStreamEventSchema>;
export type StoryPhase = Extract<StoryStreamEvent, { type: "phase" }>["phase"];
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
    site: record.site,
    evidence: record.evidence,
  });
}

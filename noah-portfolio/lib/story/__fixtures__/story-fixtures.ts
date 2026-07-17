import {
  CORPUS_EVIDENCE_REFS,
  resolveStoryProjects,
} from "@/lib/story/evidence";
import { seedStoryFixtures } from "@/lib/story/store";
import {
  toPublicStory,
  type ProjectSlug,
  type StoryProject,
  type StoryRecord,
} from "@/lib/story/types";

export const CURRENT_STORY_ID = "S7nQ2vL9_xK4pR8mT1cW6aB3";
export const RELATED_STORY_ID = "H4dM8sP2_zF7kN1qR5vC9xL6";
export const OUTDATED_STORY_ID = "A9wE3rT7_yU1iO5pS8dF2gH4";
export const CURRENT_PUBLICATION_TOKEN = `${CURRENT_STORY_ID}.${"a".repeat(43)}`;

export const CURRENT_QUESTION = "How does Noah turn complex systems into products?";
export const RELATED_QUESTION = "Which projects best show Noah's technical range?";

const evidence = [...CORPUS_EVIDENCE_REFS.slice(0, 3)];
const [headlineEvidence, locationEvidence, summaryEvidence] = evidence;
if (!headlineEvidence || !locationEvidence || !summaryEvidence) {
  throw new Error("Story fixtures require at least three Corpus Evidence Refs");
}

function requiredProjects(slugs: ProjectSlug[]): StoryProject[] {
  const projects = resolveStoryProjects(slugs);
  if (!projects) throw new Error("Story fixture project slugs must be present");
  return projects;
}

function makeScenes(titles: [string, string, string], bodies: [string, string, string]) {
  return [
    {
      id: "direct-answer",
      index: 0,
      role: "direct-answer" as const,
      pattern: "hero-statement" as const,
      register: "editorial" as const,
      title: titles[0],
      claim: "Noah turns complex systems into products by pairing technical depth with a clear product narrative.",
      assetId: "circuit-mind" as const,
      evidenceRefIds: [headlineEvidence.id],
      cue: { phase: "intro" as const, focus: "center" as const, intensity: "quiet" as const },
      body: bodies[0],
    },
    {
      id: "grounded-evidence",
      index: 1,
      role: "evidence" as const,
      pattern: "evidence-ledger" as const,
      register: "technical" as const,
      title: titles[1],
      claim: "Shipped project evidence connects product decisions to concrete implementation work.",
      assetId: "print-layers" as const,
      evidenceRefIds: [locationEvidence.id, summaryEvidence.id],
      projectSlugs: ["ask-me-portfolio", "llm-comparison"] as ProjectSlug[],
      projects: requiredProjects(["ask-me-portfolio", "llm-comparison"]),
      cue: { phase: "develop" as const, focus: "left" as const, intensity: "strong" as const },
      body: bodies[1],
    },
    {
      id: "closing-view",
      index: 2,
      role: "synthesis" as const,
      pattern: "closing-synthesis" as const,
      register: "reflective" as const,
      title: titles[2],
      claim: "The result is practical systems work shaped around what people need to understand and use.",
      assetId: "morning-coffee" as const,
      evidenceRefIds: [headlineEvidence.id, summaryEvidence.id],
      projectSlugs: ["moodify"] as ProjectSlug[],
      projects: requiredProjects(["moodify"]),
      cue: { phase: "resolve" as const, focus: "right" as const, intensity: "medium" as const },
      body: bodies[2],
    },
  ];
}

function makeRecord({
  id,
  displayQuestion,
  titles,
  bodies,
  relatedQuestions,
  corpusRevision = "2026-07-14",
  storyContractVersion = "v5",
}: {
  id: string;
  displayQuestion: string;
  titles: [string, string, string];
  bodies: [string, string, string];
  relatedQuestions: [string, string];
  corpusRevision?: string;
  storyContractVersion?: string;
}): StoryRecord {
  const scenes = makeScenes(titles, bodies);
  return {
    id,
    displayQuestion,
    corpusRevision,
    storyContractVersion,
    createdAt: "2026-07-14T07:00:00.000Z",
    plan: {
      question: displayQuestion,
      backdropPreset: "ditherTide",
      scenes: scenes.map((scene) => ({
        id: scene.id,
        index: scene.index,
        role: scene.role,
        pattern: scene.pattern,
        register: scene.register,
        title: scene.title,
        claim: scene.claim,
        assetId: scene.assetId,
        evidenceRefIds: scene.evidenceRefIds,
        ...("projectSlugs" in scene ? { projectSlugs: scene.projectSlugs } : {}),
        cue: scene.cue,
      })),
      relatedQuestions,
    },
    scenes,
    evidence,
  };
}

export const CURRENT_STORY_RECORD = makeRecord({
  id: CURRENT_STORY_ID,
  displayQuestion: CURRENT_QUESTION,
  titles: ["Systems become usable products", "Evidence from shipped work", "Craft meets delivery"],
  bodies: [
    "He starts with the system boundary, then makes the value legible to the people using it.",
    "The work joins product decisions to implementation evidence rather than treating design and engineering as separate hand-offs.",
    "That combination keeps ambitious technical work understandable, maintainable, and useful.",
  ],
  relatedQuestions: [RELATED_QUESTION, "How does Noah balance engineering and design?"],
});

export const RELATED_STORY_RECORD = makeRecord({
  id: RELATED_STORY_ID,
  displayQuestion: RELATED_QUESTION,
  titles: ["Technical range in practice", "Projects as evidence", "Range with a purpose"],
  bodies: [
    "Noah's range shows up where product interfaces meet infrastructure and delivery systems.",
    "Selected projects ground that range in shipped work, not a list of disconnected technologies.",
    "The common thread is choosing the right level of the stack for the problem in front of him.",
  ],
  relatedQuestions: [CURRENT_QUESTION, "What kind of teams does Noah work best with?"],
});

export const OUTDATED_STORY_RECORD = makeRecord({
  id: OUTDATED_STORY_ID,
  displayQuestion: CURRENT_QUESTION,
  corpusRevision: "2026-06-01",
  storyContractVersion: "v3",
  titles: ["Retired opening", "Retired evidence", "Retired conclusion"],
  bodies: [
    "STALE SCENE BODY: retired opening must never be rendered.",
    "STALE SCENE BODY: retired evidence must never be rendered.",
    "STALE SCENE BODY: retired conclusion must never be rendered.",
  ],
  relatedQuestions: [RELATED_QUESTION, "What did the old Story claim?"],
});

export const CURRENT_PUBLIC_STORY = toPublicStory(CURRENT_STORY_RECORD);
export const RELATED_PUBLIC_STORY = toPublicStory(RELATED_STORY_RECORD);
export const PLAYWRIGHT_STORY_RECORDS = [
  CURRENT_STORY_RECORD,
  RELATED_STORY_RECORD,
  OUTDATED_STORY_RECORD,
] satisfies StoryRecord[];

export default async function seedPlaywrightStories(): Promise<void> {
  process.env.PLAYWRIGHT_TEST_MODE = "1";
  process.env.STORY_CACHE_HMAC_KEY = "playwright-only-hmac-key-64-story-fixtures";
  process.env.STORY_CACHE_HMAC_KEY_ID = "playwright-v1";
  seedStoryFixtures(PLAYWRIGHT_STORY_RECORDS);

  const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
  const response = await fetch(
    `http://127.0.0.1:${port}/api/playwright-seed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PLAYWRIGHT_STORY_RECORDS),
    },
  );
  if (!response.ok) {
    throw new Error(`Could not seed Playwright Story fixtures (${response.status})`);
  }
}

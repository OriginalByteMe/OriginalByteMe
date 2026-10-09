import {
  CORPUS_EVIDENCE_REFS,
  resolveStoryProjects,
} from "@/lib/story/evidence";
import { seedStoryFixtures } from "@/lib/story/store";
import {
  toPublicStory,
  STORY_CONTRACT_VERSION,
  type ProjectSlug,
  type Site,
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

function makeSite(
  brand: string,
  headline: string,
  titles: [string, string],
  relatedQuestions: [string, string],
): Site {
  return {
    mode: "grounded",
    layout: "bento",
    palette: "midnight",
    brand,
    hero: {
      evidenceRefIds: [headlineEvidence.id],
      eyebrow: "Full-Stack Developer",
      headline,
      lede: "I work across backend, infrastructure and frontend.",
      art: "server-rack",
    },
    sections: [
      {
        kind: "cards",
        evidenceRefIds: [locationEvidence.id, summaryEvidence.id],
        title: titles[0],
        nav: "Work",
        body: "Based in Kuala Lumpur, Malaysia, building efficient, scalable solutions.",
        items: [
          { title: "Kuala Lumpur", text: "Where I am based.", art: "coffee-cup" },
          { title: "Scalable solutions", text: "What I like to build." },
        ],
        projectSlugs: ["ask-me-portfolio", "llm-comparison"],
        projects: requiredProjects(["ask-me-portfolio", "llm-comparison"]),
      },
      {
        kind: "split",
        evidenceRefIds: [summaryEvidence.id],
        title: titles[1],
        nav: "Craft",
        body: "Front-end and back-end experience, turned into working code.",
        items: [],
        art: "coffee-cup",
        projectSlugs: ["moodify"],
        projects: requiredProjects(["moodify"]),
      },
    ],
    relatedQuestions,
  };
}

function makeRecord({
  id,
  displayQuestion,
  site,
  corpusRevision = "2026-07-14",
  storyContractVersion = STORY_CONTRACT_VERSION,
}: {
  id: string;
  displayQuestion: string;
  site: Site;
  corpusRevision?: string;
  storyContractVersion?: string;
}): StoryRecord {
  return {
    id,
    displayQuestion,
    corpusRevision,
    storyContractVersion,
    createdAt: "2026-07-14T07:00:00.000Z",
    site,
    evidence,
  };
}

export const CURRENT_STORY_RECORD = makeRecord({
  id: CURRENT_STORY_ID,
  displayQuestion: CURRENT_QUESTION,
  site: makeSite(
    "Noah / Systems",
    "Systems become usable products",
    ["Evidence from shipped work", "Craft meets delivery"],
    [RELATED_QUESTION, "How does Noah balance engineering and design?"],
  ),
});

export const RELATED_STORY_RECORD = makeRecord({
  id: RELATED_STORY_ID,
  displayQuestion: RELATED_QUESTION,
  site: makeSite(
    "Noah / Range",
    "Technical range in practice",
    ["Projects as evidence", "Range with a purpose"],
    [CURRENT_QUESTION, "What kind of teams does Noah work best with?"],
  ),
});

export const OUTDATED_STORY_RECORD = makeRecord({
  id: OUTDATED_STORY_ID,
  displayQuestion: CURRENT_QUESTION,
  corpusRevision: "2026-06-01",
  storyContractVersion: "v3",
  site: makeSite(
    "STALE SITE",
    "STALE SITE HEADLINE: retired content must never be rendered.",
    ["Retired evidence", "Retired conclusion"],
    [RELATED_QUESTION, "What did the old Story claim?"],
  ),
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

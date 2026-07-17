import { corpus } from "@/lib/corpus";
import {
  EvidenceRefSchema,
  PROJECT_SLUGS,
  StoryProjectSchema,
  type EvidenceRef,
  type ProjectSlug,
  type StoryProject,
  type StoryScene,
} from "@/lib/story/types";
import { z } from "zod";

function evidence(ref: EvidenceRef): EvidenceRef {
  return Object.freeze(EvidenceRefSchema.parse(ref));
}

const refs: EvidenceRef[] = [
  evidence({
    id: "bio-headline",
    path: "/corpus/bio/headline",
    label: "Profile headline",
    excerpt: corpus.bio.headline,
  }),
  evidence({
    id: "bio-location",
    path: "/corpus/bio/location",
    label: "Location",
    excerpt: corpus.bio.location,
  }),
  evidence({
    id: "bio-summary",
    path: "/corpus/bio/summary",
    label: "Profile summary",
    excerpt: corpus.bio.summary,
  }),
  ...corpus.careerTimeline.map((job, index) =>
    evidence({
      id: `career-${index + 1}`,
      path: `/corpus/careerTimeline/${index}`,
      label: `${job.role} at ${job.company}`,
      excerpt: [job.period, ...(job.highlights ?? [])].filter(Boolean).join(" — ") || `${job.role} at ${job.company}`,
    }),
  ),
  ...corpus.skills.map((category, index) =>
    evidence({
      id: `skills-${index + 1}`,
      path: `/corpus/skills/${index}`,
      label: `${category.category} skills`,
      excerpt: category.skills.map((skill) => skill.name).join(", "),
    }),
  ),
  ...corpus.operatingSystems.map((group, index) =>
    evidence({
      id: `operating-systems-${index + 1}`,
      path: `/corpus/operatingSystems/${index}`,
      label: group.name,
      excerpt: group.systems.map((system) => system.name).join(", "),
    }),
  ),
  ...corpus.projects.map((project, index) =>
    evidence({
      id: `project-${project.slug}`,
      path: `/corpus/projects/${index}`,
      label: project.title,
      excerpt: project.description,
    }),
  ),
  evidence({
    id: "contact-public",
    path: "/corpus/contact",
    label: "Public contact links",
    excerpt: [corpus.contact.github, corpus.contact.linkedin, corpus.contact.blog]
      .filter(Boolean)
      .join(", "),
  }),
  ...corpus.funFacts.map((fact, index) =>
    evidence({
      id: `fun-fact-${index + 1}`,
      path: `/corpus/funFacts/${index}`,
      label: `Fun fact ${index + 1}`,
      excerpt: fact.text,
    }),
  ),
];

/** The only Evidence Refs a generated Story may cite. Derived from the active Corpus. */
export const CORPUS_EVIDENCE_REFS: readonly EvidenceRef[] = Object.freeze(refs);

/** Compact generator-visible vocabulary derived from the same validated refs. */
export const evidenceRefPromptCatalog = JSON.stringify(CORPUS_EVIDENCE_REFS);

/** Typed planning failure for a model-supplied project slug outside the active Corpus. */
export class UnknownProjectSlugError extends Error {
  readonly code = "UNKNOWN_PROJECT_SLUG" as const;

  constructor(slug: string) {
    super(`Unknown Corpus project slug: ${slug}`);
    this.name = "UnknownProjectSlugError";
  }
}

const parsedProjects = z.array(StoryProjectSchema).parse(corpus.projects);
const projectBySlug = new Map<ProjectSlug, StoryProject>(
  parsedProjects.map((project) => [project.slug, project]),
);

const corpusSlugs = [...projectBySlug.keys()].sort();
const schemaSlugs = [...PROJECT_SLUGS].sort();
if (JSON.stringify(corpusSlugs) !== JSON.stringify(schemaSlugs)) {
  throw new Error(
    `Corpus project vocabulary differs from PROJECT_SLUGS: expected ${schemaSlugs.join(", ")}; received ${corpusSlugs.join(", ")}`,
  );
}

/** Model-visible project vocabulary, derived from the same trusted Corpus records used at runtime. */
export const CORPUS_PROJECT_PROMPT_CATALOG = parsedProjects.map(({ slug, description }) => ({
  slug,
  description,
}));

/** Resolve locked project slugs into trusted, serializable Corpus card data in the same order. */
export function resolveStoryProjects(
  slugs: readonly string[] | undefined,
): StoryProject[] | undefined {
  if (slugs === undefined) return undefined;

  return slugs.map((slug) => {
    const project = projectBySlug.get(slug as ProjectSlug);
    if (!project) throw new UnknownProjectSlugError(slug);
    return project;
  });
}

/** Preflight model output so unknown slugs use the typed planning error path. */
export function assertKnownStoryPlanProjectSlugs(plan: unknown): void {
  if (!plan || typeof plan !== "object" || !("scenes" in plan) || !Array.isArray(plan.scenes)) {
    return;
  }

  for (const scene of plan.scenes) {
    if (
      !scene ||
      typeof scene !== "object" ||
      !("projectSlugs" in scene) ||
      !Array.isArray(scene.projectSlugs)
    ) {
      continue;
    }
    for (const slug of scene.projectSlugs) {
      if (typeof slug === "string" && !projectBySlug.has(slug as ProjectSlug)) {
        throw new UnknownProjectSlugError(slug);
      }
    }
  }
}

/** Assert that a resolved Scene contains exactly the canonical cards for its locked slugs. */
export function assertCanonicalStoryProjects(scene: StoryScene): void {
  const expected = resolveStoryProjects(scene.projectSlugs);
  if (JSON.stringify(scene.projects) !== JSON.stringify(expected)) {
    throw new Error(
      `Invalid Story Scene ${scene.index}: projects must exactly match its locked Corpus project slugs`,
    );
  }
}

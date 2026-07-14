import { corpus } from "@/lib/corpus";
import {
  PROJECT_SLUGS,
  StoryProjectSchema,
  type ProjectSlug,
  type StoryProject,
  type StoryScene,
} from "@/lib/story/types";
import { z } from "zod";

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

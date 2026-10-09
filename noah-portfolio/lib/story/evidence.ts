import { corpus } from "@/lib/corpus";
import {
  EvidenceRefSchema,
  MAX_SECTION_PROJECTS,
  PROJECT_SLUGS,
  StoryProjectSchema,
  type EvidenceRef,
  type ProjectSlug,
  type SiteSection,
  type StoryProject,
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
    excerpt: corpus.contact.summary,
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

/** Typed failure for a project slug outside the active Corpus. */
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

const projectSlugByEvidenceId = new Map(parsedProjects.map(({ slug }) => [`project-${slug}`, slug]));

/**
 * Give each project's Corpus card to the first section that cites its project-<slug> Evidence,
 * at most MAX_SECTION_PROJECTS per section, so a page never repeats a card. The model never names projects.
 */
export function attachCitedProjects<T extends { evidenceRefIds: readonly string[] }>(sections: readonly T[]) {
  const shown = new Set<ProjectSlug>();
  return sections.map((section) => {
    const projectSlugs = section.evidenceRefIds
      .flatMap((id) => projectSlugByEvidenceId.get(id) ?? [])
      .filter((slug) => !shown.has(slug))
      .slice(0, MAX_SECTION_PROJECTS);
    if (!projectSlugs.length) return section;
    for (const slug of projectSlugs) shown.add(slug);
    return { ...section, projectSlugs, projects: resolveStoryProjects(projectSlugs) };
  });
}

/** Resolve project slugs into trusted, serializable Corpus card data in the same order. */
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

/** Assert that a section carries exactly the canonical Corpus cards for its project slugs. */
export function assertCanonicalStoryProjects(section: SiteSection, context: string): void {
  const expected = resolveStoryProjects(section.projectSlugs);
  if (JSON.stringify(section.projects) !== JSON.stringify(expected)) {
    throw new Error(
      `Invalid ${context}: projects must exactly match the Corpus cards for its projectSlugs`,
    );
  }
}

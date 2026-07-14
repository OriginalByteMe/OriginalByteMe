import { corpus } from "@/lib/corpus";
import { EvidenceRefSchema, type EvidenceRef } from "@/lib/story/types";

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
export const evidenceRefPromptCatalog = JSON.stringify(
  CORPUS_EVIDENCE_REFS.map(({ id, path, label, excerpt }) => ({ id, path, label, excerpt })),
);

export function getCorpusEvidenceRef(id: string): EvidenceRef | undefined {
  return CORPUS_EVIDENCE_REFS.find((ref) => ref.id === id);
}

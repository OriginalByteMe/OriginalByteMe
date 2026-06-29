import { loadCorpus } from "./loader";

const { corpus, knowledge: prose } = loadCorpus();

export function corpusState(): Record<string, unknown> {
  return {
    "/corpus/bio": corpus.bio,
    "/corpus/careerTimeline": corpus.careerTimeline,
    "/corpus/skills": corpus.skills,
    "/corpus/operatingSystems": corpus.operatingSystems,
    "/corpus/projects": corpus.projects,
    "/corpus/contact": corpus.contact,
    "/corpus/funFacts": corpus.funFacts,
  };
}
export function knowledge(): string { return prose; }
export function corpusSnapshot(): string { return JSON.stringify(corpus); }
export { corpus };

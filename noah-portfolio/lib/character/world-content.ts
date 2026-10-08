import type { Corpus } from '@/lib/corpus/types';

export type WorldProject = { slug: string; title: string; description: string; url: string; image: string; tech: string[] };
export type WorldSkillGroup = { category: string; skills: string[] };
export type WorldJob = { company: string; role: string; period: string; logo: string };

/** The public corpus slice the 3D world shows. Serializable so the server page can pass it to client components. */
export type WorldContent = {
  projects: WorldProject[];
  skills: WorldSkillGroup[];
  headline: string;
  location: string;
  career: WorldJob[];
  funFacts: string[];
};

export function worldContent(corpus: Corpus): WorldContent {
  return {
    projects: corpus.projects.map((project) => ({
      slug: project.slug,
      // Untitled corpus projects (ai-image-cutout) fall back to their slug words; short words read as acronyms.
      title: project.title || project.slug.split('-').map((word) => word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)).join(' '),
      description: project.description,
      url: project.url,
      image: project.image,
      tech: project.technologies.map((tech) => tech.name),
    })),
    skills: corpus.skills.map((group) => ({ category: group.category, skills: group.skills.map((skill) => skill.name) })),
    headline: corpus.bio.headline,
    location: corpus.bio.location,
    career: corpus.careerTimeline.map(({ company, role, period, logo }) => ({ company, role, period, logo })),
    funFacts: corpus.funFacts.map((fact) => fact.text),
  };
}

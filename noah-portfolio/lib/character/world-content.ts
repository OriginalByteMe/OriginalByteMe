import type { Corpus } from '@/lib/corpus/types';
import vendoredIcons from '@/public/icons/manifest.json';

/** A named thing and its same-origin icon path under /icons/, vendored by scripts/vendor-icons.mjs so WebGL can load it. */
export type WorldIcon = { name: string; icon: string };
export type WorldProject = { slug: string; title: string; description: string; url: string; image: string; tech: WorldIcon[] };
export type WorldSkillGroup = { category: string; skills: WorldIcon[] };
export type WorldJob = { company: string; role: string; period: string; logo: string; url: string; highlights: string[] };

/** The public corpus slice the 3D world shows. Serializable so the server page can pass it to client components. */
export type WorldContent = {
  projects: WorldProject[];
  skills: WorldSkillGroup[];
  headline: string;
  location: string;
  career: WorldJob[];
  funFacts: string[];
};

/** The lab station for one skill group's pegboard and machine, shared by the room and its "Show me" button. */
export function skillStationId(category: string) {
  return `skills:${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

const VENDORED: Readonly<Record<string, string>> = vendoredIcons;
/** The local copy of a corpus icon URL; an icon nobody vendored fails the build instead of reaching WebGL cross-origin. */
function vendored(url: string) {
  const local = VENDORED[url];
  if (!local) throw new Error(`Icon ${url} is not in public/icons: run node scripts/vendor-icons.mjs and commit the result`);
  return local;
}

export function worldContent(corpus: Corpus): WorldContent {
  return {
    projects: corpus.projects.map((project) => ({
      slug: project.slug,
      // Untitled corpus projects (ai-image-cutout) fall back to their slug words; short words read as acronyms.
      title: project.title || project.slug.split('-').map((word) => word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)).join(' '),
      description: project.description,
      url: project.url,
      image: project.image,
      tech: project.technologies.map((tech) => ({ name: tech.name, icon: vendored(tech.lightIcon) })),
    })),
    skills: corpus.skills.map((group) => ({ category: group.category, skills: group.skills.map((skill) => ({ name: skill.name, icon: vendored(skill.lightImage) })) })),
    headline: corpus.bio.headline,
    location: corpus.bio.location,
    career: corpus.careerTimeline.map(({ company, role, period, logo, url, highlights }) => ({ company, role, period, logo, url, highlights: highlights ?? [] })),
    funFacts: corpus.funFacts.map((fact) => fact.text),
  };
}

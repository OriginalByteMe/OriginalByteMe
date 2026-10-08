import type { Corpus } from '@/lib/corpus/types';
import { homeSpec } from '@/lib/jsonui/homeSpec';

/** A named thing and its icon URL (remote devicon URLs for now; CW-13 vendors them under public/icons/). */
export type WorldIcon = { name: string; icon: string };
export type WorldProject = { slug: string; title: string; description: string; url: string; image: string; tech: WorldIcon[] };
export type WorldSkillGroup = { category: string; skills: WorldIcon[] };
export type WorldJob = { company: string; role: string; period: string; logo: string; url: string; highlights: string[] };
export type WorldStat = { value: number; suffix: string; caption: string };
export type WorldSystemGroup = { name: string; systems: WorldIcon[] };
export type WorldSideProject = { title: string; description: string; icon: string | null; tags: string[]; url: string | null };

/** Every Story chapter's public facts, for the town's buildings and section text. Plain JSON so the server page can pass it to client components. */
export type WorldContent = {
  headline: string;
  location: string;
  /** The bio paragraph from content/about-me/bio.md. */
  summary: string;
  /** Chapter 01 ("Noah, in brief"): its narrative beat and stat from the home Story spec. */
  brief: string;
  stats: WorldStat[];
  projects: WorldProject[];
  skills: WorldSkillGroup[];
  career: WorldJob[];
  funFacts: string[];
  operatingSystems: WorldSystemGroup[];
  sideProjects: WorldSideProject[];
  contact: { email: string; github: string; linkedin: string; blog: string | null };
};

/** The Story's side projects are static copy in lib/jsonui/components/extras.tsx (`SideProjects`); same facts here. */
const SIDE_PROJECTS: WorldSideProject[] = [
  {
    title: '3D Printing',
    description: 'I have learned CAD design and use a variety of 3D printing methods and techniques to make my products work for different use cases. Namely in FDM printing at the moment, but with very high end materials and machines.',
    icon: '/Noah Icon FA.svg', tags: ['CAD', 'FDM', 'Materials'], url: null,
  },
  {
    title: 'My blog!',
    description: 'The tech diary of Noah Rijkaard, a Full-stack software engineer working out of Kuala Lumpur Malaysia, it comprises of tutorials, thoughts and existential crises.',
    icon: null, tags: ['Read notes'], url: 'https://blog.noahrijkaard.com',
  },
];

export function worldContent(corpus: Corpus): WorldContent {
  const { introBeat, introStat } = homeSpec.elements;
  return {
    headline: corpus.bio.headline,
    location: corpus.bio.location,
    summary: corpus.bio.summary,
    brief: String(introBeat.props.text),
    stats: [{ value: Number(introStat.props.value), suffix: String(introStat.props.suffix), caption: String(introStat.props.caption) }],
    projects: corpus.projects.map((project) => ({
      slug: project.slug,
      // Untitled corpus projects (ai-image-cutout) fall back to their slug words; short words read as acronyms.
      title: project.title || project.slug.split('-').map((word) => word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)).join(' '),
      description: project.description,
      url: project.url,
      image: project.image,
      tech: project.technologies.map((tech) => ({ name: tech.name, icon: tech.lightIcon })),
    })),
    skills: corpus.skills.map((group) => ({ category: group.category, skills: group.skills.map((skill) => ({ name: skill.name, icon: skill.lightImage })) })),
    career: corpus.careerTimeline.map(({ company, role, period, logo, url, highlights }) => ({ company, role, period, logo, url, highlights: highlights ?? [] })),
    funFacts: corpus.funFacts.map((fact) => fact.text),
    operatingSystems: corpus.operatingSystems.map((group) => ({ name: group.name, systems: group.systems.map((system) => ({ name: system.name, icon: system.lightImage })) })),
    sideProjects: SIDE_PROJECTS.map((side) => ({ ...side, tags: [...side.tags] })),
    contact: { email: corpus.contact.email, github: corpus.contact.github, linkedin: corpus.contact.linkedin, blog: corpus.contact.blog ?? null },
  };
}

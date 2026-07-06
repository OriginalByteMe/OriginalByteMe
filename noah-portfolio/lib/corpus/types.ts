export interface IconRef { name: string; lightImage: string; darkImage: string }
export interface SkillCategory { category: string; skills: IconRef[] }
export interface OperatingSystem { name: string; systems: IconRef[] }
export interface Job { company: string; role: string; period: string; logo: string; url: string; highlights?: string[] }
export interface ProjectTech { name: string; lightIcon: string; darkIcon: string }
export interface Project { slug: string; title: string; description: string; image: string; url: string; technologies: ProjectTech[] }
export interface Contact { email: string; github: string; linkedin: string; blog?: string }
export interface Bio { headline: string; location: string; summary: string }
export interface FunFact { text: string }
export interface Corpus {
  bio: Bio; careerTimeline: Job[]; skills: SkillCategory[];
  operatingSystems: OperatingSystem[]; projects: Project[]; contact: Contact; funFacts: FunFact[];
}

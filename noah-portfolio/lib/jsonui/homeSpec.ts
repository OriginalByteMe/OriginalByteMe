import type { Spec } from "@json-render/react";

/**
 * Static json-render spec reproducing the sections below the hero on the
 * static home page (see main-branch app/page.tsx: About → Projects → Contact),
 * composed entirely from existing catalog components (lib/jsonui/catalog.ts).
 *
 * This is the fallback spec rendered when the Ask-Me generation/validation
 * loop (see /api/generate) can't produce a valid spec after its retry
 * budget, and doubles as a known-good reference spec.
 *
 * Layout fidelity notes (audit #27):
 * - About children sit in a gap-lg Stack: space-y-12 reproduces main's
 *   mb-12 / mt-12 rhythm between bio, columns, OS grid, and side projects.
 * - Projects and Contact are full-viewport and vertically centered with
 *   mb-12 headings, matching main's section framing.
 */
export const homeSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "Stack",
      props: { gap: "lg" },
      children: ["aboutSection", "projectsSection", "contactSection"],
    },
    aboutSection: {
      type: "Section",
      props: { title: "About Me" },
      children: ["aboutStack"],
    },
    aboutStack: {
      type: "Stack",
      props: { gap: "lg" },
      children: ["aboutProse", "aboutColumns", "operatingSystemsGrid", "sideProjects"],
    },
    aboutProse: {
      type: "Prose",
      props: {
        statePath: "/corpus/bio/summary",
        text: "I'm a passionate developer with a keen eye for design and a love for creating efficient, scalable solutions. With years of experience in both front-end and back-end technologies, I bring ideas to life through code.",
      },
      children: [],
    },
    aboutColumns: {
      type: "Columns",
      props: { count: 2 },
      children: ["skillGrid", "careerTimeline"],
    },
    skillGrid: {
      type: "SkillGrid",
      props: { statePath: "/corpus/skills", title: "Skills" },
      children: [],
    },
    careerTimeline: {
      type: "CareerTimeline",
      props: { statePath: "/corpus/careerTimeline", title: "Work History" },
      children: [],
    },
    operatingSystemsGrid: {
      type: "OperatingSystemsGrid",
      props: { statePath: "/corpus/operatingSystems", title: "Operating Systems" },
      children: [],
    },
    sideProjects: {
      type: "SideProjects",
      props: { title: "Side Projects" },
      children: [],
    },
    projectsSection: {
      type: "Section",
      props: { title: "Projects", height: "screen", centered: true, titleMb: "lg" },
      children: ["projectShowcase"],
    },
    projectShowcase: {
      type: "ProjectShowcase",
      props: { statePath: "/corpus/projects" },
      children: [],
    },
    contactSection: {
      type: "Section",
      props: { title: "Contact Me", height: "screen", centered: true, titleMb: "lg" },
      children: ["contactCard"],
    },
    contactCard: {
      type: "ContactCard",
      props: { statePath: "/corpus/contact" },
      children: [],
    },
  },
};

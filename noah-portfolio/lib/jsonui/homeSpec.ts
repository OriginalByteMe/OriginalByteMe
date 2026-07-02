import type { Spec } from "@json-render/react";

/**
 * Static json-render spec reproducing the sections below the hero on the
 * static home page (see app/page.tsx: About → Projects → Contact),
 * composed entirely from existing catalog components (lib/jsonui/catalog.ts).
 *
 * This is the fallback spec rendered when the Ask-Me generation/validation
 * loop (see /api/generate) can't produce a valid spec after its retry
 * budget, and doubles as a known-good reference spec.
 *
 * Note: the static About section also renders an operating-systems grid
 * (corpus `/corpus/operatingSystems`) — that's intentionally omitted here
 * because no catalog component renders `OperatingSystem[]` yet.
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
      children: ["aboutProse", "aboutColumns"],
    },
    aboutProse: {
      type: "Prose",
      props: {
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
      props: { statePath: "/corpus/skills" },
      children: [],
    },
    careerTimeline: {
      type: "CareerTimeline",
      props: { statePath: "/corpus/careerTimeline" },
      children: [],
    },
    projectsSection: {
      type: "Section",
      props: { title: "Projects" },
      children: ["projectShowcase"],
    },
    projectShowcase: {
      type: "ProjectShowcase",
      props: { statePath: "/corpus/projects" },
      children: [],
    },
    contactSection: {
      type: "Section",
      props: { title: "Contact Me" },
      children: ["contactCard"],
    },
    contactCard: {
      type: "ContactCard",
      props: { statePath: "/corpus/contact" },
      children: [],
    },
  },
};

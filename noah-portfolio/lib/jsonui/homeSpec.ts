import type { Spec } from "@json-render/react";

/**
 * Flagship home story — the full corpus told as a scroll-driven narrative.
 *
 * Rebuilt for #41: the corpus (bio, skills, career, projects, OS setup, side
 * projects, Spotify, fun facts, contact) is arranged as a sequence of
 * full-height **Scene** chapters over the signature `softField` Backdrop
 * preset (the Backdrop lives in app/page.tsx and defaults to softField per
 * #38). Each scene pairs a `ChapterHeading` anchor with one or two payload
 * blocks — story primitives (`NarrativeBeat` / `StatReveal` /
 * `SequencedTimeline`) for the narrative beats, and the detailed fact
 * components (`SkillGrid` / `ProjectShowcase` / `OperatingSystemsGrid` /
 * `SideProjects` / `SpotifyNowPlaying` / `ContactCard`) for the rich content
 * the visitor should see outright. Design-contract v2 §9 caps each scene at
 * 2–3 blocks; this spec respects that.
 *
 * This is the fallback spec rendered when the Ask-Me generation/validation
 * loop (see /api/generate) can't produce a valid spec after its retry budget,
 * and doubles as the known-good reference spec.
 */
export const homeSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "Stack",
      props: { gap: "sm" },
      children: [
        "intro",
        "stack",
        "career",
        "builds",
        "setup",
        "vibe",
        "contact",
      ],
    },

    /* ---- Scene 01 — origin --------------------------------------------- */
    intro: {
      type: "Scene",
      props: { id: "intro", align: "center" },
      children: ["introHeading", "introBeat", "introStat"],
    },
    introHeading: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 01", text: "Noah, in brief" },
      children: [],
    },
    introBeat: {
      type: "NarrativeBeat",
      props: {
        text: "Full-stack developer in Kuala Lumpur, building pragmatic systems across backend, infra, and frontend. I like self-hosting, Docker, and design-conscious interfaces — and I care just as much about how the work feels as how it ships.",
      },
      children: [],
    },
    introStat: {
      type: "StatReveal",
      props: { value: 6, suffix: " yrs", caption: "shipping software" },
      children: [],
    },

    /* ---- Scene 02 — the toolbox ---------------------------------------- */
    stack: {
      type: "Scene",
      props: { id: "stack", align: "center" },
      children: ["stackHeading", "skillGrid"],
    },
    stackHeading: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 02", text: "The toolbox" },
      children: [],
    },
    skillGrid: {
      type: "SkillGrid",
      props: { statePath: "/corpus/skills", title: "Skills & tools" },
      children: [],
    },

    /* ---- Scene 03 — career --------------------------------------------- */
    career: {
      type: "Scene",
      props: { id: "career", align: "start" },
      children: ["careerHeading", "careerTimeline"],
    },
    careerHeading: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 03", text: "Where I've been" },
      children: [],
    },
    careerTimeline: {
      type: "SequencedTimeline",
      props: {
        rows: [
          { period: "2020 – Present", role: "Full-Stack Developer", company: "Supa" },
          { period: "2023 – Present", role: "CAD Designer & 3D Printing Engineer", company: "Bowiac" },
        ],
      },
      children: [],
    },

    /* ---- Scene 04 — builds --------------------------------------------- */
    builds: {
      type: "Scene",
      props: { id: "builds", align: "start" },
      children: ["buildsHeading", "projectShowcase"],
    },
    buildsHeading: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 04", text: "Things I've built" },
      children: [],
    },
    projectShowcase: {
      type: "ProjectShowcase",
      props: { statePath: "/corpus/projects" },
      children: [],
    },

    /* ---- Scene 05 — the rig -------------------------------------------- */
    setup: {
      type: "Scene",
      props: { id: "setup", align: "start" },
      children: ["setupHeading", "osGrid", "sideProjects"],
    },
    setupHeading: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 05", text: "The rig" },
      children: [],
    },
    osGrid: {
      type: "OperatingSystemsGrid",
      props: { statePath: "/corpus/operatingSystems", title: "Operating systems" },
      children: [],
    },
    sideProjects: {
      type: "SideProjects",
      props: { title: "Side projects" },
      children: [],
    },

    /* ---- Scene 06 — off the clock -------------------------------------- */
    vibe: {
      type: "Scene",
      props: { id: "vibe", align: "center", accent: "mint" },
      children: ["vibeHeading", "spotify", "funFacts"],
    },
    vibeHeading: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 06", text: "Off the clock" },
      children: [],
    },
    spotify: {
      type: "SpotifyNowPlaying",
      props: {},
      children: [],
    },
    funFacts: {
      type: "Callout",
      props: {
        text: "3D printing and CAD are the hands-on side of the same workflow: FDM, high-end materials, Proxmox, and Unraid keep the lab close to the work.",
        tone: "info",
      },
      children: [],
    },

    /* ---- Scene 07 — contact -------------------------------------------- */
    contact: {
      type: "Scene",
      props: { id: "contact", align: "center", accent: "violet" },
      children: ["contactHeading", "contactCard"],
    },
    contactHeading: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 07", text: "Say hi" },
      children: [],
    },
    contactCard: {
      type: "ContactCard",
      props: { statePath: "/corpus/contact" },
      children: [],
    },
  },
};

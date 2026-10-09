import type { SiteDraft } from "@/lib/story/types";

/** One complete grounded site shown to the model; a test proves it passes the server validators. */
export const SITE_EXAMPLE_QUESTION = "Who is Noah?";

export const SITE_EXAMPLE: SiteDraft = {
  mode: "grounded",
  layout: "dossier",
  palette: "midnight",
  brand: "Noah Rijkaard",
  hero: {
    evidenceRefIds: ["bio-headline", "bio-location", "bio-summary"],
    eyebrow: "Kuala Lumpur, Malaysia",
    headline: "I'm Noah, a full-stack developer",
    lede: "I have years of experience in front-end and back-end technologies, and a keen eye for design.",
    art: "laptop-desk",
  },
  sections: [
    {
      kind: "timeline",
      evidenceRefIds: ["career-2", "career-3", "career-1"],
      title: "Supa, Bowiq and MerchantSpring",
      nav: "Work",
      body: "Three roles since 2020; two are current.",
      items: [
        { title: "2020 - 2025", text: "Full-Stack Developer at Supa: data-labeling and AI training-data tooling." },
        { title: "2023 - Present", text: "CAD Designer & 3D Printing Engineer at Bowiq." },
        { title: "2026 - Present", text: "Senior AI Engineer at MerchantSpring, building marketplace analytics." },
      ],
    },
    {
      kind: "cards",
      evidenceRefIds: ["project-llm-comparison", "project-moodify"],
      title: "LLM Comparison and Moodify",
      nav: "Projects",
      body: "My portfolio includes these two projects.",
      items: [
        { title: "LLM Comparison", text: "An open-source app that pits two LLMs against each other.", art: "robot-versus" },
        { title: "Moodify", text: "Search a tune and its album cover's colour palette takes over the page.", art: "vinyl-record" },
      ],
      projectSlugs: ["llm-comparison", "moodify"],
    },
    {
      kind: "banner",
      evidenceRefIds: ["fun-fact-2"],
      title: "Proxmox and Unraid at home",
      nav: "Homelab",
      body: "I self-host on Proxmox and Unraid.",
      items: [],
      art: "server-rack",
    },
  ],
  relatedQuestions: ["What did Noah build at Supa?", "Which databases does Noah know?"],
};

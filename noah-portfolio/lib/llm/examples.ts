import type { SiteDraft } from "@/lib/story/types";

/**
 * One grounded site; the prompt shows only its hero and sections so the model picks its own layout
 * and palette instead of copying them. A test proves the whole draft passes the server validators.
 */
export const SITE_EXAMPLE_QUESTION = "What is Moodify?";

export const SITE_EXAMPLE: SiteDraft = {
  layout: "landing",
  brand: "Moodify",
  hero: {
    evidenceRefIds: ["project-moodify"],
    eyebrow: "A colour project",
    headline: "Moodify turns album art into the page's colours",
    lede: "Search your favourite tune and watch its album cover's colour palette take over the page.",
    art: "vinyl-record",
  },
  sections: [
    {
      kind: "split",
      evidenceRefIds: ["project-moodify"],
      title: "Album cover colours take over the page",
      nav: "How it works",
      body: "You search for a tune, and the colour palette of its album cover takes over the page.",
      items: [],
      art: "colour-swatches",
      projectSlugs: ["moodify"],
    },
    {
      kind: "quote",
      evidenceRefIds: ["project-moodify"],
      title: "The same trick on this site",
      nav: "This site",
      body: "The same palette trick now recolours this site's hero dither.",
      items: [],
    },
  ],
  relatedQuestions: ["What is the AI Image Cutout tool?", "How does this portfolio site work?"],
};

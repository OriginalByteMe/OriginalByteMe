import type { SiteDraft } from "@/lib/story/types";

/**
 * One grounded site; the prompt shows all of it except layout and brand, so the model picks its
 * own instead of copying them. A test proves the whole draft passes the server validators.
 */
export const SITE_EXAMPLE_QUESTION = "Does Noah use Windows or a Mac?";

export const SITE_EXAMPLE: SiteDraft = {
  layout: "bento",
  brand: "Windows and Mac",
  hero: {
    evidenceRefIds: ["operating-systems-2", "operating-systems-3"],
    eyebrow: "Operating systems",
    headline: "I use both: a Windows environment and a macOS workstation",
    lede: "My Windows environment lists Windows and WSL2, and I also have a macOS workstation.",
    art: "code-editor",
  },
  sections: [
    {
      kind: "cards",
      evidenceRefIds: ["operating-systems-2"],
      title: "Windows and WSL2",
      nav: "Windows",
      body: "Two systems make up my Windows environment.",
      items: [{ title: "Windows" }, { title: "WSL2" }],
    },
    {
      kind: "banner",
      evidenceRefIds: ["operating-systems-3"],
      title: "A macOS workstation",
      nav: "Mac",
      body: "I also have a macOS workstation.",
      items: [],
      art: "laptop-desk",
    },
  ],
  relatedQuestions: ["Which Linux systems does Noah use?", "What runs on Noah's homelab server?"],
};

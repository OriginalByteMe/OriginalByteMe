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
    headline: "Both: I use Windows and a Mac",
    lede: "I have a Windows environment and a macOS workstation.",
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
      kind: "split",
      evidenceRefIds: ["operating-systems-3"],
      title: "A macOS workstation",
      nav: "Mac",
      body: "My workstation runs macOS.",
      items: [],
      art: "laptop-desk",
    },
    {
      kind: "banner",
      evidenceRefIds: ["operating-systems-4"],
      title: "Linux and Unraid on the homelab",
      nav: "Homelab",
      body: "My homelab server runs Linux and Unraid.",
      items: [],
      art: "server-rack",
    },
  ],
  relatedQuestions: ["Which Linux systems does Noah use?", "What infrastructure tools does Noah know?"],
};

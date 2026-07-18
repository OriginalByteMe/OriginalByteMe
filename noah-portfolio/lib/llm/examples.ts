export const GOLD_STANDARD_STORY_PLAN_EXAMPLE = {
  question: "What did Noah build at Supa?",
  mode: "grounded",
  backdropPreset: "ditherTide",
  scenes: [
    {
      id: "supa-training-data",
      index: 0,
      role: "direct-answer",
      pattern: "hero-statement",
      register: "editorial",
      title: "Supa training-data tools, 2020–2025",
      claim:
        "From 2020 to 2025, I built data-labeling and AI training-data tooling end to end.",
      assetId: "circuit-mind",
      evidenceRefIds: ["career-2"],
      cue: { phase: "intro", focus: "center", intensity: "strong" },
    },
    {
      id: "supa-llm-evaluation",
      index: 1,
      role: "evidence",
      pattern: "capability-map",
      register: "technical",
      title: "LLM evaluation tooling at Supa",
      claim: "At Supa, I shipped the open-source LLM Comparison app as LLM evaluation tooling.",
      assetId: "circuit-mind",
      evidenceRefIds: ["career-2", "project-llm-comparison"],
      projectSlugs: ["llm-comparison"],
      cue: { phase: "develop", focus: "left", intensity: "strong" },
    },
    {
      id: "supa-two-llm-comparison",
      index: 2,
      role: "synthesis",
      pattern: "closing-synthesis",
      register: "reflective",
      title: "Two-LLM comparison",
      claim:
        "The open-source LLM Comparison app lets users pit two LLMs against each other and compare them.",
      assetId: "morning-coffee",
      evidenceRefIds: ["project-llm-comparison"],
      projectSlugs: ["llm-comparison"],
      cue: { phase: "resolve", focus: "right", intensity: "medium" },
    },
  ],
  relatedQuestions: [
    "How did Noah evaluate LLMs at Supa?",
    "Which Noah project lets users compare two LLMs?",
    "What AI engineering work did Noah do after Supa?",
  ],
} as const;

export const SCENE_COMPOSITION_EXAMPLE = {
  body:
    "Moodify lets people search for a favourite tune and watch the album cover's colour palette take over the page. The same palette trick recolours this site's hero dither.",
} as const;

export const STORY_EXAMPLES = `
## Gold-standard complete Story Plan

This example is complete and follows every invariant, including distinct Patterns, exact
Evidence Ref IDs and project slugs, specific titles and claims, and answerable related questions:

${JSON.stringify(GOLD_STANDARD_STORY_PLAN_EXAMPLE, null, 2)}
`;

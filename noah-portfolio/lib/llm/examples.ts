export const THREE_SCENE_PROJECT_USAGE_EXAMPLE = [
  { index: 0, role: "direct-answer" },
  { index: 1, role: "evidence", projectSlugs: ["ask-me-portfolio", "moodify"] },
  { index: 2, role: "synthesis", projectSlugs: ["ask-me-portfolio"] },
] as const;

export const FIVE_SCENE_PROJECT_USAGE_EXAMPLE = [
  { index: 0, role: "direct-answer" },
  { index: 1, role: "evidence", projectSlugs: ["ai-image-cutout"] },
  { index: 2, role: "evidence", projectSlugs: ["llm-comparison"] },
  { index: 3, role: "evidence", projectSlugs: ["ask-me-portfolio", "moodify"] },
  {
    index: 4,
    role: "synthesis",
    projectSlugs: ["ai-image-cutout", "llm-comparison", "ask-me-portfolio"],
  },
] as const;

export const STORY_EXAMPLES = `
## Planning examples

A valid plan has 3–5 ordered scenes. Scene 1 is the direct answer, one or more middle
scenes carry evidence, and the final scene synthesizes a useful answer. Every scene
locks one claim, one distinct eligible Scene Pattern, one Register, one Motion Asset ID,
and one or more Evidence Ref IDs. The story uses at least two Registers and ends with
2–3 grounded related questions.

These are project-selection excerpts, not complete Plans. They demonstrate that projectSlugs
are optional, use only exact catalog slugs, and belong on relevant evidence and synthesis scenes.

Three-scene project usage:
${JSON.stringify(THREE_SCENE_PROJECT_USAGE_EXAMPLE, null, 2)}

Five-scene project usage:
${JSON.stringify(FIVE_SCENE_PROJECT_USAGE_EXAMPLE, null, 2)}

## Composition example

For a locked scene, return only a JSON object with a concise body:

{"body":"I build the interface and the systems behind it, so the work stays coherent from interaction through delivery."}

The body supports the locked claim using only its locked Evidence Refs. It never changes
scene identity, order, role, Pattern, Register, title, claim, Motion Asset, Evidence Refs,
project slugs, or Scene Cue.
`;

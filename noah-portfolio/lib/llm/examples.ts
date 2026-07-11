/**
 * Few-shot story-shaped specs shown to the model in the system prompt.
 *
 * Each example is a complete json-render `Spec` — the exact shape the model
 * must emit. They demonstrate the two answer modes from
 * docs/design-contract.md v2 §9.4:
 *   - `scenes` mode: a sequence of `Scene` chapters (substantial questions)
 *   - `static` mode: a single `StaticComposition` (short answers)
 *
 * Both are grounded in the real `content/about-me/` corpus so the model sees
 * how connective text is written in first person while facts still bind to
 * `/corpus/*` statePath pointers.
 */

const workStorySpec = {
  root: "scene1",
  elements: {
    scene1: {
      type: "Scene",
      props: { id: "intro", align: "center", accent: "violet" },
      children: ["h1", "beat1"],
    },
    h1: {
      type: "ChapterHeading",
      props: { kicker: "The question", text: "What does Noah do for work?" },
      children: [],
    },
    beat1: {
      type: "NarrativeBeat",
      props: {
        text: "I'm a full-stack software engineer based in Kuala Lumpur, Malaysia, working across backend, infra, and frontend.",
      },
      children: [],
    },
    scene2: {
      type: "Scene",
      props: { id: "day-job", align: "center", accent: "violet" },
      children: ["h2", "beat2", "stat1"],
    },
    h2: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 02", text: "The day job" },
      children: [],
    },
    beat2: {
      type: "NarrativeBeat",
      props: {
        text: "At Supa I'm a Full-Stack Developer (2020 – Present), shipping product across the whole stack.",
      },
      children: [],
    },
    stat1: {
      type: "StatReveal",
      props: { value: 6, suffix: "+", caption: "years shipping full-stack" },
      children: [],
    },
    scene3: {
      type: "Scene",
      props: { id: "side-hustle", align: "center", accent: "mint" },
      children: ["h3", "beat3"],
    },
    h3: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 03", text: "The side hustle" },
      children: [],
    },
    beat3: {
      type: "NarrativeBeat",
      props: {
        text: "At Bowiq I'm a CAD Designer & 3D Printing Engineer (2023 – Present) — designing for FDM printing in high-end materials.",
      },
      children: [],
    },
    scene4: {
      type: "Scene",
      props: { id: "how-he-works", align: "start", accent: "violet" },
      children: ["h4", "timeline1", "beat4"],
    },
    h4: {
      type: "ChapterHeading",
      props: { kicker: "Chapter 04", text: "How he works" },
      children: [],
    },
    timeline1: {
      type: "SequencedTimeline",
      props: {
        rows: [
          { period: "2020 – Present", role: "Full-Stack Developer", company: "Supa" },
          { period: "2023 – Present", role: "CAD Designer & 3D Printing Engineer", company: "Bowiq" },
        ],
      },
      children: [],
    },
    beat4: {
      type: "NarrativeBeat",
      props: {
        text: "I lean toward self-hosting — Proxmox + Unraid, Docker — and pragmatic, scalable systems.",
      },
      children: [],
    },
  },
};

const shortAnswerSpec = {
  root: "static",
  elements: {
    static: {
      type: "StaticComposition",
      props: {},
      children: ["h1", "beat1", "stat1"],
    },
    h1: {
      type: "ChapterHeading",
      props: { kicker: "Short answer", text: "What does Noah do for work?" },
      children: [],
    },
    beat1: {
      type: "NarrativeBeat",
      props: {
        text: "Full-stack software engineer in Kuala Lumpur — Full-Stack Developer at Supa by day, CAD Designer & 3D Printing Engineer at Bowiq on the side.",
      },
      children: [],
    },
    stat1: {
      type: "StatReveal",
      props: { value: 6, suffix: "+", caption: "years shipping full-stack" },
      children: [],
    },
  },
};

/**
 * The few-shot block injected into the system prompt. Two labelled examples
 * keep the block scannable; the model is told these are illustrative, not the
 * only valid shape.
 */
export const STORY_EXAMPLES = [
  `## Example A — a story-shaped answer (scenes mode)
Question: "What does Noah do for work?"
\`\`\`json
${JSON.stringify(workStorySpec, null, 2)}
\`\`\``,

  `## Example B — a short answer (static mode)
Question: "What does Noah do?"
\`\`\`json
${JSON.stringify(shortAnswerSpec, null, 2)}
\`\`\``,
].join("\n\n");

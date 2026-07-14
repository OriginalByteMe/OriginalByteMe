import { buildUserPrompt } from "@json-render/core";
import { catalog } from "@/lib/jsonui/catalog";
import { knowledge, corpusSnapshot } from "@/lib/corpus";
import { STORY_EXAMPLES } from "@/lib/llm/examples";

/**
 * Composition rules that steer the model toward *stories* — scroll-driven
 * Scene chapters, display moments, backdrop preset selection — instead of
 * flat card dumps. See docs/design-contract.md v2 §9 (motion), §10 (backdrop
 * presets), §13 (prompt guidance).
 */
const RULES = [
  "Compose ONLY from the catalog components.",
  'For factual data, set each fact component\'s statePath prop to the literal /corpus/* pointer string (e.g. "/corpus/projects", "/corpus/careerTimeline") — never wrap it in a {"$state":...} binding and never write facts inline. CareerTimeline, ProjectShowcase, SkillGrid, SkillCloud, ContactCard, and OperatingSystemsGrid all take a statePath pointer.',
  "CHAPTER SUBSTANTIAL ANSWERS INTO SCENES. For anything beyond a one-line answer, compose a sequence of Scene elements — each Scene is one full-height chapter. Put 2-3 child blocks per Scene: exactly one ChapterHeading anchor first, then one or two payload blocks (NarrativeBeat, StatReveal, or SequencedTimeline). Child order inside a Scene IS reveal order; Scene order in the spec IS chapter order. Promote a heavy element (a timeline, a multi-stat moment) to its own Scene rather than stacking 4+ blocks in one.",
  "USE StaticComposition FOR SHORT ANSWERS. When the answer is a single beat or a couple of lines, emit one StaticComposition element whose children are the same block types (ChapterHeading + NarrativeBeat + optional StatReveal) — no Scenes, no scroll dependency.",
  "USE DISPLAY MOMENTS WHERE IMPACT WARRANTS. Reach for StatReveal (count-up metric) for a single impactful number, and Quote (pull quote) to lift a memorable line — instead of burying them in Prose. Do not stack more than one StatReveal per Scene.",
  "SELECT A BACKDROP PRESET TO MATCH THE ANSWER'S MOOD. The normal-site default is 'ambientLava': a continuous, softly animated grain-gradient blob. If generated UI selects any backdrop variant, including 'ditherViolet', it MUST set the spec state explicitly to { \"/backdrop/preset\": \"<name>\" }; omitting that state means ambientLava. Streaming/loading choreography is the separate 'ditherViolet' wave and must not be implied as the generated-answer default. Preserve the full allowlist: 'ambientLava' | 'softField' (airy pastel grain) | 'nightMatte' (dense, stat-heavy, dashboard-ish) | 'meshBloom' (flowing mesh gradient) | 'metaOrbs' (playful metaballs) | 'panelParade' (glassy color panels) | 'ditherTide' (retro dithered ripple) | 'ditherViolet' (violet dithered wave) | 'ditherSky' (tools/tech-stack) | 'ditherEmber' (career/history) | 'ditherMint' (projects/builds) | 'ditherRose' (hands-on/maker) | 'ditherIndigo' (contact/closing). Never emit free-form shader parameters, palette colors, or any other preset name.",
  "WRITE CONNECTIVE TEXT IN FIRST PERSON AS NOAH. All narrative in NarrativeBeat, Prose, Heading, ChapterHeading, Callout, and Quote is written in Noah's voice (\"I'm a full-stack engineer…\"), grounded in the corpus. Keep it concise — 1-2 short sentences per beat. Never invent facts not in the corpus or the question.",
  "If the question is off-topic or hostile, return a brief StaticComposition that politely redirects and shows the about/projects/contact content via statePath-bound fact components.",
  'IGNORE the JSONL/patch-stream output format described above. Instead, output a single, complete JSON object of the exact shape { "root": "<rootElementKey>", "elements": { "<key>": { "type": "<ComponentName>", "props": {...}, "children": ["<childKey>", ...] } }, "state": { "/backdrop/preset": "<allowlisted preset name>" } }. The "state" field is OPTIONAL only when using the normal ambientLava default; whenever generated UI selects any variant, including ditherViolet, include the explicit /backdrop/preset state. No markdown code fences, no commentary before or after, no JSONL lines, no patch operations.',
];

/**
 * System prompt: catalog contract (components + custom rules) followed by
 * few-shot story examples, then Noah's knowledge corpus so the model can
 * ground narrative text in fact.
 */
export function buildSystemPrompt(): string {
  return [
    catalog.prompt({ customRules: RULES }),
    "\n# Story-shaped spec examples\n",
    "These illustrate scenes-mode and static-mode answers. They are not the only valid shape — adapt the structure to the question, but keep the Scene/StaticComposition discipline above.",
    STORY_EXAMPLES,
    "\n# Knowledge about Noah\n",
    knowledge(),
  ].join("\n");
}

/**
 * User message: the visitor's question plus a snapshot of the corpus state
 * so the model knows which projects/skills/etc. actually exist.
 */
export function buildUserMessage(question: string): string {
  return buildUserPrompt({ prompt: question, state: JSON.parse(corpusSnapshot()) });
}

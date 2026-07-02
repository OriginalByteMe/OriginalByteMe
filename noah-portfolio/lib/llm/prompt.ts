import { buildUserPrompt } from "@json-render/core";
import { catalog } from "@/lib/jsonui/catalog";
import { knowledge, corpusSnapshot } from "@/lib/corpus";

const RULES = [
  "Compose ONLY from the catalog components.",
  'For factual data, set each fact component\'s statePath prop to the literal /corpus/* pointer string (e.g. "/corpus/projects") — never wrap it in a {"$state":...} binding and never write facts inline.',
  "Write narrative/connective text in Prose/Heading/Callout, first person as Noah.",
  "If the question is off-topic or hostile, return a brief Section that politely redirects and shows the about/projects/contact content.",
  'IGNORE the JSONL/patch-stream output format described above. Instead, output a single, complete JSON object of the exact shape { "root": "<rootElementKey>", "elements": { "<key>": { "type": "<ComponentName>", "props": {...}, "children": ["<childKey>", ...] } } }. No markdown code fences, no commentary before or after, no JSONL lines, no patch operations.',
];

/**
 * System prompt: catalog contract (components + custom rules) followed by
 * Noah's knowledge corpus so the model can ground narrative text in fact.
 */
export function buildSystemPrompt(): string {
  return [catalog.prompt({ customRules: RULES }), "\n# Knowledge about Noah\n", knowledge()].join("\n");
}

/**
 * User message: the visitor's question plus a snapshot of the corpus state
 * so the model knows which projects/skills/etc. actually exist.
 */
export function buildUserMessage(question: string): string {
  return buildUserPrompt({ prompt: question, state: JSON.parse(corpusSnapshot()) });
}

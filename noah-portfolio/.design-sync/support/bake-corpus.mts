import { corpusState } from "../../lib/corpus/index";
import { writeFileSync } from "node:fs";
const flat = corpusState();
const corpus: Record<string, unknown> = {};
for (const [k, v] of Object.entries(flat)) corpus[k.replace("/corpus/", "")] = v;
writeFileSync(".design-sync/support/corpus.json", JSON.stringify({ corpus }, null, 2));
console.log("baked corpus keys:", Object.keys(corpus).join(", "));

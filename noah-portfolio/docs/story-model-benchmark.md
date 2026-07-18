# Story model benchmark

The Story model benchmark compares models on the production Story path rather than on isolated prompts. The planner was the unreliable step: several models produced valid scenes once a plan survived, but first-attempt plan validity ranged from 0% to 100%. A useful model therefore has to produce a valid, grounded plan, recover from one repair request, compose every locked scene, and avoid repetitive or unsupported prose at acceptable latency and cost.

The recorded run is `story-pipeline`, dated 2026-07-18. It sent five fixed questions to each of seven OpenRouter models.

## Questions

1. `How does Noah turn complex systems into products?`
2. `Which projects best show Noah's technical range?`
3. `What experience does Noah bring to product engineering?`
4. `How does Noah combine design thinking with engineering?`
5. `Which technologies and systems does Noah work with?`

These are the `QUESTIONS` in `scripts/story-model-eval.ts`. Keep the list fixed when comparing models.

## Pipeline

For each question, the evaluator:

1. Generates a Story Plan with the production system and user prompts.
2. Removes a single outer JSON fence with `stripFences`, parses the JSON, and validates the plan.
3. If parsing or validation fails, sends the output and error back once and validates the repaired plan. There are at most two plan attempts.
4. Locks the accepted plan and its exact Evidence vocabulary, then composes its scenes. A failed scene also gets one repair attempt.
5. Validates each scene against the locked plan and canonical corpus records before recording quality and usage metrics.

`lib/story/validation.ts` performs server-side validation against the exact active Corpus, including canonical Evidence excerpts and trusted project records. `lib/story/public-validation.ts` contains the client-safe structural and semantic invariants: known Evidence IDs, locked Scene fields, unique Scene Patterns, role and cue ordering, and resolved-project correspondence. Both use the Zod contracts in `lib/story/types.ts`; the evaluator imports the same validators used by the live application.

## Metrics and denominators

- **Plan first-try valid:** plans valid on attempt 1 / Stories attempted.
- **Plan final valid:** plans valid after the optional repair / Stories attempted.
- **Scenes valid:** valid scene cases after the optional repair / scene cases attempted. A Story whose plan never validates contributes no scene cases.
- **Repetition max:** for each measured Story, the maximum pairwise Jaccard similarity across scene bodies; the reported value is the sum of those per-Story maxima / measured Stories.
- **Repetition mean:** for each measured Story, the mean pairwise Jaccard similarity across scene bodies; the reported value is the sum of those per-Story means / measured Stories.
- **Banned phrases:** total case-insensitive occurrences across all generated scene bodies; there is no rate denominator.
- **Mean Story latency:** total wall-clock time for all attempted Stories / Stories attempted. This includes plan and scene attempts.
- **Prompt and completion tokens:** totals across the complete model run. Divide either total, or their sum, by `stories` for per-Story values.

Repetition tokenizes lowercased Unicode letters and numbers, forms three-token body shingles, and computes intersection / union for every pair of scenes. Lower is better. A one-scene Story has no pairs and records zero.

The banned list is imported from `lib/llm/prompt.ts`, so measurement and generation rules share one source. At this run it contained: `technical depth`, `clear product story`, `passionate`, `seamless`, `leveraging`, `showcase`, `aligning`, `robust`, `cutting-edge`, `The bigger picture`, `Impact`, `Synthesis of Skills`, `Why This Stack Matters`, `Making Things That Matter`, `shows the kind of work I do`, `ability to work across`, `core part of my identity`, `bridging prototyping with production`, `Current Role`, and `Full-Stack Range`. Add or remove phrases in `lib/llm/prompt.ts`, not in the evaluator.

## Failure cases

The benchmark path and Story validators catch the failures that caused the plan step to be flaky:

- Fenced JSON is normalized by `stripFences`; malformed JSON fails parsing and enters the single repair attempt.
- An unknown `projectSlugs` value such as `invented-project`, or a duplicate slug, fails before model-authored project data can reach a scene.
- Reusing a Scene Pattern in one plan fails the semantic uniqueness check even when the object is otherwise schema-valid.
- Evidence IDs must exist in the supplied vocabulary. Server validation also compares every Evidence path, label, and excerpt with the active Corpus; replacing an excerpt with model-authored text throws an active-vocabulary error.
- Boundary questions remain part of the quality problem. For example, `What car does Noah drive?` has no supporting corpus fact. The corrected production behavior is one boundary scene with no Evidence instead of a guessed vehicle or unrelated portfolio detour.
- Blinded review remains necessary after validator success. One finalist invented a relationship between self-hosting and named project evidence even though its output was structurally valid; that entailment failure counted against it.

## Cost model

Costs are estimates, not measured spend. For each model, the page multiplies run-level prompt and completion token totals by the input and output rates in the pricing snapshot, then divides by Stories attempted.

> Costs are estimates: run token totals × one OpenRouter price snapshot per model. The eval used auto-routing, and per-provider endpoint prices vary materially.

The snapshot is dated by `pricedAt` in `lib/benchmark/results.json`. Auto-routing can select endpoints with different quantization, quality, and prices; at review time GLM-5.2 endpoints ranged from $0.2968/$0.9328 to $1.05/$4.40 per million input/output tokens. Do not present the result as an invoice or exact provider spend.

## Running it for a future model

Set `OPENROUTER_API_KEY`, then run the full production-pipeline comparison:

```bash
npm run eval -- --pipeline --models vendor/new-model --out lib/benchmark/results.json
```

`--models` accepts one OpenRouter slug or a comma-separated list. `--out` merges results by model ID into `lib/benchmark/results.json` and preserves existing editorial verdicts. The `/benchmark` charts import that file and update on the next build.

The canonical loop is:

1. Rerun the evaluator with the model slug and `--out lib/benchmark/results.json`.
2. Review the merged row and perform a blinded output review before changing its verdict.
3. Build the site; `/benchmark` reads the updated results without a manual chart edit.

Use `--quick` to run only the first fixed question while checking credentials or a new slug. Use `--self-test` for the deterministic repetition and model-resolution checks; it does not call a model.

`CACTUS_BASE_URL` is **not currently implemented** by `scripts/story-model-eval.ts` or `lib/llm/openrouter.ts`; setting it has no effect. The evaluator currently constructs an OpenRouter provider directly and requires `OPENROUTER_API_KEY`. A non-OpenRouter local endpoint needs an explicit provider/base-URL seam before it can use this harness.

## 2026-07-18 results

| Model | Plan first-try valid | Plan final valid | Scenes valid | Repetition max | Repetition mean | Banned phrases | Mean Story ms | Prompt tokens | Completion tokens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `deepseek/deepseek-v4-flash` | 100% | 100% | 100% | 0.163 | 0.065 | 0 | 67,887 | 45,334 | 31,247 |
| `qwen/qwen3.5-27b` | 60% | 100% | 100% | 0.000 | 0.000 | 0 | 185,908 | 47,026 | 55,949 |
| `openai/gpt-oss-120b` | 60% | 100% | 100% | 0.144 | 0.069 | 1 | 8,298 | 64,975 | 23,272 |
| `mistralai/mistral-small-2603` | 20% | 80% | 100% | 0.122 | 0.033 | 0 | 10,963 | 71,569 | 7,088 |
| `z-ai/glm-5.2` | 80% | 100% | 100% | 0.039 | 0.012 | 0 | 38,930 | 57,631 | 28,190 |
| `z-ai/glm-4.7-flash` | 20% | 80% | 93% | 0.137 | 0.035 | 0 | 231,562 | 62,423 | 51,287 |
| `qwen/qwen3.5-35b-a3b` | 0% | 20% | 67% | 0.017 | 0.006 | 0 | 296,394 | 13,405 | 27,592 |

A blinded review ranked the viable finalists **C > A > B**: A was DeepSeek V4 Flash, B was GPT-OSS 120B, and C was GLM-5.2. GLM-5.2 covered the broadest set of projects and had no entailment violations in the reviewed output. It also combined 80% first-try and 100% final plan validity, zero banned phrases, 0.039 maximum repetition, and about 39 seconds per Story. DeepSeek repeated more and took about 68 seconds; GPT-OSS was much faster but used a banned phrase and invented an evidence relationship. GLM-5.2 and DeepSeek were MIT-licensed; GPT-OSS was Apache-2.0. The review selected `z-ai/glm-5.2` as the application default while retaining OpenRouter auto-routing unless an operator deliberately sets a provider order and reruns the benchmark.

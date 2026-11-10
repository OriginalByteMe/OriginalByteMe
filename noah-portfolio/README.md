This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Site generation model

`/api/generate` makes one model call per attempt (at most two) through `@openrouter/ai-sdk-provider`, with a JSON response schema for constrained decoding. See `.env.local.example` for defaults.

- `OPENROUTER_API_KEY` (required), `OPENROUTER_MODEL`, `OPENROUTER_PROVIDER_ORDER`, `OPENROUTER_FALLBACK_MODELS`
- `OPENROUTER_BASE_URL` (optional): any OpenAI-compatible endpoint, e.g. a local Ollama `http://localhost:11434/v1`.
- `OPENROUTER_REASONING_EFFORT` (optional): one of `xhigh`, `high`, `medium`, `low`, `minimal`, `none`, sent as `reasoning: { effort }`; other values are rejected.

`npx tsx scripts/story-model-eval.ts --out-dir <dir> [--quick] [--limit N]` runs the built-in question set through the same generator against whatever these variables point at. Add `--results lib/benchmark/results.json` on a full run to update that model's row on `/benchmark`.

## Observability (Langfuse)

Story-generation tracing is opt-in through the `LANGFUSE_*` environment variables below; production credentials live in the Vercel environment. The `/api/generate` pipeline uses the Vercel AI SDK's OpenTelemetry telemetry, registered in `instrumentation.ts`, so each question generation produces one `story-generation` trace that groups its `story-site` LLM calls. Without credentials, tracing is a no-op.

- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Cosmos lab (`/cosmos`)

A set of interactive space animations that tell the portfolio story as you scroll, plus a workbench for choosing between them.

- `lib/cosmos/` is a dependency-free WebGL2 engine. `config.ts` names every scene, render style, palette, transition, chapter and cut; `shaders/` holds the GLSL; `engine.ts` draws scene A and scene B, blends them with a transition, then applies a render style; `lab.ts` builds the scroll journey and the workbench.
- `components/cosmos/CosmosCanvas.tsx` draws one scene: `<CosmosCanvas scene="afroHole" style="ascii" palette="kente" />`. Pass `progress` (0..1) to drive it from scroll.
- `components/cosmos/CosmosJourney.tsx` is the full scroll story. Edit `CHAPTERS` in `lib/cosmos/config.ts` to change the copy, order, styles, palettes and transitions.
- Pointer: moving steers and lights scenes, clicking sends a shockwave. `prefers-reduced-motion` freezes time and redraws only on scroll.

## Studies (`/studies`)

Seven quiet, interactive generative pieces (Ink, Lattice, Tide, Contours, Vase mode, Forms, Silk), each a full-viewport plate with its own variations and a shared palette switcher. Lattice and Tide can form a picture or a word (`image={{ src }}` or `image={{ text }}`).

- `lib/studies/core.ts` is the runtime (loop, resize, pointer, idle autopilot, reduced motion) and the palettes.
- `lib/studies/pieces/` holds one file per piece; `lib/studies/list.ts` sets the order.
- `<StudyCanvas study="ink" palette="ember" />` (in `components/studies`) drops a single piece anywhere; `<Studies />` is the whole gallery.
- On the home page, `components/studies/HomeStudies.tsx` pins one piece behind each story chapter and clips it to that chapter, so chapters wipe past each other on scroll. Its `PLAN` array maps chapter ids to pieces. The hero portrait is the Lattice piece fed with `hero.png`.

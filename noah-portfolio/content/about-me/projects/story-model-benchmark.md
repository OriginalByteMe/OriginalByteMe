---
title: "Story Model Benchmark"
image: "/story-model-benchmark-cover.svg"
url: "https://my-portfolio-originalbyteme.vercel.app/benchmark"
technologies:
  - name: "Next.js"
    lightIcon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg"
    darkIcon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-plain.svg"
  - name: "TypeScript"
    lightIcon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg"
    darkIcon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-plain.svg"
  - name: "Zod"
    lightIcon: "https://cdn.jsdelivr.net/gh/colinhacks/zod/logo.svg"
    darkIcon: "https://cdn.jsdelivr.net/gh/colinhacks/zod/logo.svg"
description: >-
  I built a repeatable shootout for the portfolio's Story-generation models. It sends five fixed portfolio questions to each model through the production plan generation, one JSON-repair retry, and scene-composition pipeline, then applies the same Zod validators as the live app, checking schema shape and evidence references against a locked corpus vocabulary. It records first-try and after-repair plan validity, scene validity, cross-scene repetition using body-token Jaccard similarity, banned filler phrases, per-Story latency, token use, and estimated cost. The cases exercise malformed JSON, invalid project slugs, duplicate Scene Patterns, and out-of-vocabulary evidence references; semantic grounding is judged separately by a blinded manual review of the finalists. In July 2026 I ran seven OpenRouter models; that review selected GLM-5.2, which is now the application default.
---

A production-pipeline benchmark for choosing the portfolio's Story-generation model with validity, grounding, repetition, latency, token, and estimated-cost evidence.

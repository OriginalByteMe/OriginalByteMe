import { Callout } from "noah-portfolio";

// Callout — a matte highlighted note with a violet/mint left-rule accent.
// The `tone` axis is the primary variant; text is realistic portfolio copy.

export const Info = () => (
  <Callout
    props={{
      text: "I self-host most of my side projects on a home Kubernetes cluster — it keeps the feedback loop tight and the cloud bill honest.",
      tone: "info",
    }}
  />
);

export const Success = () => (
  <Callout
    props={{
      text: "The Ask-Me portfolio ships every answer as a validated JSON spec — if the model can't ground a claim in the corpus, it degrades to an honest boundary story instead of inventing one.",
      tone: "success",
    }}
  />
);

export const Warn = () => (
  <Callout
    props={{
      text: "Generated specs are capped at 2–3 blocks per scene. Past that, density fights the nocturne rhythm and the narrative stops reading like a story.",
      tone: "warn",
    }}
  />
);

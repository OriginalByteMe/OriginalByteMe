import { SequencedTimeline } from "noah-portfolio";

// SequencedTimeline — a vertical timeline whose rows reveal sequentially.
// Provide exactly one source: inline `rows`, or `statePath` bound to Corpus.

export const InlineRows = () => (
  <SequencedTimeline
    props={{
      rows: [
        { period: "2023 — now", role: "Developer", company: "MerchantSpring", url: "https://merchantspring.io/" },
        { period: "2022 — 2023", role: "Full-stack Engineer", company: "Supahands" },
        { period: "2021 — 2022", role: "Software Engineer", company: "BOWIQ" },
      ],
    }}
  />
);

export const FromCorpus = () => (
  <SequencedTimeline props={{ statePath: "/corpus/careerTimeline" }} />
);

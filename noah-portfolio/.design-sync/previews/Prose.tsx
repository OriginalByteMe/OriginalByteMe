import { Prose } from "noah-portfolio";

// Prose — a single narrative paragraph in a comfortable reading measure
// (max-w-2xl). Optional statePath reads the text from corpus state instead.

export const Paragraph = () => (
  <Prose
    props={{
      text: "Full-stack developer in Kuala Lumpur, building pragmatic systems across backend, infra, and frontend. I like self-hosting, Docker, and design-conscious interfaces — and I care just as much about how the work feels as how it ships.",
    }}
  />
);

export const Short = () => (
  <Prose props={{ text: "Small, sharp, and to the point." }} />
);

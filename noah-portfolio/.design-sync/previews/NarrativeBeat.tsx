import { NarrativeBeat } from "noah-portfolio";

// NarrativeBeat — one concise prose beat (1–2 short sentences) in a max-w-2xl
// reading measure. The narrative payload of a Scene.

export const Beat = () => (
  <NarrativeBeat
    props={{
      text: "I like self-hosting, Docker, and design-conscious interfaces — and I care just as much about how the work feels as how it ships.",
    }}
  />
);

export const ContactBeat = () => (
  <NarrativeBeat
    props={{
      text: "Got a project, a role, or just a question about anything on this page? My inbox is open and I actually reply.",
    }}
  />
);

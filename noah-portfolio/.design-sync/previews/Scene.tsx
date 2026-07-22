import { Scene, ChapterHeading, NarrativeBeat, StatReveal } from "noah-portfolio";

// Scene — one full-height curated chapter. Children reveal on scroll entry with
// an in-scene stagger. Cap at 2–3 children: a ChapterHeading anchor plus a
// payload. `align` center/start; `accent` violet/mint from the fixed palette.

export const Centered = () => (
  <Scene props={{ id: "intro", align: "center" }}>
    <ChapterHeading props={{ kicker: "Chapter 01", text: "Noah, in brief" }} />
    <NarrativeBeat props={{ text: "Full-stack developer in Kuala Lumpur, building pragmatic systems across backend, infra, and frontend." }} />
    <StatReveal props={{ value: 6, suffix: " yrs", caption: "shipping software" }} />
  </Scene>
);

export const StartWithAccent = () => (
  <Scene props={{ id: "contact", align: "start", accent: "violet" }}>
    <ChapterHeading props={{ kicker: "Chapter 06", text: "Say hi" }} />
    <NarrativeBeat props={{ text: "My inbox is open and I actually reply — pick whichever door you like." }} />
  </Scene>
);

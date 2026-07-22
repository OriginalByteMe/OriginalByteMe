import { Heading } from "noah-portfolio";

// Heading — a serif section heading. `level` (1–4) sets the semantic tag; the
// visual treatment stays consistent tracking-tight serif.

export const Level1 = () => <Heading props={{ text: "Things I've built", level: 1 }} />;
export const Level2 = () => <Heading props={{ text: "The toolbox", level: 2 }} />;
export const Level3 = () => <Heading props={{ text: "Operating systems", level: 3 }} />;

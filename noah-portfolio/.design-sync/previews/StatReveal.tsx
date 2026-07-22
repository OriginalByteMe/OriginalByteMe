import { StatReveal } from "noah-portfolio";

// StatReveal — a big metric that counts up from 0 to `value` the first time it
// scrolls into view. `suffix` is appended to the number; `caption` labels it.

export const Years = () => (
  <StatReveal props={{ value: 6, suffix: " yrs", caption: "shipping software" }} />
);

export const Projects = () => (
  <StatReveal props={{ value: 5, caption: "featured projects" }} />
);

export const Uptime = () => (
  <StatReveal props={{ value: 100, suffix: "%", caption: "commitment to the craft" }} />
);

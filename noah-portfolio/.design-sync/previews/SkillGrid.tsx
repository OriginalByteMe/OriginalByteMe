import { SkillGrid } from "noah-portfolio";

// SkillGrid — categorized skills as matte cards with per-skill logo pills.
// Bind statePath to "/corpus/skills"; optional title adds a code-icon heading.

export const WithTitle = () => (
  <SkillGrid props={{ statePath: "/corpus/skills", title: "Skills & tools" }} />
);

export const NoTitle = () => (
  <SkillGrid props={{ statePath: "/corpus/skills" }} />
);

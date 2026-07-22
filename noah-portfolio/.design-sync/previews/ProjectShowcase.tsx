import { ProjectShowcase } from "noah-portfolio";

// ProjectShowcase — corpus-bound project cards (cover image, description, tech
// chips, link). Bind statePath to "/corpus/projects"; the preview provider
// supplies Noah's real project corpus. `slug` filters to a single project.

export const AllProjects = () => (
  <ProjectShowcase props={{ statePath: "/corpus/projects" }} />
);

export const SingleProject = () => (
  <ProjectShowcase props={{ statePath: "/corpus/projects", slug: "ai-image-cutout" }} />
);

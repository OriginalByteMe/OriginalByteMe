import { SideProjects } from "noah-portfolio";

// SideProjects — the static side-projects grid (3D printing + blog). Content is
// fixed to the home view; optional title adds a code-icon heading.

export const WithTitle = () => <SideProjects props={{ title: "Side projects" }} />;
export const NoTitle = () => <SideProjects props={{}} />;

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoryProjects } from "@/components/story/StoryProjects";
import type { StoryProject } from "@/lib/story/types";

const project: StoryProject = {
  slug: "ask-me-portfolio",
  title: "Ask-Me Portfolio",
  description: "A grounded portfolio that composes answers as visual Stories.",
  image: "/portfolio-showcase.png",
  url: "https://github.com/OriginalByteMe/OriginalByteMe",
  technologies: [
    {
      name: "Next.js",
      lightIcon: "https://cdn.example.com/next-light.svg",
      darkIcon: "https://cdn.example.com/next-dark.svg",
    },
    {
      name: "TypeScript",
      lightIcon: "https://cdn.example.com/typescript-light.svg",
      darkIcon: "https://cdn.example.com/typescript-dark.svg",
    },
  ],
};

describe("StoryProjects", () => {
  it("renders trusted project links, previews, descriptions, and technology icons", () => {
    const { container } = render(<StoryProjects projects={[project]} />);

    const link = screen.getByRole("link", { name: "View Ask-Me Portfolio project" });
    expect(link).toHaveAttribute("href", project.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(project.description)).toBeInTheDocument();
    expect(screen.getByAltText("Ask-Me Portfolio project preview")).toHaveAttribute(
      "src",
      expect.stringContaining("portfolio-showcase.png"),
    );
    expect(screen.getByText("Next.js")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(3);
  });

  it("renders nothing when a Scene has no referenced projects", () => {
    const { container } = render(<StoryProjects projects={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText("Referenced projects")).not.toBeInTheDocument();
  });
});

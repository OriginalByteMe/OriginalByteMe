import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StateProvider, createStateStore } from "@json-render/react";
import { factComponents } from "@/lib/jsonui/components/facts";

describe("factComponents", () => {
  it("ProjectShowcase renders titles bound from state", () => {
    const store = createStateStore({
      corpus: {
        projects: [
          { slug: "x", title: "AI Image Cutout Tool", description: "d", image: "/i.png", url: "#", technologies: [] },
        ],
      },
    });
    const ProjectShowcase = factComponents.ProjectShowcase;
    render(
      <StateProvider store={store}>
        <ProjectShowcase props={{ statePath: "/corpus/projects" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByText("AI Image Cutout Tool")).toBeInTheDocument();
  });

  it("ProjectShowcase filters to a single project when slug is given", () => {
    const store = createStateStore({
      corpus: {
        projects: [
          { slug: "x", title: "Project X", description: "d1", image: "/x.png", url: "#", technologies: [] },
          { slug: "y", title: "Project Y", description: "d2", image: "/y.png", url: "#", technologies: [] },
        ],
      },
    });
    const ProjectShowcase = factComponents.ProjectShowcase;
    render(
      <StateProvider store={store}>
        <ProjectShowcase props={{ statePath: "/corpus/projects", slug: "y" }} children={null} />
      </StateProvider>,
    );
    expect(screen.queryByText("Project X")).not.toBeInTheDocument();
    expect(screen.getByText("Project Y")).toBeInTheDocument();
  });

  it("SkillGrid renders category headings and skill names from state", () => {
    const store = createStateStore({
      corpus: {
        skills: [
          {
            category: "Programming Languages",
            skills: [{ name: "TypeScript", lightImage: "/ts-light.svg", darkImage: "/ts-dark.svg" }],
          },
        ],
      },
    });
    const SkillGrid = factComponents.SkillGrid;
    render(
      <StateProvider store={store}>
        <SkillGrid props={{ statePath: "/corpus/skills" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByText("Programming Languages")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("SkillCloud renders flattened skill names without category headings", () => {
    const store = createStateStore({
      corpus: {
        skills: [
          {
            category: "Databases",
            skills: [{ name: "PostgreSQL", lightImage: "/pg-light.svg", darkImage: "/pg-dark.svg" }],
          },
        ],
      },
    });
    const SkillCloud = factComponents.SkillCloud;
    render(
      <StateProvider store={store}>
        <SkillCloud props={{ statePath: "/corpus/skills" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.queryByText("Databases")).not.toBeInTheDocument();
  });

  it("CareerTimeline renders job company, role, and period from state", () => {
    const store = createStateStore({
      corpus: {
        careerTimeline: [
          { company: "Supa", role: "Full-Stack Developer", period: "2020 - Present", logo: "/supa.png", url: "https://supa.so" },
        ],
      },
    });
    const CareerTimeline = factComponents.CareerTimeline;
    render(
      <StateProvider store={store}>
        <CareerTimeline props={{ statePath: "/corpus/careerTimeline" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByText("Supa")).toBeInTheDocument();
    expect(screen.getByText("Full-Stack Developer")).toBeInTheDocument();
    expect(screen.getByText("2020 - Present")).toBeInTheDocument();
  });

  it("ContactCard renders email, github, and linkedin from state", () => {
    const store = createStateStore({
      corpus: {
        contact: {
          email: "noahrijkaard@gmail.com",
          github: "https://github.com/OriginalByteMe",
          linkedin: "https://www.linkedin.com/in/noah-rijkaard/",
        },
      },
    });
    const ContactCard = factComponents.ContactCard;
    render(
      <StateProvider store={store}>
        <ContactCard props={{ statePath: "/corpus/contact" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByText("noahrijkaard@gmail.com")).toBeInTheDocument();
    const githubLink = screen.getByText("github.com/OriginalByteMe");
    expect(githubLink.closest("a")).toHaveAttribute("href", "https://github.com/OriginalByteMe");
    const linkedinLink = screen.getByText("www.linkedin.com/in/noah-rijkaard/");
    expect(linkedinLink.closest("a")).toHaveAttribute("href", "https://www.linkedin.com/in/noah-rijkaard/");
  });

  it("StatCallout renders its value and label from literal props (no state)", () => {
    const StatCallout = factComponents.StatCallout;
    render(<StatCallout props={{ value: "5+", label: "Years shipping production code" }} children={null} />);
    expect(screen.getByText("5+")).toBeInTheDocument();
    expect(screen.getByText("Years shipping production code")).toBeInTheDocument();
  });
});

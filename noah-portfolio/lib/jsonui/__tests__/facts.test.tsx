import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StateProvider, createStateStore } from "@json-render/react";
import { factComponents } from "@/lib/jsonui/components/facts";

const stubHandlers = {
  emit: vi.fn(),
  on: vi.fn(),
};


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
        <ProjectShowcase {...stubHandlers} props={{ statePath: "/corpus/projects" }} children={null} />
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
        <ProjectShowcase {...stubHandlers} props={{ statePath: "/corpus/projects", slug: "y" }} children={null} />
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
        <SkillGrid {...stubHandlers} props={{ statePath: "/corpus/skills" }} children={null} />
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
        <SkillCloud {...stubHandlers} props={{ statePath: "/corpus/skills" }} children={null} />
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
        <CareerTimeline {...stubHandlers} props={{ statePath: "/corpus/careerTimeline" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByText("Supa")).toBeInTheDocument();
    expect(screen.getByText("Full-Stack Developer")).toBeInTheDocument();
    expect(screen.getByText("2020 - Present")).toBeInTheDocument();
    expect(screen.getByAltText("Supa logo")).toBeInTheDocument();
    const companyLink = screen.getByRole("link", { name: "Visit Supa website" });
    expect(companyLink).toHaveAttribute("href", "https://supa.so");
    expect(companyLink).toHaveAttribute("target", "_blank");
    expect(companyLink).toHaveAttribute("rel", "noreferrer noopener");
    expect(companyLink).toHaveClass("focus-visible:ring-2");
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
        <ContactCard {...stubHandlers} props={{ statePath: "/corpus/contact" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByText("noahrijkaard@gmail.com")).toBeInTheDocument();
    const githubLink = screen.getByText("github.com/OriginalByteMe");
    expect(githubLink.closest("a")).toHaveAttribute("href", "https://github.com/OriginalByteMe");
    const linkedinLink = screen.getByText("www.linkedin.com/in/noah-rijkaard/");
    expect(linkedinLink.closest("a")).toHaveAttribute("href", "https://www.linkedin.com/in/noah-rijkaard/");
  });
  it("ContactCard renders only populated contact links from partial state", () => {
    const store = createStateStore({
      corpus: {
        contact: {
          email: "",
          github: "https://github.com/OriginalByteMe",
          linkedin: "",
        },
      },
    });
    const ContactCard = factComponents.ContactCard;
    render(
      <StateProvider store={store}>
        <ContactCard {...stubHandlers} props={{ statePath: "/corpus/contact" }} children={null} />
      </StateProvider>,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(screen.getByRole("link", { name: /github\.com\/OriginalByteMe/i })).toHaveAttribute(
      "href",
      "https://github.com/OriginalByteMe",
    );
    expect(screen.queryByRole("link", { name: /noahrijkaard@gmail\.com/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /linkedin/i })).not.toBeInTheDocument();
  });

  it("StatCallout renders its value and label from literal props (no state)", () => {
    const StatCallout = factComponents.StatCallout;
    render(<StatCallout {...stubHandlers} props={{ value: "5+", label: "Years shipping production code" }} children={null} />);
    expect(screen.getByText("5+")).toBeInTheDocument();
    expect(screen.getByText("Years shipping production code")).toBeInTheDocument();
  });

  it("SkillGrid renders an optional title heading when a title is given", () => {
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
        <SkillGrid {...stubHandlers} props={{ statePath: "/corpus/skills", title: "Skills" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Skills" })).toBeInTheDocument();
  });

  it("SkillGrid omits the title heading when no title is given", () => {
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
        <SkillGrid {...stubHandlers} props={{ statePath: "/corpus/skills" }} children={null} />
      </StateProvider>,
    );
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Programming Languages" })).toBeInTheDocument();
  });

  it("CareerTimeline renders an optional title heading when a title is given", () => {
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
        <CareerTimeline {...stubHandlers} props={{ statePath: "/corpus/careerTimeline", title: "Work History" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Work History" })).toBeInTheDocument();
  });

  it("CareerTimeline omits the title heading when no title is given", () => {
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
        <CareerTimeline {...stubHandlers} props={{ statePath: "/corpus/careerTimeline" }} children={null} />
      </StateProvider>,
    );
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Supa" })).toBeInTheDocument();
  });

  it("OperatingSystemsGrid renders the environment name, its primary system as a header icon, and the rest as labeled pills", () => {
    const store = createStateStore({
      corpus: {
        operatingSystems: [
          {
            name: "Linux",
            systems: [
              { name: "Ubuntu", lightImage: "/ubuntu-light.svg", darkImage: "/ubuntu-dark.svg" },
              { name: "Fedora", lightImage: "/fedora-light.svg", darkImage: "/fedora-dark.svg" },
              { name: "Arch", lightImage: "/arch-light.svg", darkImage: "/arch-dark.svg" },
            ],
          },
        ],
      },
    });
    const OperatingSystemsGrid = factComponents.OperatingSystemsGrid;
    render(
      <StateProvider store={store}>
        <OperatingSystemsGrid {...stubHandlers} props={{ statePath: "/corpus/operatingSystems" }} children={null} />
      </StateProvider>,
    );
    expect(screen.getByRole("heading", { level: 4, name: "Linux" })).toBeInTheDocument();
    // Primary system is the header icon (image alt only), never a labeled pill.
    expect(screen.getByAltText("Ubuntu")).toBeInTheDocument();
    expect(screen.queryByText("Ubuntu")).not.toBeInTheDocument();
    // Remaining systems render as labeled pills.
    expect(screen.getByText("Fedora")).toBeInTheDocument();
    expect(screen.getByText("Arch")).toBeInTheDocument();
  });

  it("OperatingSystemsGrid pluralizes a one-system environment and preserves dark icon contrast", () => {
    const store = createStateStore({
      corpus: {
        operatingSystems: [
          {
            name: "macOS Workstation",
            systems: [
              {
                name: "macOS",
                lightImage: "/apple.svg",
                darkImage: "/apple.svg",
                invertInDark: true,
              },
            ],
          },
        ],
      },
    });
    const OperatingSystemsGrid = factComponents.OperatingSystemsGrid;
    render(
      <StateProvider store={store}>
        <OperatingSystemsGrid {...stubHandlers} props={{ statePath: "/corpus/operatingSystems" }} children={null} />
      </StateProvider>,
    );

    expect(screen.getByText("1 system")).toBeInTheDocument();
    expect(screen.queryByText("1 systems")).not.toBeInTheDocument();
    expect(screen.getByAltText("macOS")).toHaveClass("dark:invert");
  });

  it("OperatingSystemsGrid renders no environment cards for an empty state array", () => {
    const store = createStateStore({ corpus: { operatingSystems: [] } });
    const OperatingSystemsGrid = factComponents.OperatingSystemsGrid;
    render(
      <StateProvider store={store}>
        <OperatingSystemsGrid {...stubHandlers} props={{ statePath: "/corpus/operatingSystems", title: "Operating Systems" }} children={null} />
      </StateProvider>,
    );
    // Component mounts (title shows) but produces no per-environment cards (each card renders an h4).
    expect(screen.getByRole("heading", { level: 3, name: "Operating Systems" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });

});

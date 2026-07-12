import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, beforeAll, vi } from "vitest";
import { Renderer, StateProvider, ActionProvider, VisibilityProvider, createStateStore } from "@json-render/react";
import { JsonUiProvider } from "@/components/JsonUiProvider";
import { corpusState } from "@/lib/corpus";
import { homeSpec } from "@/lib/jsonui/homeSpec";
import { registry } from "@/lib/jsonui/registry";

vi.mock("@/components/ui/spotify-reveal", () => ({
  default: () => <div>Spotify Magic</div>,
}));
// jsdom has no IntersectionObserver; the Scene chapters use framer-motion's
// `whileInView`, which gates reveal on it. Stub it to report every element as
// intersecting so chapter/beat content lands in the accessibility tree.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
beforeAll(() => {
  // Assign to a typed const so the access is checked, not an inline cast.
  const g = globalThis as unknown as Record<string, unknown>;
  if (typeof g.IntersectionObserver === "undefined") g.IntersectionObserver = IO;
});

// End-to-end proof that the fallback home spec assembles through the real
// registry: every section/subsection component resolves and renders, and the
// bio Prose binds from corpus state rather than falling back to its literal.
function renderHome() {
  const store = createStateStore({
    corpus: {
      bio: { summary: "State-bound bio paragraph." },
      skills: [
        {
          category: "Programming Languages",
          skills: [{ name: "TypeScript", lightImage: "/ts-light.svg", darkImage: "/ts-dark.svg" }],
        },
      ],
      careerTimeline: [
        { company: "Supa", role: "Full-Stack Developer", period: "2020 - Present", logo: "/supa.png", url: "https://supa.so" },
      ],
      operatingSystems: [
        {
          name: "Linux",
          systems: [
            { name: "Ubuntu", lightImage: "/ubuntu-light.svg", darkImage: "/ubuntu-dark.svg" },
            { name: "Fedora", lightImage: "/fedora-light.svg", darkImage: "/fedora-dark.svg" },
          ],
        },
      ],
      projects: [
        {
          slug: "cutout",
          title: "AI Image Cutout Tool",
          description: "d",
          image: "/cutout.png",
          url: "https://example.com",
          technologies: [{ name: "React", lightIcon: "/react-light.svg", darkIcon: "/react-dark.svg" }],
        },
      ],
      contact: { email: "noah@example.com", github: "https://github.com/OriginalByteMe", linkedin: "https://linkedin.com/in/noah" },
    },
  });
  return render(
    <StateProvider store={store}>
      <ActionProvider>
        <VisibilityProvider>
          <Renderer spec={homeSpec} registry={registry} />
        </VisibilityProvider>
      </ActionProvider>
    </StateProvider>,
  );
}

function renderProductionHome(initialState = corpusState()) {
  return render(
    <JsonUiProvider initialState={initialState}>
      <Renderer spec={homeSpec} registry={registry} />
    </JsonUiProvider>,
  );
}
function countVisibleSceneBlocks(section: HTMLElement) {
  const shell = section.firstElementChild;
  if (!shell) return 0;
  return Array.from(shell.children).filter(
    (child) => !(child as HTMLElement).hasAttribute("aria-hidden"),
  ).length;
}

describe("homeSpec end-to-end render", () => {
  it("assembles every home chapter and fact-component heading through the registry", () => {
    renderHome();
    // Chapter headings (ChapterHeading anchors, one per Scene)
    for (const name of [
      "Noah, in brief",
      "The toolbox",
      "Where I've been",
      "Things I've built",
      "The rig",
      "Off the clock",
      "Say hi",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    // Fact-component sub-headings still render inside the scenes
    expect(screen.getByRole("heading", { name: "Skills & tools" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operating systems" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Side projects" })).toBeInTheDocument();
  });
  it("keeps the intro and toolbox scenes centered in real Scene wrappers", () => {
    renderHome();

    for (const { name, id, blocks } of [
      { name: "Noah, in brief", id: "intro", blocks: 3 },
      { name: "The toolbox", id: "stack", blocks: 2 },
    ]) {
      const heading = screen.getByRole("heading", { name });
      const section = heading.closest("section");
      expect(section).not.toBeNull();

      const sectionEl = section as HTMLElement;
      const shell = sectionEl.firstElementChild as HTMLElement | null;
      expect(shell).not.toBeNull();

      expect(sectionEl).toHaveAttribute("id", id);
      expect(sectionEl).toHaveClass("relative", "flex", "min-h-screen", "items-center", "justify-center", "text-center");
      expect(shell).toContainElement(heading);
      expect(shell).toHaveClass("mx-auto", "items-center");
      expect(countVisibleSceneBlocks(sectionEl)).toBe(blocks);
    }
  });

  it("keeps every scene within the intended 2-3 block rhythm", () => {
    renderHome();

    for (const { name, blocks } of [
      { name: "Noah, in brief", blocks: 3 },
      { name: "The toolbox", blocks: 2 },
      { name: "Where I've been", blocks: 2 },
      { name: "Things I've built", blocks: 2 },
      { name: "The rig", blocks: 3 },
      { name: "Off the clock", blocks: 3 },
      { name: "Say hi", blocks: 2 },
    ]) {
      const heading = screen.getByRole("heading", { name });
      const section = heading.closest("section");
      expect(section).not.toBeNull();
      expect(countVisibleSceneBlocks(section as HTMLElement)).toBe(blocks);
    }
  });


  it("renders the bio narrative beat as inline story prose", () => {
    renderHome();
    expect(screen.getByText(/Full-stack developer in Kuala Lumpur/)).toBeInTheDocument();
  });

  it("binds fact components to corpus state (skills, projects, OS, contact)", () => {
    renderHome();
    // SkillGrid binds to /corpus/skills and renders the category heading
    expect(screen.getByRole("heading", { name: "Programming Languages" })).toBeInTheDocument();
    // ProjectShowcase binds to /corpus/projects and renders the project title
    expect(screen.getByRole("heading", { name: "AI Image Cutout Tool" })).toBeInTheDocument();
    // OperatingSystemsGrid binds to /corpus/operatingSystems
    expect(screen.getByRole("heading", { name: "Linux" })).toBeInTheDocument();
    // ContactCard binds to /corpus/contact and renders the Email card title
    expect(screen.getByRole("heading", { name: "Email" })).toBeInTheDocument();
  });
  it("renders every repository-authored home Story fact through the production provider", () => {
    renderProductionHome();
    const toolbox = screen.getByRole("heading", { name: "The toolbox" }).closest("section");
    const builds = screen.getByRole("heading", { name: "Things I've built" }).closest("section");
    const operatingSystems = screen.getByRole("region", { name: "Operating systems" });
    const contact = screen.getByRole("heading", { name: "Say hi" }).closest("section");
    expect(toolbox).not.toBeNull();
    expect(builds).not.toBeNull();
    expect(contact).not.toBeNull();
    const toolboxQueries = within(toolbox as HTMLElement);
    const buildsQueries = within(builds as HTMLElement);
    const operatingSystemQueries = within(operatingSystems);
    const contactQueries = within(contact as HTMLElement);

    for (const category of [
      "Programming Languages",
      "Frontend Frameworks",
      "Infrastructure & DevOps",
      "Databases",
    ]) {
      expect(toolboxQueries.getByRole("heading", { name: category })).toBeInTheDocument();
    }
    expect(toolboxQueries.getAllByRole("heading", { level: 4 })).toHaveLength(4);

    for (const skill of [
      "Ruby",
      "Python",
      "JavaScript",
      "TypeScript",
      "React",
      "Bash",
      "Next.js",
      "Ruby on Rails",
      "Tailwind CSS",
      "Docker",
      "Proxmox",
      "Unraid",
      "AWS",
      "Git",
      "Terraform",
      "PostgreSQL",
      "MySQL",
      "SQLite",
      "Redis",
      "MongoDB",
    ]) {
      expect(toolboxQueries.getByText(skill)).toBeInTheDocument();
    }
    expect(toolboxQueries.getAllByRole("img")).toHaveLength(20);

    expect(screen.getByText("Bowiq")).toBeInTheDocument();
    expect(screen.queryByText("Bowiac")).not.toBeInTheDocument();

    for (const project of ["AI Image Cutout Tool", "LLM Comparison app"]) {
      expect(screen.getByRole("heading", { name: project })).toBeInTheDocument();
    }
    expect(buildsQueries.getAllByRole("link")).toHaveLength(2);

    for (const operatingSystem of ["Linux", "Debian", "Ubuntu", "Windows", "WSL2"]) {
      expect(operatingSystemQueries.getByAltText(operatingSystem)).toBeInTheDocument();
    }
    expect(operatingSystemQueries.getAllByRole("img")).toHaveLength(5);
    expect(screen.getByRole("link", { name: /noahrijkaard@gmail\.com/i })).toHaveAttribute(
      "href",
      "mailto:noahrijkaard@gmail.com",
    );
    expect(screen.getByRole("link", { name: /github\.com\/OriginalByteMe/i })).toHaveAttribute(
      "href",
      "https://github.com/OriginalByteMe",
    );
    expect(screen.getByRole("link", { name: /linkedin\.com\/in\/noah-rijkaard/i })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/noah-rijkaard/",
    );
    expect(contactQueries.getAllByRole("link")).toHaveLength(3);
  });

  it("binds the career chapter to the production Corpus state path", () => {
    renderProductionHome({
      ...corpusState(),
      "/corpus/careerTimeline": [
        {
          period: "State period",
          role: "State-backed role",
          company: "State-backed company",
          logo: "",
          url: "",
        },
      ],
    });

    expect(screen.getByText("State period")).toBeInTheDocument();
    expect(screen.getByText("State-backed role")).toBeInTheDocument();
    expect(screen.getByText("State-backed company")).toBeInTheDocument();
    expect(screen.queryByText("Bowiq")).not.toBeInTheDocument();
  });

  it("renders the operating systems grid and side-project cards in the default homeSpec", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: "Operating systems" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Linux" })).toBeInTheDocument();
    expect(screen.getByAltText("Ubuntu")).toBeInTheDocument();
    expect(screen.getByText("Fedora")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "3D Printing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "My blog!" })).toBeInTheDocument();
  });
});

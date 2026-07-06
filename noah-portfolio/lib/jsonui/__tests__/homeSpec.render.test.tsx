import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeAll } from "vitest";
import { Renderer, StateProvider, ActionProvider, VisibilityProvider, createStateStore } from "@json-render/react";
import { registry } from "@/lib/jsonui/registry";
import { homeSpec } from "@/lib/jsonui/homeSpec";
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
});

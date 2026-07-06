import { defineCatalog } from "@json-render/core";
import { z } from "zod";
import { schema } from "./schema";

/**
 * json-render component catalog for the Ask-Me dynamic portfolio.
 *
 * Visual contract: see docs/design-contract.md.
 * Any new component added here must follow the spacing, surface, typography,
 * and motion rules documented there so generated layouts stay consistent.
 */
export const catalog = defineCatalog(schema, {
  components: {
    Section: {
      props: z.object({
        title: z.string().nullable().optional(),
        height: z.enum(["auto", "screen"]).nullable().optional(),
        centered: z.boolean().nullable().optional(),
        titleMb: z.enum(["sm", "md", "lg"]).nullable().optional(),
      }),
      description:
        "Full-width vertical section with optional heading. height 'screen' makes it full-viewport; centered vertically centers content; titleMb adjusts heading margin (default md).",
    },
    Stack: {
      props: z.object({ gap: z.enum(["sm", "md", "lg"]).nullable().optional() }),
      description: "Vertical stack of children.",
    },
    Columns: {
      props: z.object({ count: z.number().min(1).max(3) }),
      description: "Responsive multi-column grid (1-3).",
    },
    Grid: {
      props: z.object({ cols: z.number().min(1).max(4) }),
      description: "Card grid.",
    },
    Prose: {
      props: z.object({ text: z.string(), statePath: z.string().nullable().optional() }),
      description:
        'A paragraph of narrative text written by you. Optional statePath reads the text from corpus state instead (e.g. "/corpus/bio/summary"); text is the fallback.',
    },
    Heading: {
      props: z.object({ text: z.string(), level: z.number().min(1).max(4) }),
      description: "Section heading.",
    },
    Callout: {
      props: z.object({ text: z.string(), tone: z.enum(["info", "success", "warn"]).nullable().optional() }),
      description: "Highlighted callout.",
    },
    Quote: {
      props: z.object({ text: z.string(), cite: z.string().nullable().optional() }),
      description: "Pull quote.",
    },
    CareerTimeline: {
      props: z.object({ statePath: z.string(), title: z.string().nullable().optional() }),
      description:
        'Animated company/role timeline. Bind statePath to the literal string "/corpus/careerTimeline". Optional title renders a briefcase-icon sub-heading (e.g. "Work History").',
    },
    ProjectShowcase: {
      props: z.object({ statePath: z.string(), slug: z.string().nullable().optional() }),
      description: 'Project cards (image, desc, tech, link). Bind statePath to the literal string "/corpus/projects"; optional slug filters to one.',
    },
    SkillGrid: {
      props: z.object({ statePath: z.string(), title: z.string().nullable().optional() }),
      description:
        'Categorized skills grid. Bind statePath to the literal string "/corpus/skills". Optional title renders a code-icon sub-heading (e.g. "Skills").',
    },
    SkillCloud: {
      props: z.object({ statePath: z.string() }),
      description: 'Compact skill pills. Bind statePath to the literal string "/corpus/skills".',
    },
    StatCallout: {
      props: z.object({ value: z.string(), label: z.string() }),
      description: "Big number + label.",
    },
    ContactCard: {
      props: z.object({ statePath: z.string() }),
      description: 'Email/GitHub/LinkedIn cards. Bind statePath to the literal string "/corpus/contact".',
    },
    OperatingSystemsGrid: {
      props: z.object({ statePath: z.string(), title: z.string().nullable().optional() }),
      description:
        'Frosted-glass cards of OS environments with per-system pills. Bind statePath to the literal string "/corpus/operatingSystems". Optional title renders a code-icon sub-heading (e.g. "Operating Systems").',
    },
    SideProjects: {
      props: z.object({ title: z.string().nullable().optional() }),
      description:
        "Noah's side-projects cards (3D printing + blog). Static home-view block; optional title renders a code-icon sub-heading.",
    },
    LottieFigure: {
      props: z.object({ src: z.string(), caption: z.string().nullable().optional() }),
      description: "Decorative Lottie animation.",
    },
    SpotifyNowPlaying: {
      props: z.object({}),
      description: "Noah's current Spotify track reveal.",
    },
    ImageBlock: {
      props: z.object({ src: z.string(), alt: z.string(), caption: z.string().nullable().optional() }),
      description: "Image with caption.",
    },
    StepFlow: {
      props: z.object({ steps: z.array(z.object({ title: z.string(), body: z.string() })) }),
      description: "Animated numbered steps to explain how something works.",
    },
  },
  actions: {},
});

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
    Scene: {
      props: z.object({
        id: z.string().nullable().optional(),
        align: z.enum(["center", "start"]).nullable().optional(),
        accent: z.enum(["violet", "mint"]).nullable().optional(),
      }),
      description:
        "One full-height story chapter: children reveal on scroll entry with an in-scene stagger. Cap at 2-3 child blocks — one ChapterHeading anchor plus one payload (NarrativeBeat / StatReveal / SequencedTimeline); child order IS scene order. align 'center' (default) or 'start'; optional accent rule 'violet' or 'mint' from the fixed palette only. Emit a sequence of Scene elements for mode:'scenes' answers.",
    },
    ChapterHeading: {
      props: z.object({ text: z.string(), kicker: z.string().nullable().optional() }),
      description:
        "Serif display chapter heading with an optional mono kicker (e.g. 'Chapter 02'). Use one per Scene as the anchor block.",
    },
    NarrativeBeat: {
      props: z.object({ text: z.string() }),
      description:
        "One concise prose paragraph beat (1-2 short sentences) in a max-w-2xl reading measure. The narrative payload of a Scene.",
    },
    StatReveal: {
      props: z.object({
        value: z.number(),
        caption: z.string(),
        suffix: z.string().nullable().optional(),
      }),
      description:
        "A single big metric that counts up from 0 to value the first time it scrolls into view. suffix is appended to the number (e.g. '+', 'yrs'); caption labels it. Use for stat/dashboard moments.",
    },
    SequencedTimeline: {
      props: z.object({
        rows: z.array(
          z.object({ period: z.string(), role: z.string(), company: z.string() }),
        ),
      }),
      description:
        "A vertical timeline whose rows reveal sequentially (nested stagger). Each row is {period, role, company}. Promote a heavy timeline to its own Scene.",
    },
    StaticComposition: {
      props: z.object({}),
      description:
        "Rich static fallback for short answers instead of Scenes: a centered max-w-3xl reading column that mount-staggers its child blocks with no scroll dependency. Use for mode:'static' answers; hold the same block set (ChapterHeading / NarrativeBeat / StatReveal / SequencedTimeline).",
    },
  },
  actions: {},
});

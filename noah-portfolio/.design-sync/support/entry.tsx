// design-sync bundle entry (barrel).
//
// The Ask-Me portfolio's design system is a json-render *catalog*: the real
// components live as entries on the registry objects in lib/jsonui/components/*,
// not as named React exports. This barrel gives each catalog component a real
// named export so the design-sync IIFE assigns it to
// window.NoahPortfolio.<Name> untouched — the shipped component, no wrapper.
//
// Every component keeps its native json-render calling convention:
//   <Section props={{ title: "…" }}>{children}</Section>
// i.e. a `props` object (the JSON spec's props) plus optional `children`.
//
// DesignPreviewProvider is exported too (cfg.provider) so state-bound
// components render against the real corpus in preview cards.

export { DesignPreviewProvider } from "./provider";

import { primitiveComponents } from "@/lib/jsonui/components/primitives";
import { factComponents } from "@/lib/jsonui/components/facts";
import { extraComponents } from "@/lib/jsonui/components/extras";
import { storyComponents } from "@/lib/jsonui/components/story";

// ── Layout & content primitives ──────────────────────────────────────────
export const Section = primitiveComponents.Section;
export const Stack = primitiveComponents.Stack;
export const Columns = primitiveComponents.Columns;
export const Grid = primitiveComponents.Grid;
export const Prose = primitiveComponents.Prose;
export const Heading = primitiveComponents.Heading;
export const Callout = primitiveComponents.Callout;
export const Quote = primitiveComponents.Quote;

// ── Corpus-bound fact components ─────────────────────────────────────────
export const ProjectShowcase = factComponents.ProjectShowcase;
export const SkillGrid = factComponents.SkillGrid;
export const SkillCloud = factComponents.SkillCloud;
export const CareerTimeline = factComponents.CareerTimeline;
export const OperatingSystemsGrid = factComponents.OperatingSystemsGrid;
export const ContactCard = factComponents.ContactCard;
export const StatCallout = factComponents.StatCallout;

// ── Media & extras ───────────────────────────────────────────────────────
export const SpotifyNowPlaying = extraComponents.SpotifyNowPlaying;
export const SideProjects = extraComponents.SideProjects;
export const ImageBlock = extraComponents.ImageBlock;
export const StepFlow = extraComponents.StepFlow;

// ── Story primitives ──────────────────────────────────────────────────────
export const Scene = storyComponents.Scene;
export const ChapterHeading = storyComponents.ChapterHeading;
export const NarrativeBeat = storyComponents.NarrativeBeat;
export const StatReveal = storyComponents.StatReveal;
export const SequencedTimeline = storyComponents.SequencedTimeline;

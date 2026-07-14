"use client";

import Image from "next/image";
import { BookOpen, Code2 } from "lucide-react";
import type { BaseComponentProps } from "@json-render/react";
import SpotifyReveal from "@/components/ui/spotify-reveal";
import { isSvgSrc } from "@/lib/utils";

/** One consistent icon treatment everywhere (design-contract §5). */
const ICON = { strokeWidth: 1.5 } as const;

const CARD_RULE =
  "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7a5fa0]/35 to-transparent dark:via-[#c9b3ec]/35";

const SURFACE =
  "relative overflow-hidden rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#2b2830]";

const INTERACTIVE_SURFACE =
  `${SURFACE} transition-all duration-300 hover:-translate-y-1 hover:border-[#5646a8]/25 hover:shadow-[0_22px_54px_-30px_rgba(58,51,69,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fa0]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] dark:hover:border-[#c9b3ec]/30 dark:focus-visible:ring-offset-[#2b2830]`;

const BADGE =
  "inline-flex w-max items-center rounded-full border border-[#37304a]/10 bg-[#f4ecdf] px-2.5 py-1 font-mono text-xs uppercase tracking-[0.22em] text-[#6f6885] shadow-[0_6px_16px_-12px_rgba(58,51,69,0.32)] dark:border-white/10 dark:bg-[#26232c] dark:text-[#a9a2bd]";


export const extraComponents = {
  SpotifyNowPlaying: () => <SpotifyReveal />,

  /**
   * Escape-hatch component (audit #27 §2): the side-projects grid from the
   * main-branch About section. Content is static and unique to the home
   * view — a generic catalog component would need Lottie + images + click
   * actions for one-off content. Promote to a data-driven FeatureCard if
   * answers ever need side-project-like cards.
   */
  SideProjects: ({ props }: BaseComponentProps<{ title?: string | null }>) => (
    <div>
      {props.title ? (
        <h3 className="mb-4 flex items-center gap-2 font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
          <Code2 {...ICON} className="size-4 shrink-0" /> {props.title}
        </h3>
      ) : null}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className={`${SURFACE} p-6`}>
          <span aria-hidden className={CARD_RULE} />
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#37304a]/10 bg-[#f4ecdf] dark:border-white/10 dark:bg-[#26232c]">
                <Image
                  src="/Noah Icon FA.svg"
                  alt="3D Printing"
                  width={64}
                  height={64}
                  className="h-12 w-12"
                  unoptimized
                />
              </span>
              <h4 className="text-lg font-semibold tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                3D Printing
              </h4>
            </div>
            <span className={BADGE}>At the bench</span>
          </div>
          <p className="text-pretty text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
            I have learned CAD design and use a variety of 3D printing methods
            and techniques to make my products work for different use cases.
            Namely in FDM printing at the moment, but with very high end
            materials and machines.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className={BADGE}>CAD</span>
            <span className={BADGE}>FDM</span>
            <span className={BADGE}>Materials</span>
          </div>
        </div>
        <a
          href="https://blog.noahrijkaard.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`${INTERACTIVE_SURFACE} group block h-full p-6`}
        >
          <span aria-hidden className={CARD_RULE} />
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-primary"
              >
                <BookOpen {...ICON} className="size-6" />
              </span>
              <h4 className="text-lg font-semibold tracking-tight text-[#37304a] transition-colors group-hover:text-[#5646a8] dark:text-[#eae6f2] dark:group-hover:text-[#c9b3ec]">
                My blog!
              </h4>
            </div>
            <span className={BADGE}>Read notes</span>
          </div>
          <p className="text-pretty text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
            The tech diary of Noah Rijkaard, a Full-stack software engineer
            working out of Kuala Lumpur Malaysia, it comprises of tutorials,
            thoughts and existential crises.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-[#6f6885] transition-colors group-hover:text-[#5646a8] dark:text-[#a9a2bd] dark:group-hover:text-[#c9b3ec]">
            Open blog
          </span>
        </a>
      </div>
    </div>
  ),

  ImageBlock: ({
    props,
  }: BaseComponentProps<{ src: string; alt: string; caption?: string | null }>) => (
    <figure className={SURFACE}>
      <span aria-hidden className={CARD_RULE} />
      <Image
        src={props.src}
        alt={props.alt}
        width={640}
        height={400}
        className="h-auto w-full object-cover"
        unoptimized={isSvgSrc(props.src)}
      />
      {props.caption ? (
        <figcaption className="border-t border-[#37304a]/10 px-5 py-4 font-mono text-[10px] uppercase tracking-widest text-[#6f6885] dark:border-white/10 dark:text-[#a9a2bd]">
          {props.caption}
        </figcaption>
      ) : null}
    </figure>
  ),

  StepFlow: ({
    props,
  }: BaseComponentProps<{ steps: { title: string; body: string }[] }>) => (
    <ol className="space-y-4">
      {props.steps.map((step, i) => (
        <li
          key={i}
          className={`${SURFACE} flex items-start gap-4 p-5 text-left`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#37304a]/10 bg-[#fffdf8] text-base font-semibold text-[#5646a8] dark:border-white/10 dark:bg-[#26232c] dark:text-[#9d8ff2]">
            {i + 1}
          </span>
          <div className="min-w-0">
            <h4 className="font-semibold tracking-tight text-[#37304a] dark:text-[#eae6f2]">
              {step.title}
            </h4>
            <p className="mt-1 text-pretty text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  ),
};

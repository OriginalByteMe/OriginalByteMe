"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Code2 } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { BaseComponentProps } from "@json-render/react";
import SpotifyReveal from "@/components/ui/spotify-reveal";
import { enter } from "../motion";

/** One consistent icon treatment everywhere (design-contract §5). */
const ICON = { strokeWidth: 1.5 } as const;

/** Matte card — base register (design-contract §3.1). */
const MATTE_CARD =
  "rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] p-8 shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#2b2830]";

export const extraComponents = {
  LottieFigure: ({
    props,
  }: BaseComponentProps<{ src: string; caption?: string | null }>) => (
    <figure className="flex flex-col items-center gap-2">
      <DotLottieReact src={props.src} loop autoplay className="w-full max-w-sm" />
      {props.caption ? (
        <figcaption className="text-center font-mono text-[10px] uppercase tracking-widest text-[#6f6885] dark:text-[#a9a2bd]">
          {props.caption}
        </figcaption>
      ) : null}
    </figure>
  ),

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
        <div className={MATTE_CARD}>
          <div className="mb-4 flex items-center gap-3">
            <Image
              src="/Noah Icon FA.svg"
              alt="3D Printing"
              width={64}
              height={64}
              className="h-16 w-16"
            />
            <h4 className="text-lg font-semibold tracking-tight text-[#37304a] dark:text-[#eae6f2]">
              3D Printing
            </h4>
          </div>
          <p className="text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
            I have learned CAD design and use a variety of 3D printing methods
            and techniques to make my products work for different use cases.
            Namely in FDM printing at the moment, but with very high end
            materials and machines.
          </p>
        </div>
        <a
          href="https://blog.noahrijkaard.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`${MATTE_CARD} group block transition-colors`}
        >
          <div className="mb-4 flex items-center gap-3">
            <DotLottieReact
              src="https://lottie.host/ef9b2abd-0371-4525-ad25-ad50ff45c364/JSqmr4sTA8.lottie"
              loop
              autoplay
              className="h-16 w-16"
            />
            <h4 className="text-lg font-semibold tracking-tight text-[#37304a] transition-colors group-hover:text-[#5646a8] group-hover:underline dark:text-[#eae6f2] dark:group-hover:text-[#9d8ff2]">
              My blog!
            </h4>
          </div>
          <p className="text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
            The tech diary of Noah Rijkaard, a Full-stack software engineer
            working out of Kuala Lumpur Malaysia, it comprises of tutorials,
            thoughts and existential crises.
          </p>
        </a>
      </div>
    </div>
  ),

  ImageBlock: ({
    props,
  }: BaseComponentProps<{ src: string; alt: string; caption?: string | null }>) => (
    <figure className="overflow-hidden rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#2b2830]">
      <Image
        src={props.src}
        alt={props.alt}
        width={640}
        height={400}
        className="h-auto w-full object-cover"
      />
      {props.caption ? (
        <figcaption className="px-5 py-4 font-mono text-[10px] uppercase tracking-widest text-[#6f6885] dark:text-[#a9a2bd]">
          {props.caption}
        </figcaption>
      ) : null}
    </figure>
  ),

  StepFlow: ({
    props,
  }: BaseComponentProps<{ steps: { title: string; body: string }[] }>) => (
    <motion.ol className="space-y-6">
      {props.steps.map((step, i) => (
        <motion.li
          key={i}
          custom={i}
          variants={enter}
          initial="hidden"
          animate="show"
          className="flex items-start gap-4"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#37304a]/10 bg-[#fffdf8] text-sm font-semibold text-[#5646a8] dark:border-white/10 dark:bg-[#2b2830] dark:text-[#9d8ff2]">
            {i + 1}
          </span>
          <div>
            <h4 className="font-semibold tracking-tight text-[#37304a] dark:text-[#eae6f2]">
              {step.title}
            </h4>
            <p className="text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
              {step.body}
            </p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  ),
};

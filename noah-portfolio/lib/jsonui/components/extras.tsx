"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Code } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { BaseComponentProps } from "@json-render/react";
import SpotifyReveal from "@/components/ui/spotify-reveal";
import FrostedGlassBox from "@/components/ui/frosted-glass-box";
import { enter } from "../motion";

export const extraComponents = {
  LottieFigure: ({
    props,
  }: BaseComponentProps<{ src: string; caption?: string | null }>) => (
    <figure className="flex flex-col items-center gap-2">
      <DotLottieReact src={props.src} loop autoplay className="w-full max-w-sm" />
      {props.caption ? (
        <figcaption className="text-sm text-gray-500 dark:text-gray-400 text-center">
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
        <h3 className="text-2xl font-semibold mb-4 flex items-center">
          <Code className="mr-2" /> {props.title}
        </h3>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FrostedGlassBox
          className="p-6 rounded-xl shadow-sm"
          variant="blue"
          hoverEffect="lift"
          glassOpacity="heavy"
        >
          <div className="flex items-center mb-4">
            <Image
              src="/Noah Icon FA.svg"
              alt="3D Printing"
              width={64}
              height={64}
              className="w-16 h-16 mr-3"
            />
            <h4 className="text-lg font-semibold">3D Printing</h4>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            I have learned CAD design and use a variety of 3D printing methods
            and techniques to make my products work for different use cases.
            Namely in FDM printing at the moment, but with very high end
            materials and machines.
          </p>
        </FrostedGlassBox>
        <FrostedGlassBox
          className="p-6 rounded-xl shadow-sm"
          variant="blue"
          hoverEffect="lift"
          glassOpacity="heavy"
          onClick={() => window.open("https://blog.noahrijkaard.com", "_blank")}
        >
          <div className="flex items-center mb-4">
            <div className="flex items-center mb-4">
              <DotLottieReact
                src="https://lottie.host/ef9b2abd-0371-4525-ad25-ad50ff45c364/JSqmr4sTA8.lottie"
                loop
                autoplay
                className="w-16 h-16 mr-3"
              />
            </div>
            <h4 className="text-lg font-semibold hover:underline hover:text-blue-500 dark:hover:text-blue-400">
              My blog!
            </h4>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            The tech diary of Noah Rijkaard, a Full-stack software engineer
            working out of Kuala Lumpur Malaysia, it comprises of tutorials,
            thoughts and existential crises.
          </p>
        </FrostedGlassBox>
      </div>
    </div>
  ),

  ImageBlock: ({
    props,
  }: BaseComponentProps<{ src: string; alt: string; caption?: string | null }>) => (
    <figure className="flex flex-col items-center gap-2">
      <Image
        src={props.src}
        alt={props.alt}
        width={640}
        height={400}
        className="w-full h-auto rounded-xl object-cover"
      />
      {props.caption ? (
        <figcaption className="text-sm text-gray-500 dark:text-gray-400 text-center">
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
          <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-semibold text-sm">
            {i + 1}
          </span>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {step.title}
            </h4>
            <p className="text-gray-600 dark:text-gray-400">{step.body}</p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  ),
};

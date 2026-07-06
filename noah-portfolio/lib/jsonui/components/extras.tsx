"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import type { BaseComponentProps } from "@json-render/react";
import SpotifyReveal from "@/components/ui/spotify-reveal";
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

"use client";

import { motion } from "framer-motion";
import MinimalScene from "./MinimalScene";
import Reveal from "../Reveal";
import Magnetic from "../Magnetic";
import CursorTrail from "../CursorTrail";
import CutoutDemo from "./demos/CutoutDemo";
import ArenaDemo from "./demos/ArenaDemo";
import BlogDemo from "./demos/BlogDemo";
import SpotifyReveal from "@/components/ui/spotify-reveal";
import {
  about,
  location,
  name,
  projects,
  skills,
  socials,
  work,
} from "@/lib/portfolio-data";

const PROJECT_DEMOS = [CutoutDemo, ArenaDemo, BlogDemo];

function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-10 flex items-baseline gap-4 border-t border-zinc-300 pt-6 dark:border-zinc-800">
      <span className="font-mono text-xs text-zinc-400 dark:text-zinc-600">
        {index}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {title}
      </h2>
    </div>
  );
}

/** Name rendered as individually animated letters: staggered entrance, and
 * each letter hops when hovered. */
function StaggeredName({ text, delay }: { text: string; delay: number }) {
  return (
    <span className="inline-block overflow-hidden align-bottom">
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          transition={{
            delay: delay + i * 0.045,
            duration: 0.7,
            ease: [0.21, 0.6, 0.35, 1],
          }}
          whileHover={{ y: -10, transition: { type: "spring", stiffness: 500, damping: 14 } }}
          className="inline-block cursor-default"
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

export default function MinimalDesign() {
  return (
    <div className="relative min-h-screen bg-zinc-50 text-zinc-900 selection:bg-zinc-900 selection:text-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      <MinimalScene />
      <CursorTrail />

      <div className="relative z-10">
        {/* Hero */}
        <section className="flex h-screen flex-col justify-end px-6 pb-24 md:px-12">
          <div className="mx-auto w-full max-w-5xl">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-zinc-500"
            >
              AI Engineer — {location}
            </motion.p>
            <h1 className="text-6xl font-bold leading-[0.95] tracking-tighter md:text-8xl">
              <StaggeredName text={name.split(" ")[0]} delay={0.4} />
              <br />
              <StaggeredName text={name.split(" ")[1]} delay={0.7} />
            </h1>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.8 }}
              className="mt-8 flex flex-wrap items-end justify-between gap-6"
            >
              <div>
                <p className="max-w-sm text-sm leading-6 text-zinc-500">
                  Agentic systems, LLM pipelines and the full stack that gets
                  them shipped. He waves if you get close.
                </p>
                <div className="mt-3 -ml-2 flex justify-start">
                  <SpotifyReveal />
                </div>
              </div>
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="font-mono text-xs text-zinc-400"
              >
                scroll ↓
              </motion.span>
            </motion.div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-28 px-6 pb-44 pt-10 md:px-12">
          {/* About */}
          <Reveal>
            <SectionHeading index="01" title="About" />
            <p className="max-w-2xl text-lg leading-9 text-zinc-700 dark:text-zinc-300">
              {about}
            </p>
          </Reveal>

          {/* Skills */}
          <div>
            <Reveal>
              <SectionHeading index="02" title="Stack" />
            </Reveal>
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
              {skills.map((group, i) => (
                <Reveal key={group.category} delay={i * 0.08}>
                  <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-600">
                    {group.category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <motion.span
                        key={item}
                        whileHover={{ y: -3 }}
                        transition={{ type: "spring", stiffness: 400, damping: 16 }}
                        className="cursor-default rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-700 transition-colors duration-200 hover:bg-zinc-900 hover:text-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
                      >
                        {item}
                      </motion.span>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Work */}
          <div>
            <Reveal>
              <SectionHeading index="03" title="Work" />
            </Reveal>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {work.map((job, i) => (
                <Reveal key={job.company} delay={i * 0.08}>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group -mx-4 grid gap-2 rounded-md px-4 py-8 transition-colors duration-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 md:grid-cols-[1fr_2fr_auto]"
                  >
                    <h3 className="text-xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
                      {job.company}
                    </h3>
                    <div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {job.role}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-zinc-500">
                        {job.blurb}
                      </p>
                    </div>
                    <p className="font-mono text-xs text-zinc-400 dark:text-zinc-600">
                      {job.period}
                    </p>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Projects — each with its own interactive demo */}
          <div>
            <Reveal>
              <SectionHeading index="04" title="Projects" />
              <p className="-mt-4 mb-12 font-mono text-xs text-zinc-400 dark:text-zinc-600">
                each one is a toy — touch them
              </p>
            </Reveal>
            <div className="space-y-24">
              {projects.map((project, i) => {
                const Demo = PROJECT_DEMOS[i % PROJECT_DEMOS.length];
                const flip = i % 2 === 1;
                return (
                  <Reveal key={project.title}>
                    <div className="grid items-center gap-10 md:grid-cols-2">
                      <div className={flip ? "md:order-2" : ""}>
                        <p className="mb-2 font-mono text-xs text-zinc-400 dark:text-zinc-600">
                          {String(i + 1).padStart(2, "0")} / {project.repo}
                        </p>
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-baseline gap-3"
                        >
                          <h3 className="text-2xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4 md:text-3xl">
                            {project.title}
                          </h3>
                          <span className="text-zinc-300 transition-transform duration-300 group-hover:translate-x-1 dark:text-zinc-700">
                            ↗
                          </span>
                        </a>
                        <p className="mt-4 max-w-md text-sm leading-7 text-zinc-500">
                          {project.description}
                        </p>
                        <p className="mt-4 font-mono text-xs text-zinc-400 dark:text-zinc-600">
                          {project.stack.join(" / ")}
                        </p>
                      </div>
                      <div className={flip ? "md:order-1" : ""}>
                        <Demo />
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* Contact */}
          <Reveal>
            <SectionHeading index="05" title="Contact" />
            <div className="flex flex-col gap-5">
              {socials.map((social) => (
                <Magnetic key={social.label} strength={0.22} className="w-fit">
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-4"
                  >
                    <span className="w-24 font-mono text-xs uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-600">
                      {social.label}
                    </span>
                    <span className="text-lg tracking-tight underline-offset-4 group-hover:underline md:text-2xl">
                      {social.value}
                    </span>
                  </a>
                </Magnetic>
              ))}
            </div>
            <p className="mt-20 font-mono text-xs text-zinc-400 dark:text-zinc-600">
              © {new Date().getFullYear()} {name} — built with agents, shipped by hand.
            </p>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

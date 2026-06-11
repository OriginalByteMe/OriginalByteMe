"use client";

import { motion } from "framer-motion";
import MinimalScene from "./MinimalScene";
import Reveal from "../Reveal";
import {
  about,
  location,
  name,
  projects,
  skills,
  socials,
  work,
} from "@/lib/portfolio-data";

function SectionHeading({
  index,
  title,
}: {
  index: string;
  title: string;
}) {
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

export default function MinimalDesign() {
  return (
    <div className="relative min-h-screen bg-zinc-50 text-zinc-900 selection:bg-zinc-900 selection:text-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      <MinimalScene />

      <div className="relative z-10">
        {/* Hero */}
        <section className="flex h-screen flex-col justify-end px-6 pb-24 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1, ease: [0.21, 0.6, 0.35, 1] }}
            className="mx-auto w-full max-w-5xl"
          >
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
              AI Engineer — {location}
            </p>
            <h1 className="text-6xl font-bold leading-[0.95] tracking-tighter md:text-8xl">
              {name.split(" ")[0]}
              <br />
              {name.split(" ")[1]}
            </h1>
            <div className="mt-8 flex items-center justify-between">
              <p className="max-w-sm text-sm leading-6 text-zinc-500">
                Agentic systems, LLM pipelines and the full stack
                that gets them shipped.
              </p>
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="font-mono text-xs text-zinc-400"
              >
                scroll ↓
              </motion.span>
            </div>
          </motion.div>
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
                  <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-600">
                    {group.category}
                  </p>
                  <p className="text-base leading-8 text-zinc-700 dark:text-zinc-300">
                    {group.items.join("  ·  ")}
                  </p>
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
                    className="group grid gap-2 py-8 transition-colors md:grid-cols-[1fr_2fr_auto]"
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

          {/* Projects */}
          <div>
            <Reveal>
              <SectionHeading index="04" title="Projects" />
            </Reveal>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {projects.map((project, i) => (
                <Reveal key={project.title} delay={i * 0.08}>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-6 py-8 transition-transform duration-300 hover:translate-x-2"
                  >
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4">
                        {project.title}
                      </h3>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                        {project.description}
                      </p>
                      <p className="mt-3 font-mono text-xs text-zinc-400 dark:text-zinc-600">
                        {project.stack.join(" / ")}
                      </p>
                    </div>
                    <span className="mt-1 text-zinc-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100">
                      →
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Contact */}
          <Reveal>
            <SectionHeading index="05" title="Contact" />
            <div className="flex flex-col gap-4">
              {socials.map((social) => (
                <a
                  key={social.label}
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

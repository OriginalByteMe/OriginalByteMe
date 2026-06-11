"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TerminalScene from "./TerminalScene";
import Reveal from "../Reveal";
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

/* ------------------------------ boot sequence ----------------------------- */

const BOOT_LINES = [
  "> noah.os v3.0 — agentic build",
  "> mounting /dev/creativity .......... OK",
  "> loading llm runtime ............... OK",
  "> spawning agents [4/4] ............. OK",
  "> establishing neural link .......... OK",
  "> welcome, visitor",
];

let hasBootedThisSession = false;

function BootSequence({ onDone }: { onDone: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visibleLines < BOOT_LINES.length) {
      const id = setTimeout(() => setVisibleLines((n) => n + 1), 220);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setExiting(true), 500);
    return () => clearTimeout(id);
  }, [visibleLines]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!exiting && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#020503]"
        >
          <div className="w-full max-w-md px-6 text-sm text-emerald-400">
            {BOOT_LINES.slice(0, visibleLines).map((line) => (
              <p key={line} className="leading-7">
                {line}
              </p>
            ))}
            <span className="terminal-cursor" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- terminal window ---------------------------- */

function Window({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-emerald-500/25 bg-black/70 shadow-[0_0_40px_-18px_rgba(34,197,94,0.5)] backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-950/40 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-xs text-emerald-500/70">{title}</span>
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </div>
  );
}

function Prompt({ command }: { command: string }) {
  return (
    <p className="mb-4 text-sm">
      <span className="text-emerald-600">visitor@noah</span>
      <span className="text-emerald-500/50">:~$ </span>
      <span className="text-emerald-300">{command}</span>
    </p>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/15">
      {children}
    </span>
  );
}

/* --------------------------------- design --------------------------------- */

export default function TerminalDesign() {
  const [booted, setBooted] = useState(hasBootedThisSession);

  return (
    <div className="relative min-h-screen bg-[#020503] font-mono text-emerald-300 selection:bg-emerald-500/30">
      <TerminalScene />
      <div className="crt-overlay" />
      <div className="crt-vignette crt-flicker" />

      {!booted && (
        <BootSequence
          onDone={() => {
            hasBootedThisSession = true;
            setBooted(true);
          }}
        />
      )}

      <div className="relative z-10">
        {/* Hero — the 3D orbit fills the center; identity sits at the bottom */}
        <section className="flex h-screen flex-col items-center justify-end pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: booted ? 0.2 : 1.8, duration: 0.8 }}
          >
            <p className="mb-2 text-sm text-emerald-600">
              visitor@noah:~$ whoami
            </p>
            <h1
              className="text-4xl font-bold tracking-tight text-emerald-300 md:text-6xl"
              style={{ textShadow: "0 0 24px rgba(52,211,153,0.45)" }}
            >
              {name.toUpperCase().replace(" ", "_")}
            </h1>
            <p className="mt-3 text-sm text-emerald-500/80 md:text-base">
              [ AI engineer · agentic systems · full-stack · {location} ]
            </p>
            <div className="mt-2 flex justify-center">
              <SpotifyReveal />
            </div>
            <motion.p
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mt-4 text-xs text-emerald-600"
            >
              ▼ scroll to render more
            </motion.p>
          </motion.div>
        </section>

        <div className="mx-auto max-w-5xl space-y-24 px-4 pb-44 pt-10">
          {/* About */}
          <Reveal>
            <Window title="noah@portfolio: ~/about">
              <Prompt command="cat about.md" />
              <p className="max-w-3xl text-sm leading-7 text-emerald-200/85">
                {about}
              </p>
            </Window>
          </Reveal>

          {/* Skills */}
          <Reveal>
            <Window title="noah@portfolio: ~/skills">
              <Prompt command="tree skills/ --flat" />
              <div className="space-y-5">
                {skills.map((group) => (
                  <div key={group.category}>
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-600">
                      ./{group.category.toLowerCase().replace(/[ &]+/g, "-")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <Chip key={item}>{item}</Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Window>
          </Reveal>

          {/* Work */}
          <Reveal>
            <Window title="noah@portfolio: ~/work">
              <Prompt command="history --career" />
              <ul className="space-y-6">
                {work.map((job) => (
                  <li key={job.company} className="border-l-2 border-emerald-500/30 pl-4">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-semibold text-emerald-300 underline-offset-4 hover:underline"
                    >
                      {job.company} ↗
                    </a>
                    <p className="text-sm text-emerald-400/90">{job.role}</p>
                    <p className="text-xs text-emerald-600">{job.period}</p>
                    <p className="mt-1 text-sm text-emerald-200/70">{job.blurb}</p>
                  </li>
                ))}
              </ul>
            </Window>
          </Reveal>

          {/* Projects */}
          <div>
            <Reveal>
              <Prompt command="ls ~/projects --featured" />
            </Reveal>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, i) => (
                <Reveal key={project.title} delay={i * 0.12}>
                  <a href={project.url} target="_blank" rel="noopener noreferrer">
                    <Window
                      title={project.repo}
                      className="group h-full transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-[0_0_50px_-12px_rgba(34,197,94,0.7)]"
                    >
                      <h3 className="mb-2 text-lg font-semibold text-emerald-300 group-hover:underline">
                        {project.title}
                      </h3>
                      <p className="mb-4 text-sm leading-6 text-emerald-200/70">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {project.stack.map((tech) => (
                          <Chip key={tech}>{tech}</Chip>
                        ))}
                      </div>
                    </Window>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Contact */}
          <Reveal>
            <Window title="noah@portfolio: ~/contact">
              <Prompt command="noah --connect" />
              <div className="grid gap-4 md:grid-cols-3">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-emerald-500/25 bg-emerald-500/5 p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-500/15"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                      {social.label}
                    </p>
                    <p className="mt-1 break-all text-sm text-emerald-300">
                      {social.value}
                    </p>
                  </a>
                ))}
              </div>
              <p className="mt-8 text-sm text-emerald-600">
                visitor@noah:~$ <span className="terminal-cursor" />
              </p>
            </Window>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

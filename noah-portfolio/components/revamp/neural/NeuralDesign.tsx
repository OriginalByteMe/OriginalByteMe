"use client";

import { motion } from "framer-motion";
import NeuralScene from "./NeuralScene";
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

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-[0_0_50px_-18px_rgba(99,102,241,0.55)] md:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-6 font-mono text-xs uppercase tracking-[0.35em] text-cyan-300/70">
      ⟡ {children}
    </p>
  );
}

export default function NeuralDesign() {
  return (
    <div className="relative min-h-screen bg-[#05060f] text-slate-200 selection:bg-indigo-500/40">
      {/* Ambient gradient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(79,70,229,0.18) 0%, transparent 70%), radial-gradient(45% 40% at 80% 90%, rgba(34,211,238,0.10) 0%, transparent 70%)",
        }}
      />
      <NeuralScene />

      <div className="relative z-10">
        {/* Hero */}
        <section className="flex h-screen flex-col items-center justify-end pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.21, 0.6, 0.35, 1] }}
          >
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.45em] text-cyan-300/80">
              agentic · ai · systems
            </p>
            <h1 className="bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl">
              {name}
            </h1>
            <p className="mt-4 max-w-xl text-sm text-slate-400 md:text-base">
              Building agents that plan, call tools and ship — from {location}.
            </p>
            <div className="mt-2 flex justify-center">
              <SpotifyReveal />
            </div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="mt-6 text-cyan-300/60"
            >
              ↓
            </motion.div>
          </motion.div>
        </section>

        <div className="mx-auto max-w-5xl space-y-28 px-4 pb-44 pt-10">
          {/* About */}
          <Reveal>
            <SectionLabel>signal // about</SectionLabel>
            <GlassCard>
              <p className="max-w-3xl text-base leading-8 text-slate-300">
                {about}
              </p>
            </GlassCard>
          </Reveal>

          {/* Skills */}
          <div>
            <Reveal>
              <SectionLabel>capabilities // stack</SectionLabel>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-2">
              {skills.map((group, i) => (
                <Reveal key={group.category} delay={i * 0.1}>
                  <GlassCard className="h-full transition-all duration-300 hover:border-cyan-400/30 hover:shadow-[0_0_60px_-15px_rgba(34,211,238,0.6)]">
                    <h3 className="mb-4 bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text font-semibold text-transparent">
                      {group.category}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </GlassCard>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Work timeline */}
          <div>
            <Reveal>
              <SectionLabel>trajectory // work</SectionLabel>
            </Reveal>
            <div className="relative ml-3 space-y-10 border-l border-indigo-400/30 pl-8">
              {work.map((job, i) => (
                <Reveal key={job.company} delay={i * 0.12}>
                  <div className="relative">
                    <span className="absolute -left-[39px] top-1.5 h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-semibold text-slate-100 underline-offset-4 hover:underline"
                    >
                      {job.company} ↗
                    </a>
                    <p className="text-sm text-cyan-200/80">{job.role}</p>
                    <p className="font-mono text-xs text-slate-500">{job.period}</p>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                      {job.blurb}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div>
            <Reveal>
              <SectionLabel>artifacts // projects</SectionLabel>
            </Reveal>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, i) => (
                <Reveal key={project.title} delay={i * 0.12}>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full"
                  >
                    <GlassCard className="group h-full transition-all duration-300 hover:-translate-y-2 hover:border-fuchsia-400/30 hover:shadow-[0_0_70px_-15px_rgba(232,121,249,0.5)]">
                      <h3 className="mb-2 text-lg font-semibold text-slate-100 group-hover:text-fuchsia-200">
                        {project.title}
                      </h3>
                      <p className="mb-4 font-mono text-[11px] text-slate-500">
                        {project.repo}
                      </p>
                      <p className="mb-5 text-sm leading-6 text-slate-400">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {project.stack.map((tech) => (
                          <span
                            key={tech}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </GlassCard>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Contact */}
          <Reveal>
            <SectionLabel>handshake // contact</SectionLabel>
            <GlassCard>
              <div className="flex flex-col items-center gap-6 text-center">
                <p className="max-w-md text-sm text-slate-400">
                  Open to collaborating on agents, evals and AI products.
                  Pick a channel:
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 px-6 py-2.5 text-sm text-cyan-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_-8px_rgba(34,211,238,0.8)]"
                    >
                      {social.label}
                    </a>
                  ))}
                </div>
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

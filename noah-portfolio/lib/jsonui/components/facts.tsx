"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  Terminal,
  Layout,
  Server,
  Database,
  Mail,
  Github,
  Linkedin,
  Code2,
  Briefcase,
  ArrowUpRight,
  BookOpen,
  Sparkles,
} from "lucide-react";
import type { BaseComponentProps } from "@json-render/react";
import { useStateValue } from "@json-render/react";
import { useIsDark } from "../use-is-dark";
import type { Project, SkillCategory, Job, Contact, IconRef, OperatingSystem } from "@/lib/corpus/types";
import { cn, isSvgSrc } from "@/lib/utils";

// Single lucide treatment everywhere: 1.5 stroke (design-contract §5).
const ICON = { strokeWidth: 1.5 } as const;

const CARD_RULE =
  "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7a5fa0]/35 to-transparent dark:via-[#c9b3ec]/35";

const SURFACE =
  "relative overflow-hidden rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#2b2830]";

const INTERACTIVE_SURFACE =
  `${SURFACE} transition-all duration-300 hover:-translate-y-1 hover:border-[#5646a8]/25 hover:shadow-[0_22px_54px_-30px_rgba(58,51,69,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fa0]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] dark:hover:border-[#c9b3ec]/30 dark:focus-visible:ring-offset-[#2b2830]`;

const CHIP =
  "inline-flex w-max items-center gap-2 rounded-full border border-[#37304a]/10 bg-[#fffdf8] px-3 py-1 font-mono text-xs text-[#5d5673] shadow-[0_6px_16px_-12px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#26232c] dark:text-[#bdb6d0]";

const BADGE =
  "inline-flex w-max items-center rounded-full border border-[#37304a]/10 bg-[#f4ecdf] px-2.5 py-1 font-mono text-xs uppercase tracking-[0.22em] text-[#6f6885] dark:border-white/10 dark:bg-[#26232c] dark:text-[#a9a2bd]";

const categoryIcons: Record<string, typeof Terminal> = {
  "Programming Languages": Terminal,
  "Frontend Frameworks": Layout,
  "Infrastructure & DevOps": Server,
  "AI & LLM Tooling": Sparkles,
  Databases: Database,
};

// Pills lift on hover — a small "alive" treatment for the toolbox (§9.1 spring family).
// The "hover" label propagates to the icon so the logo does a happy wiggle.
const pillMotion = {
  hover: { scale: 1.08, y: -2 },
};

const pillIconMotion = {
  hover: {
    rotate: [0, -16, 12, -6, 0],
    scale: [1, 1.25, 1.1, 1.18, 1],
    transition: { duration: 0.55, ease: "easeInOut" as const },
  },
};

function SkillPill({ skill, isDark }: { skill: IconRef; isDark: boolean }) {
  const src = isDark ? skill.darkImage : skill.lightImage;

  return (
    <motion.span
      variants={pillMotion}
      whileHover="hover"
      className={CHIP}
    >
      <motion.span variants={pillIconMotion} className="flex shrink-0">
        <Image
          src={src}
          alt={skill.name}
          width={20}
          height={20}
          className={cn("h-5 w-5", skill.invertInDark && "dark:invert")}
          unoptimized={isSvgSrc(src)}
        />
      </motion.span>
      {skill.name}
    </motion.span>
  );
}

export const factComponents = {
  ProjectShowcase: ({ props }: BaseComponentProps<{ statePath: string; slug?: string | null }>) => {
    const isDark = useIsDark();
    const all = useStateValue<Project[]>(props.statePath) ?? [];
    const projects = props.slug ? all.filter((p) => p.slug === props.slug) : all;
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <motion.a
            key={project.slug}
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex h-full flex-col text-left ${INTERACTIVE_SURFACE}`}
          >
            <div className="relative m-3 overflow-hidden rounded-[1.35rem] border border-[#37304a]/10 bg-[#f4ecdf] dark:border-white/10 dark:bg-[#26232c]">
              <Image
                src={project.image}
                alt={project.title}
                width={300}
                height={200}
                className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                unoptimized={isSvgSrc(project.image)}
              />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f4ecdf] via-[#f4ecdf]/70 to-transparent dark:from-[#26232c]" />
            </div>
            <div className="relative flex flex-1 flex-col p-6">
              <span aria-hidden className={CARD_RULE} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <span className={BADGE}>Selected project</span>
                  <h3 className="flex items-center gap-2 font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                    {project.title}
                    <ArrowUpRight
                      {...ICON}
                      className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </h3>
                </div>
                <span className={BADGE}>{project.technologies.length} tools</span>
              </div>
              <p className="mt-4 text-pretty text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
                {project.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {project.technologies.map((tech) => (
                  <span key={tech.name} className={CHIP}>
                    <Image
                      src={isDark ? tech.darkIcon : tech.lightIcon}
                      alt={tech.name}
                      width={20}
                      height={20}
                      className="h-5 w-5"
                      unoptimized={isSvgSrc(isDark ? tech.darkIcon : tech.lightIcon)}
                    />
                    <span>{tech.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    );
  },

  SkillGrid: ({ props }: BaseComponentProps<{ statePath: string; title?: string | null }>) => {
    const isDark = useIsDark();
    const categories = useStateValue<SkillCategory[]>(props.statePath) ?? [];
    return (
      <div>
        {props.title ? (
          <h3 className="mb-6 flex items-center gap-2 font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
            <Code2 {...ICON} className="size-5 shrink-0" /> {props.title}
          </h3>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map(({ category, skills }) => {
            const Icon = categoryIcons[category] ?? Code2;
            return (
              <motion.div
                key={category}
                className={`${SURFACE} p-6`}
              >
                <span aria-hidden className={CARD_RULE} />
                <div className="flex items-start justify-between gap-4">
                  <h4 className="flex items-center gap-2 font-serif text-xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                    <Icon {...ICON} className="size-4 shrink-0" />
                    {category}
                  </h4>
                  <span className={BADGE}>{skills.length} items</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <SkillPill key={skill.name} skill={skill} isDark={isDark} />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  },

  SkillCloud: ({ props }: BaseComponentProps<{ statePath: string }>) => {
    const isDark = useIsDark();
    const categories = useStateValue<SkillCategory[]>(props.statePath) ?? [];
    const skills = categories.flatMap((c) => c.skills);
    return (
      <div className="flex flex-wrap gap-2">
        {skills.map((skill, i) => (
          <SkillPill key={`${skill.name}-${i}`} skill={skill} isDark={isDark} />
        ))}
      </div>
    );
  },

  CareerTimeline: ({ props }: BaseComponentProps<{ statePath: string; title?: string | null }>) => {
    const jobs = useStateValue<Job[]>(props.statePath) ?? [];
    return (
      <div>
        {props.title ? (
          <h3 className="mb-6 flex items-center gap-2 font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
            <Briefcase {...ICON} className="size-5 shrink-0" /> {props.title}
          </h3>
        ) : null}
        <ul className="space-y-4">
          {jobs.map((job) => (
            <motion.li
              key={job.company}
              className="flex items-start gap-4 border-l-2 border-[#37304a]/10 pl-4 dark:border-white/10"
            >
              <Image
                src={job.logo}
                alt={`${job.company} logo`}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-contain"
                unoptimized={isSvgSrc(job.logo)}
              />
              <div>
                <h4 aria-label={job.company} className="text-base font-semibold tracking-tight">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Visit ${job.company} website`}
                    className="inline-flex items-center gap-2 rounded-sm text-[#5646a8] transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fa0]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf8] dark:text-[#9d8ff2] dark:focus-visible:ring-offset-[#2b2830]"
                  >
                    {job.company}
                    <ArrowUpRight {...ICON} aria-hidden="true" className="size-4 shrink-0" />
                  </a>
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
                  {job.role}
                </p>
                <p className="mt-1 font-mono text-xs uppercase tracking-widest text-[#6f6885] dark:text-[#a9a2bd]">
                  {job.period}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    );
  },

  OperatingSystemsGrid: ({ props }: BaseComponentProps<{ statePath: string; title?: string | null }>) => {
    const isDark = useIsDark();
    const environments = useStateValue<OperatingSystem[]>(props.statePath) ?? [];
    return (
      <div role="region" aria-label={props.title ?? "Operating systems"}>
        {props.title ? (
          <h3 className="mb-6 flex items-center gap-2 font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
            <Code2 {...ICON} className="size-5 shrink-0" /> {props.title}
          </h3>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {environments.map((environment) => {
            const [primary, ...rest] = environment.systems;
            return (
              <motion.div
                key={environment.name}
                className={`${SURFACE} p-6`}
              >
                <span aria-hidden className={CARD_RULE} />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {primary ? (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#37304a]/10 bg-[#f4ecdf] dark:border-white/10 dark:bg-[#26232c]">
                        <Image
                          src={isDark ? primary.darkImage : primary.lightImage}
                          alt={primary.name}
                          width={20}
                          height={20}
                          className={cn("size-4 shrink-0", primary.invertInDark && "dark:invert")}
                          unoptimized={isSvgSrc(isDark ? primary.darkImage : primary.lightImage)}
                        />
                      </span>
                    ) : null}
                    <h4 className="font-serif text-xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                      {environment.name}
                    </h4>
                  </div>
                  <span className={BADGE}>
                    {environment.systems.length} {environment.systems.length === 1 ? "system" : "systems"}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {rest.map((system) => (
                    <SkillPill key={system.name} skill={system} isDark={isDark} />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  },

  ContactCard: ({ props }: BaseComponentProps<{ statePath: string }>) => {
    const contact = useStateValue<Contact>(props.statePath);
    const email = contact?.email?.trim() ?? "";
    const github = contact?.github?.trim() ?? "";
    const linkedin = contact?.linkedin?.trim() ?? "";
    const blog = contact?.blog?.trim() ?? "";
    const cards = [
      ...(email
        ? [
            {
              key: "email",
              Icon: Mail,
              title: "Email",
              href: `mailto:${email}`,
              label: email,
              blurb: "The fastest way to reach me — say hi, pitch an idea, ask anything.",
              external: false,
            },
          ]
        : []),
      ...(github
        ? [
            {
              key: "github",
              Icon: Github,
              title: "GitHub",
              href: github,
              label: github.replace(/^https?:\/\//, ""),
              blurb: "Side projects, experiments, and the code behind this very site.",
              external: true,
            },
          ]
        : []),
      ...(linkedin
        ? [
            {
              key: "linkedin",
              Icon: Linkedin,
              title: "LinkedIn",
              href: linkedin,
              label: linkedin.replace(/^https?:\/\//, ""),
              blurb: "The professional trail — roles, history, and a DM inbox I check.",
              external: true,
            },
          ]
        : []),
      ...(blog
        ? [
            {
              key: "blog",
              Icon: BookOpen,
              title: "Blog",
              href: blog,
              label: blog.replace(/^https?:\/\//, ""),
              blurb: "Tutorials, tinkering notes, and the occasional existential crisis.",
              external: true,
            },
          ]
        : []),
    ];
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ key, Icon, title, href, label, blurb, external }) => (
          <motion.a
            key={key}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`${INTERACTIVE_SURFACE} group flex h-full min-h-52 flex-col justify-between p-7 text-left`}
          >
            <span aria-hidden className={CARD_RULE} />
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl border border-[#37304a]/10 bg-[#f4ecdf] text-[#5646a8] shadow-[0_10px_24px_-18px_rgba(86,70,168,0.7)] dark:border-white/10 dark:bg-[#26232c] dark:text-[#c9b3ec]">
                <Icon {...ICON} className="size-5 shrink-0" />
              </span>
              <span className={BADGE}>{external ? "External" : "Direct"}</span>
            </div>
            <div className="mt-7">
              <h3 className="font-serif text-3xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">{title}</h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">{blurb}</p>
              <span className="mt-3 block break-words text-sm leading-relaxed text-[#5646a8] dark:text-[#c9b3ec]">{label}</span>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6f6885] transition-colors group-hover:text-[#5646a8] group-focus-visible:text-[#5646a8] dark:text-[#a9a2bd] dark:group-hover:text-[#c9b3ec] dark:group-focus-visible:text-[#c9b3ec]">
              {external ? "Open link" : "Send email"}
              <ArrowUpRight {...ICON} className="size-3.5 shrink-0" />
            </span>
          </motion.a>
        ))}
      </div>
    );
  },

  StatCallout: ({ props }: BaseComponentProps<{ value: string; label: string }>) => (
    <motion.div
      className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-[#2e2b38]/10 bg-[#f6f4f9] p-6 text-center shadow-[0_10px_30px_-18px_rgba(20,19,25,0.5)] dark:border-white/10 dark:bg-[#211f29]"
    >
      <span aria-hidden className={CARD_RULE} />
      <span className="text-4xl font-bold tracking-tight text-[#2e2b38] dark:text-[#e9e6f2]">{props.value}</span>
      <span className="mt-2 font-mono text-xs uppercase tracking-[0.22em] text-[#6b6580] dark:text-[#a29bbd]">
        {props.label}
      </span>
    </motion.div>
  ),
};

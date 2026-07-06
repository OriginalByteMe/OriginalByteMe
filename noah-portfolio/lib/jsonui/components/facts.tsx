"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Terminal, Layout, Server, Database, Mail, Github, Linkedin, Code2, Briefcase, ArrowUpRight } from "lucide-react";
import type { BaseComponentProps } from "@json-render/react";
import { useStateValue } from "@json-render/react";
import { enter } from "../motion";
import { useIsDark } from "../use-is-dark";
import type { Project, SkillCategory, Job, Contact, IconRef, OperatingSystem } from "@/lib/corpus/types";

// Single lucide treatment everywhere: 1.5 stroke (design-contract §5).
const ICON = { strokeWidth: 1.5 } as const;

// Base-register matte card (§3.1): opaque fill, hairline border, soft long-throw shadow.
const MATTE_CARD =
  "rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#2b2830]";

// Matte pill (§3, §7.2): opaque fill + hairline border + rounded-full, mono label.
const MATTE_PILL =
  "inline-flex w-max items-center gap-2 rounded-full border border-[#37304a]/10 bg-[#fffdf8] px-3 py-1 font-mono text-xs text-[#5d5673] dark:border-white/10 dark:bg-[#2b2830] dark:text-[#bdb6d0]";

const categoryIcons: Record<string, typeof Terminal> = {
  "Programming Languages": Terminal,
  "Frontend Frameworks": Layout,
  "Infrastructure & DevOps": Server,
  Databases: Database,
};

function SkillPill({ skill, isDark }: { skill: IconRef; isDark: boolean }) {
  return (
    <span className={MATTE_PILL}>
      <Image
        src={isDark ? skill.darkImage : skill.lightImage}
        alt={skill.name}
        width={20}
        height={20}
        className="h-5 w-5"
      />
      {skill.name}
    </span>
  );
}

export const factComponents = {
  ProjectShowcase: ({ props }: BaseComponentProps<{ statePath: string; slug?: string | null }>) => {
    const isDark = useIsDark();
    const all = useStateValue<Project[]>(props.statePath) ?? [];
    const projects = props.slug ? all.filter((p) => p.slug === props.slug) : all;
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, i) => (
          <motion.a
            key={project.slug}
            custom={i}
            variants={enter}
            initial="hidden"
            animate="show"
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex flex-col overflow-hidden transition-transform hover:-translate-y-1 ${MATTE_CARD}`}
          >
            <Image
              src={project.image}
              alt={project.title}
              width={300}
              height={200}
              className="h-48 w-full object-cover"
            />
            <div className="p-6">
              <h3 className="flex items-center gap-2 font-serif text-xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                {project.title}
                <ArrowUpRight
                  {...ICON}
                  className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">{project.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {project.technologies.map((tech) => (
                  <span key={tech.name} className={MATTE_PILL}>
                    <Image
                      src={isDark ? tech.darkIcon : tech.lightIcon}
                      alt={tech.name}
                      width={20}
                      height={20}
                      className="h-5 w-5"
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
        <div className="space-y-6">
          {categories.map(({ category, skills }) => {
            const Icon = categoryIcons[category] ?? Code2;
            return (
              <div key={category}>
                <h4 className="mb-3 flex items-center gap-2 font-serif text-xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                  <Icon {...ICON} className="size-4 shrink-0" />
                  {category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <SkillPill key={skill.name} skill={skill} isDark={isDark} />
                  ))}
                </div>
              </div>
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
          {jobs.map((job, i) => (
            <motion.li
              key={job.company}
              custom={i}
              variants={enter}
              initial="hidden"
              animate="show"
              className="flex items-start gap-4 border-l-2 border-[#37304a]/10 pl-4 dark:border-white/10"
            >
              <Image
                src={job.logo}
                alt={`${job.company} logo`}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg"
              />
              <div>
                <h4 className="flex items-center gap-2 text-base font-semibold tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                  {job.company}
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#5646a8] transition-opacity hover:opacity-70 dark:text-[#9d8ff2]"
                  >
                    <ArrowUpRight {...ICON} className="size-4 shrink-0" />
                  </a>
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">{job.role}</p>
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
      <div>
        {props.title ? (
          <h3 className="mb-6 flex items-center gap-2 font-serif text-2xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
            <Code2 {...ICON} className="size-5 shrink-0" /> {props.title}
          </h3>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {environments.map((environment, i) => {
            const [primary, ...rest] = environment.systems;
            return (
              <motion.div
                key={environment.name}
                custom={i}
                variants={enter}
                initial="hidden"
                animate="show"
                className={`p-8 ${MATTE_CARD}`}
              >
                <div className="flex items-center gap-3">
                  {primary ? (
                    <Image
                      src={isDark ? primary.darkImage : primary.lightImage}
                      alt={primary.name}
                      width={20}
                      height={20}
                      className="size-4 shrink-0"
                    />
                  ) : null}
                  <h4 className="font-serif text-xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                    {environment.name}
                  </h4>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
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
    const email = contact?.email ?? "";
    const github = contact?.github ?? "";
    const linkedin = contact?.linkedin ?? "";
    const cards = [
      { key: "email", Icon: Mail, title: "Email", href: `mailto:${email}`, label: email, external: false },
      { key: "github", Icon: Github, title: "GitHub", href: github, label: github.replace(/^https?:\/\//, ""), external: true },
      {
        key: "linkedin",
        Icon: Linkedin,
        title: "LinkedIn",
        href: linkedin,
        label: linkedin.replace(/^https?:\/\//, ""),
        external: true,
      },
    ];
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map(({ key, Icon, title, href, label, external }, i) => (
          <motion.a
            key={key}
            custom={i}
            variants={enter}
            initial="hidden"
            animate="show"
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`group flex flex-col items-center p-8 text-center transition-transform hover:-translate-y-1 ${MATTE_CARD}`}
          >
            <Icon {...ICON} className="mb-4 size-10 text-[#37304a] dark:text-[#eae6f2]" />
            <h3 className="font-serif text-xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">{title}</h3>
            <span className="mt-2 text-sm text-[#5646a8] group-hover:underline dark:text-[#9d8ff2]">{label}</span>
          </motion.a>
        ))}
      </div>
    );
  },

  StatCallout: ({ props }: BaseComponentProps<{ value: string; label: string }>) => (
    <motion.div
      variants={enter}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center rounded-2xl border border-[#2e2b38]/10 bg-[#f6f4f9] p-6 text-center shadow-[0_10px_30px_-18px_rgba(20,19,25,0.5)] dark:border-white/10 dark:bg-[#211f29]"
    >
      <span className="text-4xl font-bold tracking-tight text-[#2e2b38] dark:text-[#e9e6f2]">{props.value}</span>
      <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6b6580] dark:text-[#a29bbd]">
        {props.label}
      </span>
    </motion.div>
  ),
};

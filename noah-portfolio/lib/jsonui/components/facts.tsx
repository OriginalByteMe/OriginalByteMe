"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Terminal, Layout, Server, Database, Mail, Github, Linkedin } from "lucide-react";
import type { BaseComponentProps } from "@json-render/react";
import { useStateValue } from "@json-render/react";
import FrostedGlassBox from "@/components/ui/frosted-glass-box";
import { enter } from "../motion";
import type { Project, SkillCategory, Job, Contact, IconRef } from "@/lib/corpus/types";

/**
 * `lib/hooks/useTheme.ts` only exposes the lava-lamp colour palette
 * (`applyPalette`/`resetPalette`) — it has no light/dark flag. The existing
 * sections (`Projects.tsx`, `About.tsx`) each derive dark-mode locally by
 * watching the `<html>` element's `class` attribute via `MutationObserver`.
 * Fact components need that same boolean to pick `lightImage`/`darkImage`
 * variants, so this replicates the established local pattern rather than
 * depending on a hook that doesn't provide it.
 */
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          setIsDark(document.documentElement.classList.contains("dark"));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

const categoryIcons: Record<string, typeof Terminal> = {
  "Programming Languages": Terminal,
  "Frontend Frameworks": Layout,
  "Infrastructure & DevOps": Server,
  Databases: Database,
};

function SkillPill({ skill, isDark }: { skill: IconRef; isDark: boolean }) {
  return (
    <FrostedGlassBox
      className="px-3 py-1 rounded-full text-sm flex items-center gap-2 w-max m-0"
      variant="blue"
      hoverEffect="lift"
      glassOpacity="light"
    >
      <Image
        src={isDark ? skill.darkImage : skill.lightImage}
        alt={skill.name}
        width={20}
        height={20}
        className="w-5 h-5"
      />
      {skill.name}
    </FrostedGlassBox>
  );
}

export const factComponents = {
  ProjectShowcase: ({ props }: BaseComponentProps<{ statePath: string; slug?: string | null }>) => {
    const isDark = useIsDark();
    const all = useStateValue<Project[]>(props.statePath) ?? [];
    const projects = props.slug ? all.filter((p) => p.slug === props.slug) : all;
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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
            className="group bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden transition-all hover:scale-105 hover:shadow-lg"
          >
            <Image
              src={project.image}
              alt={project.title}
              width={300}
              height={200}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                {project.title}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                  />
                </svg>
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {project.technologies.map((tech) => (
                  <div
                    key={tech.name}
                    className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1 rounded-full text-sm"
                  >
                    <Image
                      src={isDark ? tech.darkIcon : tech.lightIcon}
                      alt={tech.name}
                      width={20}
                      height={20}
                      className="w-5 h-5"
                    />
                    <span>{tech.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    );
  },

  SkillGrid: ({ props }: BaseComponentProps<{ statePath: string }>) => {
    const isDark = useIsDark();
    const categories = useStateValue<SkillCategory[]>(props.statePath) ?? [];
    return (
      <div className="space-y-6">
        {categories.map(({ category, skills }) => {
          const Icon = categoryIcons[category];
          return (
            <div key={category}>
              <h4 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center">
                {Icon ? <Icon className="mr-2 h-5 w-5" /> : null}
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

  CareerTimeline: ({ props }: BaseComponentProps<{ statePath: string }>) => {
    const jobs = useStateValue<Job[]>(props.statePath) ?? [];
    return (
      <ul className="space-y-4">
        {jobs.map((job, i) => (
          <motion.li
            key={job.company}
            custom={i}
            variants={enter}
            initial="hidden"
            animate="show"
            className="border-l-2 border-gray-300 dark:border-gray-800 pl-4 flex items-start gap-4"
          >
            <Image
              src={job.logo}
              alt={`${job.company} logo`}
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                {job.company}
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                    />
                  </svg>
                </a>
              </h4>
              <p className="text-gray-600 dark:text-gray-400">{job.role}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">{job.period}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    );
  },

  ContactCard: ({ props }: BaseComponentProps<{ statePath: string }>) => {
    const contact = useStateValue<Contact>(props.statePath);
    const email = contact?.email ?? "";
    const github = contact?.github ?? "";
    const linkedin = contact?.linkedin ?? "";
    return (
      <div className="grid md:grid-cols-3 gap-8">
        <FrostedGlassBox
          variant="blue"
          hoverEffect="lift"
          glassOpacity="heavy"
          onClick={() => window.open(`mailto:${email}`, "_blank")}
        >
          <div className="flex flex-col items-center">
            <Mail className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
            <h3 className="text-xl font-semibold mb-2">Email</h3>
            <a
              href={`mailto:${email}`}
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {email}
            </a>
          </div>
        </FrostedGlassBox>
        <FrostedGlassBox
          variant="blue"
          hoverEffect="lift"
          glassOpacity="heavy"
          onClick={() => window.open(github, "_blank")}
        >
          <div className="flex flex-col items-center">
            <Github className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
            <h3 className="text-xl font-semibold mb-2">GitHub</h3>
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {github.replace(/^https?:\/\//, "")}
            </a>
          </div>
        </FrostedGlassBox>
        <FrostedGlassBox
          variant="blue"
          hoverEffect="lift"
          glassOpacity="heavy"
          onClick={() => window.open(linkedin, "_blank")}
        >
          <div className="flex flex-col items-center">
            <Linkedin className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
            <h3 className="text-xl font-semibold mb-2">LinkedIn</h3>
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {linkedin.replace(/^https?:\/\//, "")}
            </a>
          </div>
        </FrostedGlassBox>
      </div>
    );
  },

  StatCallout: ({ props }: BaseComponentProps<{ value: string; label: string }>) => (
    <motion.div
      variants={enter}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center text-center p-6"
    >
      <span className="text-4xl font-bold">{props.value}</span>
      <span className="text-sm text-gray-500 dark:text-gray-400 mt-2">{props.label}</span>
    </motion.div>
  ),
};

"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { useIsDark } from "@/lib/jsonui/use-is-dark";
import type { StoryProject } from "@/lib/story/types";
import { isSvgSrc } from "@/lib/utils";

export interface StoryProjectsProps {
  projects: readonly StoryProject[];
}

/** Render server-resolved, trusted Corpus project cards inside a Nocturne Story Scene. */
export function StoryProjects({ projects }: StoryProjectsProps) {
  const isDark = useIsDark();
  if (projects.length === 0) return null;

  return (
    <section
      className="mt-[var(--story-space-8)] grid gap-[var(--story-space-4)] md:grid-cols-2"
      aria-label="Referenced projects"
    >
      {projects.map((project) => (
        <a
          key={project.slug}
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${project.title} project`}
          className="group relative flex min-w-0 flex-col overflow-hidden rounded-[var(--story-radius-md)] border border-[hsl(var(--story-border))] bg-[hsl(var(--story-surface-raised))] text-left text-[hsl(var(--story-ink))] shadow-[var(--story-shadow)] hover:translate-y-[var(--story-hover-lift)] hover:border-[hsl(var(--story-accent))] focus-visible:outline focus-visible:outline-[var(--story-focus-width)] focus-visible:outline-offset-[var(--story-space-1)] focus-visible:[outline-color:hsl(var(--story-accent))] motion-reduce:transform-none"
        >
          <div className="relative m-[var(--story-space-2)] overflow-hidden rounded-[var(--story-radius-sm)] border border-[hsl(var(--story-border))] bg-[hsl(var(--story-surface))]">
            <Image
              src={project.image}
              alt={`${project.title} project preview`}
              width={640}
              height={400}
              className="aspect-video w-full object-cover"
              unoptimized={isSvgSrc(project.image)}
            />
          </div>

          <div className="relative flex flex-1 flex-col p-[var(--story-space-4)]">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-[hsl(var(--story-accent))]"
            />
            <div className="flex items-start justify-between gap-[var(--story-space-3)]">
              <div>
                <p className="font-mono text-[length:var(--story-type-index)] uppercase tracking-widest text-[hsl(var(--story-muted))]">
                  Corpus project
                </p>
                <h3 className="mt-[var(--story-space-2)] flex items-center gap-[var(--story-space-2)] [font-family:var(--story-display-font)] text-[length:var(--story-type-lead)] tracking-tight text-[hsl(var(--story-ink))]">
                  {project.title}
                  <ArrowUpRight
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="size-[var(--story-icon-size)] shrink-0 opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                </h3>
              </div>
              <span className="shrink-0 rounded-[var(--story-radius-pill)] border border-[hsl(var(--story-border))] bg-[hsl(var(--story-surface))] px-[var(--story-space-3)] py-[var(--story-space-1)] font-mono text-[length:var(--story-type-index)] uppercase tracking-widest text-[hsl(var(--story-muted))]">
                {project.technologies.length} tools
              </span>
            </div>

            <p className="mt-[var(--story-space-3)] text-pretty text-[length:var(--story-type-sm)] leading-relaxed text-[hsl(var(--story-muted))]">
              {project.description}
            </p>

            <div className="mt-[var(--story-space-6)] flex flex-wrap gap-[var(--story-space-2)]">
              {project.technologies.map((technology) => {
                const icon = isDark ? technology.darkIcon : technology.lightIcon;
                return (
                  <span
                    key={technology.name}
                    className="inline-flex items-center gap-[var(--story-space-2)] rounded-[var(--story-radius-pill)] border border-[hsl(var(--story-border))] bg-[hsl(var(--story-surface))] px-[var(--story-space-3)] py-[var(--story-space-1)] font-mono text-[length:var(--story-type-xs)] text-[hsl(var(--story-muted))]"
                  >
                    <Image
                      src={icon}
                      alt=""
                      aria-hidden="true"
                      width={16}
                      height={16}
                      className="size-[var(--story-icon-size)] object-contain"
                      unoptimized={isSvgSrc(icon)}
                    />
                    {technology.name}
                  </span>
                );
              })}
            </div>
          </div>
        </a>
      ))}
    </section>
  );
}

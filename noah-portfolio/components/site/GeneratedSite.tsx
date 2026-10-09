"use client";

import type { CSSProperties, MouseEvent } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";

import { Art } from "@/lib/site/art";
import type { EvidenceRef, Site, SiteItem, SiteSection, StoryProject } from "@/lib/story/types";

/** Items inside each block, in snap order: nav, hero, each section, related questions, footer. */
export function siteBlockItems(site: Site): number[] {
  return [
    1 + site.sections.length,
    1,
    ...site.sections.map((section) => section.items.length + (section.projects?.length ?? 0)),
    site.relatedQuestions.length,
    0,
  ];
}

interface GeneratedSiteProps {
  site: Site;
  evidence: readonly EvidenceRef[];
  /** Blocks shown so far; omitted means the whole site is built. */
  revealed?: number;
  onAsk: (question: string) => void;
}

function Items({ section }: { section: SiteSection }) {
  if (section.items.length === 0) return null;
  // Small models pick "timeline" for undated facts too; only dated items get the timeline rail.
  const dated = section.kind === "timeline" && section.items.every((item) => /\d{4}/.test(item.title));
  const List = dated ? "ol" : "ul";
  return (
    <List className="gs-items" data-items={section.kind === "cards" ? "cards" : dated ? "timeline" : "list"}>
      {section.items.map((item: SiteItem, index) => (
        <li key={`${item.title}-${index}`} className="gs-item" style={{ "--i": index } as CSSProperties}>
          {item.art && section.kind === "cards" ? <Art id={item.art} className="gs-item__art" decorative /> : null}
          <h3 className="gs-item__title">{item.title}</h3>
          {item.text ? <p className="gs-item__text">{item.text}</p> : null}
        </li>
      ))}
    </List>
  );
}

function Projects({ projects }: { projects: readonly StoryProject[] }) {
  return (
    <ul className="gs-projects">
      {projects.map((project, index) => (
        <li key={project.slug} className="gs-project" style={{ "--i": index } as CSSProperties}>
          {/* Corpus images are local files with mixed formats; next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gs-project__image" src={project.image} alt="" loading="lazy" />
          <div className="gs-project__body">
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <p className="gs-project__tech">{project.technologies.map((tech) => tech.name).join(" · ")}</p>
            <a href={project.url} target="_blank" rel="noreferrer noopener" className="gs-link">
              View project <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.5} />
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Sources({ ids, evidence }: { ids: readonly string[]; evidence: readonly EvidenceRef[] }) {
  const labels = ids.flatMap((id) => evidence.find((ref) => ref.id === id)?.label ?? []);
  return labels.length ? <p className="gs-sources">Sources: {labels.join(" · ")}</p> : null;
}

/**
 * In-site links scroll in place instead of navigating to the fragment, which would push a history
 * entry per click and make the browser Back button step through sections before leaving the site.
 * Focusing the target keeps keyboard users where a fragment jump would have put them.
 */
function jumpTo(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const target = document.getElementById(event.currentTarget.hash.slice(1));
  target?.scrollIntoView({ block: "start" });
  target?.focus({ preventScroll: true });
}

export default function GeneratedSite({ site, evidence, revealed, onAsk }: GeneratedSiteProps) {
  const { hero, sections } = site;
  const boundary = site.mode === "boundary";
  const block = (index: number) => ({
    "data-block": revealed === undefined || index < revealed ? "shown" : "pending",
    style: { "--block": index } as CSSProperties,
  });
  const relatedIndex = sections.length + 2;

  return (
    <div
      className="gs"
      data-layout={site.layout}
      data-building={revealed === undefined ? undefined : ""}
    >
      <div className="gs-top">
        <header className="gs-nav" {...block(0)}>
          <a className="gs-brand" href="#gs-hero" onClick={jumpTo}>
            <span className="gs-brand__mark" aria-hidden />
            {site.brand}
          </a>
          {sections.length ? (
            <nav aria-label={`${site.brand} sections`}>
              <ul className="gs-nav__links">
                {sections.map((section, index) =>
                  // Small models repeat labels; one link per label keeps the menu readable.
                  sections.findIndex((other) => other.nav === section.nav) === index ? (
                    <li key={index}>
                      <a href={`#gs-section-${index + 1}`} onClick={jumpTo}>{section.nav}</a>
                    </li>
                  ) : null,
                )}
              </ul>
            </nav>
          ) : null}
        </header>

        <section id="gs-hero" className="gs-hero" aria-labelledby="gs-hero-title" tabIndex={-1} {...block(1)}>
          <div className="gs-hero__copy">
            <p className="gs-eyebrow">{hero.eyebrow}</p>
            <h1 id="gs-hero-title" className="gs-hero__title">{hero.headline}</h1>
            <p className="gs-hero__lede">{hero.lede}</p>
            <div className="gs-hero__actions">
              {sections.length ? (
                <a className="gs-button" href="#gs-section-1" onClick={jumpTo}>
                  {sections[0].nav}
                  <span className="gs-button__icon"><ArrowDown aria-hidden className="size-4" strokeWidth={1.5} /></span>
                </a>
              ) : null}
              <button type="button" className="gs-button gs-button--ghost" onClick={() => onAsk(site.relatedQuestions[0])}>
                {site.relatedQuestions[0]}
              </button>
            </div>
            <Sources ids={hero.evidenceRefIds} evidence={evidence} />
          </div>
          <Art id={hero.art} className="gs-hero__art" />
        </section>
      </div>

      {/* The page that hosts the takeover owns <main>; a second one would be invalid and a duplicate landmark. */}
      <div className="gs-main">
        {sections.map((section, index) => (
          <section
            key={index}
            id={`gs-section-${index + 1}`}
            className="gs-section"
            data-kind={section.kind}
            data-side={index % 2 ? "right" : "left"}
            aria-labelledby={`gs-section-${index + 1}-title`}
            tabIndex={-1}
            {...block(index + 2)}
          >
            <div className="gs-section__head">
              <div className="gs-section__copy">
                <p className="gs-eyebrow">
                  {String(index + 1).padStart(2, "0")} · {section.nav}
                </p>
                <h2 id={`gs-section-${index + 1}-title`} className="gs-section__title">{section.title}</h2>
                {section.kind === "quote" ? (
                  <blockquote className="gs-quote">{section.body}</blockquote>
                ) : (
                  <p className="gs-section__body">{section.body}</p>
                )}
              </div>
              {section.art ? <Art id={section.art} className="gs-section__art" /> : null}
            </div>
            <Items section={section} />
            {section.projects ? <Projects projects={section.projects} /> : null}
            <Sources ids={section.evidenceRefIds} evidence={evidence} />
          </section>
        ))}
      </div>

      <section className="gs-related" aria-labelledby="gs-related-title" {...block(relatedIndex)}>
        <h2 id="gs-related-title">{boundary ? "Ask me about these instead" : "Keep exploring"}</h2>
        <ul>
          {site.relatedQuestions.map((question, index) => (
            <li key={question} style={{ "--i": index } as CSSProperties}>
              <button type="button" className="gs-related__question" onClick={() => onAsk(question)}>
                <span>{question}</span>
                <ArrowUpRight aria-hidden className="size-5" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="gs-footer" {...block(relatedIndex + 1)}>
        <div>
          <p className="gs-brand">
            <span className="gs-brand__mark" aria-hidden />
            {site.brand}
          </p>
          <p className="gs-footer__note">{hero.eyebrow}</p>
        </div>
        <p className="gs-footer__note">
          Built live from Noah&apos;s portfolio notes. Every section cites the notes it uses.
        </p>
      </footer>
    </div>
  );
}

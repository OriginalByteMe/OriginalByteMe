'use client';

import { useState } from 'react';
import Hero, { HeroPortrait } from '../Hero';
import HeroCharacter, { type CharacterStatus } from './HeroCharacter';
import type { WorldContent } from '@/lib/character/world-content';

const NEW_TAB = { target: '_blank', rel: 'noreferrer noopener' } as const;

/**
 * One sticky 3D viewport over a street of seven lots, one scrolling section per lot
 * (ids from LOTS in world/types.ts). The town shows each chapter as pictures and icons;
 * the sections carry its facts as screen-reader text, revealed when a keyboard user
 * tabs to one of their links. Without the scene the page's 2D Story tells them instead.
 */
export default function CharacterWorld({ content }: { content: WorldContent }) {
  const [status, setStatus] = useState<CharacterStatus>('waiting');
  const facts = 'character-world__facts sr-only';
  return (
    <div className="character-world" data-status={status} data-testid="character-world">
      <div className="character-world__viewport">
        <HeroCharacter fallback={<HeroPortrait />} content={content} onStatus={setStatus} />
      </div>
      <Hero />
      <section id="brief" aria-labelledby="brief-heading" className="character-world__area">
        <div className={facts}>
          <h2 id="brief-heading">Noah, in brief</h2>
          <p>{content.headline} in {content.location}.</p>
          <p>{content.brief}</p>
          <p>{content.summary}</p>
          <ul>{content.stats.map((stat) => <li key={stat.caption}>{stat.value}{stat.suffix} {stat.caption}</li>)}</ul>
        </div>
      </section>
      <section id="built" aria-labelledby="built-heading" className="character-world__area">
        <div className={facts}>
          <h2 id="built-heading">Things I’ve built</h2>
          <ul>
            {content.projects.map((project) => (
              <li key={project.slug}>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <p>Built with {project.tech.map((tech) => tech.name).join(', ')}.</p>
                {project.url && <a href={project.url} {...NEW_TAB}>Visit {project.title}</a>}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section id="toolbox" aria-labelledby="toolbox-heading" className="character-world__area">
        <div className={facts}>
          <h2 id="toolbox-heading">The toolbox</h2>
          <dl>
            {content.skills.map((group) => (
              <div key={group.category}><dt>{group.category}</dt><dd>{group.skills.map((skill) => skill.name).join(', ')}</dd></div>
            ))}
          </dl>
        </div>
      </section>
      <section id="about" aria-labelledby="about-heading" className="character-world__area">
        <div className={facts}>
          <h2 id="about-heading">About me and where I’ve been</h2>
          <ol>
            {content.career.map((job) => (
              <li key={`${job.company}-${job.period}`}>
                <h3>{job.role} at {job.company}</h3>
                <p>{job.period}</p>
                <ul>{job.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
                {job.url && <a href={job.url} {...NEW_TAB}>Visit {job.company}</a>}
              </li>
            ))}
          </ol>
          <h3>Fun facts</h3>
          <ul>{content.funFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        </div>
      </section>
      <section id="rig" aria-labelledby="rig-heading" className="character-world__area">
        <div className={facts}>
          <h2 id="rig-heading">The rig</h2>
          <dl>
            {content.operatingSystems.map((group) => (
              <div key={group.name}><dt>{group.name}</dt><dd>{group.systems.map((system) => system.name).join(', ')}</dd></div>
            ))}
          </dl>
          <h3>Side projects</h3>
          <ul>
            {content.sideProjects.map((side) => (
              <li key={side.title}>
                <h4>{side.title}</h4>
                <p>{side.description}</p>
                {side.url && <a href={side.url} {...NEW_TAB}>Visit {side.title}</a>}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section id="say-hi" aria-labelledby="say-hi-heading" className="character-world__area">
        <div className={facts}>
          <h2 id="say-hi-heading">Say hi</h2>
          <ul>
            <li><a href={`mailto:${content.contact.email}`}>Email {content.contact.email}</a></li>
            <li><a href={content.contact.github} {...NEW_TAB}>GitHub</a></li>
            <li><a href={content.contact.linkedin} {...NEW_TAB}>LinkedIn</a></li>
            {content.contact.blog && <li><a href={content.contact.blog} {...NEW_TAB}>Blog</a></li>}
          </ul>
        </div>
      </section>
    </div>
  );
}

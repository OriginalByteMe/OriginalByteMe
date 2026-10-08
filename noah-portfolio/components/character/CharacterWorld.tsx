'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Hero, { HeroPortrait } from '../Hero';
import HeroCharacter, { type CharacterStatus } from './HeroCharacter';
import type { CharacterScene } from './create-character-scene';
import { skillStationId, type WorldContent } from '@/lib/character/world-content';
import { isSvgSrc } from '@/lib/utils';

/**
 * One sticky 3D viewport behind three scrolling sections. The bedroom, lab and
 * about dioramas sit under #hero, #lab and #about; the panels stay plain,
 * readable DOM whether or not the scene loads.
 */
export default function CharacterWorld({ content }: { content: WorldContent }) {
  const scene = useRef<CharacterScene | null>(null);
  const [status, setStatus] = useState<CharacterStatus>('waiting');
  const live = status === 'ready';
  const showMe = (stationId: string, name: string) => live && (
    <button type="button" className="character-world__show" onClick={() => scene.current?.visit(stationId)}>
      Show me <span className="sr-only">{name}</span> <span aria-hidden="true">↗</span>
    </button>
  );
  return (
    <div className="character-world" data-status={status} data-testid="character-world">
      <div className="character-world__viewport">
        <HeroCharacter fallback={<HeroPortrait />} content={content} sceneRef={scene} onStatus={setStatus} />
      </div>
      <Hero />
      <section id="lab" aria-labelledby="lab-heading" className="character-world__area">
        <div className="character-world__panel" data-character-ui>
          <p className="character-world__eyebrow">Tech lab</p>
          <h2 id="lab-heading">Things I’ve built</h2>
          <p className="character-world__intro">Every project and skill group has a machine in my lab. Press Show me and I’ll show it to you.</p>
          <ul className="character-world__projects">
            {content.projects.map((project) => (
              <li key={project.slug}>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <p className="character-world__tech"><span className="sr-only">Built with: </span>{project.tech.map((tech) => tech.name).join(' · ')}</p>
                <div className="character-world__actions">
                  {project.url && <a href={project.url} target="_blank" rel="noreferrer noopener">Visit <span className="sr-only">{project.title}</span> <span aria-hidden="true">↗</span></a>}
                  {showMe(`project:${project.slug}`, project.title)}
                </div>
              </li>
            ))}
          </ul>
          <h3 className="character-world__subheading">Skills</h3>
          <dl className="character-world__skills">
            {content.skills.map((group) => (
              <div key={group.category}>
                <dt>{group.category}</dt>
                <dd>
                  <ul className="character-world__skill-list">
                    {group.skills.map((skill) => (
                      <li key={skill.name}><Image src={skill.icon} alt="" width={16} height={16} unoptimized={isSvgSrc(skill.icon)} />{skill.name}</li>
                    ))}
                  </ul>
                  {showMe(skillStationId(group.category), `the ${group.category} wall`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section id="about" aria-labelledby="about-heading" className="character-world__area">
        <div className="character-world__panel" data-character-ui>
          <p className="character-world__eyebrow">Room three</p>
          <h2 id="about-heading">About me</h2>
          <p className="character-world__intro">{content.headline}, based in {content.location}.</p>
          <h3 className="character-world__subheading">Career</h3>
          <ol className="character-world__career">
            {content.career.map((job) => (
              <li key={`${job.company}-${job.period}`}><strong>{job.role}</strong> at {job.company} <span>{job.period}</span></li>
            ))}
          </ol>
          <h3 className="character-world__subheading">Fun facts</h3>
          <ul className="character-world__facts">
            {content.funFacts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
          <figure className="character-world__portrait">
            <Image src="/hero.png" alt="Framed hero portrait of Noah Rijkaard" width={1408} height={1926} sizes="(max-width: 700px) 40vw, 12rem" />
            <figcaption>The portrait on my wall. Huh. Maybe that’s what I’d look like.</figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}

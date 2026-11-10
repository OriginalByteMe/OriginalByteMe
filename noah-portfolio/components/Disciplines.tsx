'use client';

import { ArrowDown } from 'lucide-react';

import { useTheme } from '@/components/ThemeProvider';
import StudyCanvas from '@/components/studies/StudyCanvas';
import { SITE_PALETTES } from '@/lib/studies';

interface Discipline {
  title: string;
  /** Drawn from content/about-me/career.md and skills.md. */
  body: string;
  href: string;
  cta: string;
  study: string;
  variant: number;
  density?: number;
}

const DISCIPLINES: Discipline[] = [
  {
    title: 'AI engineering',
    body: 'Senior AI Engineer at MerchantSpring, building marketplace analytics. Before that, five years of data-labeling, training-data and LLM evaluation tooling at Supa.',
    href: '#career',
    cta: 'Experience',
    study: 'tide',
    variant: 1,
    density: 1.15,
  },
  {
    title: 'Full-stack systems',
    body: 'Backend, infra and frontend, end to end. Ruby, Python and TypeScript on Docker, Terraform and AWS, with a lean toward self-hosting.',
    href: '#stack',
    cta: 'Toolbox',
    study: 'lattice',
    variant: 2,
    density: 1.4,
  },
  {
    title: 'CAD & 3D printing',
    body: 'CAD Designer and 3D Printing Engineer with Bowiq: FDM printing with high-end materials and machines.',
    href: '#builds',
    cta: 'Things I’ve built',
    study: 'vase',
    variant: 0,
  },
];

/**
 * The answer to "what does Noah do?" before any scrolling story: three
 * disciplines, each with a live piece standing in for it.
 */
export default function Disciplines() {
  const { theme } = useTheme();
  const palette = theme === 'dark' ? SITE_PALETTES.dark : SITE_PALETTES.light;

  return (
    <section id="what-i-do" aria-labelledby="what-i-do-heading" className="disciplines">
      <div className="disciplines__inner">
        <header className="disciplines__head">
          <p className="disciplines__eyebrow">What I do</p>
          <h2 id="what-i-do-heading" className="disciplines__title">
            Three crafts, <em>one workbench</em>
          </h2>
        </header>
        <ul className="disciplines__grid">
          {DISCIPLINES.map((d, i) => (
            <li key={d.title} className="discipline">
              <div className="discipline__window" aria-hidden="true">
                <StudyCanvas study={d.study} variant={d.variant} palette={palette} density={d.density} />
              </div>
              <p className="discipline__index">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="discipline__title">{d.title}</h3>
              <p className="discipline__body">{d.body}</p>
              <a className="discipline__link" href={d.href}>
                {d.cta} <ArrowDown strokeWidth={1.5} className="size-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

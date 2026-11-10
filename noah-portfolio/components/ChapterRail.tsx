'use client';

import { useEffect, useRef, useState } from 'react';

const STOPS = [
  { id: 'hero', label: 'Hello' },
  { id: 'what-i-do', label: 'What I do' },
  { id: 'intro', label: 'In brief' },
  { id: 'builds', label: 'Work' },
  { id: 'career', label: 'Experience' },
  { id: 'stack', label: 'Toolbox' },
  { id: 'setup', label: 'The rig' },
  { id: 'contact', label: 'Say hi' },
] as const;

/**
 * Wayfinding for the home story: a reading-progress line across the top and a
 * rail of chapter stops. It only shows the stops that are actually on the
 * page, so it disappears while an Ask-Me answer has taken over.
 */
export default function ChapterRail() {
  const [present, setPresent] = useState<string[]>([]);
  const [active, setActive] = useState('hero');
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let queued = false;
    const update = () => {
      queued = false;
      const here = STOPS.filter((s) => document.getElementById(s.id)).map((s) => s.id);
      setPresent((prev) => (prev.join() === here.join() ? prev : here));
      const mid = window.innerHeight * 0.4;
      let current: string = here[0] ?? 'hero';
      for (const id of here) {
        const top = document.getElementById(id)?.getBoundingClientRect().top ?? Infinity;
        if (top <= mid) current = id;
      }
      setActive(current);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const beat = window.setInterval(update, 800);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.clearInterval(beat);
    };
  }, []);

  const stops = STOPS.filter((s) => present.includes(s.id));
  const story = stops.length >= 4;

  return (
    <>
      <div className="reading-progress" aria-hidden="true">
        <div ref={bar} className="reading-progress__bar" />
      </div>
      {story ? (
        <nav className="chapter-rail" aria-label="Chapters">
          <ol>
            {stops.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined}>
                  <span className="chapter-rail__label">{s.label}</span>
                  <span className="chapter-rail__dot" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </>
  );
}

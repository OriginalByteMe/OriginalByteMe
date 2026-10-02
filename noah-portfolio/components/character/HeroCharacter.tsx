'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CharacterScene } from './create-character-scene';

/** Loads neither Three.js nor the model for reduced-motion/data-saving visitors. */
export default function HeroCharacter({ fallback }: { fallback: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<CharacterScene | null>(null);
  const [status, setStatus] = useState<'waiting' | 'loading' | 'ready' | 'fallback'>('waiting');
  const [portrait, setPortrait] = useState(false);
  const [paused, setPaused] = useState(false);
  const [message, setMessage] = useState('Move your cursor. I’ll follow.');

  useEffect(() => {
    const element = host.current;
    if (!element || portrait) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const stopForPreference = () => {
      if (!preference.matches) return;
      cancelled = true;
      api.current?.dispose();
      api.current = null;
      setStatus('fallback');
    };
    if (preference.matches || connection?.saveData) {
      setStatus('fallback');
      return;
    }
    preference.addEventListener('change', stopForPreference);
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || cancelled) return;
      observer.disconnect();
      setStatus('loading');
      try {
        const { createCharacterScene } = await import('./create-character-scene');
        if (cancelled) return;
        const scene = await createCharacterScene(element, {
          onMessage: setMessage,
          onError: () => { setStatus('fallback'); api.current?.dispose(); api.current = null; },
        });
        if (cancelled) { scene.dispose(); return; }
        api.current = scene;
        cleanup = scene.dispose;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('fallback');
      }
    }, { rootMargin: '100px' });
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      preference.removeEventListener('change', stopForPreference);
      cleanup?.();
      api.current = null;
    };
  }, [portrait]);

  const showPortrait = portrait || status === 'fallback';
  const ready = status === 'ready' && !showPortrait;
  return (
    <div className="character-hero" data-testid="character-hero" data-status={showPortrait ? 'fallback' : status}>
      {(!ready || showPortrait) && <div className="character-hero__fallback">{fallback}</div>}
      <figure className={`character-stage ${ready ? 'character-stage--ready' : ''}`} data-testid={ready ? 'hero-portrait' : undefined} aria-label="Interactive Good Vibes character" aria-hidden={!ready}>
        <div className="character-stage__eyebrow" aria-hidden="true"><span>Good vibes only</span><span>01 / Playground</span></div>
        <div ref={host} className="character-stage__canvas" data-testid="character-playground" tabIndex={ready ? 0 : -1} role="group" aria-label="Character playground. Move the pointer or tap the floor to guide Noah. Use arrow keys to move, space to wave, and Escape to stop." onKeyDown={(event) => {
          if (api.current?.key(event.key)) event.preventDefault();
        }} />
        <div className="character-stage__note" aria-hidden="true"><span className="character-stage__dot" /><span>{paused ? 'Taking a breather' : message}</span></div>
        <figcaption className="character-stage__caption">A little character. A little curiosity.<br /><span>Move · tap · scroll to explore</span></figcaption>
      </figure>
      {status === 'loading' && !showPortrait && <p className="character-hero__loading" role="status">Waking up the good vibes…</p>}
      {ready && <div className="character-hero__controls" aria-label="Character controls">
        <button type="button" onClick={() => { const next = !paused; setPaused(next); api.current?.setPaused(next); }} aria-pressed={paused}>{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" onClick={() => api.current?.wave()}>Say hi <span aria-hidden="true">↗</span></button>
        <button type="button" onClick={() => { api.current?.reset(); setPaused(false); }}>Reset</button>
        <button type="button" onClick={() => setPortrait(true)}>Portrait</button>
      </div>}
      {portrait && <button type="button" className="character-hero__restore" onClick={() => { setStatus('waiting'); setPaused(false); setPortrait(false); }}>Back to playground</button>}
    </div>
  );
}

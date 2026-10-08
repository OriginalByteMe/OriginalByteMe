'use client';

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { CharacterScene } from './create-character-scene';
import type { WorldContent } from '@/lib/character/world-content';

export type CharacterStatus = 'waiting' | 'loading' | 'ready' | 'fallback';

/** Loads neither Three.js nor the model for reduced-motion/data-saving visitors. */
export default function HeroCharacter({ fallback, content, sceneRef, onStatus }: {
  fallback: ReactNode;
  content: WorldContent;
  /** Shared with the world's DOM panels so their "Show me" buttons can reach the scene. */
  sceneRef?: MutableRefObject<CharacterScene | null>;
  onStatus?: (status: CharacterStatus) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const ownScene = useRef<CharacterScene | null>(null);
  const api = sceneRef ?? ownScene;
  const [status, setStatus] = useState<CharacterStatus>('waiting');
  const [phase, setPhase] = useState('opening');
  const [portrait, setPortrait] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [message, setMessage] = useState('Click the floor to send me exploring.');

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
        // Lazy on purpose: Three.js and the scene load only for visitors who get the 3D world.
        const { createCharacterScene } = await import('./create-character-scene');
        if (cancelled) return;
        const scene = await createCharacterScene(element, {
          content,
          onMessage: setMessage,
          onGreeting: setGreeting,
          onPhase: setPhase,
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
      setGreeting(null);
      setSoundEnabled(false);
      setMusicEnabled(false);
      api.current = null;
    };
  }, [portrait, content, api]);

  const showPortrait = portrait || status === 'fallback';
  const ready = status === 'ready' && !showPortrait;
  const reported = showPortrait ? 'fallback' : status;
  useEffect(() => { onStatus?.(reported); }, [reported, onStatus]);
  /** Both toggles ask the scene for the real state: a browser can refuse audio. */
  const toggle = async (next: boolean, request: (scene: CharacterScene) => Promise<boolean>, apply: (on: boolean) => void) => {
    const scene = api.current;
    const enabled = scene ? await request(scene) : false;
    if (api.current !== scene) return;
    apply(enabled);
    if (next && !enabled) setMessage('Sound isn’t available in this browser.');
  };
  return (
    <div className="character-hero character-hero--immersive" data-phase={phase} data-testid="character-hero" data-status={reported}>
      {(!ready || showPortrait) && <div className="character-hero__fallback">{fallback}</div>}
      <figure className={`character-stage ${ready ? 'character-stage--ready' : ''}`} data-testid={ready ? 'hero-world' : undefined} data-phase={phase} aria-label="Interactive Good Vibes character" aria-hidden={!ready}>
        <div className="character-stage__eyebrow" aria-hidden="true"><span>Good vibes only</span><span>{phase === 'roam' ? 'Free to wander' : 'A tiny adventure'}</span></div>
        <div ref={host} className="character-stage__canvas" data-testid="character-playground" tabIndex={ready ? 0 : -1} role="group" aria-label="Character world. A short introduction plays automatically; you can skip it. Scroll down and Noah follows you into his lab and about room. Click or tap the floor to guide him, his things to watch him play with them, or his afro if you dare. Use arrow keys to move, space to wave, and Escape to stop." onKeyDown={(event) => {
          if (api.current?.key(event.key)) event.preventDefault();
        }} />
        {greeting && ready && <p className="character-stage__speech" role="status" aria-live="polite">{greeting}<span aria-hidden="true">↓</span></p>}
        <div className="character-stage__note" aria-hidden="true"><span className="character-stage__dot" /><span>{paused ? 'Taking a breather' : message}</span></div>
        <figcaption className="character-stage__caption">{phase === 'roam' ? 'Click to explore. Scroll and I’ll follow.' : 'A little hello, then a world to explore.'}</figcaption>
      </figure>
      {ready && <div className="character-hero__opening" aria-hidden="true"><p>Hi, I’m<br /><em>Noah Rijkaard.</em></p></div>}
      {status === 'loading' && !showPortrait && <p className="character-hero__loading" role="status">Waking up the good vibes…</p>}
      {ready && <div className="character-hero__controls" aria-label="Character controls">
        {phase !== 'roam' && <button type="button" onClick={() => api.current?.skipIntro()}>Skip intro</button>}
        <button type="button" onClick={() => { const next = !paused; setPaused(next); api.current?.setPaused(next); }} aria-pressed={paused}>{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" onClick={() => api.current?.wave()}>Say hi <span aria-hidden="true">↗</span></button>
        <button type="button" onClick={() => { api.current?.reset(); setPaused(false); }}>Reset</button>
        <button type="button" aria-label={soundEnabled ? 'Mute character sound' : 'Enable character sound'} aria-pressed={soundEnabled} title="His babble voice and sound effects, all synthesized." onClick={() => toggle(!soundEnabled, (scene) => scene.setSoundEnabled(!soundEnabled), setSoundEnabled)}>{soundEnabled ? 'Sound on' : 'Sound off'}</button>
        <button type="button" aria-label={musicEnabled ? 'Stop music' : 'Play music'} aria-pressed={musicEnabled} title="An original chiptune loop, synthesized in the browser." onClick={() => toggle(!musicEnabled, (scene) => scene.setMusicEnabled(!musicEnabled), setMusicEnabled)}>{musicEnabled ? 'Music on' : 'Music off'}</button>
        <button type="button" onClick={() => setPortrait(true)}>Portrait</button>
      </div>}
      {portrait && <button type="button" className="character-hero__restore" onClick={() => { setStatus('waiting'); setPaused(false); setPortrait(false); }}>Back to playground</button>}
    </div>
  );
}

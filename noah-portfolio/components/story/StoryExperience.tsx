'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, CircleDashed, Info, Link2, RotateCcw } from 'lucide-react';

import type {
  EvidenceRef,
  StoryPlan,
  PublicStory,
  StoryPhase,
  StoryScene,
} from '@/lib/story/types';
import { MotionAsset } from '@/components/story/MotionAsset';
import { SceneTransition } from '@/components/story/SceneTransition';
import { RemotionScene } from '@/components/story/remotion/RemotionScene';


const PHASE_LABELS: Record<StoryPhase, string> = {
  planning: 'Planning the Story',
  composing: 'Composing Scenes',
  validating: 'Validating the Story',
  publishing: 'Publishing the Story',
};

const PRELUDE_PHRASES = [
  'Let me think about Noah…',
  'What would Noah do…',
  'Sorting through the afro jungle…',
  'Grinding fresh beans and fresh takes…',
  'Warming up the 3D printer…',
  'Tuning the Kuala Lumpur frequency…',
  'Shuffling the build playlist…',
  'Tracing signals through the tech stack…',
  'Calibrating pixels, plastic, and possibility…',
  'Finding the groove between craft and code…',
  'Checking the espresso-to-ideas ratio…',
  'Turning a half-formed thought into a working system…',
] as const;

const ROLE_LABELS: Record<StoryScene['role'], string> = {
  'direct-answer': 'Direct answer',
  evidence: 'Evidence',
  synthesis: 'Synthesis',
};

interface StoryExperienceProps {
  question: string;
  phase: StoryPhase | null;
  plan: StoryPlan | null;
  scenes: StoryScene[];
  evidence: EvidenceRef[];
  story: PublicStory | null;
  error: string | null;
  onRetry: () => void;
  onRelatedQuestion: (question: string) => void;
}

interface StoryRailProps {
  plan: StoryPlan;
  readyCount: number;
  activeIndex: number;
  onNavigate: (index: number) => void;
}

function useStoryScrollSpy(
  rootRef: RefObject<HTMLElement | null>,
  sceneCount: number,
  question: string,
) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => setActiveIndex(0), [question]);

  useEffect(() => {
    if (sceneCount === 0) return;
    setActiveIndex((current) => Math.min(current, sceneCount - 1));

    const sceneElements = rootRef.current?.querySelectorAll<HTMLElement>('[data-story-scene]');
    if (!sceneElements?.length || typeof IntersectionObserver === 'undefined') return;

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.storySceneIndex);
          ratios.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let nextIndex: number | null = null;
        let nextRatio = 0;
        for (const [index, ratio] of ratios) {
          if (ratio > nextRatio) {
            nextIndex = index;
            nextRatio = ratio;
          }
        }
        if (nextIndex !== null) setActiveIndex(nextIndex);
      },
      { rootMargin: '-20% 0px -35%', threshold: [0.2, 0.45, 0.7] },
    );

    sceneElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [question, rootRef, sceneCount]);

  return [activeIndex, setActiveIndex] as const;
}

function useBackdropCue(plan: StoryPlan | null, activeIndex: number) {
  useEffect(() => {
    const backdrop = document.querySelector<HTMLElement>('.backdrop-root');
    const cue = plan?.scenes[activeIndex]?.cue;
    if (!backdrop || cue === undefined) return;
    backdrop.dataset.storyCue = JSON.stringify(cue);
    return () => {
      delete backdrop.dataset.storyCue;
    };
  }, [activeIndex, plan]);
}

function StoryPhraseCarousel() {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [phraseState, setPhraseState] = useState({ index: 0, length: 0 });
  const phrase = PRELUDE_PHRASES[phraseState.index];

  useEffect(() => {
    const phraseLength = phrase.length;
    if (prefersReducedMotion && phraseState.length !== phraseLength) {
      setPhraseState((current) => ({ ...current, length: phraseLength }));
      return;
    }

    const delay = phraseState.length < phraseLength
      ? 44
      : prefersReducedMotion
        ? 2600
        : 1600;
    const timer = window.setTimeout(() => {
      setPhraseState((current) => {
        if (current.length < PRELUDE_PHRASES[current.index].length) {
          return { ...current, length: current.length + 1 };
        }
        return {
          index: (current.index + 1) % PRELUDE_PHRASES.length,
          length: prefersReducedMotion
            ? PRELUDE_PHRASES[(current.index + 1) % PRELUDE_PHRASES.length].length
            : 0,
        };
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [phrase, phraseState.length, prefersReducedMotion]);

  return (
    <div
      className="story-phrase"
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Story preparation"
    >
      <span key={phraseState.index} className="story-phrase__typed" aria-hidden="true">
        {phrase.slice(0, phraseState.length)}
      </span>
      <span className="sr-only">{phrase}</span>
    </div>
  );
}

function StoryPhasePills({
  phase,
  plan,
  readyCount,
  story,
  error,
}: {
  phase: StoryPhase | null;
  plan: StoryPlan | null;
  readyCount: number;
  story: PublicStory | null;
  error: string | null;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const previousReadyCount = useRef(0);
  const [landedCount, setLandedCount] = useState<number | null>(null);
  const sceneCount = plan?.scenes.length ?? 0;
  const safeReadyCount = Math.min(readyCount, sceneCount);

  useEffect(() => {
    const previous = previousReadyCount.current;
    previousReadyCount.current = readyCount;
    if (phase !== 'composing' || !plan || readyCount <= previous) {
      setLandedCount(null);
      return;
    }

    const nextLandedCount = Math.min(readyCount, plan.scenes.length);
    if (nextLandedCount === 0) return;
    setLandedCount(nextLandedCount);
    const timer = window.setTimeout(() => setLandedCount(null), 1200);
    return () => window.clearTimeout(timer);
  }, [phase, plan, readyCount]);

  const landedScene = plan && landedCount
    ? plan.scenes[landedCount - 1]
    : null;
  const composingScene = phase === 'composing' && plan && safeReadyCount < sceneCount
    ? plan.scenes[safeReadyCount]
    : null;
  const completedScene = phase === 'composing' && plan && sceneCount > 0 && safeReadyCount === sceneCount
    ? plan.scenes[sceneCount - 1]
    : null;
  const sceneProgress = landedScene
    ? `Composed ${landedCount} of ${sceneCount} — ${landedScene.title}`
    : composingScene
      ? `Composing ${safeReadyCount + 1} of ${sceneCount} — ${composingScene.title}`
      : completedScene
        ? `Composed ${sceneCount} of ${sceneCount} — ${completedScene.title}`
        : null;
  const progressStatus = plan
    ? composingScene
      ? `${safeReadyCount} of ${sceneCount} planned Scenes ready. Composing ${composingScene.title}`
      : `${safeReadyCount} of ${sceneCount} planned Scenes ready`
    : '';
  const visible = phase !== null && story === null && error === null;
  const initial = reducedMotion ? { opacity: 0 } : { opacity: 0, x: '100%', scale: 0.96 };
  const exit = reducedMotion ? { opacity: 0 } : { opacity: 0, x: '100%', scale: 0.96 };
  const transition = reducedMotion
    ? { duration: 0.18 }
    : { type: 'spring' as const, stiffness: 320, damping: 28 };

  return (
    <>
      <AnimatePresence>
        {visible ? (
          <motion.div
            className="story-phase-pills"
            role="group"
            aria-label="Story generation progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`phase-${phase}`}
                className="story-phase-pill story-phase-pill--phase"
                initial={initial}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={exit}
                transition={transition}
              >
                <span>Phase</span>
                {phase ? PHASE_LABELS[phase] : null}
              </motion.div>
              {sceneProgress ? (
                <motion.div
                  key={landedScene ? `landed-${landedCount}` : `scene-${safeReadyCount}`}
                  className="story-phase-pill story-phase-pill--scene"
                  data-state={landedScene || completedScene ? 'ready' : 'composing'}
                  initial={initial}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={exit}
                  transition={transition}
                >
                  {landedScene || completedScene ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <CircleDashed aria-hidden="true" />
                  )}
                  <span>{sceneProgress}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {visible && progressStatus ? (
        <p
          className="sr-only"
          role="status"
          aria-label="Story generation status"
          aria-live="polite"
          aria-atomic="true"
        >
          {progressStatus}
        </p>
      ) : null}
    </>
  );
}

function StoryPrelude({
  question,
  error,
  onRetry,
}: {
  question: string;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="story-prelude" aria-labelledby="story-prelude-title" aria-busy={!error}>
      <div className="story-prelude__content">
        <p className="story-eyebrow">Noah&apos;s portfolio · Scene Story</p>
        <h1 id="story-prelude-title">Preparing your Story</h1>
        <p className="story-prelude__question">&ldquo;{question}&rdquo;</p>
        {error ? (
          <div className="story-error" role="alert">
            <p>{error}</p>
            <button type="button" className="story-action" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              Try this question again
            </button>
          </div>
        ) : (
          <StoryPhraseCarousel />
        )}
      </div>
    </section>
  );
}

function StoryRail({ plan, readyCount, activeIndex, onNavigate }: StoryRailProps) {
  const activeValue = String(Math.min(activeIndex, Math.max(readyCount - 1, 0)));

  return (
    <>
      <nav className="story-rail story-rail--desktop" aria-label="Story scenes">
        <p className="story-rail__label">Scenes</p>
        <ol>
          {plan.scenes.map((scene, index) => {
            const ready = index < readyCount;
            const active = ready && index === activeIndex;
            return (
              <li key={scene.id}>
                <button
                  type="button"
                  className="story-rail__target"
                  data-state={ready ? (active ? 'active' : 'ready') : 'pending'}
                  disabled={!ready}
                  aria-current={active ? 'location' : undefined}
                  onClick={() => onNavigate(index)}
                >
                  <span className="story-rail__index">{String(index + 1).padStart(2, '0')}</span>
                  <span
                    className="story-rail__title"
                    title={scene.title}
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      whiteSpace: 'normal',
                    }}
                  >
                    {scene.title}
                  </span>
                  <span className="sr-only">
                    {ready ? (active ? ', active Scene' : ', ready Scene') : ', pending Scene'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <nav className="story-rail story-rail--mobile" aria-label="Story navigation">
        <label htmlFor="story-scene-select">Scene</label>
        <select
          id="story-scene-select"
          aria-label="Choose a Story scene"
          value={activeValue}
          onChange={(event) => onNavigate(Number(event.target.value))}
        >
          {plan.scenes.map((scene, index) => {
            const ready = index < readyCount;
            return (
              <option key={scene.id} value={index} disabled={!ready}>
                {index + 1}. {scene.title}{ready ? '' : ' — pending'}
              </option>
            );
          })}
        </select>
        <span aria-live="polite">
          {readyCount} of {plan.scenes.length} ready
        </span>
      </nav>
    </>
  );
}

function SceneSources({
  scene,
  evidenceById,
}: {
  scene: StoryScene;
  evidenceById: Map<string, EvidenceRef>;
}) {
  const refs = scene.evidenceRefIds.flatMap((id) => {
    const evidenceRef = evidenceById.get(id);
    return evidenceRef ? [evidenceRef] : [];
  });
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = `story-scene-sources-${scene.index + 1}`;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      pinned.current = false;
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [open]);

  if (refs.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="story-sources"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned.current) setOpen(false);
      }}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        pinned.current = false;
        setOpen(false);
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        pinned.current = false;
        setOpen(false);
      }}
    >
      <button
        type="button"
        className="story-sources__trigger"
        aria-label="Sources for this claim"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          pinned.current = true;
          setOpen(true);
        }}
      >
        <Info aria-hidden="true" />
      </button>
      {open ? (
        <aside
          id={popoverId}
          className="story-sources__popover"
          role="dialog"
          aria-label="Sources for this claim"
        >
          <p className="story-sources__title">Sources for this claim</p>
          <ul>
            {refs.map((evidenceRef) => (
              <li key={evidenceRef.id}>
                <strong>{evidenceRef.label}</strong>
                <p>{evidenceRef.excerpt}</p>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

function StorySceneSection({
  scene,
  plan,
  cue,
  evidenceById,
  evidence,
}: {
  scene: StoryScene;
  plan: StoryPlan;
  cue: StoryPlan['scenes'][number]['cue'];
  evidenceById: Map<string, EvidenceRef>;
  evidence: readonly Pick<EvidenceRef, 'id' | 'label'>[];
}) {
  const titleId = `story-scene-title-${scene.index + 1}`;

  return (
    <section
      id={`story-scene-${scene.index + 1}`}
      className="story-scene"
      data-story-scene=""
      data-story-scene-index={scene.index}
      data-scene-pattern={scene.pattern}
      data-scene-register={scene.register}
      data-scene-cue={JSON.stringify(cue)}
      aria-labelledby={titleId}
    >
      <div className="story-scene__frame">
        <div className="story-scene__stage">
          <RemotionScene
            scene={scene}
            plan={plan}
            evidence={evidence}
            fallback={<MotionAsset assetId={scene.assetId} />}
          />

          <header className="story-scene__chrome">
            <p className="story-scene__role" aria-hidden="true">
              <span>{String(scene.index + 1).padStart(2, '0')}</span>
              {ROLE_LABELS[scene.role]}
            </p>
            <h2 id={titleId} className="sr-only">{scene.title}</h2>
          </header>

          <div className="story-scene__proof">
            <SceneSources scene={scene} evidenceById={evidenceById} />
          </div>
        </div>

        <div className="story-scene__detail">
          <p className="story-scene__claim">{scene.claim}</p>
          <div className="story-scene__body">
            {scene.body.split(/\n\n+/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        {scene.pattern !== 'project-spotlight' && scene.projects?.length ? (
          <nav className="story-scene__projects" aria-label="Referenced projects">
            {scene.projects.map((project) => (
              <a
                key={project.slug}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${project.title} project`}
              >
                <span>{project.title}</span>
                <ArrowRight aria-hidden="true" />
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  );
}

export default function StoryExperience({
  question,
  phase,
  plan,
  scenes,
  evidence,
  story,
  error,
  onRetry,
  onRelatedQuestion,
}: StoryExperienceProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useStoryScrollSpy(rootRef, scenes.length, question);
  const [shareStatus, setShareStatus] = useState('');
  const reducedMotion = Boolean(useReducedMotion());
  useBackdropCue(plan, activeIndex);
  const evidenceById = useMemo(
    () => new Map(evidence.map((evidenceRef) => [evidenceRef.id, evidenceRef])),
    [evidence],
  );

  useEffect(() => setShareStatus(''), [question]);


  if (!plan) {
    return (
      <>
        <StoryPrelude
          question={question}
          error={error}
          onRetry={onRetry}
        />
        <StoryPhasePills
          phase={phase}
          plan={plan}
          readyCount={scenes.length}
          story={story}
          error={error}
        />
      </>
    );
  }

  const navigateToScene = (index: number) => {
    if (index < 0 || index >= scenes.length) return;
    const behavior = reducedMotion ? 'auto' : 'smooth';
    setActiveIndex(index);
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-story-scene-index="${index}"]`)
      ?.scrollIntoView({ behavior, block: 'start' });
  };

  const shareStory = async () => {
    if (!story) return;
    const shareData = {
      title: `${story.displayQuestion} — Noah Rijkaard`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus('Story shared');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus('Story link copied');
      } else {
        setShareStatus('Copy the Story URL from your address bar');
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setShareStatus('The Story link could not be shared');
    }
  };

  const hasPendingScene = !story
    && !error
    && phase === 'composing'
    && scenes.length < plan.scenes.length;

  return (
    <article
      ref={rootRef}
      className="story-document"
      data-story-rail-layout="gutter"
      aria-labelledby="story-question-title"
    >
      <header className="story-document__header">
        <div>
          <p className="story-eyebrow">Your question</p>
          <h1 id="story-question-title">{question}</h1>
        </div>
        {story ? (
          <div className="story-share">
            <button
              type="button"
              className="story-action story-action--quiet"
              aria-label="Share this Story"
              onClick={() => void shareStory()}
            >
              <Link2 aria-hidden="true" />
              Share Story
            </button>
            <span role="status" aria-live="polite">{shareStatus}</span>
          </div>
        ) : null}
      </header>

      <StoryPhasePills
        phase={phase}
        plan={plan}
        readyCount={scenes.length}
        story={story}
        error={error}
      />

      {scenes.length > 0 ? (
        <StoryRail
          plan={plan}
          readyCount={scenes.length}
          activeIndex={activeIndex}
          onNavigate={navigateToScene}
        />
      ) : null}

      <div className="story-scenes">
        {scenes.map((scene, position) => (
          <Fragment key={scene.id}>
            {position > 0 ? (
              <SceneTransition
                index={scene.index}
                seed={plan.question}
                from={scenes[position - 1]}
                to={scene}
              />
            ) : null}
            <StorySceneSection
              scene={scene}
              plan={plan}
              cue={plan.scenes[scene.index].cue}
              evidenceById={evidenceById}
              evidence={evidence}
            />
          </Fragment>
        ))}
      </div>

      {hasPendingScene ? (
        <div className="story-sentinel" role="status" aria-live="polite">
          <CircleDashed aria-hidden="true" />
          <span>{`Composing Scene ${scenes.length + 1} of ${plan.scenes.length}`}</span>
        </div>
      ) : null}

      {error ? (
        <div className="story-error story-error--inline" role="alert">
          <p>{error}</p>
          <button type="button" className="story-action" onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            Try this question again
          </button>
        </div>
      ) : null}

      {story ? (
        <footer className="story-related" aria-labelledby="story-related-title">
          <p className="story-eyebrow">Continue exploring</p>
          <h2 id="story-related-title">Related Questions</h2>
          <div className="story-related__questions">
            {story.plan.relatedQuestions.map((question) => (
              <button
                type="button"
                className="story-related__question"
                key={question}
                onClick={() => onRelatedQuestion(question)}
              >
                <span>{question}</span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
          {story.evidence.length > 0 ? (
            <p className="story-related__complete">
              <Check aria-hidden="true" />
              Grounded in {story.evidence.length} evidence {story.evidence.length === 1 ? 'reference' : 'references'}
            </p>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

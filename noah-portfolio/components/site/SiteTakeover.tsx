"use client";

import "@/lib/site/art/art.css";
import "./site.css";
import "./thoughts.css";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Link2, RotateCcw, Volume2, VolumeX } from "lucide-react";

import GeneratedSite, { siteBlockItems } from "./GeneratedSite";
import {
  isSiteSoundMuted,
  playBrickSnap,
  setSiteSoundMuted,
  startThinkingNoises,
} from "@/lib/site/sound";
import { thinker } from "@/lib/site/thoughts";
import type { CanvasMode } from "@/lib/hooks/usePortfolioCanvas";
import type { EvidenceRef, PublicStory, Site } from "@/lib/story/types";

const BLOCK_MS = 430;
const GENERATING_STEPS = ["Picking a layout", "Writing the copy", "Choosing pictures", "Citing Noah's notes"];

interface SiteTakeoverProps {
  mode: Exclude<CanvasMode, "home">;
  question: string;
  site: Site | null;
  evidence: readonly EvidenceRef[];
  story: PublicStory | null;
  error: string | null;
  onAsk: (question: string) => void;
  onRetry: () => void;
  onBack: () => void;
}

/** Decorative thought bubbles beside the knob, alternating sides so the two on screen never meet. */
function ThoughtBubbles() {
  const [thoughts, setThoughts] = useState<Array<{ id: number; text: string; rise: number }>>([]);
  useEffect(() => {
    const started = Date.now();
    const next = thinker();
    let id = 0;
    let timer = window.setTimeout(function think() {
      id += 1;
      const thought = { id, text: next(Date.now() - started), rise: Math.round(Math.random() * 40) };
      // A bubble lives 3.8s and the next comes 1.9-2.7s later, so the one dropped here has faded.
      setThoughts((shown) => [...shown.slice(-1), thought]);
      timer = window.setTimeout(think, 1900 + Math.random() * 800);
    }, 700);
    return () => window.clearTimeout(timer);
  }, []);
  return thoughts.map(({ id, text, rise }) => (
    <p
      key={id}
      className="site-thought"
      data-side={id % 2 ? "left" : "right"}
      style={{ "--rise": `${rise}px` } as CSSProperties}
    >
      {text}
    </p>
  ));
}

function Generating({ question }: { question: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((value) => (value + 1) % GENERATING_STEPS.length), 3200);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="site-generating">
      <div className="site-generating__inner" role="status" aria-label="Building your site">
        <div className="site-thinking" aria-hidden>
          <svg className="site-knob" viewBox="0 0 120 120">
            {Array.from({ length: 11 }, (_, index) => (
              <line
                key={index}
                x1="60"
                y1="6"
                x2="60"
                y2="14"
                stroke="var(--site-muted)"
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${-135 + index * 27} 60 60)`}
              />
            ))}
            <circle cx="60" cy="60" r="38" fill="var(--site-paper)" stroke="var(--site-line)" strokeWidth="2" />
            <path
              className="site-knob__arc"
              d="M33.1 86.9A38 38 0 1 1 86.9 86.9"
              fill="none"
              stroke="var(--site-accent)"
              strokeWidth="5"
              strokeLinecap="round"
              pathLength="238"
            />
            <g className="site-knob__pointer">
              <line x1="60" y1="60" x2="60" y2="30" stroke="var(--site-ink)" strokeWidth="5" strokeLinecap="round" />
            </g>
          </svg>
          <ThoughtBubbles />
        </div>
        <p className="site-generating__status">{GENERATING_STEPS[step]}…</p>
        <h1 className="site-generating__question">{question}</h1>
        <div className="site-wireframe" aria-hidden>
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} style={{ "--i": index } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mounted once per site; a site that arrived through this visit's stream builds brick by brick. */
function SiteBuild({
  site,
  evidence,
  animate,
  layerRef,
  onAsk,
  onProgress,
}: {
  site: Site;
  evidence: readonly EvidenceRef[];
  animate: boolean;
  layerRef: RefObject<HTMLDialogElement | null>;
  onAsk: (question: string) => void;
  onProgress: (building: boolean) => void;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  // Captured once: publishing swaps in the stored copy of the same site and flips `animate` off,
  // and neither may restart a build that is already running.
  const [plan] = useState(() => {
    const items = siteBlockItems(site);
    return { play: animate && !reducedMotion, click: animate, total: items.length, items };
  });
  const [revealed, setRevealed] = useState<number | undefined>(plan.play ? 0 : undefined);
  const [fit, setFit] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!plan.play || !stage || !layer) return;
    // Zoom out so the whole page is visible while it assembles, then zoom back in.
    setFit(Math.min(1, Math.max(0.16, (layer.clientHeight - 56) / stage.scrollHeight)));
  }, [plan, layerRef]);

  useEffect(() => {
    if (!plan.play) {
      if (plan.click) playBrickSnap();
      return;
    }
    let count = 0;
    let timer = 0;
    const step = () => {
      count += 1;
      setRevealed(count);
      playBrickSnap();
      for (let index = 0; index < plan.items[count - 1]; index += 1) playBrickSnap(0.14 + index * 0.09, 0.4);
      timer = window.setTimeout(
        count < plan.total ? step : () => setRevealed(undefined),
        count < plan.total ? BLOCK_MS : 700,
      );
    };
    onProgress(true);
    timer = window.setTimeout(step, 320);
    return () => {
      window.clearTimeout(timer);
      // An error or a new question can unmount a build part way; it is no longer building.
      onProgress(false);
    };
  }, [plan, onProgress]);

  useEffect(() => {
    if (revealed === undefined) onProgress(false);
  }, [revealed, onProgress]);

  return (
    <div
      ref={stageRef}
      className="site-stage"
      style={revealed === undefined ? undefined : { transform: `scale(${fit})` }}
    >
      <GeneratedSite site={site} evidence={evidence} revealed={revealed} onAsk={onAsk} />
    </div>
  );
}

export default function SiteTakeover({
  mode,
  question,
  site,
  evidence,
  story,
  error,
  onAsk,
  onRetry,
  onBack,
}: SiteTakeoverProps) {
  const layerRef = useRef<HTMLDialogElement>(null);
  const [muted, setMuted] = useState(false);
  const [building, setBuilding] = useState(false);
  const [copied, setCopied] = useState(false);
  const shown = story?.site ?? site;
  const siteKey = useMemo(() => (shown ? JSON.stringify(shown) : null), [shown]);
  const generating = mode === "streaming" && !shown;
  // A site that appears after this visit's generating screen builds live, even when a cached
  // replay delivers the site and its publication in one render. Restored sites appear built.
  const [live, setLive] = useState(false);
  if (generating && !live) setLive(true);

  useEffect(() => setMuted(isSiteSoundMuted()), []);

  useLayoutEffect(() => {
    const dialog = layerRef.current;
    if (!dialog) return;
    // Server HTML renders the dialog open so share links paint before hydration; upgrade it to modal
    // so the page behind becomes inert and Escape is handled by the browser.
    dialog.close();
    dialog.showModal();
    // showModal focuses the first link; focus the layer itself so nothing shows a stray focus ring.
    dialog.focus();
    // A layout cleanup runs before React removes the dialog, so the browser can still hand focus
    // back to whatever opened it; a closed detached dialog drops focus to <body>.
    return () => dialog.close();
  }, []);

  useEffect(() => {
    if (!generating) return;
    return startThinkingNoises();
  }, [generating]);

  useEffect(() => {
    layerRef.current?.scrollTo({ top: 0 });
    setCopied(false);
    if (siteKey) setLive(false);
  }, [siteKey]);

  const toggleSound = () => {
    setSiteSoundMuted(!muted);
    setMuted(!muted);
  };
  const copyLink = () => {
    if (!story) return;
    void navigator.clipboard
      ?.writeText(`${window.location.origin}/ask/${encodeURIComponent(story.id)}`)
      .then(() => setCopied(true), () => undefined);
  };

  return (
    <dialog
      ref={layerRef}
      open
      tabIndex={-1}
      className="site-takeover"
      aria-label={`Generated site: ${question}`}
      data-site-palette={shown?.palette ?? "midnight"}
      data-building={building ? "" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onBack();
      }}
    >
      {mode === "error" ? (
        <div className="site-error">
          <div className="site-error__card" role="alert">
            <p className="gs-eyebrow">Build stopped</p>
            <h1>That site did not come together</h1>
            <p>{error ?? "Something went wrong while building it."}</p>
            <div className="gs-hero__actions">
              <button type="button" className="gs-button" onClick={onRetry}>
                Try again
                <span className="gs-button__icon"><RotateCcw aria-hidden className="size-4" strokeWidth={1.5} /></span>
              </button>
            </div>
          </div>
        </div>
      ) : shown && siteKey ? (
        <SiteBuild
          key={siteKey}
          site={shown}
          evidence={story?.evidence ?? evidence}
          animate={live}
          layerRef={layerRef}
          onAsk={onAsk}
          onProgress={setBuilding}
        />
      ) : (
        <Generating question={question} />
      )}

      <div className="site-dock" role="toolbar" aria-label="Site controls">
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden className="size-4" strokeWidth={1.5} />
          Back to portfolio
        </button>
        <button type="button" onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
          {muted ? <VolumeX aria-hidden className="size-4" strokeWidth={1.5} /> : <Volume2 aria-hidden className="size-4" strokeWidth={1.5} />}
        </button>
        {story && !building ? (
          <button type="button" onClick={copyLink}>
            {copied ? <Check aria-hidden className="size-4" strokeWidth={1.5} /> : <Link2 aria-hidden className="size-4" strokeWidth={1.5} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        ) : (
          <span className="site-dock__status" aria-live="polite">
            {generating ? "Generating" : building ? "Building" : mode === "error" ? "Stopped" : "Saving"}
          </span>
        )}
      </div>
    </dialog>
  );
}

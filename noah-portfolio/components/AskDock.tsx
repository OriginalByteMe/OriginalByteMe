'use client';

import { forwardRef, useEffect, useState, type ButtonHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import ChatBox from './ChatBox';
import { useAskMe } from './AskMeProvider';

const CTA_STORAGE_KEY = 'askDockCtaSeen';

type AskLauncherButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'>;

export const AskLauncherButton = forwardRef<HTMLButtonElement, AskLauncherButtonProps>(
  function AskLauncherButton({ className = '', ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={`ask-launcher-button ${className}`.trim()}
        {...props}
      >
        <MessageCircle strokeWidth={1.5} aria-hidden />
      </button>
    );
  },
);

/**
 * The always-available Ask entry point. While the hero's ask panel is on
 * screen nothing renders; the moment the visitor scrolls past it (or an
 * answer takes over the page) a chat bubble springs into the bottom-right.
 * Clicking it unfolds a sticky mini chat panel; submitting closes the panel
 * so the streamed takeover has the stage. A one-time "Ask me anything ✨"
 * call-to-action rides along until the first interaction.
 */
export default function AskDock() {
  const { mode } = useAskMe();
  const [open, setOpen] = useState(false);
  const [heroAskVisible, setHeroAskVisible] = useState(true);
  const [ctaSeen, setCtaSeen] = useState(true);

  useEffect(() => {
    try {
      setCtaSeen(window.localStorage.getItem(CTA_STORAGE_KEY) === '1');
    } catch {
      setCtaSeen(false);
    }
  }, []);

  const dismissCta = () => {
    setCtaSeen(true);
    try {
      window.localStorage.setItem(CTA_STORAGE_KEY, '1');
    } catch {
      /* private mode — CTA just reappears next visit */
    }
  };

  // Keep the dock retracted while the hero launcher is visible or still below
  // the viewport. It appears only after the visitor has actually scrolled past
  // that launcher, not merely because a tall mobile hero starts above it.
  useEffect(() => {
    if (mode !== 'home' || typeof IntersectionObserver === 'undefined') {
      setHeroAskVisible(false);
      return;
    }
    let observer: IntersectionObserver | null = null;
    let retryTimer: number | undefined;
    let attempts = 0;
    const bind = () => {
      const panel = document.getElementById('ask-me');
      if (!panel) {
        attempts += 1;
        if (attempts < 10) {
          retryTimer = window.setTimeout(bind, 200);
        } else {
          setHeroAskVisible(false);
        }
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => setHeroAskVisible(
          entry.isIntersecting || entry.boundingClientRect.top >= 0,
        ),
        { threshold: 0.2 },
      );
      observer.observe(panel);
    };
    bind();
    return () => {
      window.clearTimeout(retryTimer);
      observer?.disconnect();
    };
  }, [mode]);

  const docked = !heroAskVisible;

  // Fold the panel away whenever the dock retracts (scrolled back to hero).
  useEffect(() => {
    if (!docked) setOpen(false);
  }, [docked]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {docked && open && (
          <motion.div
            id="ask-dock-panel"
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="w-[min(24rem,calc(100vw-3rem))] rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] p-6 shadow-[0_28px_80px_-32px_rgba(58,51,69,0.55)] dark:border-white/10 dark:bg-[#241f32]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl tracking-tight text-[#37304a] dark:text-[#eae6f2]">
                Ask me anything
              </h2>
              <button
                type="button"
                aria-label="Close Ask-Me"
                onClick={() => setOpen(false)}
                className="hero-action size-10 shrink-0 justify-center rounded-full"
              >
                <X strokeWidth={1.5} className="size-4" aria-hidden />
              </button>
            </div>
            <ChatBox autoFocus onSubmitted={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {docked && !open && (
          <motion.div
            key="fab"
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: 40, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            {!ctaSeen && (
              <motion.span
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: 0.45 }}
                className="rounded-full border border-[#37304a]/10 bg-[#fffdf8] px-4 py-2 text-sm text-[#5646a8] shadow-[0_14px_36px_-18px_rgba(58,51,69,0.5)] dark:border-white/10 dark:bg-[#241f32] dark:text-[#c9b3ec]"
              >
                Ask me anything ✨
              </motion.span>
            )}
            <AskLauncherButton
              aria-label="Ask this portfolio a question"
              aria-expanded={false}
              aria-controls="ask-dock-panel"
              onClick={() => {
                setOpen(true);
                dismissCta();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

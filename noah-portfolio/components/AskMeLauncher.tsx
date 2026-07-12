'use client';

import { useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatBox from './ChatBox';

export default function AskMeLauncher() {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  if (!open) {
    return (
      <button
        ref={launcherRef}
        type="button"
        aria-label="Open Ask-Me"
        aria-expanded="false"
        onClick={() => setOpen(true)}
        className="hero-action mt-3 min-h-12 w-full justify-between rounded-full px-4 text-sm font-medium"
      >
        <span>Ask this portfolio</span>
        <MessageCircle strokeWidth={1.5} className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl tracking-tight">Where should we begin?</h2>
        <button
          type="button"
          aria-label="Close Ask-Me"
          onClick={close}
          className="hero-action size-11 shrink-0 justify-center rounded-full"
        >
          <X strokeWidth={1.5} className="size-4" aria-hidden />
        </button>
      </div>
      <ChatBox autoFocus />
    </div>
  );
}

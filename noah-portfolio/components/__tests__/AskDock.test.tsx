import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AskDock from '@/components/AskDock';

const askMeState = vi.hoisted(() => ({ mode: 'home' as 'home' | 'streaming' | 'answer' }));

vi.mock('@/components/AskMeProvider', () => ({
  useAskMe: () => askMeState,
}));
vi.mock('@/components/ChatBox', () => ({
  default: ({ autoFocus }: { autoFocus?: boolean }) => (
    <input aria-label="Dock question" autoFocus={autoFocus} />
  ),
}));
let observedTop = -1;


class HiddenHeroObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0.2];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{
        isIntersecting: false,
        target,
        boundingClientRect: { top: observedTop },
      } as unknown as IntersectionObserverEntry],
      this,
    );
  }

  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
}

beforeEach(() => {
  askMeState.mode = 'home';
  observedTop = -1;
  vi.stubGlobal('IntersectionObserver', HiddenHeroObserver);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  });
  const heroAsk = document.createElement('section');
  heroAsk.id = 'ask-me';
  document.body.appendChild(heroAsk);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.getElementById('ask-me')?.remove();
});

describe('AskDock shared launcher', () => {
  it('uses the shared launcher language after the hero Ask-Me leaves view', async () => {
    render(<AskDock />);

    const launcher = await screen.findByRole('button', { name: 'Ask this portfolio a question' });
    expect(launcher).toHaveClass('ask-launcher-button');
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(launcher).toHaveAttribute('aria-controls', 'ask-dock-panel');

    fireEvent.click(launcher);

    expect(screen.getByRole('heading', { name: 'Ask me anything' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Dock question' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Close Ask-Me' })).toBeInTheDocument();
  });

  it('stays retracted while the hero launcher is still below the viewport', () => {
    observedTop = 640;
    render(<AskDock />);

    expect(screen.queryByRole('button', { name: 'Ask this portfolio a question' })).not.toBeInTheDocument();
  });
});

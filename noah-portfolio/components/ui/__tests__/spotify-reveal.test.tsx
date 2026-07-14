import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SpotifyReveal from '@/components/ui/spotify-reveal';

const spotifyHook = vi.hoisted(() => ({ fetchSpotifyTracksAndPalettes: vi.fn() }));
const spotifyState = vi.hoisted(() => ({
  current: {
    tracks: [] as Array<{ id: string }>,
    isLoading: false,
    error: null as string | null,
  },
}));

vi.mock('react-redux', () => ({
  useSelector: (selector: (state: { spotify: typeof spotifyState.current }) => unknown) =>
    selector({ spotify: spotifyState.current }),
}));

vi.mock('@/lib/hooks/useSpotify', () => ({
  default: () => spotifyHook,
}));

vi.mock('@/components/ui/spotify-pill', () => ({
  default: ({ track }: { track: { id: string } }) => <div data-testid={`spotify-track-${track.id}`} />,
}));

interface ObserverHarness {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observer: IntersectionObserver;
  getTarget: () => Element | undefined;
}


const observers: ObserverHarness[] = [];
let observerConstructor: unknown;

function installIntersectionObserverMock() {
  observerConstructor = vi.fn(function MockIntersectionObserver(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
      let target: Element | undefined;
      const observer: IntersectionObserver = {
        root: options?.root ?? null,
        rootMargin: options?.rootMargin ?? '0px',
        thresholds: [0],
        disconnect: vi.fn(),
        observe: vi.fn((element: Element) => {
          target = element;
        }),
        takeRecords: vi.fn(() => []),
        unobserve: vi.fn(),
      };

      observers.push({ callback, options, observer, getTarget: () => target });
      return observer;
    },
  );
  vi.stubGlobal('IntersectionObserver', observerConstructor);
}

function triggerIntersection(harness: ObserverHarness, isIntersecting: boolean) {
  const target = harness.getTarget();
  if (!target) {
    throw new Error('IntersectionObserver target was not observed');
  }

  harness.callback([{ isIntersecting, target } as IntersectionObserverEntry], harness.observer);
}

beforeEach(() => {
  vi.useFakeTimers();
  observers.length = 0;
  spotifyState.current = { tracks: [], isLoading: false, error: null };
  spotifyHook.fetchSpotifyTracksAndPalettes.mockClear();
  installIntersectionObserverMock();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SpotifyReveal listening callout', () => {
  it('shows the easter-egg callout at the first near-viewport intersection, then removes it', () => {
    render(<SpotifyReveal variant="easter-egg" />);

    const reveal = document.querySelector('.listening-easter-egg__reveal');
    expect(reveal).toBeInTheDocument();
    expect(reveal).not.toHaveAttribute('data-callout-visible');
    expect(observers).toHaveLength(1);
    expect(observers[0].options).toMatchObject({ rootMargin: '0px' });
    expect(observers[0].getTarget()).toBe(reveal);

    act(() => triggerIntersection(observers[0], false));
    expect(reveal).not.toHaveAttribute('data-callout-visible');

    act(() => triggerIntersection(observers[0], true));
    expect(reveal).toHaveAttribute('data-callout-visible', 'true');

    act(() => vi.advanceTimersByTime(4499));
    expect(reveal).toHaveAttribute('data-callout-visible', 'true');

    act(() => vi.advanceTimersByTime(1));
    expect(reveal).not.toHaveAttribute('data-callout-visible');
  });

  it('does not restart the one-shot timer and keeps archive toggling and fetching intact', () => {
    render(<SpotifyReveal variant="easter-egg" />);

    const reveal = document.querySelector('.listening-easter-egg__reveal');
    const harness = observers[0];

    act(() => triggerIntersection(harness, true));
    expect(harness.observer.disconnect).toHaveBeenCalledTimes(1);

    const trigger = screen.getByRole('button', { name: "Show Noah's listening context" });
    fireEvent.focus(trigger);
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(reveal).toHaveAttribute('data-callout-visible', 'true');
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(2000));
    act(() => triggerIntersection(harness, true));
    act(() => vi.advanceTimersByTime(2499));
    expect(reveal).toHaveAttribute('data-callout-visible', 'true');

    act(() => vi.advanceTimersByTime(1));
    expect(reveal).not.toHaveAttribute('data-callout-visible');
    expect(harness.observer.disconnect).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('listening-easter-egg-archive')).toBeInTheDocument();
    expect(spotifyHook.fetchSpotifyTracksAndPalettes).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('listening-easter-egg-archive')).not.toBeInTheDocument();
  });

  it('disconnects the observer and clears the pending callout timeout on unmount', () => {
    const { unmount } = render(<SpotifyReveal variant="easter-egg" />);
    const harness = observers[0];

    act(() => triggerIntersection(harness, true));
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(harness.observer.disconnect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves the default variant unobserved and preserves its archive toggle', () => {
    spotifyState.current = {
      tracks: [{ id: 'default-track' }],
      isLoading: false,
      error: null,
    };

    render(<SpotifyReveal />);

    expect(observerConstructor).not.toHaveBeenCalled();
    expect(document.querySelector('.listening-easter-egg__reveal')).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: "Show Noah's listening context" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('spotify-track-default-track')).toBeInTheDocument();
    expect(spotifyHook.fetchSpotifyTracksAndPalettes).not.toHaveBeenCalled();
  });

  it('renders the easter egg without throwing when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    expect(() => render(<SpotifyReveal variant="easter-egg" />)).not.toThrow();
    expect(document.querySelector('.listening-easter-egg__reveal')).not.toHaveAttribute(
      'data-callout-visible',
    );
  });
});

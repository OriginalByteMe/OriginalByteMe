import { createElement, type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SiteShell, { chooseListeningEasterEggSlot } from '@/components/SiteShell';
import { makeStore } from '@/lib/store';

const askMeState = vi.hoisted(() => ({ mode: 'home' as 'home' | 'streaming' | 'answer' }));
const spotifyHook = vi.hoisted(() => ({ fetchSpotifyTracksAndPalettes: vi.fn() }));

vi.mock('@/components/AskMeProvider', () => ({
  useAskMe: () => askMeState,
}));
vi.mock('@/lib/hooks/useSpotify', () => ({
  default: () => spotifyHook,
}));
vi.mock('@/components/Hero', () => ({ default: () => <div>Hero surface</div> }));
vi.mock('@/components/PortfolioCanvas', () => ({
  default: () => (
    <div>
      <section data-testid="chapter-1">Chapter one</section>
      <section data-testid="chapter-2">Chapter two</section>
      <section data-testid="chapter-3">Chapter three</section>
      <section data-testid="chapter-4">Chapter four</section>
      <section data-testid="chapter-5">Chapter five</section>
    </div>
  ),
}));
vi.mock('@/components/CompactHeader', () => ({ default: () => <header>Compact header</header> }));
vi.mock('@/components/AskDock', () => ({ default: () => <div>Ask dock</div> }));
vi.mock('@/components/ThemeSwitch', () => ({
  ThemeSwitch: () => <button type="button" aria-label="Toggle color theme" aria-pressed="false">Theme</button>,
}));
vi.mock('next/image', () => ({
  default: (rawProps: ComponentProps<'img'> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => {
    const { fill, priority, unoptimized, ...props } = rawProps;
    void fill;
    void priority;
    void unoptimized;
    return createElement('img', props);
  },
}));

beforeEach(() => {
  askMeState.mode = 'home';
  spotifyHook.fetchSpotifyTracksAndPalettes.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('site-wide listening easter egg', () => {
  it('maps deterministic random values only to distributed allowlisted slots', () => {
    expect(chooseListeningEasterEggSlot(() => 0)).toBe('hero-edge-left');
    expect(chooseListeningEasterEggSlot(() => 0.17)).toBe('hero-edge-right');
    expect(chooseListeningEasterEggSlot(() => 0.34)).toBe('chapter-1-left');
    expect(chooseListeningEasterEggSlot(() => 0.99)).toBe('chapter-5-right');
    expect(chooseListeningEasterEggSlot(() => 1)).toBe('chapter-5-right');
  });

  it('chooses once after hydration, persists the slot, and exposes the concise CTA', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    render(
      <Provider store={makeStore()}>
        <SiteShell />
      </Provider>,
    );

    const easterEgg = await screen.findByTestId('listening-easter-egg');
    expect(easterEgg).toHaveAttribute('data-slot', 'chapter-5-right');
    expect(easterEgg).toHaveAttribute('data-align', 'right');
    expect(easterEgg.parentElement).toHaveClass('listening-easter-egg-layer');
    expect(easterEgg.closest('[data-listening-section="5"]')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('listeningEasterEggSlot')).toBe('chapter-5-right');
    expect(screen.getByText('Want to know what I’m listening to?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Show Noah's listening context" })).toHaveAttribute('aria-expanded', 'false');

    cleanup();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(
      <Provider store={makeStore()}>
        <SiteShell />
      </Provider>,
    );

    expect(await screen.findByTestId('listening-easter-egg')).toHaveAttribute('data-slot', 'chapter-5-right');
  });

  it('keeps one primary navigation and theme control in persistent site chrome across modes', async () => {
    const { rerender } = render(
      <Provider store={makeStore()}>
        <SiteShell />
      </Provider>,
    );

    const chrome = document.querySelector('.site-top-chrome');
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    const story = screen.getByRole('link', { name: "Read Noah's story" });
    const blog = screen.getByRole('link', { name: "Read Noah's blog" });
    const theme = screen.getByRole('button', { name: 'Toggle color theme' });

    expect(document.querySelectorAll('.site-top-chrome')).toHaveLength(1);
    expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(1);
    expect(navigation).toHaveClass('site-primary-nav');
    expect(navigation.closest('.site-top-chrome')).toBe(chrome);
    expect(story).toHaveAttribute('href', '#story');
    expect(blog).toHaveAttribute('href', 'https://blog.noahrijkaard.com');
    expect(blog).toHaveAttribute('target', '_blank');
    expect(blog).toHaveAttribute('rel', 'noreferrer noopener');
    expect(theme.closest('.site-theme-toggle')?.parentElement).toBe(chrome);
    expect(screen.getAllByRole('button', { name: 'Toggle color theme' })).toHaveLength(1);
    expect(document.querySelector('.profile-nav')).not.toBeInTheDocument();

    askMeState.mode = 'answer';
    rerender(
      <Provider store={makeStore()}>
        <SiteShell />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByText('Compact header')).toBeInTheDocument());
    expect(document.querySelectorAll('.site-top-chrome')).toHaveLength(1);
    expect(document.querySelector('.site-top-chrome')).toBe(chrome);
    expect(screen.getAllByRole('navigation', { name: 'Primary navigation' })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toContainElement(
      screen.getByRole('link', { name: "Read Noah's story" }),
    );
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toContainElement(
      screen.getByRole('link', { name: "Read Noah's blog" }),
    );
    expect(screen.getAllByRole('button', { name: 'Toggle color theme' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Toggle color theme' }).closest('.site-top-chrome')).toBe(chrome);
  });

  it('opens the existing Spotify archive on activation and fetches only when empty', async () => {
    render(
      <Provider store={makeStore()}>
        <SiteShell />
      </Provider>,
    );

    const trigger = await screen.findByRole('button', { name: "Show Noah's listening context" });
    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: "Hide Noah's listening context" })).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('listening-easter-egg-archive')).toBeInTheDocument();
    await waitFor(() => expect(spotifyHook.fetchSpotifyTracksAndPalettes).toHaveBeenCalledTimes(1));
  });

  it('keeps track selection wired to the portrait palette state', async () => {
    const track = {
      id: 'track-1',
      title: 'Night Drive',
      artist: 'The Operators',
      albumCover: '',
      songUrl: 'https://open.spotify.com/track/track-1',
      colourPalette: [[34, 29, 47], [157, 143, 242]],
    };
    const store = makeStore({
      spotify: {
        tracks: [track],
        isLoading: false,
        error: null,
        selectedTrack: null,
      },
    });

    render(
      <Provider store={store}>
        <SiteShell />
      </Provider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: "Show Noah's listening context" }));
    expect(screen.getByTestId('spotify-pill')).toBeInTheDocument();
    const paletteAction = screen.getByRole('button', { name: 'Use Night Drive for the portrait palette' });
    paletteAction.focus();
    expect(paletteAction).toHaveFocus();
    fireEvent.click(paletteAction);

    expect(store.getState().spotify.selectedTrack).toEqual(track);
    expect(screen.getByRole('button', { name: 'Remove Night Drive from the portrait palette' })).toBeInTheDocument();
    expect(spotifyHook.fetchSpotifyTracksAndPalettes).not.toHaveBeenCalled();
  });
});

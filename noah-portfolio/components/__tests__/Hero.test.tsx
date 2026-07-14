import { createElement, type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Hero from '@/components/Hero';
import { ThemeProvider } from '@/components/ThemeProvider';
import { makeStore } from '@/lib/store';

vi.mock('next/image', () => ({
  default: (rawProps: ComponentProps<'img'> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    const { fill, priority, unoptimized, ...props } = rawProps;
    void fill;
    void priority;
    void unoptimized;
    return createElement('img', props);
  },
}));

vi.mock('@paper-design/shaders-react', () => ({
  ImageDithering: () => <div data-testid="portrait-dither" />,
}));

vi.mock('@/components/ChatBox', () => ({
  default: () => <label>Question for Noah<input aria-label="Question for Noah" /></label>,
}));

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  });
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Hero interaction composition', () => {
  it('surrounds the portrait with independent destinations outside its pointer surface', () => {
    render(
      <Provider store={makeStore()}>
        <ThemeProvider>
          <Hero />
        </ThemeProvider>
      </Provider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /Noah Rijkaard/ })).toHaveAttribute('id', 'profile-heading');
    const portrait = screen.getByRole('img', { name: 'Portrait of Noah Rijkaard' });
    expect(portrait).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument();
    expect(document.querySelector('.profile-nav')).not.toBeInTheDocument();

    expect(screen.queryByRole('complementary', { name: 'Contact and destinations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Listening context' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('compact-spotify')).not.toBeInTheDocument();

    const destinations = screen.getByRole('navigation', { name: 'Contact destinations' });
    expect(destinations).not.toHaveClass('hero-panel');
    const email = screen.getByRole('link', { name: 'Email Noah' });
    const github = screen.getByRole('link', { name: 'Visit Noah on GitHub' });
    const linkedin = screen.getByRole('link', { name: 'Visit Noah on LinkedIn' });
    expect(email).toHaveAttribute('href', 'mailto:noahrijkaard@gmail.com');
    expect(email).toHaveAttribute('data-contact-anchor', 'upper-left');
    expect(github).toHaveAttribute('href', 'https://github.com/OriginalByteMe');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noreferrer noopener');
    expect(github).toHaveAttribute('data-contact-anchor', 'middle-right');
    expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/noah-rijkaard/');
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noreferrer noopener');
    expect(linkedin).toHaveAttribute('data-contact-anchor', 'lower-left');
    expect(portrait.closest('figure')).not.toContainElement(email);
    expect(portrait.closest('figure')).not.toContainElement(github);
    expect(portrait.closest('figure')).not.toContainElement(linkedin);
    expect(screen.getByRole('tooltip', { name: 'Email me' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: 'See my GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip', { name: 'Connect on LinkedIn' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Toggle color theme' })).not.toBeInTheDocument();
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('reveals the centered Ask-Me composer and prompt routes only after activation', async () => {
    render(
      <Provider store={makeStore()}>
        <ThemeProvider>
          <Hero />
        </ThemeProvider>
      </Provider>,
    );

    const askRegion = screen.getByRole('region', { name: 'Ask-Me' });
    expect(askRegion).toHaveAttribute('data-state', 'collapsed');
    expect(askRegion).not.toHaveClass('hero-panel');
    const launcher = screen.getByRole('button', { name: 'Open Ask-Me composer' });
    expect(launcher).toHaveClass('ask-launcher-button');
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Ask this portfolio anything')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Question for Noah' })).not.toBeInTheDocument();
    expect(screen.queryByText('Where should we begin?')).not.toBeInTheDocument();

    fireEvent.click(launcher);

    expect(askRegion).toHaveAttribute('data-state', 'expanded');
    expect(screen.getByRole('button', { name: 'Ask-Me composer is open' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Where should we begin?' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Question for Noah' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Ask-Me' }));

    expect(screen.queryByRole('textbox', { name: 'Question for Noah' })).not.toBeInTheDocument();
    const restoredLauncher = screen.getByRole('button', { name: 'Open Ask-Me composer' });
    await waitFor(() => expect(restoredLauncher).toHaveFocus());
  });

  it('keeps a selected Spotify track tied to portrait tinting without restoring listening UI', () => {
    const selectedTrack = {
      id: 'signal-1',
      title: 'Night Drive',
      artist: 'The Operators',
      albumCover: '/album-cover.jpg',
      songUrl: 'https://open.spotify.com/track/signal-1',
      colourPalette: [[34, 29, 47], [157, 143, 242]],
    };
    const store = makeStore({
      spotify: {
        tracks: [selectedTrack],
        isLoading: false,
        error: null,
        selectedTrack,
      },
    });

    render(
      <Provider store={store}>
        <ThemeProvider>
          <Hero />
        </ThemeProvider>
      </Provider>,
    );

    expect(screen.getByText(/tinted by Night Drive/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Listening context' })).not.toBeInTheDocument();
    expect(screen.queryByText('The Operators')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Show Noah's listening context" })).not.toBeInTheDocument();
  });
});

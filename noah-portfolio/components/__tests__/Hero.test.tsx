import { createElement, type ComponentProps, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AskMeProvider } from '@/components/AskMeProvider';
import Hero from '@/components/Hero';
import CharacterWorld from '@/components/character/CharacterWorld';
import { ThemeProvider } from '@/components/ThemeProvider';
import { makeStore } from '@/lib/store';
import type { WorldContent } from '@/lib/character/world-content';

const { createScene, scene } = vi.hoisted(() => ({
  scene: { dispose: vi.fn(), visit: vi.fn(), setPaused: vi.fn(), key: vi.fn(), wave: vi.fn(), reset: vi.fn(), skipIntro: vi.fn(), setSoundEnabled: vi.fn(), setMusicEnabled: vi.fn() },
  createScene: vi.fn(),
}));
vi.mock('@/components/character/create-character-scene', () => ({ createCharacterScene: createScene }));

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

const content: WorldContent = {
  projects: [
    { slug: 'moodify', title: 'Moodify', description: 'Playlists that follow your mood.', url: 'https://github.com/OriginalByteMe/Moodify', image: '', tech: [{ name: 'Next.js', icon: '/icons/next-js.svg' }, { name: 'Spotify API', icon: '/icons/spotify.svg' }] },
    { slug: 'ai-image-cutout', title: 'AI Image Cutout Tool', description: 'Cuts subjects out of photos.', url: '', image: '', tech: [{ name: 'Python', icon: '/icons/python.svg' }] },
  ],
  skills: [{ category: 'Databases', skills: [{ name: 'PostgreSQL', icon: '/icons/postgresql.svg' }, { name: 'Redis', icon: '/icons/redis.svg' }] }, { category: 'AI & LLM Tooling', skills: [{ name: 'LangChain', icon: '/icons/langchain.png' }] }],
  headline: 'Full-Stack Developer',
  location: 'Kuala Lumpur, Malaysia',
  career: [{ company: 'MerchantSpring', role: 'Senior AI Engineer', period: '2026 - Present', logo: '', url: '', highlights: [] }, { company: 'Bowiq', role: 'CAD Designer & 3D Printing Engineer', period: '2023 - Present', logo: '', url: '', highlights: [] }],
  funFacts: ['Self-hosts on Proxmox + Unraid'],
};
let reducedMotion = true;
let intersect: IntersectionObserverCallback;
const providers = (children: ReactNode, store = makeStore()) => <Provider store={store}><ThemeProvider><AskMeProvider>{children}</AskMeProvider></ThemeProvider></Provider>;

beforeEach(() => {
  reducedMotion = true;
  createScene.mockResolvedValue(scene);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  });
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query.includes('prefers-reduced-motion') && reducedMotion,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {} disconnect() {} unobserve() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Hero interaction composition', () => {
  it('surrounds the portrait with independent destinations outside its pointer surface', () => {
    render(providers(<CharacterWorld content={content} />));

    expect(screen.getByRole('heading', { level: 1, name: /Hi, I’m Noah Rijkaard/ })).toHaveAttribute('id', 'profile-heading');
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
    expect(github).toHaveAttribute('href', 'https://github.com/OriginalByteMe');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noreferrer noopener');
    expect(linkedin).toHaveAttribute('href', 'https://www.linkedin.com/in/noah-rijkaard/');
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noreferrer noopener');
    expect(portrait.closest('figure')).not.toContainElement(email);
    expect(portrait.closest('figure')).not.toContainElement(github);
    expect(portrait.closest('figure')).not.toContainElement(linkedin);
    expect(destinations).toHaveClass('immersive-hero__contacts');

    expect(screen.queryByRole('button', { name: 'Toggle color theme' })).not.toBeInTheDocument();
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('leaves asking to the always-open Ask bar instead of a hero launcher', () => {
    render(providers(<Hero />));

    expect(screen.getByRole('heading', { level: 1, name: /Hi, I’m Noah Rijkaard/ })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Ask-Me' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ask-Me|ask this portfolio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
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

    render(providers(<CharacterWorld content={content} />, store));

    expect(screen.getByText(/tinted by Night Drive/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Listening context' })).not.toBeInTheDocument();
    expect(screen.queryByText('The Operators')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Show Noah's listening context" })).not.toBeInTheDocument();
  });
});

describe('Character world sections', () => {
  it('keeps every project, skill group and about fact readable as plain DOM in the portrait fallback', () => {
    render(providers(<CharacterWorld content={content} />));
    expect(screen.getByTestId('character-world')).toHaveAttribute('data-status', 'fallback');
    expect(createScene).not.toHaveBeenCalled();

    const lab = screen.getByRole('region', { name: 'Things I’ve built' });
    expect(lab).toHaveAttribute('id', 'lab');
    for (const project of content.projects) {
      const card = within(lab).getByRole('heading', { level: 3, name: project.title }).closest('li')!;
      expect(card).toHaveTextContent(project.description);
      expect(card).toHaveTextContent(project.tech.map((tech) => tech.name).join(' · '));
    }
    expect(within(lab).getByRole('link', { name: /Visit Moodify/ })).toHaveAttribute('href', 'https://github.com/OriginalByteMe/Moodify');
    expect(within(lab).queryByRole('link', { name: /Visit AI Image Cutout Tool/ })).not.toBeInTheDocument();
    expect(within(lab).getByText('Databases').nextSibling).toHaveTextContent(/^PostgreSQL, Redis\s*$/);
    expect(within(lab).getByText('AI & LLM Tooling')).toBeInTheDocument();
    expect(within(lab).queryByRole('button', { name: /Show me/ })).not.toBeInTheDocument();

    const about = screen.getByRole('region', { name: 'About me' });
    expect(about).toHaveAttribute('id', 'about');
    expect(about).toHaveTextContent('Full-Stack Developer, based in Kuala Lumpur, Malaysia.');
    expect(within(about).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Senior AI Engineer at MerchantSpring 2026 - Present',
      'CAD Designer & 3D Printing Engineer at Bowiq 2023 - Present',
      'Self-hosts on Proxmox + Unraid',
    ]);
    expect(within(about).getByRole('img', { name: 'Framed hero portrait of Noah Rijkaard' })).toHaveAttribute('src', '/hero.png');
  });

  it('offers Show me buttons only once the scene is live, sending him to that exhibit', async () => {
    reducedMotion = false;
    render(providers(<CharacterWorld content={content} />));
    await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getByTestId('character-world')).toHaveAttribute('data-status', 'ready'));
    expect(createScene.mock.calls[0][1].content).toBe(content);
    fireEvent.click(screen.getByRole('button', { name: 'Show me Moodify' }));
    expect(scene.visit).toHaveBeenLastCalledWith('project:moodify');
    fireEvent.click(screen.getByRole('button', { name: 'Show me the AI & LLM Tooling wall' }));
    expect(scene.visit).toHaveBeenLastCalledWith('skills:ai-llm-tooling');
    for (const panel of document.querySelectorAll('.character-world__panel')) expect(panel).toHaveAttribute('data-character-ui');
  });
});

import { createElement, type ComponentProps, type ReactNode } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Hero from '@/components/Hero';
import CharacterWorld from '@/components/character/CharacterWorld';
import { ThemeProvider } from '@/components/ThemeProvider';
import { makeStore } from '@/lib/store';
import { corpus } from '@/lib/corpus';
import { worldContent } from '@/lib/character/world-content';

const { createScene, scene } = vi.hoisted(() => ({
  scene: { dispose: vi.fn(), setPaused: vi.fn(), key: vi.fn(), wave: vi.fn(), reset: vi.fn(), skipIntro: vi.fn(), setSoundEnabled: vi.fn(), setMusicEnabled: vi.fn() },
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

const content = worldContent(corpus);
let reducedMotion = true;
let intersect: IntersectionObserverCallback;
const providers = (children: ReactNode, store = makeStore()) => <Provider store={store}><ThemeProvider>{children}</ThemeProvider></Provider>;

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
  it('gives every lot a section in street order whose chapter facts are screen-reader text, not visible panels', () => {
    render(providers(<CharacterWorld content={content} />));
    expect(screen.getByTestId('character-world')).toHaveAttribute('data-status', 'fallback');
    expect(createScene).not.toHaveBeenCalled();
    const sections = [...document.querySelectorAll('.character-world > section')];
    expect(sections.map((section) => section.id)).toEqual(['hero', 'brief', 'built', 'toolbox', 'about', 'rig', 'say-hi']);
    for (const section of sections.slice(1)) expect(section.firstElementChild).toHaveClass('sr-only');

    const brief = screen.getByRole('region', { name: 'Noah, in brief' });
    expect(brief).toHaveTextContent(content.brief);
    expect(brief).toHaveTextContent('Full-Stack Developer in Kuala Lumpur, Malaysia.');
    expect(brief).toHaveTextContent('6 yrs shipping software');

    const built = screen.getByRole('region', { name: 'Things I’ve built' });
    for (const project of content.projects) {
      const card = within(built).getByRole('heading', { level: 3, name: project.title }).closest('li')!;
      expect(card).toHaveTextContent(project.description);
      expect(card).toHaveTextContent(`Built with ${project.tech.map((tech) => tech.name).join(', ')}.`);
      const link = within(card).getByRole('link', { name: `Visit ${project.title}` });
      expect(link).toHaveAttribute('href', project.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    }

    const toolbox = screen.getByRole('region', { name: 'The toolbox' });
    for (const group of content.skills) expect(within(toolbox).getByText(group.category).nextSibling).toHaveTextContent(group.skills.map((skill) => skill.name).join(', '));

    const about = screen.getByRole('region', { name: 'About me and where I’ve been' });
    const merchantSpring = within(about).getByRole('heading', { level: 3, name: 'Senior AI Engineer at MerchantSpring' }).closest('li')!;
    expect(merchantSpring).toHaveTextContent('2026 - Present');
    expect(merchantSpring).toHaveTextContent('Building marketplace analytics for e-commerce sellers and agencies');
    expect(about).toHaveTextContent('Self-hosts on Proxmox + Unraid');

    const rig = screen.getByRole('region', { name: 'The rig' });
    expect(within(rig).getByText('Linux Environment').nextSibling).toHaveTextContent('Linux, Debian, Ubuntu');
    expect(within(rig).getByRole('link', { name: 'Visit My blog!' })).toHaveAttribute('href', 'https://blog.noahrijkaard.com');
    expect(rig).toHaveTextContent('3D Printing');

    const sayHi = screen.getByRole('region', { name: 'Say hi' });
    expect(within(sayHi).getByRole('link', { name: 'Email noahrijkaard@gmail.com' })).toHaveAttribute('href', 'mailto:noahrijkaard@gmail.com');
    expect(within(sayHi).getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/OriginalByteMe');
  });

  it('hands the scene its content and never offers Show me buttons once it is live', async () => {
    reducedMotion = false;
    render(providers(<CharacterWorld content={content} />));
    await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getByTestId('character-world')).toHaveAttribute('data-status', 'ready'));
    expect(createScene.mock.calls[0][1].content).toBe(content);
    expect(screen.queryByRole('button', { name: /Show me/ })).not.toBeInTheDocument();
  });
});

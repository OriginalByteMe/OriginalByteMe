import { createRef, type MutableRefObject } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeroCharacter from '@/components/character/HeroCharacter';
import type { CharacterScene } from '@/components/character/create-character-scene';
import type { WorldContent } from '@/lib/character/world-content';

const { createScene, api } = vi.hoisted(() => ({
  api: {
    dispose: vi.fn(), wave: vi.fn(), skipIntro: vi.fn(), reset: vi.fn(), key: vi.fn(() => true), setPaused: vi.fn(), visit: vi.fn(),
    setSoundEnabled: vi.fn(async (enabled: boolean) => enabled), setMusicEnabled: vi.fn(async (enabled: boolean) => enabled),
  },
  createScene: vi.fn(),
}));
vi.mock('@/components/character/create-character-scene', () => ({ createCharacterScene: createScene }));
let intersect: IntersectionObserverCallback;
let preferenceChanged: () => void;
let reduce = false;
const fallback = <figure data-testid="fallback">Original portrait</figure>;
const content: WorldContent = { projects: [], skills: [], headline: 'Full-Stack Developer', location: 'Kuala Lumpur, Malaysia', career: [], funFacts: [] };
const visibleNow = () => act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

beforeEach(() => {
  vi.clearAllMocks(); reduce = false;
  createScene.mockResolvedValue(api);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return reduce; }, addEventListener: (_event: string, callback: () => void) => { preferenceChanged = callback; }, removeEventListener: vi.fn() })));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {} disconnect() {} unobserve() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function load(props: Partial<Parameters<typeof HeroCharacter>[0]> = {}) {
  render(<HeroCharacter fallback={fallback} content={content} {...props} />);
  await visibleNow();
  await waitFor(() => expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready'));
}
describe('HeroCharacter progressive enhancement', () => {
  it('opens on the black title card, never the portrait, while the world loads', async () => {
    render(<HeroCharacter fallback={fallback} content={content} />);
    expect(screen.getByText('Noah Rijkaard.')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument(); expect(createScene).not.toHaveBeenCalled();
    await visibleNow();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible());
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    expect(createScene.mock.calls[0][1].content).toBe(content);
  });
  it('does not import/create a scene for reduced motion and reports the fallback', () => {
    reduce = true;
    const onStatus = vi.fn();
    render(<HeroCharacter fallback={fallback} content={content} onStatus={onStatus} />);
    expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'fallback');
    expect(onStatus).toHaveBeenLastCalledWith('fallback');
    expect(createScene).not.toHaveBeenCalled(); expect(screen.getByTestId('fallback')).toBeVisible();
  });
  it('falls back cleanly on load or WebGL failure', async () => {
    createScene.mockRejectedValue(new Error('WebGL unavailable'));
    render(<HeroCharacter fallback={fallback} content={content} />);
    await visibleNow();
    expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'fallback');
    expect(screen.getByTestId('fallback')).toBeVisible();
    expect(screen.queryByText('Noah Rijkaard.')).not.toBeInTheDocument();
  });
  it('shares the live scene with the world panels and reports readiness', async () => {
    const sceneRef = createRef<CharacterScene>() as MutableRefObject<CharacterScene | null>;
    const onStatus = vi.fn();
    await load({ sceneRef, onStatus });
    expect(sceneRef.current).toBe(api);
    expect(onStatus).toHaveBeenLastCalledWith('ready');
    fireEvent.click(screen.getByRole('button', { name: 'Portrait' }));
    expect(sceneRef.current).toBeNull();
    expect(onStatus).toHaveBeenLastCalledWith('fallback');
  });
  it('supports pause, resume, wave, keyboard, reset and reversible portrait mode', async () => {
    await load();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' })); expect(api.setPaused).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' })); expect(api.setPaused).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: /Say hi/ })); expect(api.wave).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByTestId('character-playground'), { key: 'ArrowLeft' }); expect(api.key).toHaveBeenCalledWith('ArrowLeft');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' })); expect(api.reset).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Portrait' })); expect(api.dispose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('fallback')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to playground' }));
    await visibleNow();
    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(2));
  });
  it('starts sound and music at the first click or key press anywhere, and the toggles still mute them', async () => {
    await load();
    expect(screen.getByRole('button', { name: 'Mute character sound' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Stop music' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.setSoundEnabled).not.toHaveBeenCalled(); expect(api.setMusicEnabled).not.toHaveBeenCalled();
    await act(async () => { fireEvent.keyDown(document.body, { key: 'a' }); });
    expect(api.setSoundEnabled).toHaveBeenCalledWith(true); expect(api.setMusicEnabled).toHaveBeenCalledWith(true);
    await act(async () => { fireEvent.click(document.body); });
    expect(api.setSoundEnabled).toHaveBeenCalledOnce(); expect(api.setMusicEnabled).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Mute character sound' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enable character sound' })).toHaveAttribute('aria-pressed', 'false'));
    expect(api.setSoundEnabled).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop music' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play music' })).toHaveAttribute('aria-pressed', 'false'));
    expect(api.setMusicEnabled).toHaveBeenLastCalledWith(false);
  });
  it('retries on the next gesture when the browser refuses audio, and a refused toggle stays off', async () => {
    api.setSoundEnabled.mockResolvedValueOnce(false); api.setMusicEnabled.mockResolvedValueOnce(false);
    await load();
    await act(async () => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(api.setMusicEnabled).toHaveBeenCalledOnce();
    await act(async () => { fireEvent.click(document.body); });
    expect(api.setMusicEnabled).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Stop music' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play music' })).toHaveAttribute('aria-pressed', 'false'));
    api.setMusicEnabled.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Play music' }));
    await waitFor(() => expect(api.setMusicEnabled).toHaveBeenLastCalledWith(true));
    expect(screen.getByRole('button', { name: 'Play music' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('shows greeting text in a polite, non-blocking speech bubble', async () => {
    await load();
    act(() => createScene.mock.calls[0][1].onGreeting("Stop, don't do that."));
    expect(screen.getByRole('status')).toHaveTextContent("Stop, don't do that.");
    act(() => createScene.mock.calls[0][1].onGreeting(null));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('disposes a scene when preference changes to reduced motion', async () => {
    await load(); reduce = true; act(() => preferenceChanged());
    expect(api.dispose).toHaveBeenCalledOnce(); expect(screen.getByTestId('fallback')).toBeVisible();
  });
  it('disposes a late asset completion after unmount', async () => {
    const { promise, resolve } = Promise.withResolvers<typeof api>();
    createScene.mockReturnValue(promise);
    const result = render(<HeroCharacter fallback={fallback} content={content} />);
    act(() => { void intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
    await waitFor(() => expect(createScene).toHaveBeenCalledOnce());
    result.unmount(); await act(async () => resolve(api)); expect(api.dispose).toHaveBeenCalledOnce();
  });
});

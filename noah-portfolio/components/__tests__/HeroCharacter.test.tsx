import { createRef, type MutableRefObject } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AskMeProvider, useAskMe } from '@/components/AskMeProvider';
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
/** What the Ask bar's arrow reads from the shared context. */
function Promoted() { return <span data-testid="promoted">{String(useAskMe().askPromoted)}</span>; }
const hero = (props: Partial<Parameters<typeof HeroCharacter>[0]> = {}) => render(<AskMeProvider><HeroCharacter fallback={fallback} content={content} {...props} /><Promoted /></AskMeProvider>);

beforeEach(() => {
  vi.clearAllMocks(); reduce = false;
  createScene.mockResolvedValue(api);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return reduce; }, addEventListener: (_event: string, callback: () => void) => { preferenceChanged = callback; }, removeEventListener: vi.fn() })));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {} disconnect() {} unobserve() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function load(props: Partial<Parameters<typeof HeroCharacter>[0]> = {}, enter = true) {
  const result = hero(props);
  await visibleNow();
  await waitFor(() => expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready'));
  if (enter) await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Click to enter' })); });
  return result;
}
const options = () => createScene.mock.calls[0][1];
describe('HeroCharacter progressive enhancement', () => {
  it('opens on the black title card, never the portrait, while the world loads', async () => {
    hero();
    expect(screen.getByText('Noah Rijkaard.')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument(); expect(createScene).not.toHaveBeenCalled();
    await visibleNow();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Click to enter' })).toBeVisible());
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    expect(createScene.mock.calls[0][1].content).toBe(content);
  });
  it('does not import/create a scene for reduced motion and reports the fallback', () => {
    reduce = true;
    const onStatus = vi.fn();
    hero({ onStatus });
    expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'fallback');
    expect(onStatus).toHaveBeenLastCalledWith('fallback');
    expect(createScene).not.toHaveBeenCalled(); expect(screen.getByTestId('fallback')).toBeVisible();
  });
  it('falls back cleanly on load or WebGL failure', async () => {
    createScene.mockRejectedValue(new Error('WebGL unavailable'));
    hero();
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
  it('holds the intro on the title card until the visitor clicks to enter, which starts sound and music', async () => {
    await load({}, false);
    expect(api.setPaused).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    expect(api.setSoundEnabled).not.toHaveBeenCalled(); expect(api.setMusicEnabled).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Click to enter' })); });
    expect(api.setPaused).toHaveBeenLastCalledWith(false);
    expect(api.setSoundEnabled).toHaveBeenCalledWith(true); expect(api.setMusicEnabled).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Click to enter' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute character sound' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Mute character sound' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enable character sound' })).toHaveAttribute('aria-pressed', 'false'));
    expect(api.setSoundEnabled).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop music' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play music' })).toHaveAttribute('aria-pressed', 'false'));
    expect(api.setMusicEnabled).toHaveBeenLastCalledWith(false);
  });
  it('shows sound and music as off when the browser refuses them, and a later toggle can still turn them on', async () => {
    api.setSoundEnabled.mockResolvedValueOnce(false); api.setMusicEnabled.mockResolvedValueOnce(false);
    await load();
    expect(screen.getByRole('button', { name: 'Enable character sound' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Play music' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Play music' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop music' })).toHaveAttribute('aria-pressed', 'true'));
  });
  it('shows greeting text in a polite, non-blocking speech bubble', async () => {
    await load();
    act(() => options().onGreeting("Stop, don't do that."));
    expect(screen.getByRole('status')).toHaveTextContent("Stop, don't do that.");
    act(() => options().onGreeting(null));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('puts a real Visit link where the scene reports his sign, opening a new tab, and takes it down on null', async () => {
    await load();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    act(() => options().onSign({ url: 'https://github.com/OriginalByteMe/Moodify', label: 'Visit Moodify', x: 420, y: 310 }));
    const sign = screen.getByRole('link', { name: /Visit Moodify/ });
    expect(sign).toHaveAttribute('href', 'https://github.com/OriginalByteMe/Moodify');
    expect(sign).toHaveAttribute('target', '_blank');
    expect(sign).toHaveAttribute('rel', 'noreferrer noopener');
    expect(sign).toHaveStyle({ left: '420px', top: '310px' });
    act(() => options().onSign(null));
    expect(screen.queryByRole('link', { name: /Visit Moodify/ })).not.toBeInTheDocument();
  });
  it('promotes the Ask bar while he points at it, until the visitor first does something', async () => {
    await load();
    expect(screen.getByTestId('promoted')).toHaveTextContent('false');
    act(() => options().onAskPromoted());
    expect(screen.getByTestId('promoted')).toHaveTextContent('true');
    act(() => { fireEvent.keyDown(window, { key: 'a' }); });
    expect(screen.getByTestId('promoted')).toHaveTextContent('false');
    act(() => options().onAskPromoted());
    expect(screen.getByTestId('promoted')).toHaveTextContent('true');
    act(() => { fireEvent.pointerDown(document.body); });
    expect(screen.getByTestId('promoted')).toHaveTextContent('false');
  });
  it('takes the Ask bar promotion down on its own after seven seconds, or when the hero goes away', async () => {
    const { rerender } = await load();
    vi.useFakeTimers();
    act(() => options().onAskPromoted());
    act(() => { vi.advanceTimersByTime(6900); });
    expect(screen.getByTestId('promoted')).toHaveTextContent('true');
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByTestId('promoted')).toHaveTextContent('false');
    act(() => options().onAskPromoted());
    rerender(<AskMeProvider><Promoted /></AskMeProvider>);
    expect(screen.getByTestId('promoted')).toHaveTextContent('false');
  });
  it('disposes a scene when preference changes to reduced motion', async () => {
    await load(); reduce = true; act(() => preferenceChanged());
    expect(api.dispose).toHaveBeenCalledOnce(); expect(screen.getByTestId('fallback')).toBeVisible();
  });
  it('disposes a late asset completion after unmount', async () => {
    const { promise, resolve } = Promise.withResolvers<typeof api>();
    createScene.mockReturnValue(promise);
    const result = hero();
    act(() => { void intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
    await waitFor(() => expect(createScene).toHaveBeenCalledOnce());
    result.unmount(); await act(async () => resolve(api)); expect(api.dispose).toHaveBeenCalledOnce();
  });
});

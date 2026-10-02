import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeroCharacter from '@/components/character/HeroCharacter';

const { createScene, api } = vi.hoisted(() => ({
  api: { dispose: vi.fn(), wave: vi.fn(), reset: vi.fn(), key: vi.fn(() => true), setPaused: vi.fn() },
  createScene: vi.fn(),
}));
vi.mock('@/components/character/create-character-scene', () => ({ createCharacterScene: createScene }));
let intersect: IntersectionObserverCallback;
let preferenceChanged: () => void;
let reduce = false;
const fallback = <figure data-testid="fallback">Original portrait</figure>;

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
async function load() {
  render(<HeroCharacter fallback={fallback} />);
  await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  await waitFor(() => expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'ready'));
}
describe('HeroCharacter progressive enhancement', () => {
  it('keeps the portrait until visible and replaces it only after loading', async () => {
    render(<HeroCharacter fallback={fallback} />);
    expect(screen.getByTestId('fallback')).toBeVisible(); expect(createScene).not.toHaveBeenCalled();
    await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible());
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });
  it('does not import/create a scene for reduced motion', () => {
    reduce = true; render(<HeroCharacter fallback={fallback} />);
    expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'fallback');
    expect(createScene).not.toHaveBeenCalled(); expect(screen.getByTestId('fallback')).toBeVisible();
  });
  it('falls back cleanly on load or WebGL failure', async () => {
    createScene.mockRejectedValue(new Error('WebGL unavailable'));
    render(<HeroCharacter fallback={fallback} />);
    await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByTestId('character-hero')).toHaveAttribute('data-status', 'fallback');
    expect(screen.getByTestId('fallback')).toBeVisible();
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
    await act(async () => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(2));
  });
  it('disposes a scene when preference changes to reduced motion', async () => {
    await load(); reduce = true; act(() => preferenceChanged());
    expect(api.dispose).toHaveBeenCalledOnce(); expect(screen.getByTestId('fallback')).toBeVisible();
  });
  it('disposes a late asset completion after unmount', async () => {
    let resolve!: (value: typeof api) => void;
    createScene.mockReturnValue(new Promise((done) => { resolve = done; }));
    const result = render(<HeroCharacter fallback={fallback} />);
    act(() => { void intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
    await waitFor(() => expect(createScene).toHaveBeenCalledOnce());
    result.unmount(); await act(async () => resolve(api)); expect(api.dispose).toHaveBeenCalledOnce();
  });
});

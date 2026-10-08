import { vi } from 'vitest';

/** jsdom has no 2D canvas: every drawing call is a no-op, gradients accept stops, measureText reports a plausible width. */
export function stubCanvas2d() {
  const context = new Proxy({}, {
    get: (_, key) => key === 'measureText' ? (text: string) => ({ width: text.length * 8 }) : () => ({ addColorStop() {} }),
  });
  return vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
}

import { vi } from "vitest";

/**
 * jsdom has no modal dialogs or scrolling. This models what SiteTakeover relies on: showModal
 * remembers the focused element and close() hands focus back, which a browser skips once the
 * dialog has left the document. The `open` attribute keeps the dialog shown.
 */
export function stubDialog(): void {
  const opener = new WeakMap<HTMLDialogElement, Element | null>();
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      opener.set(this, document.activeElement);
    },
    close(this: HTMLDialogElement) {
      const element = opener.get(this);
      opener.delete(this);
      if (this.isConnected && element instanceof HTMLElement) element.focus();
    },
    scrollTo() {},
  });
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

/** What the page asked the browser's audio engine for; `sounds` counts every audible tick or click. */
export interface HeardAudio {
  contexts: number;
  resumes: number;
  sounds: number;
}

/** Installs a counting `AudioContext` so the real `lib/site/sound` module runs end to end. */
export function installFakeAudio(): HeardAudio {
  const heard: HeardAudio = { contexts: 0, resumes: 0, sounds: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const node = () => ({
    connect: <T>(next: T) => next,
    start() {},
    stop() {},
    gain: param(),
    frequency: param(),
    Q: param(),
  });

  class FakeAudioContext {
    state = "running";
    sampleRate = 8000;
    destination = node();
    createGain = node;
    createDynamicsCompressor = node;
    createBiquadFilter = node;
    constructor() {
      heard.contexts += 1;
    }
    // Follows Date so fake timers advance audio time with the clock.
    get currentTime() {
      return Date.now() / 1000;
    }
    resume() {
      heard.resumes += 1;
      return Promise.resolve();
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createOscillator() {
      heard.sounds += 1;
      return node();
    }
    createBufferSource() {
      heard.sounds += 1;
      return node();
    }
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);
  return heard;
}

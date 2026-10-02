import { describe, expect, it, vi } from "vitest";
import { CharacterMeepAudio, utteranceDuration } from "../audio";
import { CHARACTER_GREETINGS, GREETING_BEATS } from "../idle";

function fakeParam() {
  return {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

function makeOscillator() {
  return {
    type: "sine",
    frequency: fakeParam(),
    start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    onended: null as (() => void) | null,
  };
}

function makeGain() {
  return { gain: fakeParam(), connect: vi.fn(), disconnect: vi.fn() };
}

function fakeAudio() {
  const oscillators: ReturnType<typeof makeOscillator>[] = [];
  const gains: ReturnType<typeof makeGain>[] = [];
  const context = {
    state: "suspended" as AudioContextState,
    currentTime: 100,
    destination: {},
    createOscillator: vi.fn(() => {
      const oscillator = makeOscillator();
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gain = makeGain();
      gains.push(gain);
      return gain;
    }),
    resume: vi.fn(async () => { context.state = "running"; }),
    close: vi.fn(async () => { context.state = "closed"; }),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { context, factory, oscillators, gains };
}

describe("gesture-gated character meeps", () => {
  it("does not create an AudioContext or schedule sound before explicit enable", () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    expect(audio.enabled).toBe(false);
    expect(audio.playGreeting(CHARACTER_GREETINGS[0])).toBe(false);
    audio.cancel();
    audio.mute();
    expect(mock.factory).not.toHaveBeenCalled();
    expect(mock.oscillators).toHaveLength(0);
  });

  it("resumes only through enableFromGesture and uses quiet, finite original meeps", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    expect(await audio.enableFromGesture()).toBe(true);
    expect(audio.enabled).toBe(true);
    expect(mock.context.resume).toHaveBeenCalledOnce();
    expect(mock.oscillators).toHaveLength(0);
    expect(audio.playGreeting(CHARACTER_GREETINGS[0])).toBe(true);
    expect(mock.oscillators).toHaveLength(GREETING_BEATS.intro.length);
    expect(mock.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.12, 100);
    for (const [index, oscillator] of mock.oscillators.entries()) {
      const beat = GREETING_BEATS.intro[index];
      expect(oscillator.type).toBe("triangle");
      expect(oscillator.start).toHaveBeenCalledWith(100.015 + beat.at);
      expect(oscillator.stop).toHaveBeenCalledWith(100.015 + beat.at + beat.duration + 0.015);
      expect(mock.gains[index + 1].gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(0.26);
    }
    expect(await audio.enableFromGesture()).toBe(true);
    expect(mock.factory).toHaveBeenCalledOnce();
  });

  it("immediately cancels every pending or playing node without disabling sound", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    await audio.enableFromGesture();
    audio.playGreeting(CHARACTER_GREETINGS[0]);
    audio.cancel();
    for (const [index, oscillator] of mock.oscillators.entries()) {
      expect(oscillator.stop).toHaveBeenLastCalledWith(100);
      expect(oscillator.disconnect).toHaveBeenCalledOnce();
      expect(mock.gains[index + 1].gain.cancelScheduledValues).toHaveBeenCalledWith(100);
      expect(mock.gains[index + 1].disconnect).toHaveBeenCalledOnce();
      expect(oscillator.onended).toBeNull();
    }
    expect(audio.enabled).toBe(true);
    audio.cancel();
    expect(mock.oscillators[0].disconnect).toHaveBeenCalledOnce();
  });

  it("cancels the old sequence when replacing a greeting and cleans natural endings", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    await audio.enableFromGesture();
    audio.playGreeting(CHARACTER_GREETINGS[0]);
    const first = mock.oscillators[0];
    first.onended?.();
    expect(first.disconnect).toHaveBeenCalledOnce();
    audio.playGreeting(CHARACTER_GREETINGS[1]);
    expect(mock.oscillators[1].stop).toHaveBeenLastCalledWith(100);
    expect(first.disconnect).toHaveBeenCalledOnce();
    expect(mock.oscillators).toHaveLength(GREETING_BEATS.intro.length + GREETING_BEATS.hello.length);
  });

  it("mutes immediately and requires another explicit enable before playback", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    await audio.enableFromGesture();
    audio.playGreeting(CHARACTER_GREETINGS[0]);
    audio.mute();
    expect(audio.enabled).toBe(false);
    expect(audio.playGreeting(CHARACTER_GREETINGS[1])).toBe(false);
    expect(mock.oscillators[0].stop).toHaveBeenLastCalledWith(100);
    expect(await audio.enableFromGesture()).toBe(true);
    expect(audio.playGreeting(CHARACTER_GREETINGS[1])).toBe(true);
  });

  it("does not re-enable after a pending resume resolves following mute", async () => {
    const mock = fakeAudio();
    let finishResume: () => void = () => {};
    mock.context.resume.mockImplementation(() => new Promise<void>((resolve) => {
      finishResume = () => { mock.context.state = "running"; resolve(); };
    }));
    const audio = new CharacterMeepAudio(mock.factory);
    const enabling = audio.enableFromGesture();
    audio.mute();
    finishResume();
    expect(await enabling).toBe(false);
    expect(audio.enabled).toBe(false);
    expect(audio.playGreeting(CHARACTER_GREETINGS[0])).toBe(false);
  });

  it("closes context once on teardown and never recreates or resumes after disposal", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    await audio.enableFromGesture();
    audio.playGreeting(CHARACTER_GREETINGS[0]);
    await audio.dispose();
    await audio.dispose();
    expect(mock.context.close).toHaveBeenCalledOnce();
    expect(mock.gains[0].disconnect).toHaveBeenCalledOnce();
    expect(mock.oscillators[0].disconnect).toHaveBeenCalledOnce();
    expect(audio.enabled).toBe(false);
    expect(await audio.enableFromGesture()).toBe(false);
    expect(mock.factory).toHaveBeenCalledOnce();
    expect(audio.playGreeting(CHARACTER_GREETINGS[0])).toBe(false);
  });

  it("gracefully handles unsupported, closed, denied, or still-suspended audio", async () => {
    expect(await new CharacterMeepAudio(() => null).enableFromGesture()).toBe(false);
    expect(await new CharacterMeepAudio(() => { throw new Error("Unavailable"); }).enableFromGesture()).toBe(false);
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    mock.context.resume.mockRejectedValue(new Error("Gesture needed"));
    expect(await audio.enableFromGesture()).toBe(false);
    expect(audio.enabled).toBe(false);
    mock.context.resume.mockResolvedValue(undefined);
    expect(await audio.enableFromGesture()).toBe(false);
    mock.context.state = "closed";
    expect(await audio.enableFromGesture()).toBe(false);
    expect(audio.playGreeting(CHARACTER_GREETINGS[0])).toBe(false);
  });

  it("cancels already created notes if scheduling a later note fails", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    await audio.enableFromGesture();
    const create = mock.context.createOscillator.getMockImplementation()!;
    mock.context.createOscillator.mockImplementationOnce(create)
      .mockImplementationOnce(() => { throw new Error("Audio device gone"); });
    expect(audio.playGreeting(CHARACTER_GREETINGS[0])).toBe(false);
    expect(mock.oscillators[0].disconnect).toHaveBeenCalledOnce();
  });

  it("keeps every utterance muted until the explicit sound gesture", () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    for (const kind of ["greeting", "bonk", "fact"] as const) {
      expect(audio.playUtterance("Hi hi hi hi", kind)).toBe(false);
    }
    expect(mock.factory).not.toHaveBeenCalled();
    expect(mock.oscillators).toHaveLength(0);
  });

  it("caps even extremely long captions to 18 quiet nodes and 4.5 seconds", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    const line = "A public fact about Noah. ".repeat(10000);
    await audio.enableFromGesture();
    expect(audio.playUtterance(line, "fact")).toBe(true);
    expect(mock.oscillators).toHaveLength(18);
    expect(utteranceDuration(line, "fact")).toBeLessThanOrEqual(4.5);
    for (const [index, oscillator] of mock.oscillators.entries()) {
      expect(oscillator.stop.mock.calls[0][0] - mock.context.currentTime).toBeLessThanOrEqual(4.5);
      expect(mock.gains[index + 1].gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(0.26);
    }
    const lastStop = mock.oscillators.at(-1)!.stop.mock.calls[0][0];
    expect(lastStop - mock.context.currentTime).toBeCloseTo(utteranceDuration(line, "fact"));
  });

  it("creates a single short low bonk and lets cancel stop it", async () => {
    const mock = fakeAudio();
    const audio = new CharacterMeepAudio(mock.factory);
    await audio.enableFromGesture();
    expect(audio.playUtterance("Ow", "bonk")).toBe(true);
    expect(mock.oscillators).toHaveLength(1);
    expect(mock.oscillators[0].type).toBe("sine");
    expect(mock.oscillators[0].frequency.setValueAtTime.mock.calls[0][0]).toBeLessThan(200);
    expect(utteranceDuration("Ow", "bonk")).toBeLessThan(0.3);
    audio.cancel();
    expect(mock.oscillators[0].stop).toHaveBeenLastCalledWith(100);
  });

  it("uses repeatable phrase rhythms and rejects empty captions without sound", async () => {
    const first = fakeAudio();
    const second = fakeAudio();
    const a = new CharacterMeepAudio(first.factory);
    const b = new CharacterMeepAudio(second.factory);
    await a.enableFromGesture();
    await b.enableFromGesture();
    a.playUtterance("Hi hi hi hi");
    b.playUtterance("Hi hi hi hi");
    expect(first.oscillators).toHaveLength(7);
    expect(first.oscillators.map((node) => node.frequency.setValueAtTime.mock.calls))
      .toEqual(second.oscillators.map((node) => node.frequency.setValueAtTime.mock.calls));
    expect(first.oscillators.map((node) => node.stop.mock.calls))
      .toEqual(second.oscillators.map((node) => node.stop.mock.calls));
    expect(a.playUtterance("  ")).toBe(false);
    expect(utteranceDuration("  ")).toBe(0);
    expect(first.oscillators).toHaveLength(7);
  });

});

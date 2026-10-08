import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { CharacterAudio, utteranceDuration, type AudioContextFactory, type SfxName, type VoiceKind } from "../audio";

const KINDS: readonly VoiceKind[] = ["greeting", "fact", "wonder", "annoyed", "bonk"];
const EFFECTS: readonly SfxName[] = [
  "step", "jump", "trip", "fall", "land", "bonk", "pickup", "toss", "catch",
  "type", "printer", "rack", "poke", "sparkle", "select",
];

type FakeParam = {
  value: number; setValueAtTime: Mock; linearRampToValueAtTime: Mock; exponentialRampToValueAtTime: Mock;
  setTargetAtTime: Mock; setValueCurveAtTime: Mock; cancelScheduledValues: Mock;
};
type FakeNode = { connect: Mock; disconnect: Mock };
type FakeSource = FakeNode & { start: Mock; stop: Mock; onended: (() => void) | null };
type FakeOscillator = FakeSource & { frequency: FakeParam };
type FakeGain = FakeNode & { gain: FakeParam };

function fakeParam(value = 0): FakeParam {
  return {
    value,
    setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(), setValueCurveAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
  };
}

const fakeNode = (): FakeNode => ({ connect: vi.fn(), disconnect: vi.fn() });
const fakeSource = (): FakeSource => ({ ...fakeNode(), start: vi.fn(), stop: vi.fn(), onended: null });

function fakeAudio() {
  const sources: FakeSource[] = [];
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  const context = {
    state: "suspended" as AudioContextState,
    currentTime: 100,
    sampleRate: 8000,
    destination: {},
    createOscillator: vi.fn(() => {
      const oscillator = { ...fakeSource(), type: "sine", frequency: fakeParam(440), detune: fakeParam(), setPeriodicWave: vi.fn() };
      sources.push(oscillator);
      oscillators.push(oscillator);
      return oscillator;
    }),
    createBufferSource: vi.fn(() => {
      const source = { ...fakeSource(), buffer: null as unknown, loop: false };
      sources.push(source);
      return source;
    }),
    createGain: vi.fn(() => {
      const gain = { ...fakeNode(), gain: fakeParam(1) };
      gains.push(gain);
      return gain;
    }),
    createBiquadFilter: vi.fn(() => ({ ...fakeNode(), type: "lowpass", frequency: fakeParam(350), Q: fakeParam(1) })),
    createDynamicsCompressor: vi.fn(() => ({
      ...fakeNode(), threshold: fakeParam(), knee: fakeParam(), ratio: fakeParam(), attack: fakeParam(), release: fakeParam(),
    })),
    createBuffer: vi.fn((_channels: number, length: number) => ({ length, getChannelData: () => new Float32Array(length) })),
    createPeriodicWave: vi.fn(() => ({})),
    resume: vi.fn(async () => { context.state = "running"; }),
    close: vi.fn(async () => { context.state = "closed"; }),
  };
  return { context, sources, oscillators, gains, factory: vi.fn(() => context as unknown as AudioContext) };
}

/** Items appended to `list` while `act` runs. */
function during<T>(list: readonly T[], act: () => unknown): T[] {
  const from = list.length;
  act();
  return list.slice(from);
}
const startOf = (source: FakeSource): number => source.start.mock.calls[0][0];
const stopOf = (source: FakeSource): number => source.stop.mock.calls.at(-1)![0];
const pitchOf = (oscillator: FakeOscillator): number => oscillator.frequency.setValueAtTime.mock.calls[0][0];
const glideOf = (oscillator: FakeOscillator): number => oscillator.frequency.exponentialRampToValueAtTime.mock.calls.at(-1)![0];
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

async function soundOn(mock = fakeAudio()) {
  const audio = new CharacterAudio(mock.factory);
  await audio.enableFromGesture();
  return { mock, audio };
}

/** Moves the fake audio clock and the fake interval timers together. */
function advance(mock: { context: { currentTime: number } }, seconds: number) {
  mock.context.currentTime += seconds;
  vi.advanceTimersByTime(seconds * 1000);
}

beforeEach(() => { vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }); });
afterEach(() => { vi.useRealTimers(); });

describe("CharacterAudio gesture gate and lifecycle", () => {
  it("creates no context, timer or sound before an explicit gesture", () => {
    const mock = fakeAudio();
    const audio = new CharacterAudio(mock.factory);
    for (const kind of KINDS) expect(audio.speak("Hi there, I'm Noah.", kind)).toBe(false);
    for (const name of EFFECTS) audio.sfx(name);
    audio.suspend(true);
    audio.suspend(false);
    audio.cancel();
    audio.mute();
    expect(mock.factory).not.toHaveBeenCalled();
    expect(mock.sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect([audio.enabled, audio.musicEnabled]).toEqual([false, false]);
  });

  const unavailable: [string, () => { factory: AudioContextFactory; sources: unknown[] }][] = [
    ["no AudioContext", () => ({ factory: () => null, sources: [] })],
    ["a throwing constructor", () => ({ factory: () => { throw new Error("Unavailable"); }, sources: [] })],
    ["a denied resume", () => {
      const mock = fakeAudio();
      mock.context.resume.mockRejectedValue(new Error("Gesture needed"));
      return mock;
    }],
    ["a context that stays suspended", () => {
      const mock = fakeAudio();
      mock.context.resume.mockResolvedValue(undefined);
      return mock;
    }],
    ["a closed context", () => {
      const mock = fakeAudio();
      mock.context.state = "closed";
      return mock;
    }],
  ];
  it.each(unavailable)("reports off and stays silent with %s", async (_label, setup) => {
    const { factory, sources } = setup();
    const audio = new CharacterAudio(factory);
    expect(await audio.enableFromGesture()).toBe(false);
    expect(await audio.setMusic(true)).toBe(false);
    expect(audio.speak("Hello!")).toBe(false);
    for (const name of EFFECTS) audio.sfx(name);
    expect([audio.enabled, audio.musicEnabled]).toEqual([false, false]);
    expect(sources).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("turns voice+sfx and music on independently from one owned context", async () => {
    const mock = fakeAudio();
    const audio = new CharacterAudio(mock.factory);
    expect(await audio.enableFromGesture()).toBe(true);
    expect([audio.enabled, audio.musicEnabled, vi.getTimerCount()]).toEqual([true, false, 0]);
    expect(await audio.setMusic(true)).toBe(true);
    expect([audio.enabled, audio.musicEnabled, vi.getTimerCount()]).toEqual([true, true, 1]);
    audio.mute();
    expect([audio.enabled, audio.musicEnabled, vi.getTimerCount()]).toEqual([false, true, 1]);
    expect(await audio.setMusic(false)).toBe(false);
    expect(await audio.enableFromGesture()).toBe(true);
    expect([audio.enabled, audio.musicEnabled, vi.getTimerCount()]).toEqual([true, false, 0]);
    expect(mock.factory).toHaveBeenCalledOnce();
    expect(mock.context.resume).toHaveBeenCalledOnce();
  });

  it("ignores a slow resume that finishes after the visitor switched sound and music back off", async () => {
    const mock = fakeAudio();
    let finish = () => {};
    const resumed = new Promise<void>((resolve) => { finish = () => { mock.context.state = "running"; resolve(); }; });
    mock.context.resume.mockImplementation(() => resumed);
    const audio = new CharacterAudio(mock.factory);
    const sound = audio.enableFromGesture();
    const music = audio.setMusic(true);
    audio.mute();
    const off = audio.setMusic(false);
    finish();
    expect([await sound, await music, await off]).toEqual([false, false, false]);
    expect([audio.enabled, audio.musicEnabled, vi.getTimerCount()]).toEqual([false, false, 0]);
    expect(audio.speak("Hi")).toBe(false);
    expect(mock.sources).toHaveLength(0);
  });

  it("disposes once: closes the context, clears every timer and never restarts", async () => {
    const { mock, audio } = await soundOn();
    await audio.setMusic(true);
    audio.speak("Bye for now!");
    audio.sfx("sparkle");
    await audio.dispose();
    await audio.dispose();
    expect(mock.context.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    for (const source of mock.sources) expect(stopOf(source)).toBeLessThanOrEqual(100.05);
    expect([audio.enabled, audio.musicEnabled]).toEqual([false, false]);
    expect(await audio.enableFromGesture()).toBe(false);
    expect(await audio.setMusic(true)).toBe(false);
    expect(audio.speak("Hi")).toBe(false);
    audio.suspend(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(mock.factory).toHaveBeenCalledOnce();
  });
});

describe("babble voice", () => {
  it.each([
    ["Hi", 1],
    ["banana", 3],
    ["Stop, don't do that.", 4],
    ["Café über 東京 42", 8],
  ] as const)("babbles %j as %i voiced syllables ending exactly at utteranceDuration", async (line, syllables) => {
    const { mock, audio } = await soundOn();
    const voice = during(mock.sources, () => expect(audio.speak(line)).toBe(true));
    expect(mock.oscillators.filter((oscillator) => voice.includes(oscillator))).toHaveLength(syllables);
    expect(Math.min(...voice.map(startOf))).toBeGreaterThanOrEqual(100);
    expect(Math.max(...voice.map(stopOf)) - 100).toBeCloseTo(utteranceDuration(line), 6);
  });

  it.each(KINDS)("schedules %s babble that ends exactly at utteranceDuration", async (kind) => {
    const line = "Hey, did you know? I print tiny robots!";
    const { mock, audio } = await soundOn();
    const voice = during(mock.sources, () => expect(audio.speak(line, kind)).toBe(true));
    expect(Math.max(...voice.map(stopOf)) - 100).toBeCloseTo(utteranceDuration(line, kind), 6);
  });

  it("caps very long captions under five seconds and stays silent for empty or unspeakable ones", async () => {
    const { mock, audio } = await soundOn();
    const line = "A public fact about Noah. ".repeat(10000);
    const voice = during(mock.sources, () => expect(audio.speak(line, "fact")).toBe(true));
    expect(utteranceDuration(line, "fact")).toBeGreaterThan(4.5);
    expect(utteranceDuration(line, "fact")).toBeLessThanOrEqual(5);
    expect(Math.max(...voice.map(stopOf))).toBeLessThanOrEqual(105);
    for (const empty of ["", "   ", "🙂 🎉", "?!..."]) {
      expect(utteranceDuration(empty)).toBe(0);
      expect(during(mock.sources, () => expect(audio.speak(empty)).toBe(false))).toHaveLength(0);
    }
  });

  it("gives each kind its own voice", async () => {
    const line = "I like building little servers and printing gadgets at home";
    const pitches = {} as Record<VoiceKind, number[]>;
    for (const kind of KINDS) {
      const { mock, audio } = await soundOn();
      pitches[kind] = during(mock.oscillators, () => audio.speak(line, kind)).map(pitchOf);
    }
    const average = (kind: VoiceKind) => mean(pitches[kind]);
    expect(average("annoyed")).toBeLessThan(average("fact"));
    expect(average("fact")).toBeLessThan(average("greeting"));
    expect(average("greeting")).toBeGreaterThanOrEqual(380);
    expect(average("greeting")).toBeLessThanOrEqual(480);
    expect(average("wonder")).toBeGreaterThan(average("greeting"));
    const half = pitches.wonder.length / 2;
    expect(mean(pitches.wonder.slice(half))).toBeGreaterThan(mean(pitches.wonder.slice(0, half)));
    expect(utteranceDuration(line, "annoyed")).toBeLessThan(utteranceDuration(line, "greeting"));
    expect(utteranceDuration(line, "greeting")).toBeLessThan(utteranceDuration(line, "fact"));
    const rate = pitches.greeting.length / utteranceDuration(line, "greeting");
    expect(rate).toBeGreaterThanOrEqual(12);
    expect(rate).toBeLessThanOrEqual(16);
    expect(pitches.bonk).toHaveLength(1);
    expect(utteranceDuration(line, "bonk")).toBeLessThan(0.5);
  });

  it("makes the bonk one short falling oof", async () => {
    const { mock, audio } = await soundOn();
    const [oof, ...rest] = during(mock.oscillators, () => audio.speak("Ow, that really hurt!", "bonk"));
    expect(rest).toHaveLength(0);
    expect(glideOf(oof)).toBeLessThan(pitchOf(oof) * 0.75);
  });

  it("raises the end of a question, drops a statement and lifts an exclamation", async () => {
    const say = async (line: string) => {
      const { mock, audio } = await soundOn();
      return during(mock.oscillators, () => audio.speak(line));
    };
    const question = await say("Do you see me?");
    const statement = await say("Do you see me.");
    const exclamation = await say("Do you see me!");
    expect(pitchOf(question[0])).toBe(pitchOf(statement[0]));
    const [asked, told] = [question.at(-1)!, statement.at(-1)!];
    expect(pitchOf(asked)).toBeGreaterThan(pitchOf(told));
    expect(glideOf(asked)).toBeGreaterThan(pitchOf(asked));
    expect(glideOf(told)).toBeLessThan(pitchOf(told));
    expect(mean(exclamation.map(pitchOf))).toBeGreaterThan(mean(statement.map(pitchOf)));
  });

  it("cuts the previous line when a new one starts and cleans up lines that finish", async () => {
    const { mock, audio } = await soundOn();
    const first = during(mock.sources, () => audio.speak("Hello there friend"));
    const second = during(mock.sources, () => audio.speak("Bye"));
    for (const source of first) expect(stopOf(source)).toBeLessThanOrEqual(100.05);
    for (const source of second) source.onended?.();
    for (const source of second) expect(source.disconnect).toHaveBeenCalled();
  });

  it("cuts already scheduled syllables when the audio device fails mid-line", async () => {
    const { mock, audio } = await soundOn();
    const create = mock.context.createOscillator.getMockImplementation()!;
    mock.context.createOscillator.mockImplementationOnce(create)
      .mockImplementationOnce(() => { throw new Error("Audio device gone"); });
    const voice = during(mock.sources, () => expect(audio.speak("banana")).toBe(false));
    expect(voice.length).toBeGreaterThan(0);
    for (const source of voice) expect(stopOf(source)).toBeLessThanOrEqual(100.05);
  });
});

describe("sound effects", () => {
  it.each(EFFECTS)("%s schedules a short sound while sound is on and nothing once muted", async (name) => {
    const { mock, audio } = await soundOn();
    const sound = during(mock.sources, () => audio.sfx(name));
    expect(sound.length).toBeGreaterThan(0);
    for (const source of sound) {
      expect(startOf(source)).toBeGreaterThanOrEqual(100);
      expect(stopOf(source)).toBeGreaterThan(startOf(source));
      expect(stopOf(source)).toBeLessThanOrEqual(102);
    }
    audio.mute();
    expect(during(mock.sources, () => audio.sfx(name))).toHaveLength(0);
  });

  it("scales pitch and volume and alternates footsteps", async () => {
    const { mock, audio } = await soundOn();
    const play = (name: SfxName, options?: { pitch?: number; volume?: number }) => {
      const gainsBefore = mock.gains.length;
      const [first] = during(mock.oscillators, () => audio.sfx(name, options));
      const peaks = mock.gains.slice(gainsBefore).flatMap((gain) => gain.gain.linearRampToValueAtTime.mock.calls.map(([value]) => value as number));
      return { pitch: pitchOf(first), peak: Math.max(...peaks) };
    };
    const plain = play("select");
    const scaled = play("select", { pitch: 2, volume: 0.5 });
    expect(scaled.pitch).toBeCloseTo(plain.pitch * 2);
    expect(scaled.peak).toBeCloseTo(plain.peak / 2);
    expect(play("step").pitch).not.toBe(play("step").pitch);
  });
});

describe("chiptune music", () => {
  it("schedules a little ahead while on and stops for suspend and the music toggle", async () => {
    const { mock, audio } = await soundOn();
    expect(await audio.setMusic(true)).toBe(true);
    const first = mock.sources.slice();
    expect(first.length).toBeGreaterThan(0);
    for (const source of first) expect(startOf(source)).toBeLessThanOrEqual(100.25);
    const later = during(mock.sources, () => advance(mock, 2));
    expect(later.length).toBeGreaterThan(0);
    for (const source of later) expect(startOf(source)).toBeGreaterThanOrEqual(102);
    for (const source of later) expect(startOf(source)).toBeLessThanOrEqual(102.25);

    const voice = during(mock.sources, () => audio.speak("Look at it go!"));
    audio.suspend(true);
    expect(vi.getTimerCount()).toBe(0);
    for (const source of [...later, ...voice]) expect(stopOf(source)).toBeLessThanOrEqual(102.05);
    expect(audio.speak("Hello?")).toBe(false);
    expect(during(mock.sources, () => advance(mock, 2))).toHaveLength(0);

    audio.suspend(false);
    expect(vi.getTimerCount()).toBe(1);
    expect(during(mock.sources, () => advance(mock, 1)).length).toBeGreaterThan(0);

    expect(await audio.setMusic(false)).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(during(mock.sources, () => advance(mock, 2))).toHaveLength(0);
    audio.suspend(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps playing through cancel and mute, which stop voice and pending effects", async () => {
    const { mock, audio } = await soundOn();
    await audio.setMusic(true);
    const music = mock.sources.slice();
    const musicStops = music.map(stopOf);
    for (const stop of [() => audio.cancel(), () => audio.mute()]) {
      const sound = during(mock.sources, () => { audio.speak("Look at my printer go!"); audio.sfx("fall"); });
      expect(sound.length).toBeGreaterThan(0);
      stop();
      for (const source of sound) expect(stopOf(source)).toBeLessThanOrEqual(100.05);
      expect(music.map(stopOf)).toEqual(musicStops);
      expect(vi.getTimerCount()).toBe(1);
    }
    expect([audio.enabled, audio.musicEnabled]).toEqual([false, true]);
    expect(during(mock.sources, () => advance(mock, 1)).length).toBeGreaterThan(0);
  });
});

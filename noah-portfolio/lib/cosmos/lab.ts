/**
 * Framework-free DOM for the two Cosmos surfaces:
 *
 *   mountJourney(root)   — the scroll story: a pinned canvas that blends from
 *                          one chapter's scene, style and palette to the next.
 *   mountWorkbench(root) — pick any scene, variant, style and palette, preview
 *                          the transitions, and browse the full contact sheet.
 *
 * Both return a dispose function. The React wrappers in components/cosmos are
 * a ref and an effect around these.
 */
import {
  CHAPTERS,
  CUTS,
  PALETTES,
  SCENES,
  STYLES,
  TRANSITIONS,
  mixPalette,
  paletteById,
  type Chapter,
  type Cut,
  type SceneId,
  type StyleId,
  type TransitionId,
} from './config';
import { CosmosEngine, supportsCosmos } from './engine';

type Attrs = Record<string, string>;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const css = (rgb: [number, number, number]) =>
  `rgb(${Math.round(rgb[0] * 255)} ${Math.round(rgb[1] * 255)} ${Math.round(rgb[2] * 255)})`;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

const sceneLabel = (id: SceneId) => SCENES.find((s) => s.id === id)?.label ?? id;
const styleLabel = (id: StyleId) => STYLES.find((s) => s.id === id)?.label ?? id;

function fallback(root: HTMLElement) {
  root.append(
    h('p', { class: 'cz-fallback' }, [
      'These animations need WebGL2, which this browser is not offering. The story below still reads fine without them.',
    ]),
  );
}

/* ---- Journey --------------------------------------------------------------- */

export interface JourneyOptions {
  chapters?: Chapter[];
  cuts?: Cut[];
  /** Fraction of each chapter spent handing over to the next. */
  handover?: number;
}

export function mountJourney(root: HTMLElement, options: JourneyOptions = {}): () => void {
  const chapters = options.chapters ?? CHAPTERS;
  const cuts = options.cuts ?? CUTS;
  const handover = options.handover ?? 0.32;
  let cut = cuts[0];

  const canvas = h('canvas', { class: 'cz-canvas', 'aria-hidden': 'true' });
  const hudScene = h('span', { class: 'cz-hud-scene' });
  const hudMeta = h('span', { class: 'cz-hud-meta' });
  const hud = h('div', { class: 'cz-hud', 'aria-hidden': 'true' }, [hudScene, hudMeta]);
  const hint = h('p', { class: 'cz-hint', 'aria-hidden': 'true' }, ['scroll · move · click']);

  const cutButtons = cuts.map((c) => {
    const b = h('button', { type: 'button', class: 'cz-chip', title: c.blurb, 'aria-pressed': 'false' }, [c.label]);
    b.addEventListener('click', () => {
      cut = c;
      syncCuts();
      update();
    });
    return b;
  });
  const syncCuts = () =>
    cutButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(cuts[i].id === cut.id)));
  const cutBar = h('div', { class: 'cz-cuts', role: 'group', 'aria-label': 'Journey cut', 'data-cosmos-ui': '' }, [
    h('span', { class: 'cz-cuts-label' }, ['Cut']),
    ...cutButtons,
  ]);

  const sections: HTMLElement[] = [];
  const dots: HTMLButtonElement[] = [];
  const chapterWrap = h('div', { class: 'cz-chapters' });
  chapters.forEach((ch, i) => {
    const card = h('div', { class: 'cz-card' }, [
      h('p', { class: 'cz-kicker' }, [
        `${String(i + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')} · ${ch.kicker}`,
      ]),
      h(i === 0 ? 'h1' : 'h2', { class: 'cz-title' }, [ch.title]),
      h('p', { class: 'cz-body' }, [ch.body]),
      h('ul', { class: 'cz-tags' }, ch.tags.map((t) => h('li', {}, [t]))),
    ]);
    const section = h(
      'section',
      { class: 'cz-chapter', id: `chapter-${ch.id}`, 'data-side': i % 2 ? 'right' : 'left', 'aria-label': ch.title },
      [card],
    );
    sections.push(section);
    chapterWrap.append(section);

    const dot = h('button', { type: 'button', class: 'cz-dot', 'aria-label': `Go to chapter ${i + 1}: ${ch.title}` });
    dot.addEventListener('click', () => {
      section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    dots.push(dot);
  });
  const rail = h('nav', { class: 'cz-rail', 'aria-label': 'Chapters', 'data-cosmos-ui': '' }, dots);

  // The chrome sits in its own pinned layer above the cards; the canvas stays below them.
  const overlay = h('div', { class: 'cz-overlay' }, [cutBar, hud, hint, rail]);
  chapterWrap.prepend(overlay);
  const stage = h('div', { class: 'cz-stage' }, [canvas]);
  const wrap = h('div', { class: 'cz-journey' }, [stage, chapterWrap]);
  root.append(wrap);
  syncCuts();

  if (!supportsCosmos()) {
    wrap.classList.add('cz-no-gl');
    fallback(stage);
    return () => wrap.remove();
  }

  const engine = new CosmosEngine(canvas, { reducedMotion: prefersReducedMotion() });
  let lastActive = -1;

  function update() {
    const y = -chapterWrap.getBoundingClientRect().top;
    let i = 0;
    for (let k = 0; k < sections.length; k++) if (sections[k].offsetTop <= y + 1) i = k;
    const sec = sections[i];
    const f = clamp01((y - sec.offsetTop) / Math.max(1, sec.offsetHeight));
    const last = i === chapters.length - 1;
    const mix = last ? 0 : smooth(clamp01((f - (1 - handover)) / handover));
    const a = chapters[i];
    const b = chapters[Math.min(i + 1, chapters.length - 1)];
    const palA = paletteById(cut.palette ?? a.palette);
    const palB = paletteById(cut.palette ?? b.palette);
    const palette = mixPalette(palA, palB, mix);

    engine.frame = {
      a: a.scene,
      b: b.scene,
      mix,
      transition: a.out,
      styleA: cut.style ?? a.style,
      styleB: cut.style ?? b.style,
      progA: f,
      progB: 0,
      varA: a.variant,
      varB: b.variant,
      palette,
    };
    if (f > 0.25) engine.warm(b.scene);

    const active = mix > 0.5 ? i + 1 : i;
    if (active !== lastActive) {
      lastActive = active;
      const ch = chapters[active];
      hudScene.textContent = sceneLabel(ch.scene);
      hudMeta.textContent = `${styleLabel(cut.style ?? ch.style)} · ${paletteById(cut.palette ?? ch.palette).label}`;
      dots.forEach((d, k) => d.setAttribute('aria-current', k === active ? 'step' : 'false'));
    }
    hudMeta.textContent = `${styleLabel(cut.style ?? chapters[active].style)} · ${paletteById(cut.palette ?? chapters[active].palette).label}`;
    wrap.style.setProperty('--cz-accent', css(palette.c1));
    wrap.style.setProperty('--cz-accent-2', css(palette.c2));
    hint.style.opacity = y > 200 ? '0' : '';
  }

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  engine.start();

  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onMotion = () => engine.setReducedMotion(Boolean(mq?.matches));
  mq?.addEventListener?.('change', onMotion);

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    mq?.removeEventListener?.('change', onMotion);
    engine.dispose();
    wrap.remove();
  };
}

/* ---- Workbench ------------------------------------------------------------- */

interface BenchState {
  scene: SceneId;
  variant: number;
  style: StyleId;
  palette: string;
}

export function mountWorkbench(root: HTMLElement): () => void {
  const state: BenchState = { scene: 'afroHole', variant: 0, style: 'raw', palette: 'solar' };
  const disposers: Array<() => void> = [];

  const canvas = h('canvas', { class: 'cz-canvas' , 'aria-label': 'Animation preview', role: 'img' });
  const blurb = h('p', { class: 'cz-bench-blurb' });
  const view = h('div', { class: 'cz-bench-view' }, [canvas, blurb]);

  const group = (label: string, body: HTMLElement) =>
    h('div', { class: 'cz-group' }, [h('p', { class: 'cz-group-label' }, [label]), body]);
  const row = (name: string) => h('div', { class: 'cz-chips', role: 'group', 'aria-label': name });

  const sceneRow = row('Scene');
  const variantRow = row('Variant');
  const styleRow = row('Style');
  const paletteRow = row('Palette');
  const transRow = row('Transition');
  const snippet = h('code', { class: 'cz-snippet' });
  const copy = h('button', { type: 'button', class: 'cz-chip cz-copy' }, ['Copy']);
  const controls = h('div', { class: 'cz-bench-controls', 'data-cosmos-ui': '' }, [
    group('Scene', sceneRow),
    group('Variant', variantRow),
    group('Style', styleRow),
    group('Palette', paletteRow),
    group('Play a transition into the next scene', transRow),
    group('Your pick', h('div', { class: 'cz-snippet-row' }, [snippet, copy])),
  ]);

  const sheet = h('div', { class: 'cz-sheet' });
  const sheetHead = h('div', { class: 'cz-sheet-head' }, [
    h('h3', { class: 'cz-h3' }, ['Contact sheet']),
    h('p', { class: 'cz-sheet-note' }, [
      `Every scene in every style, ${SCENES.length * STYLES.length} frames in the palette picked above. Select one to load it.`,
    ]),
  ]);
  const hidden = h('canvas', { class: 'cz-offscreen', 'aria-hidden': 'true' });
  const bench = h('div', { class: 'cz-bench' }, [
    h('div', { class: 'cz-bench-top' }, [view, controls]),
    sheetHead,
    sheet,
    hidden,
  ]);
  root.append(bench);

  if (!supportsCosmos()) {
    fallback(view);
    return () => bench.remove();
  }

  const engine = new CosmosEngine(canvas, { reducedMotion: prefersReducedMotion() });
  const thumbEngine = new CosmosEngine(hidden, { pointer: false, maxScenePixels: 200_000 });
  disposers.push(() => engine.dispose(), () => thumbEngine.dispose());

  let transitioning = 0;

  const chip = (label: string, onClick: () => void, title?: string) => {
    const b = h('button', { type: 'button', class: 'cz-chip', 'aria-pressed': 'false' }, [label]);
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    return b;
  };

  function apply() {
    cancelAnimationFrame(transitioning);
    engine.frame = {
      a: state.scene,
      b: state.scene,
      mix: 0,
      transition: 'fade',
      styleA: state.style,
      styleB: state.style,
      progA: -1,
      progB: -1,
      varA: state.variant,
      varB: 0,
      palette: paletteById(state.palette),
    };
    const scene = SCENES.find((s) => s.id === state.scene)!;
    blurb.textContent = scene.blurb;
    snippet.textContent = `<CosmosCanvas scene="${state.scene}" variant={${state.variant}} style="${state.style}" palette="${state.palette}" />`;

    [...sceneRow.children].forEach((b, i) => b.setAttribute('aria-pressed', String(SCENES[i].id === state.scene)));
    [...styleRow.children].forEach((b, i) => b.setAttribute('aria-pressed', String(STYLES[i].id === state.style)));
    [...paletteRow.children].forEach((b, i) => b.setAttribute('aria-pressed', String(PALETTES[i].id === state.palette)));
    variantRow.replaceChildren(
      ...scene.variants.map((v, i) => {
        const b = chip(v, () => {
          state.variant = i;
          apply();
        });
        b.setAttribute('aria-pressed', String(i === state.variant));
        return b;
      }),
    );
    const pal = paletteById(state.palette);
    bench.style.setProperty('--cz-accent', css(pal.c1));
    bench.style.setProperty('--cz-accent-2', css(pal.c2));
  }

  SCENES.forEach((s) =>
    sceneRow.append(
      chip(s.label, () => {
        state.scene = s.id;
        state.variant = 0;
        apply();
      }, s.blurb),
    ),
  );
  STYLES.forEach((s) =>
    styleRow.append(
      chip(s.label, () => {
        state.style = s.id;
        apply();
      }, s.blurb),
    ),
  );
  PALETTES.forEach((p) => {
    const b = chip(p.label, () => {
      state.palette = p.id;
      apply();
      queueSheet();
    });
    b.classList.add('cz-swatch');
    b.style.setProperty('--sw', `linear-gradient(90deg, ${css(p.c3)}, ${css(p.c1)} 45%, ${css(p.c2)} 75%, ${css(p.hot)})`);
    paletteRow.append(b);
  });
  TRANSITIONS.forEach((t) =>
    transRow.append(
      chip(t.label, () => playTransition(t.id)),
    ),
  );

  function playTransition(id: TransitionId) {
    cancelAnimationFrame(transitioning);
    const idx = SCENES.findIndex((s) => s.id === state.scene);
    const next = SCENES[(idx + 1) % SCENES.length].id;
    const start = performance.now();
    const duration = prefersReducedMotion() ? 1 : 2200;
    engine.frame = { ...engine.frame, a: state.scene, b: next, transition: id, varB: 0, mix: 0 };
    const tick = () => {
      const t = clamp01((performance.now() - start) / duration);
      engine.frame.mix = smooth(t);
      if (t < 1) {
        transitioning = requestAnimationFrame(tick);
      } else {
        state.scene = next;
        state.variant = 0;
        apply();
      }
    };
    transitioning = requestAnimationFrame(tick);
  }

  copy.addEventListener('click', () => {
    const text = snippet.textContent ?? '';
    const done = () => {
      copy.textContent = 'Copied';
      window.setTimeout(() => (copy.textContent = 'Copy'), 1400);
    };
    const select = () => {
      const range = document.createRange();
      range.selectNodeContents(snippet);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      copy.textContent = 'Selected';
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, select);
    else select();
  });

  /* contact sheet: one hidden engine paints every scene x style into 2D canvases */
  interface Thumb {
    scene: SceneId;
    style: StyleId;
    ctx: CanvasRenderingContext2D;
  }
  const thumbs: Thumb[] = [];
  SCENES.forEach((s) => {
    const cells = STYLES.map((st) => {
      const c = h('canvas', { width: '320', height: '200', 'aria-hidden': 'true' });
      const b = h('button', { type: 'button', class: 'cz-thumb', 'aria-label': `${s.label}, ${st.label}` }, [
        c,
        h('span', { class: 'cz-thumb-label' }, [st.label]),
      ]);
      b.addEventListener('click', () => {
        state.scene = s.id;
        state.style = st.id;
        state.variant = 0;
        apply();
        view.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      });
      const ctx = c.getContext('2d');
      if (ctx) thumbs.push({ scene: s.id, style: st.id, ctx });
      return b;
    });
    sheet.append(
      h('div', { class: 'cz-sheet-row' }, [h('p', { class: 'cz-sheet-name' }, [s.label]), h('div', { class: 'cz-sheet-cells' }, cells)]),
    );
  });

  let queue: Thumb[] = [];
  let sheetVisible = false;
  let sheetRaf = 0;
  const pump = () => {
    sheetRaf = 0;
    if (!sheetVisible || !queue.length) return;
    const t = queue.shift()!;
    thumbEngine.frame = {
      ...thumbEngine.frame,
      a: t.scene,
      b: t.scene,
      mix: 0,
      styleA: t.style,
      styleB: t.style,
      progA: 0.62,
      varA: 0,
      palette: paletteById(state.palette),
    };
    thumbEngine.snapshot(t.ctx);
    sheetRaf = requestAnimationFrame(pump);
  };
  function queueSheet() {
    queue = [...thumbs];
    if (!sheetRaf) sheetRaf = requestAnimationFrame(pump);
  }
  const io = new IntersectionObserver(
    (entries) => {
      sheetVisible = entries.some((e) => e.isIntersecting);
      if (sheetVisible && !sheetRaf) sheetRaf = requestAnimationFrame(pump);
    },
    { rootMargin: '400px' },
  );
  io.observe(sheet);
  disposers.push(() => {
    io.disconnect();
    cancelAnimationFrame(sheetRaf);
    cancelAnimationFrame(transitioning);
  });

  apply();
  queueSheet();
  engine.start();

  return () => {
    disposers.forEach((fn) => fn());
    bench.remove();
  };
}

/**
 * The Studies gallery: one full-height plate per piece. Only the plates near
 * the viewport hold a live canvas, so nine pieces never mean nine GPU contexts.
 */
import { PALETTES, mountStudy, type Mounted, type Palette, type Study } from './core';
import { STUDIES } from './list';

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(c);
  return el;
}

const STORE = 'studies-palette';

export function mountGallery(root: HTMLElement, studies: Study[] = STUDIES): () => void {
  let pal: Palette = PALETTES[0];
  try {
    pal = PALETTES.find((p) => p.id === window.localStorage.getItem(STORE)) ?? pal;
  } catch {
    /* storage can be unavailable; the default palette is fine */
  }

  const wrap = h('div', { class: 'st' });
  const live = new Map<HTMLElement, { m: Mounted | null; study: Study; variant: number }>();

  const swatches = PALETTES.map((p) => {
    const b = h('button', { type: 'button', class: 'st-swatch', 'aria-label': `${p.label} palette`, title: p.label, 'aria-pressed': 'false' });
    b.style.background = `conic-gradient(from 210deg, ${p.stops.join(', ')}, ${p.stops[0]})`;
    b.addEventListener('click', () => setPalette(p));
    return b;
  });
  const palName = h('span', { class: 'st-pal-name' });
  const bar = h('header', { class: 'st-bar', 'data-ui': '' }, [
    h('span', { class: 'st-brand' }, ['Studies']),
    h('div', { class: 'st-pals', role: 'group', 'aria-label': 'Palette' }, [palName, ...swatches]),
  ]);

  function setPalette(p: Palette) {
    pal = p;
    try {
      window.localStorage.setItem(STORE, p.id);
    } catch {
      /* not persisted; still applied */
    }
    wrap.style.setProperty('--st-bg', p.bg);
    wrap.style.setProperty('--st-ink', p.ink);
    wrap.style.setProperty('--st-a', p.light ? p.stops[1] : p.stops[2]);
    wrap.dataset.light = String(p.light);
    palName.textContent = p.label;
    swatches.forEach((b, i) => b.setAttribute('aria-pressed', String(PALETTES[i].id === p.id)));
    live.forEach((v) => v.m?.set({ pal: p }));
  }

  const plates = studies.map((study, i) => {
    const stage = h('div', { class: 'st-stage' });
    const chips = study.variants.map((v, k) => {
      const b = h('button', { type: 'button', class: 'st-chip', 'aria-pressed': String(k === 0) }, [v]);
      b.addEventListener('click', () => {
        const entry = live.get(plate);
        state.variant = k;
        if (entry) {
          entry.variant = k;
          entry.m?.set({ variant: k });
        }
        chips.forEach((c, j) => c.setAttribute('aria-pressed', String(j === k)));
      });
      return b;
    });
    const state = { variant: 0 };
    const plate = h('section', { class: 'st-plate', id: study.id, 'aria-label': study.title }, [
      stage,
      h('div', { class: 'st-meta' }, [
        h('p', { class: 'st-num' }, [`${String(i + 1).padStart(2, '0')} / ${String(studies.length).padStart(2, '0')}`]),
        h(i === 0 ? 'h1' : 'h2', { class: 'st-title' }, [study.title]),
        h('p', { class: 'st-line' }, [study.line]),
      ]),
      h('div', { class: 'st-side', 'data-ui': '' }, [
        h('div', { class: 'st-chips', role: 'group', 'aria-label': `${study.title} variations` }, chips),
        h('p', { class: 'st-hint' }, [study.hint]),
      ]),
    ]);

    const mount = () => {
      if (live.has(plate)) return;
      const canvas = h('canvas', { class: 'st-canvas', 'aria-hidden': 'true' });
      stage.replaceChildren(canvas);
      const m = mountStudy(canvas, study, pal, state.variant);
      if (!m) {
        stage.replaceChildren(h('p', { class: 'st-fallback' }, ['This piece needs WebGL2, which this browser is not offering.']));
      }
      live.set(plate, { m, study, variant: state.variant });
    };
    const unmount = () => {
      const entry = live.get(plate);
      if (!entry) return;
      entry.m?.destroy();
      live.delete(plate);
      stage.replaceChildren();
    };
    return { plate, mount, unmount };
  });

  wrap.append(bar, ...plates.map((p) => p.plate));
  root.append(wrap);
  setPalette(pal);

  // Mount a little before a plate arrives, release it once it is well gone.
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const p = plates.find((x) => x.plate === e.target);
        if (!p) continue;
        if (e.isIntersecting) p.mount();
        else p.unmount();
      }
    },
    { rootMargin: '60% 0px 60% 0px' },
  );
  const shown = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.target.classList.toggle('is-live', e.intersectionRatio > 0.3);
    },
    { threshold: [0, 0.3, 0.6] },
  );
  plates.forEach((p) => {
    near.observe(p.plate);
    shown.observe(p.plate);
  });

  return () => {
    near.disconnect();
    shown.disconnect();
    plates.forEach((p) => p.unmount());
    wrap.remove();
  };
}

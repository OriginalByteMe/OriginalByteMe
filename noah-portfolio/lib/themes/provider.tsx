'use client';

/**
 * Holiday Theme provider + hooks (CONTEXT.md "Theme": a calendar/locale-driven
 * styling overlay — the holiday overlay, e.g. Christmas, Halloween).
 *
 * Two theme concerns remain intentionally separate:
 * - `components/ThemeProvider` — light/dark colour scheme.
 * - This module (`lib/themes/provider.tsx`) — holiday/locale styling overlay.
 * This provider resolves and applies the holiday overlay only.
 *
 * Privacy: header-only. Country comes from request headers (no cookies, no
 * storage, no fingerprinting — ticket #42).
 * Fallback: when no theme resolves, nothing is applied and the backdrop stays
 * at its default preset (signature `softField`).
 *
 * Server wiring is NOT done yet (deferred design stub): a layout would await
 * getVisitorCountry() and render <HolidayThemeProvider country={country}>
 * inside StoreProvider, mounting <HolidayThemeApplier /> once. Note that
 * headers() opts the route into dynamic rendering.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import { resetBackdropPreset, setBackdropPreset } from '@/lib/store/slices/backdrop-slice';
import { HolidayTheme, resolveTheme } from '@/lib/themes/registry';

export interface VisitorInfo {
  country: string | null;
}

/** Un-providered default so global (locales: null) themes still resolve. */
const VisitorContext = createContext<VisitorInfo>({ country: null });

/**
 * Context provider. Server wiring (NOT done yet, documented in module doc):
 * layout awaits getVisitorCountry() and renders
 * <HolidayThemeProvider country={country}> inside StoreProvider,
 * mounting <HolidayThemeApplier /> once.
 */
export function HolidayThemeProvider(props: {
  country: string | null;
  children: React.ReactNode;
}): React.JSX.Element {
  const value = useMemo<VisitorInfo>(() => ({ country: props.country }), [props.country]);
  return <VisitorContext.Provider value={value}>{props.children}</VisitorContext.Provider>;
}

/**
 * Resolver: context country + render-stable now (useState(() => new Date()))
 * -> useMemo(() => resolveTheme(now, country)). Un-providered default context
 * is { country: null } so global (locales: null) themes still resolve.
 */
export function useTheme(): HolidayTheme | null {
  const { country } = useContext(VisitorContext);
  const [now] = useState(() => new Date());
  return useMemo(() => resolveTheme(now, country), [now, country]);
}

/**
 * Applies the active theme: useEffect -> if theme, dispatch(setBackdropPreset(theme.backdropPreset));
 * effect cleanup -> dispatch(resetBackdropPreset()). Renders null. Accents/decoration
 * are consumed by scene components via useTheme() (application stubbed for later).
 */
export function HolidayThemeApplier(): null {
  const theme = useTheme();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!theme) return;
    dispatch(setBackdropPreset(theme.backdropPreset));
    return () => {
      dispatch(resetBackdropPreset());
    };
  }, [theme, dispatch]);

  return null;
}

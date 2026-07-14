'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { resetBackdropPreset, setBackdropPreset } from '@/lib/store/slices/backdrop-slice';
import { useAskMe } from './AskMeProvider';

/**
 * Owns backdrop changes that belong to application mode.
 *
 * Home always uses the hero's nocturne shader and decorative scene across the
 * full page. Streaming is pinned to the violet wave. Answer mode deliberately
 * dispatches nothing so the generated spec's allowlisted choice remains in
 * control.
 */
export default function BackdropSceneSync() {
  const { mode } = useAskMe();
  const dispatch = useDispatch();

  useEffect(() => {
    if (mode === 'answer') return;

    if (mode === 'streaming') {
      dispatch(setBackdropPreset('ditherViolet'));
      return;
    }

    dispatch(resetBackdropPreset());
  }, [mode, dispatch]);

  return null;
}

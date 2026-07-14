'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { resetBackdropPreset, setBackdropPreset } from '@/lib/store/slices/backdrop-slice';
import { useAskMe } from './AskMeProvider';

/**
 * Keeps application mode and the Story Plan's single allowlisted preset in
 * sync. Scene cues are applied by the active Story document as bounded data.
 */
export default function BackdropSceneSync() {
  const { mode, plan } = useAskMe();
  const dispatch = useDispatch();

  useEffect(() => {
    if (mode === 'home') {
      dispatch(resetBackdropPreset());
      return;
    }

    if (plan) {
      dispatch(setBackdropPreset(plan.backdropPreset));
      return;
    }

    if (mode === 'streaming') {
      dispatch(setBackdropPreset('ditherViolet'));
    }
  }, [mode, plan, dispatch]);

  return null;
}

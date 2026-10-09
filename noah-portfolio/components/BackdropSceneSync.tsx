'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { STREAMING_BACKDROP_PRESET } from '@/lib/backdrop/presets';
import { resetBackdropPreset, setBackdropPreset } from '@/lib/store/slices/backdrop-slice';
import { useAskMe } from './AskMeProvider';

/** Home keeps the visitor's Backdrop; any generated site sits on the streaming preset behind it. */
export default function BackdropSceneSync() {
  const { mode } = useAskMe();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(resetBackdropPreset());
    if (mode !== 'home') dispatch(setBackdropPreset(STREAMING_BACKDROP_PRESET));
  }, [mode, dispatch]);

  return null;
}

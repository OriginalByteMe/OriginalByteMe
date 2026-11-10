'use client';

import { useEffect, useRef } from 'react';

import { mountWorkbench } from '@/lib/cosmos';

/** Scene, variant, style, palette and transition picker with the full contact sheet. */
export default function CosmosWorkbench() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountWorkbench(ref.current);
  }, []);

  return <div ref={ref} />;
}

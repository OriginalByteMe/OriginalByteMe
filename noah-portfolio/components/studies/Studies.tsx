'use client';

import { useEffect, useRef } from 'react';

import { mountGallery } from '@/lib/studies';

/** The full Studies gallery. */
export default function Studies() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountGallery(ref.current);
  }, []);

  return <div ref={ref} />;
}

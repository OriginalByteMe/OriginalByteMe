'use client';

import { useEffect, useRef } from 'react';

import { mountJourney, type JourneyOptions } from '@/lib/cosmos';

/** The scroll story: a pinned canvas that blends scene, style and palette per chapter. */
export default function CosmosJourney(props: JourneyOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const options = useRef(props);

  useEffect(() => {
    if (!ref.current) return;
    return mountJourney(ref.current, options.current);
  }, []);

  return <div ref={ref} />;
}

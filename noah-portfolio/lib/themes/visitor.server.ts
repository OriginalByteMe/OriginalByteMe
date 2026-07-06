import { headers } from 'next/headers';

import { resolveVisitorCountry } from '@/lib/themes/visitor';

/**
 * Server-side entry. Next 15: headers() is async. NOTE: calling this in a
 * layout/page opts that route into dynamic rendering - rollout wiring is
 * deliberately deferred (design stub).
 */
export async function getVisitorCountry(): Promise<string | null> {
  return resolveVisitorCountry(await headers());
}

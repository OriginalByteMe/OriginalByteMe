/**
 * Visitor country from request headers. Header-only by design: no cookies,
 * no storage, no fingerprinting (privacy posture, ticket #42).
 * Primary: `x-vercel-ip-country` (Vercel edge geo, ISO 3166-1 alpha-2).
 * Fallback: first Accept-Language tag IN LISTED ORDER (q-values ignored -
 * documented simplification) that carries a 2-letter region subtag.
 * Returns UPPERCASE alpha-2 or null. Never throws.
 */
export function resolveVisitorCountry(headers: Headers): string | null {
  const geo = headers.get('x-vercel-ip-country');
  if (geo && /^[a-z]{2}$/i.test(geo) && geo.toUpperCase() !== 'XX') {
    return geo.toUpperCase();
  }

  const acceptLanguage = headers.get('accept-language');
  if (!acceptLanguage) {
    return null;
  }

  for (const rawTag of acceptLanguage.split(',')) {
    const tag = rawTag.split(';')[0].trim();
    if (!tag) {
      continue;
    }
    // subtags[0] is the primary language subtag; region is the first following
    // subtag that is exactly 2 ASCII letters (en-US -> US, zh-Hant-TW -> TW).
    const subtags = tag.split('-');
    for (let i = 1; i < subtags.length; i++) {
      if (/^[a-z]{2}$/i.test(subtags[i])) {
        return subtags[i].toUpperCase();
      }
    }
  }

  return null;
}

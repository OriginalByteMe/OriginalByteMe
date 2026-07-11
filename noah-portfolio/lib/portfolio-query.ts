const MAX_PORTFOLIO_QUERY_LENGTH = 280;

/** Normalize URL and user-input query shapes at the server/client boundary. */
export function normalizePortfolioQuery(
  value: string | readonly string[] | null | undefined,
): string {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim().slice(0, MAX_PORTFOLIO_QUERY_LENGTH) : "";
}

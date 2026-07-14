/** Normalize user-equivalent Unicode, case, and whitespace without changing punctuation. */
export function normalizeQuestion(question: string): string {
  return question.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

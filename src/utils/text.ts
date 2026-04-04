export function normalizeText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function includesAnyNeedle(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

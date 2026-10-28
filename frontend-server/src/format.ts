export function pageLabel(start: number | null, end: number | null): string {
  if (start == null) return "Page unknown";
  if (end == null || end === start) return `Page ${start}`;
  return `Pages ${start}–${end}`;
}

export function matchLabel(score: number): string {
  if (!Number.isFinite(score)) return "Match";
  return `${Math.round(score * 100)}% match`;
}

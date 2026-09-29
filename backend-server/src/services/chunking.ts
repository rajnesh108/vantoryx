import type { ChunkDraft, PageText } from "../types";

export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
  minChunkSize: number;
}

const DEFAULTS: ChunkOptions = {
  chunkSize: 1000,
  overlap: 180,
  minChunkSize: 200,
};

export function chunkPages(pages: PageText[], options: Partial<ChunkOptions> = {}): ChunkDraft[] {
  const chunkSize = options.chunkSize ?? DEFAULTS.chunkSize;
  const minChunkSize = options.minChunkSize ?? DEFAULTS.minChunkSize;
  const overlap = Math.min(options.overlap ?? DEFAULTS.overlap, Math.max(0, chunkSize - 1));
  if (chunkSize < 50) {
    throw new Error("chunkSize must be at least 50 characters");
  }

  const pieces: { text: string; page: number }[] = [];
  for (const page of pages) {
    const text = normalize(page.text);
    if (!text) continue;
    for (const part of splitToSize(text, chunkSize)) {
      pieces.push({ text: part, page: page.page });
    }
  }

  const merged: { text: string; pageStart: number; pageEnd: number }[] = [];
  for (const piece of pieces) {
    const prev = merged[merged.length - 1];
    const combinedLength = prev ? prev.text.length + 1 + piece.text.length : piece.text.length;
    if (prev && piece.text.length < minChunkSize && combinedLength <= chunkSize) {
      prev.text = `${prev.text}\n${piece.text}`;
      prev.pageEnd = piece.page;
      continue;
    }
    merged.push({ text: piece.text, pageStart: piece.page, pageEnd: piece.page });
  }

  return merged.map((current, index) => {
    if (index === 0 || overlap === 0) {
      return { content: current.text, pageStart: current.pageStart, pageEnd: current.pageEnd };
    }
    const prev = merged[index - 1];
    const overlapText = tailOverlap(prev.text, overlap);
    return {
      content: overlapText ? `${overlapText}\n${current.text}` : current.text,
      pageStart: prev.pageEnd,
      pageEnd: current.pageEnd,
    };
  });
}

function normalize(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitToSize(text: string, size: number): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= size) return [cleaned];

  const separators = ["\n\n", "\n", ". ", " "];
  for (const separator of separators) {
    const index = cleaned.lastIndexOf(separator, size);
    if (index >= Math.floor(size * 0.4)) {
      const cut = index + separator.length;
      const head = cleaned.slice(0, cut).trim();
      const tail = cleaned.slice(cut).trim();
      if (head && tail) {
        return [head, ...splitToSize(tail, size)];
      }
    }
  }

  const head = cleaned.slice(0, size).trim();
  const tail = cleaned.slice(size).trim();
  return [head, ...splitToSize(tail, size)].filter(Boolean);
}

function tailOverlap(text: string, overlap: number): string {
  if (overlap <= 0 || !text) return "";
  if (text.length <= overlap) return text;
  const slice = text.slice(-overlap);
  const space = slice.search(/\s/);
  if (space >= 0 && space < slice.length / 2) {
    return slice.slice(space).trim();
  }
  return slice.trim();
}

export const DOCUMENT_CATEGORIES = ["who", "mohfw", "aiims", "icmr", "cdc", "nice", "other"] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export function isDocumentCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

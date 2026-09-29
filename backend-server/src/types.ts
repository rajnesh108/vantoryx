export type DocumentStatus = "processing" | "ready" | "failed";

export interface DocumentItem {
  id: string;
  originalName: string;
  status: DocumentStatus;
  pageCount: number | null;
  chunkCount: number;
  error: string | null;
  createdAt: string;
}

export interface PageText {
  page: number;
  text: string;
}

export interface ChunkDraft {
  content: string;
  pageStart: number;
  pageEnd: number;
}

export interface SearchHit {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  score: number;
}

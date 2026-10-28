export type DocumentStatus = "processing" | "ready" | "failed";

export interface DocumentItem {
  id: string;
  originalName: string;
  category: string;
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
  category: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  score: number;
}

export type AgentNode = "plan" | "route" | "retrieve" | "grade" | "rewrite" | "tool";

export interface AgentStep {
  node: AgentNode;
  detail: string;
  durationMs?: number;
}

export interface AgentRetrieval {
  queries: string[];
  chunkIds: string[];
  scores: number[];
}

export interface AgentTrace {
  queries: string[];
  categories: string[];
  attempts: number;
  sufficient: boolean;
  gradeReason: string;
  retrievals: AgentRetrieval[];
  steps: AgentStep[];
}

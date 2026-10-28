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

export interface Citation {
  chunkId: string;
  documentId: string;
  documentName: string;
  category?: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  score: number;
}

export interface AgentStep {
  node: "plan" | "route" | "retrieve" | "grade" | "rewrite" | "tool";
  detail: string;
  durationMs?: number;
}

export interface AgentTrace {
  queries: string[];
  categories: string[];
  attempts: number;
  sufficient: boolean;
  steps: AgentStep[];
}

export interface ChatResult {
  answer: string;
  citations: Citation[];
  model: string | null;
  agent?: AgentTrace | null;
  outcome?: AnswerOutcome;
  observation?: Observation;
}

export type AnswerOutcome = "answered" | "not_found" | "insufficient_evidence";

export interface HealthStatus {
  status: "ok" | "degraded";
  database: string;
  embeddings: string;
  llm: { model: string; baseUrl: string };
  mcp?: { enabled: boolean; servers: string[] };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const body = text ? (JSON.parse(text) as { error?: string }) : {};
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body as T;
}

export interface EvalCase {
  id: string;
  type: "simple" | "multi_hop" | "unanswerable";
  question: string;
  expectedOutcome: AnswerOutcome;
  relevantPhrases: string[];
  expectedFacts: string[];
  forbidden: string[];
}

export interface FixturePassage {
  chunkId: string;
  documentName: string;
  category: string;
  content: string;
}

export interface EvaluationDataset {
  cases: EvalCase[];
  passages: FixturePassage[];
}

export interface EvalCaseScore {
  id: string;
  type: EvalCase["type"];
  mode: "hybrid" | "agentic";
  question: string;
  error: string | null;
  outcome: AnswerOutcome | null;
  expectedOutcome: AnswerOutcome;
  recallAtK: number | null;
  answerQuality: number | null;
  sufficiencyCorrect: boolean | null;
  gradedSufficient: boolean | null;
  gradeReason: string | null;
  latencyMs: number;
  retries: number;
  retryAddedChunks: boolean | null;
  model: string | null;
  usage: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    estimated: boolean;
    costUsd: number;
  };
  queries: string[];
  citations: Array<{ chunkId: string; documentName: string; category: string; score: number; excerpt: string }>;
  answer: string;
}

export interface EvaluationReport {
  source: "fixture" | "index";
  k: number;
  generatedAt: string;
  summary: Array<{
    mode: "hybrid" | "agentic";
    type: EvalCase["type"] | "all";
    count: number;
    meanRecall: number | null;
    meanAnswerQuality: number | null;
    sufficiencyAccuracy: number | null;
    meanLatencyMs: number;
    meanRetries: number;
    meanLlmCalls: number;
    meanTokens: number;
    meanCostUsd: number;
  }>;
  findings: Array<{ kind: string; caseId: string; detail: string }>;
  cases: EvalCaseScore[];
}

export function getEvaluationDataset(): Promise<EvaluationDataset> {
  return request("/api/evaluation/dataset");
}

export function runEvaluation(body: {
  source: "fixture" | "index";
  modes: Array<"hybrid" | "agentic">;
}): Promise<EvaluationReport> {
  return request("/api/evaluation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface Observation {
  id: string;
  createdAt: string;
  question: string;
  path: "hybrid" | "agent";
  outcome: AnswerOutcome | "error";
  latencyMs: number;
  retrieveMs: number | null;
  generateMs: number | null;
  usage: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    estimated: boolean;
    costUsd: number;
  };
  model: string | null;
  citationCount: number;
  attempts: number | null;
  sufficient: boolean | null;
  error: string | null;
}

export interface ObservationSummary {
  count: number;
  meanLatencyMs: number | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
  byOutcome: Record<Observation["outcome"], number>;
  byPath: Record<Observation["path"], number>;
}

export interface ObservationLog {
  enabled: boolean;
  summary: ObservationSummary;
  observations: Observation[];
}

export function listObservations(): Promise<ObservationLog> {
  return request("/api/observations");
}

export function listDocuments(): Promise<DocumentItem[]> {
  return request("/api/documents");
}

export function uploadDocument(file: File): Promise<DocumentItem> {
  const data = new FormData();
  data.append("file", file);
  return request("/api/documents", { method: "POST", body: data });
}

export function deleteDocument(id: string): Promise<void> {
  return request(`/api/documents/${id}`, { method: "DELETE" });
}

export function askQuestion(question: string, documentIds: string[]): Promise<ChatResult> {
  return request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, documentIds }),
  });
}

export function login(username: string, password: string): Promise<{ username: string }> {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<void> {
  return request("/api/auth/logout", { method: "POST" });
}

export async function currentUser(): Promise<{ username: string } | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (response.status === 401) return null;
  const text = await response.text();
  const body = text ? (JSON.parse(text) as { username?: string; error?: string }) : {};
  if (!response.ok || !body.username) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return { username: body.username };
}

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch("/api/health");
  const text = await response.text();
  const body = text ? (JSON.parse(text) as HealthStatus) : null;
  if (!body || typeof body.status !== "string") {
    throw new Error(`API health check failed (${response.status})`);
  }
  return body;
}

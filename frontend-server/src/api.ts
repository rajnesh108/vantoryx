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

export interface ChatResult {
  answer: string;
  citations: Citation[];
  model: string | null;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  database: string;
  embeddings: string;
  llm: { model: string; baseUrl: string };
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

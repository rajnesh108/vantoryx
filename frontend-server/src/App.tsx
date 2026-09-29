import { useCallback, useEffect, useState } from "react";
import {
  askQuestion,
  deleteDocument,
  getHealth,
  listDocuments,
  uploadDocument,
  type DocumentItem,
  type HealthStatus,
} from "./api";
import { ChatPanel, type Turn } from "./components/ChatPanel";
import { DocumentPanel } from "./components/DocumentPanel";

export function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [turns, setTurns] = useState<Turn[]>([]);
  const [health, setHealth] = useState<HealthStatus | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listDocuments();
      setDocuments(next);
      setLoadError(null);
      setSelected((current) => {
        const updated = { ...current };
        for (const document of next) {
          if (updated[document.id] === undefined && document.status === "ready") {
            updated[document.id] = true;
          }
        }
        return updated;
      });
    } catch (reason) {
      setLoadError(messageOf(reason));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [refresh]);

  const processing = documents.some((document) => document.status === "processing");

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
      void getHealth()
        .then(setHealth)
        .catch(() => setHealth(null));
    }, processing ? 2000 : 15000);
    return () => window.clearInterval(timer);
  }, [processing, refresh]);

  const selectedIds = documents
    .filter((document) => selected[document.id] && document.status === "ready")
    .map((document) => document.id);

  async function handleUpload(file: File) {
    setUploading(true);
    setActionError(null);
    try {
      const created = await uploadDocument(file);
      setDocuments((current) => [created, ...current.filter((document) => document.id !== created.id)]);
    } catch (reason) {
      setActionError(messageOf(reason));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await deleteDocument(id);
      setDocuments((current) => current.filter((document) => document.id !== id));
    } catch (reason) {
      setActionError(messageOf(reason));
    }
  }

  async function handleAsk(question: string) {
    const id = crypto.randomUUID();
    setAsking(true);
    setActionError(null);
    setTurns((current) => [...current, { id, question, pending: true }]);
    try {
      const result = await askQuestion(question, selectedIds);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? { ...turn, pending: false, answer: result.answer, citations: result.citations, model: result.model }
            : turn
        )
      );
    } catch (reason) {
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, pending: false, error: messageOf(reason) } : turn))
      );
    } finally {
      setAsking(false);
    }
  }

  const banner = bannerFor(health, actionError, loadError);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">V1 · local RAG</p>
            <h1>MedRAG</h1>
          </div>
        </div>
        <p className="tagline">Medical PDFs stay on this machine. Answers cite the pages they came from.</p>
      </header>

      {banner && <div className={`banner ${banner.tone}`}>{banner.text}</div>}

      <main>
        <DocumentPanel
          documents={documents}
          selected={selected}
          uploading={uploading}
          onToggle={(id) => setSelected((current) => ({ ...current, [id]: !current[id] }))}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onError={setActionError}
        />
        <ChatPanel turns={turns} asking={asking} canAsk={selectedIds.length > 0} onAsk={(question) => void handleAsk(question)} />
      </main>
    </div>
  );
}

function bannerFor(
  health: HealthStatus | null | undefined,
  actionError: string | null,
  loadError: string | null
): { tone: string; text: string } | null {
  if (actionError) return { tone: "bad", text: actionError };
  if (health === undefined) return null;
  if (health === null) return { tone: "bad", text: "API is not reachable on port 4000." };
  if (health.database !== "ok") return { tone: "bad", text: `Database is unavailable. ${health.database}` };
  if (health.embeddings === "unavailable" || health.embeddings === "error") {
    return { tone: "bad", text: "Embedding service is unavailable. Start the Python service on port 8000." };
  }
  if (loadError) return { tone: "bad", text: loadError };
  if (health.embeddings === "loading") {
    return { tone: "info", text: "Local embedding model is loading. The first download can take a few minutes." };
  }
  return null;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong";
}

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  currentUser,
  deleteDocument,
  getHealth,
  listDocuments,
  login,
  logout,
  uploadDocument,
  type DocumentItem,
  type HealthStatus,
} from "../api";
import { DocumentList, DocumentPanel } from "../components/DocumentPanel";
import { Topbar } from "../components/Topbar";

type AdminSection = "upload" | "documents";

export function AdminPage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>("upload");

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments());
      setLoadError(null);
    } catch (reason) {
      setLoadError(messageOf(reason));
    }
  }, []);

  useEffect(() => {
    void currentUser()
      .then((session) => setUser(session?.username ?? null))
      .catch(() => setUser(null));
    void getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const processing = documents.some((document) => document.status === "processing");

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [refresh, user]);

  useEffect(() => {
    if (!user || !processing) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [processing, refresh, user]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const session = await login(username.trim(), password);
      setUser(session.username);
      setPassword("");
    } catch (reason) {
      setActionError(messageOf(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setActionError(null);
    try {
      await logout();
    } catch (reason) {
      setActionError(messageOf(reason));
      return;
    }
    setUser(null);
    setDocuments([]);
  }

  async function handleUpload(file: File, category: string) {
    setUploading(true);
    setActionError(null);
    try {
      const created = await uploadDocument(file, category);
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

  const banner = bannerFor(health, user ? actionError : null, user ? loadError : null);

  if (user === undefined) {
    return (
      <div className="app">
        <Topbar path={path} onNavigate={onNavigate} />
        <main className="narrow" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <Topbar path={path} onNavigate={onNavigate} />
        {actionError && <div className="banner bad">{actionError}</div>}
        <main className="narrow">
          <form className="login-card" onSubmit={(event) => void handleLogin(event)}>
            <div className="login-intro">
              <h2>Vantoryx Control Center</h2>
              <p>Sign in to manage your AI platform, knowledge sources, and system configurations.</p>
            </div>
            <label className="field">
              Username
              <input
                value={username}
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button type="submit" disabled={submitting || username.trim().length === 0 || password.length === 0}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Topbar path={path} onNavigate={onNavigate} />
      <div className="admin-shell">
        <nav className="admin-nav" aria-label="Admin">
          <button type="button" className={section === "upload" ? "active" : undefined} onClick={() => setSection("upload")}>
            <AdminIcon name="upload" />
            Upload
          </button>
          <button type="button" className={section === "documents" ? "active" : undefined} onClick={() => setSection("documents")}>
            <AdminIcon name="documents" />
            Documents
          </button>
        </nav>
        <div className="admin-stage">
          {banner && <div className={`banner ${banner.tone}`}>{banner.text}</div>}
          <main className="admin-content">
            <div className="admin-stack">
              <div className="admin-bar">
                <p>
                  Signed in as <strong>{user}</strong>
                </p>
                <button type="button" className="text-button sign-out" onClick={() => void handleLogout()}>
                  Sign out
                </button>
              </div>
              {section === "upload" ? (
                <DocumentPanel
                  documents={documents}
                  selected={{}}
                  uploading={uploading}
                  manage
                  onToggle={() => undefined}
                  onUpload={handleUpload}
                  onDelete={handleDelete}
                  onError={setActionError}
                />
              ) : (
                <section className="sidebar" aria-label="Uploaded documents">
                  <div className="sidebar-head">
                    <h2>Documents</h2>
                    <p>PDFs already saved for search.</p>
                  </div>
                  <DocumentList
                    documents={documents}
                    manage
                    selected={{}}
                    onToggle={() => undefined}
                    onDelete={handleDelete}
                  />
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function AdminIcon({ name }: { name: "documents" | "upload" }) {
  if (name === "upload") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V4.5" />
        <path d="M7.5 9 12 4.5 16.5 9" />
        <path d="M5 15.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-3.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7.2L19 8.2V20.5H7z" />
      <path d="M14.2 3.5V8.2H19" />
      <path d="M10 12.5h5.5M10 16h5.5" />
    </svg>
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

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
import { DocumentPanel } from "../components/DocumentPanel";

export function AdminPage() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    const timer = window.setInterval(() => {
      void refresh();
    }, processing ? 2000 : 15000);
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

  const banner = bannerFor(health, user ? actionError : null, user ? loadError : null);

  if (user === undefined) {
    return <main className="narrow" />;
  }

  if (!user) {
    return (
      <>
        {actionError && <div className="banner bad">{actionError}</div>}
        <main className="narrow">
          <form className="login-card" onSubmit={(event) => void handleLogin(event)}>
            <div>
              <h2>Admin sign in</h2>
              <p>Upload and remove indexed documents.</p>
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
      </>
    );
  }

  return (
    <>
      {banner && <div className={`banner ${banner.tone}`}>{banner.text}</div>}
      <main className="narrow manage">
        <div className="admin-stack">
          <div className="admin-bar">
            <p>
              Signed in as <strong>{user}</strong>
            </p>
            <button type="button" className="text-button sign-out" onClick={() => void handleLogout()}>
              Sign out
            </button>
          </div>
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
        </div>
      </main>
    </>
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

import { useEffect, useState } from "react";
import { askQuestion, getHealth, type HealthStatus } from "../api";
import { ChatPanel, type Turn } from "../components/ChatPanel";

export function SearchPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [health, setHealth] = useState<HealthStatus | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
    const timer = window.setInterval(() => {
      void getHealth()
        .then(setHealth)
        .catch(() => setHealth(null));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleAsk(question: string) {
    const id = crypto.randomUUID();
    setAsking(true);
    setActionError(null);
    setTurns((current) => [...current, { id, question, pending: true }]);
    try {
      const result = await askQuestion(question, []);
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

  const banner = bannerFor(health, actionError);

  return (
    <>
      {banner && <div className={`banner ${banner.tone}`}>{banner.text}</div>}
      <ChatPanel turns={turns} asking={asking} onAsk={(question) => void handleAsk(question)} />
    </>
  );
}

function bannerFor(
  health: HealthStatus | null | undefined,
  actionError: string | null
): { tone: string; text: string } | null {
  if (actionError) return { tone: "bad", text: actionError };
  if (health === undefined) return null;
  if (health === null) return { tone: "bad", text: "API is not reachable on port 4000." };
  if (health.database !== "ok") return { tone: "bad", text: `Database is unavailable. ${health.database}` };
  if (health.embeddings === "unavailable" || health.embeddings === "error") {
    return { tone: "bad", text: "Embedding service is unavailable. Start the Python service on port 8000." };
  }
  if (health.embeddings === "loading") {
    return { tone: "info", text: "Local embedding model is loading. The first download can take a few minutes." };
  }
  return null;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong";
}

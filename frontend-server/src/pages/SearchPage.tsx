import { useEffect, useState } from "react";
import { askQuestion, getHealth, getLlmOptions, type HealthStatus, type LlmOption } from "../api";
import { ChatPanel, type Turn } from "../components/ChatPanel";

export function SearchPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [health, setHealth] = useState<HealthStatus | null | undefined>(undefined);
  const [models, setModels] = useState<LlmOption[]>([]);
  const [preferred, setPreferred] = useState<{ provider: LlmOption["provider"]; model: string } | null>(null);
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

  useEffect(() => {
    void getLlmOptions()
      .then((catalog) => {
        setModels(catalog.options);
        setPreferred({ provider: catalog.provider, model: catalog.model });
      })
      .catch(() => setModels([]));
  }, []);

  async function handleAsk(question: string, llm: { provider: LlmOption["provider"]; model: string } | null) {
    const id = crypto.randomUUID();
    setAsking(true);
    setActionError(null);
    setTurns((current) => [...current, { id, question, pending: true }]);
    try {
      const result = await askQuestion(question, [], llm ?? undefined);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                pending: false,
                answer: result.answer,
                citations: result.citations,
                model: result.model,
                agent: result.agent,
                outcome: result.outcome,
                observation: result.observation,
              }
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
      <ChatPanel
        turns={turns}
        asking={asking}
        models={models}
        preferred={preferred}
        onAsk={(question, llm) => void handleAsk(question, llm)}
      />
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
  if (health.llm.status === "unavailable") {
    const where = `${health.llm.label} is unreachable at ${health.llm.baseUrl}.`;
    const text = health.llm.family === "cloud" ? where : `${where} Start the local model server.`;
    return { tone: "info", text };
  }
  if (health.llm.status === "model-missing") {
    const text =
      health.llm.family === "cloud"
        ? `${health.llm.label} does not list ${health.llm.model}.`
        : `Load ${health.llm.model} in ${health.llm.label}. The server is up.`;
    return { tone: "info", text };
  }
  return null;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong";
}

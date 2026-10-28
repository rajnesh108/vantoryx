import { useEffect, useState } from "react";
import { listObservations, type Observation, type ObservationLog } from "../api";

export function ObservationPage() {
  const [log, setLog] = useState<ObservationLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setLog(await listObservations());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const estimated = log?.observations.some((item) => item.usage.estimated) ?? false;

  return (
    <>
      {error && <div className="banner bad">{error}</div>}
      <main className="observe">
        <section className="eval-card">
          <div className="admin-bar">
            <h2>Request traces</h2>
            <button type="button" className="text-button sign-out" onClick={() => void refresh()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <p>
            Each chat question records how long retrieval and the answer took, how many model calls it made, and the
            token cost. The list is kept in this API process and clears when the process restarts.
          </p>
          {log && !log.enabled && <p>Recording is off. Set OBSERVATION_ENABLED=true to keep traces.</p>}
          {log && log.summary.count === 0 && log.enabled && <p>No questions have been recorded yet.</p>}
          {log && log.summary.count > 0 && (
            <p className="eval-meta">
              {log.summary.count} {log.summary.count === 1 ? "request" : "requests"} · mean{" "}
              {log.summary.meanLatencyMs == null ? "n/a" : latency(log.summary.meanLatencyMs)} ·{" "}
              {log.summary.totalPromptTokens + log.summary.totalCompletionTokens} tokens · {money(log.summary.totalCostUsd)}
              {" · "}
              {log.summary.byPath.agent} agent · {log.summary.byPath.hybrid} hybrid
            </p>
          )}
          {estimated && <p className="eval-note">Some token counts were estimated from text length.</p>}
        </section>
        {log && log.observations.length > 0 && (
          <section className="eval-card">
            <div className="eval-scroll">
              <table className="eval-table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Path</th>
                    <th scope="col">Outcome</th>
                    <th scope="col">Latency</th>
                    <th scope="col">Retrieve</th>
                    <th scope="col">Answer</th>
                    <th scope="col">Calls</th>
                    <th scope="col">Tokens</th>
                    <th scope="col">Cost</th>
                    <th scope="col">Question</th>
                  </tr>
                </thead>
                <tbody>
                  {log.observations.map((item) => (
                    <tr key={item.id}>
                      <td>{item.createdAt.slice(11, 19)}</td>
                      <td>{item.path === "agent" ? "Agent" : "Hybrid"}</td>
                      <td>{outcomeLabel(item.outcome)}</td>
                      <td>{latency(item.latencyMs)}</td>
                      <td>{item.retrieveMs == null ? "n/a" : `${item.retrieveMs} ms`}</td>
                      <td>{item.generateMs == null ? "n/a" : `${item.generateMs} ms`}</td>
                      <td>{item.usage.calls}</td>
                      <td>
                        {item.usage.promptTokens + item.usage.completionTokens}
                        {item.usage.estimated ? "*" : ""}
                      </td>
                      <td>{money(item.usage.costUsd)}</td>
                      <td>{item.error ?? item.question}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function outcomeLabel(outcome: Observation["outcome"]): string {
  if (outcome === "answered") return "Answered";
  if (outcome === "not_found") return "Not found";
  if (outcome === "insufficient_evidence") return "Insufficient";
  return "Error";
}

function latency(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.round(value)} ms`;
}

function money(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.0001) return "<$0.0001";
  return `$${value.toFixed(4)}`;
}

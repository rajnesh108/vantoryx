import { useEffect, useState, type FormEvent } from "react";
import {
  getEvaluationDataset,
  runEvaluation,
  type AnswerOutcome,
  type EvalCase,
  type EvalCaseScore,
  type EvaluationDataset,
  type EvaluationReport,
} from "../api";

export function EvaluationPage() {
  const [dataset, setDataset] = useState<EvaluationDataset | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [source, setSource] = useState<"fixture" | "index">("fixture");
  const [hybrid, setHybrid] = useState(true);
  const [agentic, setAgentic] = useState(true);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    void getEvaluationDataset()
      .then(setDataset)
      .catch((reason: unknown) => setDatasetError(messageOf(reason)));
  }, []);

  async function handleRun(event: FormEvent) {
    event.preventDefault();
    const modes = [hybrid ? "hybrid" : "", agentic ? "agentic" : ""].filter(
      (mode): mode is "hybrid" | "agentic" => mode === "hybrid" || mode === "agentic"
    );
    if (modes.length === 0) return;
    setRunning(true);
    setRunError(null);
    try {
      setReport(await runEvaluation({ source, modes }));
    } catch (reason) {
      setRunError(messageOf(reason));
    } finally {
      setRunning(false);
    }
  }

  const banner = datasetError || runError;
  const estimated = report?.cases.some((item) => item.usage.estimated) ?? false;

  return (
    <>
      {banner && <div className="banner bad">{banner}</div>}
      <main className="eval">
        <section className="eval-card">
          <h2>RAG and agent evaluation</h2>
          <p>
            Six fixed questions compare hybrid retrieval with the retrieval agent. Two are single-fact lookups, two need
            more than one passage, and two are unanswerable from the notes. Recall checks labeled phrases in the top
            passages. Answer quality checks expected facts, or whether an unanswerable question was left unanswered.
          </p>
          <form className="eval-form" onSubmit={(event) => void handleRun(event)}>
            <fieldset>
              <legend>Corpus</legend>
              <label>
                <input
                  type="radio"
                  name="eval-source"
                  checked={source === "fixture"}
                  onChange={() => setSource("fixture")}
                />
                Fixture notes
              </label>
              <label>
                <input
                  type="radio"
                  name="eval-source"
                  checked={source === "index"}
                  onChange={() => setSource("index")}
                />
                Indexed PDFs
              </label>
            </fieldset>
            <fieldset>
              <legend>Retrieval</legend>
              <label>
                <input type="checkbox" checked={hybrid} onChange={(event) => setHybrid(event.target.checked)} />
                Hybrid
              </label>
              <label>
                <input type="checkbox" checked={agentic} onChange={(event) => setAgentic(event.target.checked)} />
                Agentic
              </label>
            </fieldset>
            <button type="submit" disabled={running || (!hybrid && !agentic)}>
              {running ? "Running the question set…" : "Run evaluation"}
            </button>
          </form>
          <p className="eval-note">
            {source === "fixture"
              ? "Fixture runs four bundled notes and does not read the database. It still calls the chat model."
              : "Indexed PDFs runs these questions on ready documents. The labels were written for the fixture notes, so recall can be zero on a different corpus."}
            {" "}
            A full run calls the model for each plan, grade, and answer, and can take several minutes.
          </p>
        </section>

        {report && (
          <>
            <section className="eval-card">
              <h2>Summary</h2>
              <p className="eval-meta">
                {report.source === "fixture" ? "Fixture notes" : "Indexed PDFs"} · Recall@{report.k} · {report.generatedAt}
              </p>
              {report.summary.length === 0 ? (
                <p>No question finished, so there is no average to show.</p>
              ) : (
                <div className="eval-scroll">
                  <table className="eval-table">
                    <thead>
                      <tr>
                        <th scope="col">Mode</th>
                        <th scope="col">Type</th>
                        <th scope="col">Cases</th>
                        <th scope="col">Recall</th>
                        <th scope="col">Quality</th>
                        <th scope="col">Sufficiency</th>
                        <th scope="col">Latency</th>
                        <th scope="col">Retries</th>
                        <th scope="col">Calls</th>
                        <th scope="col">Tokens</th>
                        <th scope="col">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.summary.map((row) => (
                        <tr key={`${row.mode}-${row.type}`}>
                          <td>{modeLabel(row.mode)}</td>
                          <td>{typeLabel(row.type)}</td>
                          <td>{row.count}</td>
                          <td>{percent(row.meanRecall)}</td>
                          <td>{percent(row.meanAnswerQuality)}</td>
                          <td>{percent(row.sufficiencyAccuracy)}</td>
                          <td>{latency(row.meanLatencyMs)}</td>
                          <td>{figure(row.meanRetries)}</td>
                          <td>{figure(row.meanLlmCalls)}</td>
                          <td>{figure(row.meanTokens)}</td>
                          <td>{money(row.meanCostUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {estimated && <p className="eval-note">Token counts marked on a question were estimated from text length.</p>}
            </section>

            <section className="eval-card">
              <h2>Findings</h2>
              {report.findings.length === 0 ? (
                <p>Nothing to flag on this run.</p>
              ) : (
                <ul className="eval-findings">
                  {report.findings.map((finding) => (
                    <li key={`${finding.kind}-${finding.caseId}-${finding.detail}`}>{finding.detail}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="eval-card">
              <h2>Questions</h2>
              {report.cases.map((item) => (
                <details key={`${item.mode}-${item.id}`} className="eval-case">
                  <summary>
                    <span className="eval-type">{typeLabel(item.type)}</span>
                    <span>{modeLabel(item.mode)}</span>
                    <strong>{item.id}</strong>
                    <span>{item.error ? "Failed" : outcomeLabel(item.outcome)}</span>
                  </summary>
                  <CaseBody item={item} />
                </details>
              ))}
            </section>
          </>
        )}

        <section className="eval-card">
          <h2>Question set</h2>
          {!dataset && !datasetError && <p>Loading the question set…</p>}
          {dataset && (
            <>
              <ul className="eval-questions">
                {dataset.cases.map((item) => (
                  <li key={item.id}>
                    <span className="eval-type">{typeLabel(item.type)}</span>
                    <span>{item.question}</span>
                  </li>
                ))}
              </ul>
              <details className="eval-passages">
                <summary>Fixture notes ({dataset.passages.length})</summary>
                {dataset.passages.map((passage) => (
                  <p key={passage.chunkId}>
                    <strong>{passage.documentName}</strong> {passage.content}
                  </p>
                ))}
              </details>
            </>
          )}
        </section>
      </main>
    </>
  );
}

function CaseBody({ item }: { item: EvalCaseScore }) {
  if (item.error) return <p className="doc-error">{item.error}</p>;
  const tokens = item.usage.promptTokens + item.usage.completionTokens;
  return (
    <div className="eval-detail">
      <p>{item.question}</p>
      <p>
        Expected {outcomeLabel(item.expectedOutcome)}. Outcome {outcomeLabel(item.outcome)}. Grade{" "}
        {gradeLabel(item.gradedSufficient)}.
        {item.gradeReason ? ` ${item.gradeReason}` : ""}
      </p>
      <p>
        Recall {percent(item.recallAtK)} · Quality {percent(item.answerQuality)} · {latency(item.latencyMs)} ·{" "}
        {item.retries} {item.retries === 1 ? "retry" : "retries"} · {item.usage.calls}{" "}
        {item.usage.calls === 1 ? "call" : "calls"} · {tokens} tokens{item.usage.estimated ? " estimated" : ""} ·{" "}
        {money(item.usage.costUsd)}
      </p>
      {item.queries.length > 0 && <p>Searches: {item.queries.join(" · ")}</p>}
      {item.answer && <p>{item.answer}</p>}
      {item.citations.length > 0 && (
        <ul>
          {item.citations.map((citation) => (
            <li key={citation.chunkId}>
              <strong>{citation.documentName}</strong> {citation.excerpt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function typeLabel(type: EvalCase["type"] | "all"): string {
  if (type === "simple") return "Simple lookup";
  if (type === "multi_hop") return "Multi-hop";
  if (type === "unanswerable") return "Unanswerable";
  return "All";
}

function modeLabel(mode: "hybrid" | "agentic"): string {
  return mode === "hybrid" ? "Hybrid" : "Agentic";
}

function outcomeLabel(outcome: AnswerOutcome | null): string {
  if (outcome === "answered") return "answered";
  if (outcome === "not_found") return "not found";
  if (outcome === "insufficient_evidence") return "insufficient evidence";
  return "unavailable";
}

function gradeLabel(sufficient: boolean | null): string {
  if (sufficient === true) return "sufficient";
  if (sufficient === false) return "not sufficient";
  return "unavailable";
}

function percent(value: number | null): string {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function latency(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.round(value)} ms`;
}

function figure(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function money(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.0001) return "<$0.0001";
  return `$${value.toFixed(4)}`;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong";
}

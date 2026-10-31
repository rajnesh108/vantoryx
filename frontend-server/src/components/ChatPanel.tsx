import { useState } from "react";
import type { AgentTrace, AnswerOutcome, Citation, LlmOption, Observation } from "../api";
import { pageLabel } from "../format";
import { Logo } from "./Logo";

export interface Turn {
  id: string;
  question: string;
  answer?: string;
  citations?: Citation[];
  model?: string | null;
  agent?: AgentTrace | null;
  outcome?: AnswerOutcome;
  observation?: Observation;
  error?: string;
  pending?: boolean;
}

interface ChatPanelProps {
  turns: Turn[];
  asking: boolean;
  models: LlmOption[];
  preferred: { provider: LlmOption["provider"]; model: string } | null;
  onAsk: (question: string, llm: { provider: LlmOption["provider"]; model: string } | null) => void;
}

const FEATURES = [
  {
    title: "RAG Search",
    text: "Find relevant information from healthcare documents and guidelines.",
    tone: "blue",
    icon: "search",
  },
  {
    title: "AI Agents",
    text: "Go beyond search with agentic workflows and tool integration.",
    tone: "violet",
    icon: "brain",
  },
  {
    title: "Flexible Inference",
    text: "Use cloud LLMs, local models or your own infrastructure (vLLM / Ollama).",
    tone: "mint",
    icon: "cloud",
  },
  {
    title: "Trusted Sources",
    text: "Powered by authoritative healthcare documents (WHO, MoHFW, AIIMS and more).",
    tone: "green",
    icon: "shield",
  },
  {
    title: "Scalable Data Pipeline",
    text: "Ingest, chunk, embed and store with pgvector for high-performance retrieval.",
    tone: "violet",
    icon: "stack",
  },
  {
    title: "Observability & Evaluation",
    text: "Track performance, measure accuracy and improve continuously.",
    tone: "blue",
    icon: "chart",
  },
] as const;

const NODE_LABELS = {
  plan: "Plan",
  route: "Route",
  retrieve: "Retrieve",
  grade: "Grade",
  rewrite: "Rewrite",
  tool: "Tool",
} as const;

const ORGANIZATIONS: Record<string, string> = {
  who: "WHO",
  mohfw: "MoHFW",
  aiims: "AIIMS",
  icmr: "ICMR",
  cdc: "CDC",
  nice: "NICE",
  other: "Other publishers",
  tool: "Tool",
};

const PREVIEW_SOURCES = [
  ["WHO", "Page 12"],
  ["MoHFW", "Page 45"],
  ["AIIMS", "Page 23"],
];

export function ChatPanel({ turns, asking, models, preferred, onAsk }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [modelKey, setModelKey] = useState("");
  const latest = turns[turns.length - 1];
  const selected = pickModel(models, modelKey, preferred);

  function submit(raw = question) {
    const trimmed = raw.trim();
    if (!trimmed || asking) return;
    onAsk(trimmed, selected ? { provider: selected.provider, model: selected.model } : null);
  }

  return (
    <div className="landing">
      <section className="landing-copy">
        <div className="brand-lockup">
          <Logo className="brand-mark" />
          <div>
            <h1>Vantoryx</h1>
          </div>
        </div>
        <p className="platform">AI Systems &amp; Inference Platform</p>
        <p className="mission">
          Vantoryx helps you search and understand healthcare information using the power of AI. It combines advanced
          retrieval, agentic workflows and local or cloud inference to deliver accurate, grounded answers from trusted
          medical sources.
        </p>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature">
              <span className={`feature-icon ${feature.tone}`}>
                <FeatureIcon name={feature.icon} />
              </span>
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
              {feature.title === "Observability & Evaluation" && (
                <>
                  <a className="feature-more" href="/evaluate">
                    Open evaluation
                  </a>
                  <a className="feature-more" href="/observe">
                    Open observability
                  </a>
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="landing-insight">
        <p className="formula">
          Real documents <span>+</span> Advanced AI <span>=</span> Better healthcare insights
        </p>
        <label className="model-pick">
          <span>Model</span>
          <select
            aria-label="Model"
            value={selected ? choiceKey(selected) : ""}
            disabled={asking || models.length === 0}
            onChange={(event) => setModelKey(event.target.value)}
          >
            {models.length === 0 && <option value="">Loading models…</option>}
            {models.map((model) => (
              <option key={choiceKey(model)} value={choiceKey(model)} disabled={!model.available}>
                {model.label} · {model.model}
                {model.detail ? ` — ${model.detail}` : ""}
              </option>
            ))}
          </select>
        </label>
        <form
          className="pill-search"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FeatureIcon name="search" />
          <input
            type="text"
            enterKeyHint="search"
            value={question}
            placeholder="What are the guidelines for TB prevention?"
            aria-label="Search healthcare documents"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              submit(event.currentTarget.value);
            }}
          />
          <button type="submit" aria-label="Search" disabled={asking || question.trim().length === 0}>
            <Arrow />
          </button>
        </form>

        <div className="insight-stage">
          <div className="source-stack">
            <article className="source-tile who">
              <Globe />
              <strong>WHO</strong>
            </article>
            <article className="source-tile">
              <Emblem />
              <strong>MoHFW</strong>
              <small>Government of India</small>
            </article>
            <article className="source-tile">
              <Caduceus />
              <strong>AIIMS</strong>
            </article>
            <article className="source-tile more">
              <DocsIcon />
              <small>and more…</small>
            </article>
          </div>
          <svg className="source-links" viewBox="0 0 80 250" aria-hidden="true">
            <path d="M2 36C48 36 28 108 78 112" />
            <path d="M2 112C42 112 40 124 78 128" />
            <path d="M2 186C52 186 32 148 78 140" />
          </svg>
          <article className="answer-card">
            <h2>
              <Spark /> AI Answer
            </h2>
            {!latest && (
              <p>
                According to the WHO guidelines on tuberculosis preventive treatment, preventive treatment is
                recommended for people living with HIV, close contacts of active TB cases, and other high-risk groups…
              </p>
            )}
            {latest?.pending && <p className="pending">Planning the search across trusted sources…</p>}
            {latest?.error && <p className="doc-error">{latest.error}</p>}
            {latest?.outcome && latest.outcome !== "answered" && (
              <p className="outcome-label">{latest.outcome === "not_found" ? "Not found" : "Insufficient evidence"}</p>
            )}
            {latest?.answer && <AnswerText text={latest.answer} />}
            {latest?.observation && <p className="observe-line">{observationLine(latest.observation)}</p>}
            {latest?.agent && latest.agent.steps.length > 0 && (
              <>
                <h3>Agent</h3>
                <ul>
                  {latest.agent.steps.map((step, index) => (
                    <li key={`${step.node}-${index}`} className="agent-step">
                      <span>{step.detail}</span>
                      <span>
                        {NODE_LABELS[step.node]}
                        {step.durationMs != null ? ` · ${step.durationMs} ms` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3>
              <DocsIcon /> Sources
            </h3>
            <ul>
              {!latest &&
                PREVIEW_SOURCES.map(([name, page]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <span>{page}</span>
                  </li>
                ))}
              {latest?.citations?.slice(0, 4).map((citation) => (
                <li key={citation.chunkId}>
                  <span>{organizationName(citation.category)}</span>
                  <span>
                    {citation.category === "tool" ? citation.documentName : pageLabel(citation.pageStart, citation.pageEnd)}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="wave-wrap" aria-hidden="true">
          <svg className="wave" viewBox="0 0 640 160" preserveAspectRatio="none">
            <path
              d="M0 90C80 90 90 20 180 28C280 38 300 120 400 112C500 104 520 40 640 48V160H0Z"
              fill="url(#wave-fill)"
            />
            <path d="M250 78h36l10-22 16 44 14-28 8 6h40" fill="none" stroke="#0e8f96" strokeWidth="3" strokeLinecap="round" />
            <defs>
              <linearGradient id="wave-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e5f6f7" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#b7e0e3" stopOpacity="0.95" />
              </linearGradient>
            </defs>
          </svg>
          <span className="plus-badge">+</span>
        </div>
      </section>
      <footer className="landing-foot">
        <p>RAG · Agents · LLMs · Inference · Healthcare</p>
        <p>Vantoryx — Building the next generation of AI systems for better healthcare.</p>
      </footer>
    </div>
  );
}

function choiceKey(model: LlmOption): string {
  return `${model.provider}\t${model.model}`;
}

function pickModel(
  models: LlmOption[],
  key: string,
  preferred: { provider: LlmOption["provider"]; model: string } | null
): LlmOption | undefined {
  const chosen = models.find((model) => model.available && choiceKey(model) === key);
  if (chosen) return chosen;
  if (!key && preferred) {
    const match = models.find(
      (model) =>
        model.available &&
        model.provider === preferred.provider &&
        (model.model === preferred.model || model.model.split(":")[0] === preferred.model)
    );
    if (match) return match;
  }
  return models.find((model) => model.available);
}

function organizationName(category: string | undefined): string {
  if (!category) return ORGANIZATIONS.other;
  return ORGANIZATIONS[category.toLowerCase()] ?? ORGANIZATIONS.other;
}

function observationLine(observation: Observation): string {
  const tokens = observation.usage.promptTokens + observation.usage.completionTokens;
  const retrieve = observation.retrieveMs == null ? "" : ` · retrieve ${observation.retrieveMs} ms`;
  const generate = observation.generateMs == null ? "" : ` · answer ${observation.generateMs} ms`;
  const estimated = observation.usage.estimated ? " estimated" : "";
  return `${latencyLabel(observation.latencyMs)}${retrieve}${generate} · ${observation.usage.calls} ${observation.usage.calls === 1 ? "call" : "calls"} · ${tokens} tokens${estimated} · ${moneyLabel(observation.usage.costUsd)}`;
}

function latencyLabel(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.round(value)} ms`;
}

function moneyLabel(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.0001) return "<$0.0001";
  return `$${value.toFixed(4)}`;
}

function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p>
      {parts.map((part, index) =>
        /^\[\d+\]$/.test(part) ? (
          <sup key={index} className="cite-mark">
            {part}
          </sup>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </p>
  );
}

function FeatureIcon({ name }: { name: string }) {
  if (name === "brain") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 7a3 3 0 0 1 6 0 3 3 0 0 1 2.8 4.2A3 3 0 0 1 16 16.5V18H8v-1.5a3 3 0 0 1-1.8-5.3A3 3 0 0 1 9 7z" />
        <path d="M12 7v11M9 11h6" />
      </svg>
    );
  }
  if (name === "cloud") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.5 3.5 0 0 0 7 18z" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 3v6c0 4.2-2.8 7.2-7 9-4.2-1.8-7-4.8-7-9V6l7-3z" />
      </svg>
    );
  }
  if (name === "stack") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18h16M6 16l4-5 3 3 5-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Spark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3z" />
    </svg>
  );
}

function Globe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4c2.4 2.6 2.4 13.4 0 16M12 4c-2.4 2.6-2.4 13.4 0 16" />
    </svg>
  );
}

function Emblem() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10M8 10h8M9 14h6" />
    </svg>
  );
}

function Caduceus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v16M9 7c0 2 6 2 6 4s-6 2-6 4 6 2 6 4" />
      <circle cx="12" cy="5" r="1.2" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

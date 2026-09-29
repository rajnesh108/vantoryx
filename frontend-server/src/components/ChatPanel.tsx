import { useEffect, useRef, useState } from "react";
import type { Citation } from "../api";
import { matchLabel, pageLabel } from "../format";

export interface Turn {
  id: string;
  question: string;
  answer?: string;
  citations?: Citation[];
  model?: string | null;
  error?: string;
  pending?: boolean;
}

interface ChatPanelProps {
  turns: Turn[];
  asking: boolean;
  canAsk: boolean;
  onAsk: (question: string) => void;
}

const SUGGESTIONS = [
  "What is the main conclusion?",
  "Which values or thresholds are stated?",
  "Summarize the contraindications that appear in the text.",
];

export function ChatPanel({ turns, asking, canAsk, onAsk }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  function submit(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || asking || !canAsk) return;
    onAsk(trimmed);
    setQuestion("");
  }

  return (
    <section className="chat">
      <div className="thread">
        {turns.length === 0 && (
          <div className="intro">
            <h2>Ask the uploaded documents</h2>
            <ol>
              <li>The PDF is stored on this machine.</li>
              <li>Text is extracted and split into overlapping chunks.</li>
              <li>A local model embeds each chunk.</li>
              <li>pgvector returns the closest passages.</li>
              <li>The language model answers from those passages and cites them.</li>
            </ol>
            <div className="suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => submit(suggestion)} disabled={!canAsk || asking}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <article key={turn.id} className="turn">
            <p className="question">{turn.question}</p>
            {turn.pending && <p className="pending">Searching indexed passages…</p>}
            {turn.error && <p className="doc-error">{turn.error}</p>}
            {turn.answer && <AnswerText text={turn.answer} />}
            {turn.model && <p className="model-line">Answered with {turn.model}</p>}
            {turn.citations && turn.citations.length > 0 && (
              <div className="citations">
                <h3>Citations</h3>
                {turn.citations.map((citation, index) => (
                  <CitationCard key={citation.chunkId} citation={citation} index={index + 1} />
                ))}
              </div>
            )}
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          value={question}
          placeholder={canAsk ? "Ask about the selected documents" : "Index a PDF before asking"}
          disabled={!canAsk || asking}
          rows={3}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-row">
          <p>Answers stay tied to the retrieved pages. This is document search, not medical advice.</p>
          <button type="submit" disabled={!canAsk || asking || question.trim().length === 0}>
            {asking ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="answer">
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

function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const long = citation.content.length > 360;
  const excerpt = long ? `${citation.content.slice(0, 360).trim()}…` : citation.content;
  return (
    <article className="citation">
      <header>
        <span className="cite-index">[{index}]</span>
        <strong>{citation.documentName}</strong>
        <span>{pageLabel(citation.pageStart, citation.pageEnd)}</span>
        <span>{matchLabel(citation.score)}</span>
      </header>
      <p>{excerpt}</p>
      {long && (
        <details>
          <summary>Show full passage</summary>
          <p>{citation.content}</p>
        </details>
      )}
    </article>
  );
}

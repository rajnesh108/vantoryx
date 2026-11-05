import { useRef, useState } from "react";
import type { DocumentItem } from "../api";

interface DocumentPanelProps {
  documents: DocumentItem[];
  selected: Record<string, boolean>;
  uploading: boolean;
  manage: boolean;
  onToggle: (id: string) => void;
  onUpload: (file: File, category: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onError: (message: string) => void;
}

export function DocumentPanel({
  documents,
  selected,
  uploading,
  manage,
  onToggle,
  onUpload,
  onDelete,
  onError,
}: DocumentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState("");

  async function takeFile(file: File | undefined) {
    if (!file || uploading) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      onError("Only PDF files are supported.");
      return;
    }
    if (!category) {
      onError("Choose a document category.");
      return;
    }
    await onUpload(file, category);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2>{manage ? "Make your PDFs searchable" : "Search scope"}</h2>
        {manage ? (
          <>
            <p>
              Upload a PDF containing selectable text. Vantoryx will extract its content and make it available for
              intelligent search and retrieval.
            </p>
            <p>Scanned PDFs or image-only pages are currently not supported.</p>
          </>
        ) : (
          <p>Choose ready documents to search. New PDFs are added from the admin panel.</p>
        )}
      </div>

      {manage && (
        <>
          <label className="field">
            Publisher
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Choose a publisher</option>
              {PUBLISHERS.map((publisher) => (
                <option key={publisher.id} value={publisher.id}>
                  {publisher.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`dropzone${dragging ? " dragging" : ""}`}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void takeFile(event.dataTransfer.files[0]);
            }}
          >
            <span>{uploading ? "Uploading…" : "Drop a medical PDF"}</span>
            <small>or click to browse · 40 MB max</small>
          </button>
          <input
            ref={inputRef}
            className="file-input"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              void takeFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </>
      )}

      {manage ? null : (
        <DocumentList
          documents={documents}
          manage={false}
          selected={selected}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      )}
    </aside>
  );
}

export function DocumentList({
  documents,
  manage,
  selected,
  onToggle,
  onDelete,
}: {
  documents: DocumentItem[];
  manage: boolean;
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <ul className="doc-list">
      {documents.length === 0 && (
        <li className="empty-docs">{manage ? "No documents yet." : "No documents are ready to search yet."}</li>
      )}
      {documents.map((document) => (
        <li key={document.id} className={`doc-card status-${document.status}`}>
          <label>
            {manage ? null : (
              <input
                type="checkbox"
                checked={Boolean(selected[document.id]) && document.status === "ready"}
                disabled={document.status !== "ready"}
                onChange={() => onToggle(document.id)}
              />
            )}
            <span>
              <strong>{document.originalName}</strong>
              <small>
                {publisherName(document.category)}
                {" · "}
                {labelFor(document)}
                {document.pageCount != null ? ` · ${document.pageCount} pages` : ""}
                {document.chunkCount > 0 ? ` · ${document.chunkCount} chunks` : ""}
              </small>
            </span>
          </label>
          {document.status === "processing" && <div className="progress" />}
          {document.error && <p className="doc-error">{document.error}</p>}
          {manage && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                if (window.confirm(`Remove ${document.originalName}?`)) {
                  void onDelete(document.id);
                }
              }}
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const PUBLISHERS = [
  { id: "who", label: "WHO" },
  { id: "mohfw", label: "MoHFW" },
  { id: "aiims", label: "AIIMS" },
  { id: "icmr", label: "ICMR" },
  { id: "cdc", label: "CDC" },
  { id: "nice", label: "NICE" },
  { id: "other", label: "Other publishers" },
] as const;

function publisherName(category: string | undefined): string {
  return PUBLISHERS.find((publisher) => publisher.id === category)?.label ?? "Other publishers";
}

function labelFor(document: DocumentItem): string {
  if (document.status === "processing") return "Preparing";
  if (document.status === "failed") return "Failed";
  return "Ready";
}

import { useRef, useState } from "react";
import type { DocumentItem } from "../api";

interface DocumentPanelProps {
  documents: DocumentItem[];
  selected: Record<string, boolean>;
  uploading: boolean;
  onToggle: (id: string) => void;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onError: (message: string) => void;
}

export function DocumentPanel({
  documents,
  selected,
  uploading,
  onToggle,
  onUpload,
  onDelete,
  onError,
}: DocumentPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function takeFile(file: File | undefined) {
    if (!file || uploading) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      onError("Only PDF files are supported.");
      return;
    }
    await onUpload(file);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2>Documents</h2>
        <p>Text-based PDFs are indexed locally. Scanned pages without a text layer cannot be searched in V1.</p>
      </div>

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

      <ul className="doc-list">
        {documents.length === 0 && <li className="empty-docs">No documents yet.</li>}
        {documents.map((document) => (
          <li key={document.id} className={`doc-card status-${document.status}`}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(selected[document.id]) && document.status === "ready"}
                disabled={document.status !== "ready"}
                onChange={() => onToggle(document.id)}
              />
              <span>
                <strong>{document.originalName}</strong>
                <small>
                  {labelFor(document)}
                  {document.pageCount != null ? ` · ${document.pageCount} pages` : ""}
                  {document.chunkCount > 0 ? ` · ${document.chunkCount} chunks` : ""}
                </small>
              </span>
            </label>
            {document.status === "processing" && <div className="progress" />}
            {document.error && <p className="doc-error">{document.error}</p>}
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
          </li>
        ))}
      </ul>
    </aside>
  );
}

function labelFor(document: DocumentItem): string {
  if (document.status === "processing") return "Indexing";
  if (document.status === "failed") return "Failed";
  return "Ready";
}

import { pool } from "./pool";
import type { DocumentItem, DocumentStatus } from "../types";

interface DocumentRow {
  id: string;
  original_name: string;
  storage_path: string;
  status: DocumentStatus;
  page_count: number | null;
  error: string | null;
  created_at: Date | string;
  chunk_count: number | string;
}

const documentSelect = `
  SELECT d.id, d.original_name, d.storage_path, d.status, d.page_count, d.error, d.created_at,
         COUNT(c.id)::int AS chunk_count
  FROM documents d
  LEFT JOIN chunks c ON c.document_id = d.id
`;

function mapDocument(row: DocumentRow): DocumentItem {
  return {
    id: row.id,
    originalName: row.original_name,
    status: row.status,
    pageCount: row.page_count,
    chunkCount: Number(row.chunk_count ?? 0),
    error: row.error,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function insertDocument(input: {
  id: string;
  originalName: string;
  storagePath: string;
}): Promise<DocumentItem> {
  await pool.query(
    `INSERT INTO documents (id, original_name, storage_path, status)
     VALUES ($1, $2, $3, 'processing')`,
    [input.id, input.originalName, input.storagePath]
  );
  const created = await getDocument(input.id);
  if (!created) {
    throw new Error("Document was not saved");
  }
  return created;
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const result = await pool.query<DocumentRow>(
    `${documentSelect} GROUP BY d.id ORDER BY d.created_at DESC`
  );
  return result.rows.map(mapDocument);
}

export async function getDocument(id: string): Promise<DocumentItem | null> {
  const result = await pool.query<DocumentRow>(
    `${documentSelect} WHERE d.id = $1 GROUP BY d.id`,
    [id]
  );
  const row = result.rows[0];
  return row ? mapDocument(row) : null;
}

export async function getStoragePath(id: string): Promise<string | null> {
  const result = await pool.query<{ storage_path: string }>(
    "SELECT storage_path FROM documents WHERE id = $1",
    [id]
  );
  return result.rows[0]?.storage_path ?? null;
}

export async function updateDocument(
  id: string,
  patch: { status: DocumentStatus; pageCount?: number | null; error: string | null }
): Promise<void> {
  await pool.query(
    `UPDATE documents
     SET status = $2,
         page_count = COALESCE($3, page_count),
         error = $4,
         updated_at = now()
     WHERE id = $1`,
    [id, patch.status, patch.pageCount ?? null, patch.error]
  );
}

export async function deleteDocument(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM documents WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

import { pool } from "../db/pool";
import { toVectorLiteral } from "../db/vector";
import { config } from "../config";
import type { SearchHit } from "../types";

interface SearchRow {
  id: string;
  document_id: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  original_name: string;
  category: string;
  score: number | string;
}

export async function searchSimilar(
  embedding: number[],
  scope: { documentIds?: string[]; categories?: string[] }
): Promise<SearchHit[]> {
  const values: unknown[] = [toVectorLiteral(embedding), config.topK];
  const filters: string[] = [];
  const documentIds = scope.documentIds ?? [];
  const categories = scope.categories ?? [];
  if (documentIds.length > 0) {
    values.push(documentIds);
    filters.push(`c.document_id = ANY($${values.length}::uuid[])`);
  }
  if (categories.length > 0) {
    values.push(categories);
    filters.push(`d.category = ANY($${values.length}::text[])`);
  }
  const where = filters.length > 0 ? `AND ${filters.join(" AND ")}` : "";

  const result = await pool.query<SearchRow>(
    `SELECT c.id, c.document_id, c.content, c.page_start, c.page_end, d.original_name, d.category,
            1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.status = 'ready'
       ${where}
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    values
  );

  return result.rows.map((row) => ({
    chunkId: row.id,
    documentId: row.document_id,
    documentName: row.original_name,
    category: row.category,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    content: row.content,
    score: Number(row.score),
  }));
}

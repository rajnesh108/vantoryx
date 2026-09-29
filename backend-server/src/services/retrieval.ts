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
  score: number | string;
}

export async function searchSimilar(embedding: number[], documentIds: string[]): Promise<SearchHit[]> {
  const values: unknown[] = [toVectorLiteral(embedding), config.topK];
  let scope = "";
  if (documentIds.length > 0) {
    values.push(documentIds);
    scope = `AND c.document_id = ANY($${values.length}::uuid[])`;
  }

  const result = await pool.query<SearchRow>(
    `SELECT c.id, c.document_id, c.content, c.page_start, c.page_end, d.original_name,
            1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.status = 'ready'
       ${scope}
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    values
  );

  return result.rows.map((row) => ({
    chunkId: row.id,
    documentId: row.document_id,
    documentName: row.original_name,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    content: row.content,
    score: Number(row.score),
  }));
}

import { pool } from "../db/pool";
import { toVectorLiteral } from "../db/vector";
import { config } from "../config";
import { fuseByReciprocalRank } from "./fusion";
import { rerankTexts } from "./embeddingClient";
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

interface SearchScope {
  documentIds?: string[];
  categories?: string[];
}

const SELECT_HITS = `SELECT c.id, c.document_id, c.content, c.page_start, c.page_end, d.original_name, d.category`;

export async function retrieve(
  question: string,
  embedding: number[] | null,
  scope: SearchScope
): Promise<SearchHit[]> {
  const [vectorHits, keywordHits] = await Promise.all([
    embedding ? searchSimilar(embedding, scope, config.vectorTopK) : Promise.resolve([]),
    searchBm25(question, scope, config.bm25TopK),
  ]);
  const fused = fuseByReciprocalRank([vectorHits, keywordHits]);
  if (fused.length === 0) return [];
  if (!config.rerankerEnabled) return fused.slice(0, config.topK);

  try {
    const scores = await rerankTexts(
      question,
      fused.map((hit) => hit.content)
    );
    return fused
      .map((hit, index) => ({ ...hit, score: sigmoid(scores[index]) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, config.rerankTopK);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reranker request failed";
    console.error(`[retrieve] reranker failed, using fused order: ${message}`);
    return fused.slice(0, config.topK);
  }
}

export async function searchSimilar(
  embedding: number[],
  scope: SearchScope,
  limit = config.vectorTopK
): Promise<SearchHit[]> {
  const values: unknown[] = [toVectorLiteral(embedding), limit];
  const where = scopeClause(scope, values);
  const result = await pool.query<SearchRow>(
    `${SELECT_HITS},
            1 - (c.embedding <=> $1::vector) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.status = 'ready'
       ${where}
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    values
  );
  return result.rows.map(toHit);
}

async function searchBm25(question: string, scope: SearchScope, limit: number): Promise<SearchHit[]> {
  const values: unknown[] = [question, limit];
  const where = scopeClause(scope, values);
  const result = await pool.query<SearchRow>(
    `${SELECT_HITS},
            ts_rank_cd(c.content_tsv, query) AS score
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     CROSS JOIN websearch_to_tsquery('english', $1) AS query
     WHERE d.status = 'ready'
       AND c.content_tsv @@ query
       ${where}
     ORDER BY score DESC, c.id
     LIMIT $2`,
    values
  );
  return result.rows.map(toHit);
}

function scopeClause(scope: SearchScope, values: unknown[]): string {
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
  return filters.length > 0 ? `AND ${filters.join(" AND ")}` : "";
}

function toHit(row: SearchRow): SearchHit {
  return {
    chunkId: row.id,
    documentId: row.document_id,
    documentName: row.original_name,
    category: row.category,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    content: row.content,
    score: Number(row.score),
  };
}

function sigmoid(value: number): number {
  if (value > 20) return 1;
  if (value < -20) return 0;
  return 1 / (1 + Math.exp(-value));
}

import { randomUUID } from "crypto";
import { pool } from "../db/pool";
import { toVectorLiteral } from "../db/vector";
import { getDocument, updateDocument } from "../db/documents";
import { config } from "../config";
import { chunkPages } from "./chunking";
import { embedTexts, extractPdf } from "./embeddingClient";
import type { ChunkDraft } from "../types";

export async function ingestDocument(documentId: string): Promise<void> {
  try {
    const existing = await getDocument(documentId);
    if (!existing) return;

    const storagePath = await storagePathFor(documentId);
    console.log(`[ingest ${documentId}] extracting text`);
    const pages = await extractPdf(storagePath);
    const chunks = chunkPages(pages, {
      chunkSize: config.chunkSize,
      overlap: config.chunkOverlap,
    });
    if (chunks.length === 0) {
      throw new Error(
        "No extractable text found. Scanned image PDFs need OCR, which is not part of V1."
      );
    }

    console.log(`[ingest ${documentId}] embedding ${chunks.length} chunks`);
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
    const stillThere = await getDocument(documentId);
    if (!stillThere) return;

    await insertChunks(documentId, chunks, embeddings);
    await updateDocument(documentId, {
      status: "ready",
      pageCount: pages.length,
      error: null,
    });
    console.log(`[ingest ${documentId}] stored ${chunks.length} chunks`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    console.error(`[ingest ${documentId}] ${message}`);
    try {
      await updateDocument(documentId, { status: "failed", error: message });
    } catch (updateError) {
      console.error(`[ingest ${documentId}] could not record failure`, updateError);
    }
  }
}

async function storagePathFor(documentId: string): Promise<string> {
  const result = await pool.query<{ storage_path: string }>(
    "SELECT storage_path FROM documents WHERE id = $1",
    [documentId]
  );
  const storagePath = result.rows[0]?.storage_path;
  if (!storagePath) {
    throw new Error("Uploaded file is missing");
  }
  return storagePath;
}

async function insertChunks(
  documentId: string,
  chunks: ChunkDraft[],
  embeddings: number[][]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM chunks WHERE document_id = $1", [documentId]);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const embedding = embeddings[index];
      await client.query(
        `INSERT INTO chunks (id, document_id, chunk_index, page_start, page_end, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
        [
          randomUUID(),
          documentId,
          index,
          chunk.pageStart,
          chunk.pageEnd,
          chunk.content,
          toVectorLiteral(embedding),
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

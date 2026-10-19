import { z, ZodError } from "zod";
import { config } from "../config";
import { HttpError } from "../lib/http";
import type { PageText } from "../types";

const extractSchema = z.object({
  pages: z.array(
    z.object({
      page: z.number().int().positive(),
      text: z.string(),
    })
  ),
});

const embedSchema = z.object({
  embeddings: z.array(z.array(z.number())),
  model: z.string(),
  dimension: z.number(),
});

export async function extractPdf(storagePath: string): Promise<PageText[]> {
  const body = await postJson("/extract", { path: storagePath });
  try {
    return extractSchema.parse(body).pages;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(502, "Embedding service returned an unexpected extraction response");
    }
    throw error;
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  const batchSize = 32;
  for (let index = 0; index < texts.length; index += batchSize) {
    vectors.push(...(await embedBatch(texts.slice(index, index + batchSize))));
  }
  return vectors;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const body = await postJson("/embed", { texts });
  let parsed: z.infer<typeof embedSchema>;
  try {
    parsed = embedSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(502, "Embedding service returned an unexpected embedding response");
    }
    throw error;
  }
  if (parsed.dimension !== config.embeddingDim || parsed.embeddings.length !== texts.length) {
    throw new HttpError(
      502,
      `Embedding service returned ${parsed.embeddings.length} vectors of dimension ${parsed.dimension}; expected ${texts.length} vectors of dimension ${config.embeddingDim}`
    );
  }
  for (const vector of parsed.embeddings) {
    if (vector.length !== config.embeddingDim || vector.some((value) => !Number.isFinite(value))) {
      throw new HttpError(502, "Embedding service returned an invalid vector");
    }
  }
  return parsed.embeddings;
}

async function postJson(pathname: string, payload: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${config.embeddingServiceUrl}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.embeddingTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new HttpError(503, "Embedding service timed out. The model may still be loading.");
    }
    throw new HttpError(503, "Embedding service is unavailable. Start it on port 8000.");
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new HttpError(response.status === 422 ? 422 : 502, errorMessage(body, "Embedding service request failed"));
  }
  return body;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

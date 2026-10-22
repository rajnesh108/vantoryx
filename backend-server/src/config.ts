import dotenv from "dotenv";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  throw new Error(`${name} must be true or false`);
}

const embeddingDim = intEnv("EMBEDDING_DIM", 768, 768, 768);

const uploadDir = process.env.UPLOAD_DIR?.trim()
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(repoRoot, "uploads");

export const config = {
  repoRoot,
  port: intEnv("PORT", 4000, 1, 65535),
  databaseUrl: process.env.DATABASE_URL?.trim() || "postgresql://rag:rag@localhost:5432/vantoryx",
  uploadDir,
  embeddingServiceUrl: (process.env.EMBEDDING_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, ""),
  embeddingTimeoutMs: intEnv("EMBEDDING_TIMEOUT_MS", 180_000, 1_000, 600_000),
  embeddingDim,
  chunkSize: intEnv("CHUNK_SIZE", 1000, 200, 4000),
  chunkOverlap: intEnv("CHUNK_OVERLAP", 180, 0, 1000),
  topK: intEnv("TOP_K", 5, 1, 20),
  bm25TopK: intEnv("BM25_TOP_K", 20, 1, 100),
  vectorTopK: intEnv("VECTOR_TOP_K", 20, 1, 100),
  rerankTopK: intEnv("RERANK_TOP_K", 5, 1, 20),
  rerankerEnabled: boolEnv("RERANKER_ENABLED", true),
  llm: {
    baseUrl: (process.env.LLM_BASE_URL || "http://127.0.0.1:11434/v1").replace(/\/$/, ""),
    apiKey: process.env.LLM_API_KEY?.trim() || "",
    model: process.env.LLM_MODEL?.trim() || "llama3.1",
    timeoutMs: intEnv("LLM_TIMEOUT_MS", 120_000, 1_000, 600_000),
  },
  admin: {
    username: process.env.ADMIN_USERNAME?.trim() || "admin",
    password: process.env.ADMIN_PASSWORD?.trim() || "admin",
  },
};

if (config.chunkOverlap >= config.chunkSize) {
  throw new Error("CHUNK_OVERLAP must be smaller than CHUNK_SIZE");
}

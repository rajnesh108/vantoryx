import { Router } from "express";
import { config } from "../config";
import { pool } from "../db/pool";
import { asyncHandler } from "../lib/http";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    let database = "ok";
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      database = error instanceof Error ? error.message : "unavailable";
    }

    let embeddings = "unavailable";
    try {
      const response = await fetch(`${config.embeddingServiceUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const body = (await response.json()) as { status?: string };
      embeddings = body.status || "unknown";
    } catch {
      embeddings = "unavailable";
    }

    const ok = database === "ok";
    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      database,
      embeddings,
      llm: {
        model: config.llm.model,
        baseUrl: config.llm.baseUrl,
      },
    });
  })
);

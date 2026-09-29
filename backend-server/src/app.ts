import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { chatRouter } from "./routes/chat";
import { documentsRouter } from "./routes/documents";
import { healthRouter } from "./routes/health";
import { HttpError } from "./lib/http";

export function buildApp() {
  const app = express();
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/health", healthRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/chat", chatRouter);
  app.use(errorHandler);
  return app;
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues.map((issue) => issue.message).join(" ") });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (isFileTooLarge(error)) {
    res.status(413).json({ error: "PDF must be 40 MB or smaller." });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: "Request body must be JSON." });
    return;
  }
  if (isDatabaseDown(error)) {
    res.status(503).json({ error: "Database is unavailable. Start PostgreSQL with docker compose up -d." });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Unexpected server error" });
}

function isFileTooLarge(error: unknown): boolean {
  return codeOf(error) === "LIMIT_FILE_SIZE";
}

function isDatabaseDown(error: unknown): boolean {
  const code = codeOf(error);
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "57P01") return true;
  return error instanceof Error && /ECONNREFUSED|ENOTFOUND/.test(error.message);
}

function codeOf(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  return String(error.code);
}

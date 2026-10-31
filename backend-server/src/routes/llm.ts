import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { listLlmOptions } from "../services/llmChoice";

export const llmRouter = Router();

llmRouter.get(
  "/options",
  asyncHandler(async (_req, res) => {
    res.json(await listLlmOptions());
  })
);

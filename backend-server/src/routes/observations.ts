import { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { asyncHandler } from "../lib/http";
import { observationLog, summarizeObservations } from "../services/observe";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const observationsRouter = Router();

observationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = querySchema.parse(req.query);
    const limit = query.limit ?? 50;
    if (!config.observationEnabled) {
      res.json({ enabled: false, summary: summarizeObservations([]), observations: [] });
      return;
    }
    res.json({
      enabled: true,
      summary: observationLog.summary(),
      observations: observationLog.list(limit),
    });
  })
);

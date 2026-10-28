import { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { loadDataset } from "../evaluation/dataset";
import { FIXTURE_PASSAGES } from "../evaluation/fixture";
import type { EvalMode } from "../evaluation/metrics";
import { runEvaluation } from "../evaluation/run";
import { asyncHandler, HttpError } from "../lib/http";

const runSchema = z.object({
  source: z.enum(["fixture", "index"]),
  modes: z.array(z.enum(["hybrid", "agentic"])).max(2).optional(),
  caseIds: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  k: z.number().int().min(1).max(20).optional(),
});

export const evaluationRouter = Router();

evaluationRouter.get(
  "/dataset",
  asyncHandler(async (_req, res) => {
    res.json({ cases: loadDataset(), passages: FIXTURE_PASSAGES });
  })
);

evaluationRouter.post(
  "/run",
  asyncHandler(async (req, res) => {
    const body = runSchema.parse(req.body);
    if (body.modes && body.modes.length === 0) {
      throw new HttpError(400, "Choose hybrid, agentic, or both.");
    }
    if (body.caseIds && body.caseIds.length === 0) {
      throw new HttpError(400, "Choose at least one evaluation case.");
    }
    const dataset = loadDataset();
    const cases = selectCases(dataset, body.caseIds);
    const report = await runEvaluation({
      source: body.source,
      modes: chosenModes(body.modes),
      cases,
      k: body.k ?? config.topK,
    });
    res.json(report);
  })
);

function selectCases(dataset: ReturnType<typeof loadDataset>, caseIds: string[] | undefined) {
  if (!caseIds) return dataset;
  const known = new Set(dataset.map((item) => item.id));
  const unknown = caseIds.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new HttpError(400, `Unknown evaluation case: ${unknown.join(", ")}`);
  const wanted = new Set(caseIds);
  return dataset.filter((item) => wanted.has(item.id));
}

function chosenModes(modes: Array<"hybrid" | "agentic"> | undefined): EvalMode[] {
  const list = modes && modes.length > 0 ? modes : (["hybrid", "agentic"] as const);
  const unique: EvalMode[] = [];
  for (const mode of list) {
    if (!unique.includes(mode)) unique.push(mode);
  }
  return unique;
}

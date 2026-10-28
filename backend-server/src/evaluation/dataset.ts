import { z } from "zod";
import datasetJson from "./dataset.json";
import type { AnswerOutcome } from "../services/outcome";

export const QUESTION_TYPES = ["simple", "multi_hop", "unanswerable"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface EvalCase {
  id: string;
  type: QuestionType;
  question: string;
  expectedOutcome: AnswerOutcome;
  relevantPhrases: string[];
  expectedFacts: string[];
  forbidden: string[];
}

const caseSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]+$/).max(40),
  type: z.enum(QUESTION_TYPES),
  question: z.string().trim().min(1).max(2000),
  expectedOutcome: z.enum(["answered", "not_found", "insufficient_evidence"]),
  relevantPhrases: z.array(z.string().trim().min(1).max(300)).max(8),
  expectedFacts: z.array(z.string().trim().min(1).max(120)).max(8),
  forbidden: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
});

export function loadDataset(value: unknown = datasetJson): EvalCase[] {
  const cases = z.array(caseSchema).max(20).parse(value);
  const ids = new Set<string>();
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error(`Duplicate evaluation case: ${item.id}`);
    ids.add(item.id);
  }
  return cases;
}

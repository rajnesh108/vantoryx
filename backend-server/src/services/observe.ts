import { randomUUID } from "node:crypto";
import { config } from "../config";
import type { TokenRates } from "./cost";
import { usageCost } from "./cost";
import type { LlmUsage } from "./llm";
import type { AnswerOutcome } from "./outcome";

export type ObservationPath = "hybrid" | "agent";
export type ObservationOutcome = AnswerOutcome | "error";

export interface ObservationUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  estimated: boolean;
  costUsd: number;
}

export interface Observation {
  id: string;
  createdAt: string;
  question: string;
  path: ObservationPath;
  outcome: ObservationOutcome;
  latencyMs: number;
  retrieveMs: number | null;
  generateMs: number | null;
  usage: ObservationUsage;
  model: string | null;
  citationCount: number;
  attempts: number | null;
  sufficient: boolean | null;
  error: string | null;
}

export interface ObservationSummary {
  count: number;
  meanLatencyMs: number | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
  byOutcome: Record<ObservationOutcome, number>;
  byPath: Record<ObservationPath, number>;
}

const QUESTION_LIMIT = 240;

export function buildObservation(input: {
  question: string;
  path: ObservationPath;
  outcome: ObservationOutcome;
  latencyMs: number;
  retrieveMs: number | null;
  generateMs: number | null;
  usage: LlmUsage;
  rates: TokenRates;
  model: string | null;
  citationCount: number;
  attempts: number | null;
  sufficient: boolean | null;
  error: string | null;
  now?: string;
  id?: string;
}): Observation {
  return {
    id: input.id ?? randomUUID(),
    createdAt: input.now ?? new Date().toISOString(),
    question: clip(input.question, QUESTION_LIMIT),
    path: input.path,
    outcome: input.outcome,
    latencyMs: Math.max(0, input.latencyMs),
    retrieveMs: input.retrieveMs,
    generateMs: input.generateMs,
    usage: {
      calls: input.usage.calls,
      promptTokens: input.usage.promptTokens,
      completionTokens: input.usage.completionTokens,
      estimated: input.usage.estimated,
      costUsd: roundCost(usageCost(input.usage, input.rates)),
    },
    model: input.model,
    citationCount: input.citationCount,
    attempts: input.attempts,
    sufficient: input.sufficient,
    error: input.error ? clip(input.error, QUESTION_LIMIT) : null,
  };
}

export function summarizeObservations(rows: Observation[]): ObservationSummary {
  const byOutcome: Record<ObservationOutcome, number> = {
    answered: 0,
    not_found: 0,
    insufficient_evidence: 0,
    error: 0,
  };
  const byPath: Record<ObservationPath, number> = { hybrid: 0, agent: 0 };
  let prompt = 0;
  let completion = 0;
  let cost = 0;
  let latency = 0;
  for (const row of rows) {
    byOutcome[row.outcome] += 1;
    byPath[row.path] += 1;
    prompt += row.usage.promptTokens;
    completion += row.usage.completionTokens;
    cost += row.usage.costUsd;
    latency += row.latencyMs;
  }
  return {
    count: rows.length,
    meanLatencyMs: rows.length === 0 ? null : Math.round(latency / rows.length),
    totalPromptTokens: prompt,
    totalCompletionTokens: completion,
    totalCostUsd: roundCost(cost),
    byOutcome,
    byPath,
  };
}

export function createObservationLog(limit: number) {
  const rows: Observation[] = [];
  return {
    add(item: Observation) {
      rows.push(item);
      const extra = rows.length - limit;
      if (extra > 0) rows.splice(0, extra);
    },
    list(count: number): Observation[] {
      const size = Math.max(0, Math.min(count, rows.length));
      return rows.slice(rows.length - size).reverse();
    },
    summary(): ObservationSummary {
      return summarizeObservations(rows);
    },
  };
}

export const observationLog = createObservationLog(config.observationLimit);

export function currentRates(): TokenRates {
  return {
    promptUsdPerMillion: config.eval.promptUsdPerMillion,
    completionUsdPerMillion: config.eval.completionUsdPerMillion,
  };
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

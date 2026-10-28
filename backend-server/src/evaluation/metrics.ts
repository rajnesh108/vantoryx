import { usageCost } from "../services/cost";
import type { LlmUsage } from "../services/llm";
import type { AnswerOutcome } from "../services/outcome";
import type { AgentRetrieval, SearchHit } from "../types";
import type { EvalCase, QuestionType } from "./dataset";

export type EvalMode = "hybrid" | "agentic";
export type EvalSource = "fixture" | "index";

export interface TokenRates {
  promptUsdPerMillion: number;
  completionUsdPerMillion: number;
}

export interface MeasuredRun {
  answer: string;
  model: string | null;
  outcome: AnswerOutcome;
  citations: SearchHit[];
  queries: string[];
  attempts: number;
  gradedSufficient: boolean | null;
  gradeReason: string | null;
  retrievals: AgentRetrieval[];
}

export interface CaseCitation {
  chunkId: string;
  documentName: string;
  category: string;
  score: number;
  excerpt: string;
}

export interface CaseUsage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  estimated: boolean;
  costUsd: number;
}

export interface CaseScore {
  id: string;
  type: QuestionType;
  mode: EvalMode;
  question: string;
  error: string | null;
  outcome: AnswerOutcome | null;
  expectedOutcome: AnswerOutcome;
  recallAtK: number | null;
  answerQuality: number | null;
  sufficiencyCorrect: boolean | null;
  gradedSufficient: boolean | null;
  gradeReason: string | null;
  latencyMs: number;
  retries: number;
  retryAddedChunks: boolean | null;
  model: string | null;
  usage: CaseUsage;
  queries: string[];
  citations: CaseCitation[];
  answer: string;
}

export interface SummaryRow {
  mode: EvalMode;
  type: QuestionType | "all";
  count: number;
  meanRecall: number | null;
  meanAnswerQuality: number | null;
  sufficiencyAccuracy: number | null;
  meanLatencyMs: number;
  meanRetries: number;
  meanLlmCalls: number;
  meanTokens: number;
  meanCostUsd: number;
}

export interface Finding {
  kind: "agentic_recall_gain" | "hybrid_parity" | "unsupported_answer" | "retry_no_gain";
  caseId: string;
  detail: string;
}

export interface EvalReport {
  source: EvalSource;
  k: number;
  generatedAt: string;
  summary: SummaryRow[];
  findings: Finding[];
  cases: CaseScore[];
}

export function recallAtK(passages: string[], phrases: string[], k: number): number | null {
  const labels = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  if (labels.length === 0) return null;
  const top = passages.slice(0, Math.max(0, k)).map((passage) => passage.toLowerCase());
  const hit = labels.filter((phrase) => top.some((passage) => passage.includes(phrase.toLowerCase()))).length;
  return hit / labels.length;
}

export function factCoverage(answer: string, facts: string[]): number | null {
  const needed = facts.map((fact) => fact.trim()).filter(Boolean);
  if (needed.length === 0) return null;
  const haystack = answer.toLowerCase();
  return needed.filter((fact) => haystack.includes(fact.toLowerCase())).length / needed.length;
}

export function answerQuality(input: {
  expected: AnswerOutcome;
  actual: AnswerOutcome;
  answer: string;
  expectedFacts: string[];
  forbidden: string[];
}): number | null {
  if (input.expected !== "answered") {
    const abstained = input.actual !== "answered";
    const leaked = input.forbidden.some((phrase) => input.answer.toLowerCase().includes(phrase.toLowerCase()));
    return abstained && !leaked ? 1 : 0;
  }
  return factCoverage(input.answer, input.expectedFacts);
}

export function sufficiencyCorrect(expected: AnswerOutcome, actual: AnswerOutcome): boolean {
  return (expected === "answered") === (actual === "answered");
}

export function retryAddedChunks(retrievals: AgentRetrieval[]): boolean | null {
  if (retrievals.length < 2) return null;
  const first = new Set(retrievals[0]?.chunkIds ?? []);
  const last = retrievals[retrievals.length - 1]?.chunkIds ?? [];
  return last.some((id) => !first.has(id));
}

export { usageCost };

export function scoreCase(input: {
  evalCase: EvalCase;
  mode: EvalMode;
  k: number;
  latencyMs: number;
  usage: LlmUsage;
  rates: TokenRates;
  run: MeasuredRun;
}): CaseScore {
  const passages = input.run.citations.filter((hit) => hit.category !== "tool").map((hit) => hit.content);
  const recall = recallAtK(passages, input.evalCase.relevantPhrases, input.k);
  return {
    id: input.evalCase.id,
    type: input.evalCase.type,
    mode: input.mode,
    question: input.evalCase.question,
    error: null,
    outcome: input.run.outcome,
    expectedOutcome: input.evalCase.expectedOutcome,
    recallAtK: recall,
    answerQuality: answerQuality({
      expected: input.evalCase.expectedOutcome,
      actual: input.run.outcome,
      answer: input.run.answer,
      expectedFacts: input.evalCase.expectedFacts,
      forbidden: input.evalCase.forbidden,
    }),
    sufficiencyCorrect: sufficiencyCorrect(input.evalCase.expectedOutcome, input.run.outcome),
    gradedSufficient: input.run.gradedSufficient,
    gradeReason: input.run.gradeReason,
    latencyMs: input.latencyMs,
    retries: input.mode === "agentic" ? Math.max(0, input.run.attempts - 1) : 0,
    retryAddedChunks: input.mode === "agentic" ? retryAddedChunks(input.run.retrievals) : null,
    model: input.run.model,
    usage: pricedUsage(input.usage, input.rates),
    queries: input.run.queries,
    citations: input.run.citations.map(viewCitation),
    answer: input.run.answer,
  };
}

export function scoreFailure(input: {
  evalCase: EvalCase;
  mode: EvalMode;
  latencyMs: number;
  usage: LlmUsage;
  rates: TokenRates;
  error: string;
}): CaseScore {
  return {
    id: input.evalCase.id,
    type: input.evalCase.type,
    mode: input.mode,
    question: input.evalCase.question,
    error: input.error,
    outcome: null,
    expectedOutcome: input.evalCase.expectedOutcome,
    recallAtK: null,
    answerQuality: null,
    sufficiencyCorrect: null,
    gradedSufficient: null,
    gradeReason: null,
    latencyMs: input.latencyMs,
    retries: 0,
    retryAddedChunks: null,
    model: null,
    usage: pricedUsage(input.usage, input.rates),
    queries: [],
    citations: [],
    answer: "",
  };
}

export function buildReport(input: { source: EvalSource; k: number; cases: CaseScore[]; generatedAt: string }): EvalReport {
  return {
    source: input.source,
    k: input.k,
    generatedAt: input.generatedAt,
    summary: summarize(input.cases),
    findings: buildFindings(input.cases),
    cases: input.cases,
  };
}

function summarize(rows: CaseScore[]): SummaryRow[] {
  const summary: SummaryRow[] = [];
  for (const mode of ["hybrid", "agentic"] as const) {
    const present = rows.some((row) => row.error === null && row.mode === mode);
    if (!present) continue;
    for (const type of ["simple", "multi_hop", "unanswerable", "all"] as const) {
      const row = summarizeSlice(rows, mode, type);
      if (row) summary.push(row);
    }
  }
  return summary;
}

function summarizeSlice(rows: CaseScore[], mode: EvalMode, type: QuestionType | "all"): SummaryRow | null {
  const matched = rows.filter((row) => row.error === null && row.mode === mode && (type === "all" || row.type === type));
  if (matched.length === 0) return null;
  const sufficiency = matched.map((row) => row.sufficiencyCorrect).filter((value): value is boolean => value !== null);
  return {
    mode,
    type,
    count: matched.length,
    meanRecall: roundMean(matched.map((row) => row.recallAtK).filter(isNumber), 4),
    meanAnswerQuality: roundMean(matched.map((row) => row.answerQuality).filter(isNumber), 4),
    sufficiencyAccuracy: roundMean(sufficiency.map((value) => (value ? 1 : 0)), 4),
    meanLatencyMs: Math.round(mean(matched.map((row) => row.latencyMs)) ?? 0),
    meanRetries: round(mean(matched.map((row) => row.retries)) ?? 0, 4),
    meanLlmCalls: round(mean(matched.map((row) => row.usage.calls)) ?? 0, 4),
    meanTokens: round(mean(matched.map((row) => row.usage.promptTokens + row.usage.completionTokens)) ?? 0, 4),
    meanCostUsd: round(mean(matched.map((row) => row.usage.costUsd)) ?? 0, 6),
  };
}

function buildFindings(rows: CaseScore[]): Finding[] {
  const successful = rows.filter((row) => row.error === null);
  const findings: Finding[] = [];
  for (const id of [...new Set(successful.map((row) => row.id))]) {
    const hybrid = successful.find((row) => row.id === id && row.mode === "hybrid");
    const agentic = successful.find((row) => row.id === id && row.mode === "agentic");
    if (hybrid && agentic && hybrid.recallAtK !== null && agentic.recallAtK !== null && agentic.recallAtK > hybrid.recallAtK + 0.001) {
      findings.push({
        kind: "agentic_recall_gain",
        caseId: id,
        detail: `Agentic recall was higher on the ${typeLabel(agentic.type)} ${id} (${percentLabel(agentic.recallAtK)} vs ${percentLabel(hybrid.recallAtK)}).`,
      });
    } else if (hybrid && agentic && close(hybrid.recallAtK, agentic.recallAtK) && close(hybrid.answerQuality, agentic.answerQuality)) {
      const faster = hybrid.latencyMs + 50 < agentic.latencyMs;
      const cheaper = hybrid.usage.costUsd + 1e-9 < agentic.usage.costUsd;
      if (faster || cheaper) {
        const reasons = [faster ? "lower latency" : "", cheaper ? "lower cost" : ""].filter(Boolean);
        findings.push({
          kind: "hybrid_parity",
          caseId: id,
          detail: `Hybrid matched agentic recall and answer quality on ${id} with ${reasons.join(" and ")}.`,
        });
      }
    }
    for (const row of [hybrid, agentic]) {
      if (!row) continue;
      if (row.type === "unanswerable" && row.outcome === "answered") {
        findings.push({
          kind: "unsupported_answer",
          caseId: id,
          detail: `${row.mode === "hybrid" ? "Hybrid" : "Agentic"} answered ${id} even though the dataset marks that question unanswerable.`,
        });
      }
      if (row.mode === "agentic" && row.retries > 0 && row.retryAddedChunks === false) {
        findings.push({
          kind: "retry_no_gain",
          caseId: id,
          detail: `The retry on ${id} did not add a chunk.`,
        });
      }
    }
  }
  return findings;
}

function typeLabel(type: QuestionType): string {
  if (type === "simple") return "simple lookup";
  if (type === "multi_hop") return "multi-hop question";
  return "unanswerable question";
}

function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function close(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) < 0.001;
}

function pricedUsage(usage: LlmUsage, rates: TokenRates): CaseUsage {
  return {
    calls: usage.calls,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    estimated: usage.estimated,
    costUsd: round(usageCost(usage, rates), 6),
  };
}

function viewCitation(hit: SearchHit): CaseCitation {
  return {
    chunkId: hit.chunkId,
    documentName: hit.documentName,
    category: hit.category,
    score: round(hit.score, 4),
    excerpt: excerpt(hit.content, 320),
  };
}

function excerpt(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMean(values: number[], digits: number): number | null {
  const value = mean(values);
  return value === null ? null : round(value, digits);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

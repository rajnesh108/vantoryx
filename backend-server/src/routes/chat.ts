import { Router } from "express";
import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "../categories";
import { config } from "../config";
import { asyncHandler } from "../lib/http";
import { runAgenticRetrieval } from "../services/agent/run";
import { LLM_PROVIDERS } from "../services/localLlm";
import { chatTargetFor, withChatTarget } from "../services/llmChoice";
import { usageFromError, withLlmUsage, type LlmUsage } from "../services/llm";
import { buildObservation, currentRates, observationLog, type Observation, type ObservationPath } from "../services/observe";
import { abstainAnswer, answerFromCitations, decideOutcome, type AnswerOutcome } from "../services/outcome";
import { hybridRetrieve } from "../services/retrieval";
import type { AgentTrace, SearchHit } from "../types";

const chatSchema = z.object({
  question: z.string().trim().min(1, "Enter a question.").max(2000, "Question must be 2000 characters or fewer."),
  documentIds: z.array(z.string().uuid()).max(50).optional(),
  categories: z.array(z.enum(DOCUMENT_CATEGORIES)).max(DOCUMENT_CATEGORIES.length).optional(),
  llm: z
    .object({
      provider: z.enum(LLM_PROVIDERS),
      model: z.string().trim().min(1, "Choose a model.").max(200),
    })
    .optional(),
});

interface ChatRun {
  answer: string;
  citations: SearchHit[];
  model: string | null;
  agent: AgentTrace | null;
  outcome: AnswerOutcome;
  path: ObservationPath;
  retrieveMs: number;
  generateMs: number | null;
}

export const chatRouter = Router();

chatRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const target = body.llm ? chatTargetFor(body.llm.provider, body.llm.model) : null;
    const started = Date.now();
    try {
      const measured = await withLlmUsage(() =>
        target ? withChatTarget(target, () => executeChat(body)) : executeChat(body)
      );
      const observation = observeRun(body.question, measured.result, measured.usage, Date.now() - started, null);
      res.json({ ...responseOf(measured.result), observation });
    } catch (error) {
      observeRun(body.question, null, usageFromError(error), Date.now() - started, error);
      throw error;
    }
  })
);

async function executeChat(body: z.infer<typeof chatSchema>): Promise<ChatRun> {
  const documentIds = body.documentIds ?? [];
  const categories = body.categories ?? [];
  const path: ObservationPath = config.agentEnabled ? "agent" : "hybrid";
  const retrieveStarted = Date.now();
  const retrieved = config.agentEnabled
    ? await runAgenticRetrieval({ question: body.question, documentIds, categories })
    : { citations: await hybridRetrieve(body.question, { documentIds, categories }), agent: null };
  const retrieveMs = Date.now() - retrieveStarted;
  const outcome = decideOutcome(retrieved.citations.length, retrieved.agent ? retrieved.agent.sufficient : null);
  if (outcome !== "answered") {
    return {
      answer: abstainAnswer(outcome, categories.length),
      citations: retrieved.citations,
      model: null,
      agent: retrieved.agent,
      outcome,
      path,
      retrieveMs,
      generateMs: null,
    };
  }
  const generateStarted = Date.now();
  const generated = await answerFromCitations(body.question, retrieved.citations);
  return {
    answer: generated.text,
    citations: retrieved.citations,
    model: generated.model,
    agent: retrieved.agent,
    outcome,
    path,
    retrieveMs,
    generateMs: Date.now() - generateStarted,
  };
}

function observeRun(
  question: string,
  run: ChatRun | null,
  usage: LlmUsage,
  latencyMs: number,
  error: unknown
): Observation {
  const observation = buildObservation({
    question,
    path: run?.path ?? (config.agentEnabled ? "agent" : "hybrid"),
    outcome: run?.outcome ?? "error",
    latencyMs,
    retrieveMs: run?.retrieveMs ?? null,
    generateMs: run?.generateMs ?? null,
    usage,
    rates: currentRates(),
    model: run?.model ?? null,
    citationCount: run?.citations.length ?? 0,
    attempts: run?.agent?.attempts ?? null,
    sufficient: run?.agent?.sufficient ?? null,
    error: error instanceof Error ? error.message : error ? "Request failed" : null,
  });
  if (config.observationEnabled) observationLog.add(observation);
  return observation;
}

function responseOf(run: ChatRun) {
  return {
    answer: run.answer,
    citations: run.citations,
    model: run.model,
    agent: run.agent,
    outcome: run.outcome,
  };
}

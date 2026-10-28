import { DOCUMENT_CATEGORIES } from "../categories";
import { config } from "../config";
import type { EvalCase } from "./dataset";
import { searchFixture } from "./fixture";
import type { EvalMode, EvalSource, MeasuredRun } from "./metrics";
import { compileRetrievalGraph, toTrace, type RetrievalSnapshot } from "../services/agent/graph";
import { retrievalAgentDeps } from "../services/agent/run";
import { abstainAnswer, answerFromCitations, decideOutcome } from "../services/outcome";
import { hybridRetrieve } from "../services/retrieval";
import type { SearchHit } from "../types";

type EvalGraph = ReturnType<typeof compileRetrievalGraph>;

export function compileEvalGraph(source: EvalSource): EvalGraph {
  if (source === "index") {
    return compileRetrievalGraph({
      ...retrievalAgentDeps,
      maxToolCalls: 0,
      tools: null,
    });
  }
  const limit = passageLimit();
  return compileRetrievalGraph({
    ...retrievalAgentDeps,
    maxToolCalls: 0,
    tools: null,
    search: async (queries) => searchFixture(queries, limit),
    rerank: async (_question, hits) => hits.slice(0, limit),
  });
}

export async function executeQuestion(
  source: EvalSource,
  mode: EvalMode,
  evalCase: EvalCase,
  graph: EvalGraph | null
): Promise<MeasuredRun> {
  if (mode === "hybrid") return runHybrid(source, evalCase.question);
  if (!graph) throw new Error("Agentic evaluation graph was not compiled.");
  return runAgentic(graph, evalCase.question);
}

async function runHybrid(source: EvalSource, question: string): Promise<MeasuredRun> {
  const citations = source === "fixture" ? searchFixture([question], passageLimit()) : await hybridRetrieve(question);
  const outcome = decideOutcome(citations.length, null);
  const [generated, grade] = await Promise.all([
    outcome === "answered"
      ? answerFromCitations(question, citations)
      : Promise.resolve({ text: abstainAnswer(outcome, 0), model: null }),
    gradePassages(question, citations),
  ]);
  const documents = citations.filter((hit) => hit.category !== "tool");
  return {
    answer: generated.text,
    model: generated.model,
    outcome,
    citations,
    queries: [question],
    attempts: 1,
    gradedSufficient: grade.sufficient,
    gradeReason: grade.reason,
    retrievals: [
      {
        queries: [question],
        chunkIds: documents.map((hit) => hit.chunkId),
        scores: documents.map((hit) => hit.score),
      },
    ],
  };
}

async function runAgentic(graph: EvalGraph, question: string): Promise<MeasuredRun> {
  const state = (await graph.invoke({
    question,
    documentIds: [],
    requestedCategories: [],
    allowedCategories: [...DOCUMENT_CATEGORIES],
  })) as RetrievalSnapshot;
  const agent = toTrace(state);
  const outcome = decideOutcome(state.citations.length, agent.sufficient);
  const generated =
    outcome === "answered"
      ? await answerFromCitations(question, state.citations)
      : { text: abstainAnswer(outcome, 0), model: null };
  return {
    answer: generated.text,
    model: generated.model,
    outcome,
    citations: state.citations,
    queries: agent.queries,
    attempts: agent.attempts,
    gradedSufficient: agent.sufficient,
    gradeReason: agent.gradeReason || null,
    retrievals: agent.retrievals,
  };
}

async function gradePassages(
  question: string,
  citations: SearchHit[]
): Promise<{ sufficient: boolean | null; reason: string | null }> {
  if (citations.length === 0) {
    return { sufficient: false, reason: "No passages matched the query." };
  }
  try {
    const decision = await retrievalAgentDeps.grade(question, citations);
    return { sufficient: decision.sufficient, reason: decision.reason };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grading failed";
    return { sufficient: null, reason: message };
  }
}

function passageLimit(): number {
  return config.rerankerEnabled ? config.rerankTopK : config.topK;
}

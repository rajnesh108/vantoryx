import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ToolCall, ToolCatalogEntry } from "../mcp/catalog";
import { toolCitation } from "../mcp/catalog";
import type { AgentRetrieval, AgentStep, AgentTrace, SearchHit } from "../../types";
import {
  appendCitation,
  brief,
  isRepeatedQuery,
  normalizeQueries,
  preferIncoming,
  questionMayNeedTool,
  retrievalScope,
  selectCategories,
  shouldRewrite,
} from "./decisions";

export interface ToolBridge {
  list: () => Promise<{ tools: ToolCatalogEntry[]; error: string | null }>;
  choose: (question: string, tools: ToolCatalogEntry[], gradeReason: string) => Promise<{ call: ToolCall | null; reason: string }>;
  call: (choice: ToolCall) => Promise<string>;
}

export interface AgentDeps {
  maxQueries: number;
  maxRetries: number;
  maxToolCalls?: number;
  tools?: ToolBridge | null;
  plan: (question: string) => Promise<{ queries: string[]; reason: string }>;
  route: (question: string, allowed: string[]) => Promise<{ categories: string[]; reason: string }>;
  search: (queries: string[], scope: { documentIds: string[]; categories: string[] }) => Promise<SearchHit[]>;
  rerank: (question: string, hits: SearchHit[]) => Promise<SearchHit[]>;
  grade: (question: string, hits: SearchHit[]) => Promise<{ sufficient: boolean; reason: string }>;
  rewrite: (question: string, queries: string[], gradeReason: string) => Promise<{ query: string }>;
}

const RetrievalState = Annotation.Root({
  question: Annotation<string>,
  documentIds: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  requestedCategories: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  allowedCategories: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  queries: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  categories: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  previousQueries: Annotation<string[]>({
    reducer: (left, right) => (left ?? []).concat(right ?? []),
    default: () => [],
  }),
  citations: Annotation<SearchHit[]>({ reducer: (_left, right) => right, default: () => [] }),
  sufficient: Annotation<boolean>({ reducer: (_left, right) => right, default: () => false }),
  attempts: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  stop: Annotation<boolean>({ reducer: (_left, right) => right, default: () => false }),
  gradeReason: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  toolAttempts: Annotation<number>({ reducer: (_left, right) => right, default: () => 0 }),
  reviewTool: Annotation<boolean>({ reducer: (_left, right) => right, default: () => false }),
  steps: Annotation<AgentStep[]>({
    reducer: (left, right) => (left ?? []).concat(right ?? []),
    default: () => [],
  }),
  retrievals: Annotation<AgentRetrieval[]>({
    reducer: (left, right) => (left ?? []).concat(right ?? []),
    default: () => [],
  }),
});

export type RetrievalSnapshot = typeof RetrievalState.State;

export function compileRetrievalGraph(deps: AgentDeps) {
  const maxToolCalls = deps.maxToolCalls ?? 0;
  const toolBridge = deps.tools ?? null;

  const plan = async (state: RetrievalSnapshot) => {
    try {
      const decision = await deps.plan(state.question);
      const queries = normalizeQueries(decision.queries, state.question, deps.maxQueries);
      const noun = queries.length === 1 ? "query" : "queries";
      return {
        queries,
        steps: [{ node: "plan" as const, detail: `Planned ${queries.length} search ${noun}: ${queries.join("; ")}. ${brief(decision.reason)}` }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Planning failed";
      console.error(`[agent] planning failed, using the original question: ${message}`);
      return {
        queries: normalizeQueries([], state.question, 1),
        steps: [{ node: "plan" as const, detail: "Planning failed, so the original question is used." }],
      };
    }
  };

  const route = async (state: RetrievalSnapshot) => {
    try {
      const decision = await deps.route(state.question, state.allowedCategories);
      const categories = selectCategories(decision.categories, state.allowedCategories);
      return {
        categories,
        steps: [{ node: "route" as const, detail: `Routed to ${categories.join(", ")}. ${brief(decision.reason)}` }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Routing failed";
      console.error(`[agent] routing failed, searching every allowed collection: ${message}`);
      return {
        categories: [...state.allowedCategories],
        steps: [{ node: "route" as const, detail: "Routing failed, so every allowed collection is searched." }],
      };
    }
  };

  const retrieve = async (state: RetrievalSnapshot) => {
    const scope = retrievalScope(
      state.documentIds,
      state.requestedCategories,
      state.allowedCategories,
      state.categories
    );
    const documents = state.citations.filter((hit) => hit.category !== "tool");
    const keptTools = state.citations.filter((hit) => hit.category === "tool");
    const found = await deps.search(state.queries, scope);
    const reranked = await deps.rerank(state.question, preferIncoming(documents, found));
    const citations = [...reranked, ...keptTools];
    const where = scope.categories.length > 0 ? ` in ${scope.categories.join(", ")}` : "";
    const noun = reranked.length === 1 ? "passage" : "passages";
    return {
      citations,
      attempts: state.attempts + 1,
      previousQueries: state.queries,
      retrievals: [
        {
          queries: [...state.queries],
          chunkIds: reranked.map((hit) => hit.chunkId),
          scores: reranked.map((hit) => hit.score),
        },
      ],
      steps: [
        {
          node: "retrieve" as const,
          detail: `Retrieved ${reranked.length} ${noun}${where} for: ${state.queries.join("; ")}.`,
        },
      ],
    };
  };

  const grade = async (state: RetrievalSnapshot) => {
    if (state.citations.length === 0) {
      const reason = "No passages matched the query.";
      const canRetry = shouldRewrite(false, state.attempts, deps.maxRetries);
      const toolsLeft = toolBridge !== null && state.toolAttempts < maxToolCalls;
      const calculation = toolsLeft && state.toolAttempts === 0 && questionMayNeedTool(state.question);
      const detail = calculation || (toolsLeft && !canRetry)
        ? "No passages matched, so a configured tool can be tried."
        : canRetry
          ? "No passages matched, so another search can be tried."
          : "No passages matched.";
      return {
        sufficient: false,
        gradeReason: reason,
        steps: [{ node: "grade" as const, detail }],
      };
    }

    try {
      const decision = await deps.grade(state.question, state.citations);
      const reason = brief(decision.reason);
      return {
        sufficient: decision.sufficient,
        gradeReason: reason,
        steps: [
          {
            node: "grade" as const,
            detail: decision.sufficient
              ? `Passages are sufficient. ${reason}`
              : `Passages are not sufficient. ${reason}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Grading failed";
      console.error(`[agent] grading failed, keeping the current passages: ${message}`);
      const reason = "The grader was unavailable, so the current passages were kept.";
      return {
        sufficient: true,
        gradeReason: reason,
        steps: [{ node: "grade" as const, detail: reason }],
      };
    }
  };

  const rewrite = async (state: RetrievalSnapshot) => {
    try {
      const decision = await deps.rewrite(state.question, state.previousQueries, state.gradeReason);
      const [query] = normalizeQueries([decision.query], "", 1);
      if (!query || isRepeatedQuery(query, state.previousQueries)) {
        return {
          stop: true,
          steps: [{ node: "rewrite" as const, detail: "Stopped because the rewritten query repeated an earlier search." }],
        };
      }
      return {
        queries: [query],
        stop: false,
        steps: [{ node: "rewrite" as const, detail: `Rewrote the search as "${query}".` }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rewrite failed";
      console.error(`[agent] rewrite failed, keeping the current passages: ${message}`);
      return {
        stop: true,
        steps: [{ node: "rewrite" as const, detail: "Rewrite failed, so the current passages were kept." }],
      };
    }
  };

  const useTools = async (state: RetrievalSnapshot) => {
    const stopped = { toolAttempts: maxToolCalls, reviewTool: false };
    if (!toolBridge) {
      return { ...stopped, steps: [{ node: "tool" as const, detail: "No MCP tools are configured." }] };
    }
    try {
      const listed = await toolBridge.list();
      if (listed.error || listed.tools.length === 0) {
        const detail = listed.error
          ? "MCP is not connected, so the current passages were kept."
          : "No MCP tools are connected, so the current passages were kept.";
        return { ...stopped, steps: [{ node: "tool" as const, detail }] };
      }
      const decision = await toolBridge.choose(state.question, listed.tools, state.gradeReason);
      if (!decision.call) {
        const reason = brief(decision.reason) || "No configured tool applies";
        const sentence = reason.endsWith(".") ? reason : `${reason}.`;
        return { ...stopped, steps: [{ node: "tool" as const, detail: `${sentence} The current passages were kept.` }] };
      }
      const text = await toolBridge.call(decision.call);
      return {
        citations: appendCitation(state.citations, toolCitation(decision.call, text, state.toolAttempts + 1)),
        toolAttempts: state.toolAttempts + 1,
        reviewTool: true,
        steps: [
          {
            node: "tool" as const,
            detail: `Called ${decision.call.server}/${decision.call.name}. ${brief(decision.call.reason)}`,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "MCP tool call failed";
      console.error(`[agent] MCP tool call failed: ${message}`);
      return { ...stopped, steps: [{ node: "tool" as const, detail: "The MCP tool call failed, so the current passages were kept." }] };
    }
  };

  const afterGrade = (state: RetrievalSnapshot): "rewrite" | "tools" | typeof END => {
    if (state.stop) return END;
    const toolsLeft = toolBridge !== null && state.toolAttempts < maxToolCalls;
    if (toolsLeft && state.toolAttempts === 0 && questionMayNeedTool(state.question)) return "tools";
    if (state.sufficient) return END;
    if (shouldRewrite(state.sufficient, state.attempts, deps.maxRetries)) return "rewrite";
    if (toolsLeft) return "tools";
    return END;
  };

  const afterRewrite = (state: RetrievalSnapshot): "retrieve" | typeof END => {
    return state.stop ? END : "retrieve";
  };

  const afterTools = (state: RetrievalSnapshot): "grade" | "rewrite" | typeof END => {
    if (state.reviewTool) return "grade";
    if (!state.sufficient && shouldRewrite(state.sufficient, state.attempts, deps.maxRetries)) return "rewrite";
    return END;
  };

  return new StateGraph(RetrievalState)
    .addNode("plan", withDuration(plan))
    .addNode("route", withDuration(route))
    .addNode("retrieve", withDuration(retrieve))
    .addNode("grade", withDuration(grade))
    .addNode("rewrite", withDuration(rewrite))
    .addNode("tools", withDuration(useTools))
    .addEdge(START, "plan")
    .addEdge("plan", "route")
    .addEdge("route", "retrieve")
    .addEdge("retrieve", "grade")
    .addConditionalEdges("grade", afterGrade)
    .addConditionalEdges("rewrite", afterRewrite)
    .addConditionalEdges("tools", afterTools)
    .compile();
}

function withDuration<T extends { steps?: AgentStep[] }>(
  node: (state: RetrievalSnapshot) => Promise<T>
): (state: RetrievalSnapshot) => Promise<T> {
  return async (state) => {
    const started = Date.now();
    const update = await node(state);
    if (!update.steps) return update;
    const durationMs = Date.now() - started;
    return { ...update, steps: update.steps.map((step) => ({ ...step, durationMs })) };
  };
}

export function toTrace(state: RetrievalSnapshot): AgentTrace {
  return {
    queries: state.queries,
    categories: state.categories,
    attempts: state.attempts,
    sufficient: state.sufficient,
    gradeReason: state.gradeReason,
    retrievals: state.retrievals,
    steps: state.steps,
  };
}

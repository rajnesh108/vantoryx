import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { AgentStep, AgentTrace, SearchHit } from "../../types";
import {
  brief,
  isRepeatedQuery,
  normalizeQueries,
  preferIncoming,
  retrievalScope,
  selectCategories,
  shouldRewrite,
} from "./decisions";

export interface AgentDeps {
  maxQueries: number;
  maxRetries: number;
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
  steps: Annotation<AgentStep[]>({
    reducer: (left, right) => (left ?? []).concat(right ?? []),
    default: () => [],
  }),
});

export type RetrievalSnapshot = typeof RetrievalState.State;

export function compileRetrievalGraph(deps: AgentDeps) {
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
    const found = await deps.search(state.queries, scope);
    const citations = await deps.rerank(state.question, preferIncoming(state.citations, found));
    const where = scope.categories.length > 0 ? ` in ${scope.categories.join(", ")}` : "";
    const noun = citations.length === 1 ? "passage" : "passages";
    return {
      citations,
      attempts: state.attempts + 1,
      previousQueries: state.queries,
      steps: [
        {
          node: "retrieve" as const,
          detail: `Retrieved ${citations.length} ${noun}${where} for: ${state.queries.join("; ")}.`,
        },
      ],
    };
  };

  const grade = async (state: RetrievalSnapshot) => {
    if (state.citations.length === 0) {
      const reason = "No passages matched the query.";
      const canRetry = shouldRewrite(false, state.attempts, deps.maxRetries);
      return {
        sufficient: false,
        gradeReason: reason,
        steps: [
          {
            node: "grade" as const,
            detail: canRetry ? "No passages matched, so another search can be tried." : "No passages matched.",
          },
        ],
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

  const afterGrade = (state: RetrievalSnapshot): "rewrite" | typeof END => {
    if (state.stop || !shouldRewrite(state.sufficient, state.attempts, deps.maxRetries)) return END;
    return "rewrite";
  };

  const afterRewrite = (state: RetrievalSnapshot): "retrieve" | typeof END => {
    return state.stop ? END : "retrieve";
  };

  return new StateGraph(RetrievalState)
    .addNode("plan", plan)
    .addNode("route", route)
    .addNode("retrieve", retrieve)
    .addNode("grade", grade)
    .addNode("rewrite", rewrite)
    .addEdge(START, "plan")
    .addEdge("plan", "route")
    .addEdge("route", "retrieve")
    .addEdge("retrieve", "grade")
    .addConditionalEdges("grade", afterGrade)
    .addConditionalEdges("rewrite", afterRewrite)
    .compile();
}

export function toTrace(state: RetrievalSnapshot): AgentTrace {
  return {
    queries: state.queries,
    categories: state.categories,
    attempts: state.attempts,
    sufficient: state.sufficient,
    steps: state.steps,
  };
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileRetrievalGraph } from "../src/services/agent/graph";
import {
  isRepeatedQuery,
  normalizeQueries,
  parsePlan,
  parseRoute,
  preferIncoming,
  retrievalScope,
  selectCategories,
  shouldRewrite,
} from "../src/services/agent/decisions";
import type { SearchHit } from "../src/types";

describe("agent decisions", () => {
  it("keeps distinct planned queries and falls back to the question", () => {
    assert.deepEqual(normalizeQueries(["  TB prevention ", "tb prevention", "HIV contacts"], "original", 3), [
      "TB prevention",
      "HIV contacts",
    ]);
    assert.deepEqual(normalizeQueries([], "What is TB prevention?", 3), ["What is TB prevention?"]);
  });

  it("reads a fenced plan and drops categories outside the allowed set", () => {
    const plan = parsePlan('```json\n{"queries":["metformin dose"],"reason":"One fact."}\n```', "dose", 3);
    assert.deepEqual(plan.queries, ["metformin dose"]);

    assert.deepEqual(selectCategories(["WHO", "pubmed", "cdc"], ["who", "cdc", "nice"]), ["who", "cdc"]);
    assert.deepEqual(selectCategories(["pubmed"], ["who", "cdc"]), ["who", "cdc"]);
    const route = parseRoute('{"categories":["cdc"],"reason":"The question names CDC."}', ["who", "cdc"]);
    assert.deepEqual(route.categories, ["cdc"]);
  });

  it("narrows the search only when routing dropped a collection", () => {
    assert.deepEqual(retrievalScope(["doc-1"], [], ["who", "cdc"], ["who", "cdc"]).categories, []);
    assert.deepEqual(retrievalScope([], [], ["who", "cdc"], ["who"]).categories, ["who"]);
    assert.deepEqual(retrievalScope([], ["who", "cdc"], ["who", "cdc"], ["who", "cdc"]).categories, ["who", "cdc"]);
  });

  it("retries while the passages are insufficient and the budget remains", () => {
    assert.equal(shouldRewrite(false, 1, 1), true);
    assert.equal(shouldRewrite(false, 2, 1), false);
    assert.equal(shouldRewrite(true, 1, 1), false);
    assert.equal(isRepeatedQuery("TB prevention", ["tb prevention"]), true);
  });

  it("puts the latest search ahead of passages already kept", () => {
    const ordered = preferIncoming([hit("old")], [hit("new"), hit("old")], 5);
    assert.deepEqual(
      ordered.map((item) => item.chunkId),
      ["new", "old"]
    );
  });
});

describe("retrieval graph", () => {
  it("stops after a sufficient grade", async () => {
    const searches: string[][] = [];
    const graph = compileRetrievalGraph({
      maxQueries: 3,
      maxRetries: 1,
      plan: async () => ({ queries: ["tb prevention"], reason: "Single fact." }),
      route: async () => ({ categories: ["who"], reason: "The question names WHO." }),
      search: async (queries) => {
        searches.push(queries);
        return [hit("passage")];
      },
      rerank: async (_question, hits) => hits,
      grade: async () => ({ sufficient: true, reason: "The passage states the recommendation." }),
      rewrite: async () => {
        throw new Error("rewrite should not run");
      },
    });

    const result = await graph.invoke({
      question: "What does WHO recommend for TB prevention?",
      documentIds: [],
      requestedCategories: [],
      allowedCategories: ["who", "cdc"],
    });

    assert.deepEqual(searches, [["tb prevention"]]);
    assert.equal(result.attempts, 1);
    assert.equal(result.sufficient, true);
    assert.deepEqual(
      result.steps.map((step) => step.node),
      ["plan", "route", "retrieve", "grade"]
    );
  });

  it("rewrites once when the first passages are not enough", async () => {
    const searches: string[][] = [];
    const graph = compileRetrievalGraph({
      maxQueries: 3,
      maxRetries: 1,
      plan: async () => ({ queries: ["tb treatment", "tb prevention"], reason: "Split the two topics." }),
      route: async () => ({ categories: ["who", "cdc"], reason: "No publisher was named." }),
      search: async (queries) => {
        searches.push(queries);
        return queries[0] === "preventive treatment eligibility" ? [hit("prevention")] : [hit("treatment")];
      },
      rerank: async (_question, hits) => hits.slice(0, 5),
      grade: async (_question, hits) => ({
        sufficient: hits.some((item) => item.chunkId === "prevention"),
        reason: "Prevention eligibility is still missing.",
      }),
      rewrite: async () => ({ query: "preventive treatment eligibility" }),
    });

    const result = await graph.invoke({
      question: "How does TB treatment differ from prevention?",
      allowedCategories: ["who", "cdc"],
    });

    assert.deepEqual(searches, [["tb treatment", "tb prevention"], ["preventive treatment eligibility"]]);
    assert.equal(result.attempts, 2);
    assert.equal(result.sufficient, true);
    assert.equal(result.citations[0]?.chunkId, "prevention");
  });

  it("stops when a rewrite repeats an earlier query", async () => {
    let searches = 0;
    const graph = compileRetrievalGraph({
      maxQueries: 3,
      maxRetries: 2,
      plan: async () => ({ queries: ["metformin 500 mg"], reason: "Keep the dose." }),
      route: async () => ({ categories: ["who"], reason: "WHO." }),
      search: async () => {
        searches += 1;
        return [];
      },
      rerank: async (_question, hits) => hits,
      grade: async () => ({ sufficient: false, reason: "Nothing matched." }),
      rewrite: async () => ({ query: "Metformin 500 mg" }),
    });

    const result = await graph.invoke({
      question: "What is the metformin 500 mg note?",
      allowedCategories: ["who"],
    });

    assert.equal(searches, 1);
    assert.equal(result.stop, true);
    assert.equal(result.sufficient, false);
    assert.equal(result.steps.at(-1)?.node, "rewrite");
  });

  it("uses the original question when planning fails", async () => {
    const searches: string[][] = [];
    const graph = compileRetrievalGraph({
      maxQueries: 3,
      maxRetries: 0,
      plan: async () => {
        throw new Error("model down");
      },
      route: async () => ({ categories: ["cdc"], reason: "CDC." }),
      search: async (queries) => {
        searches.push(queries);
        return [hit("kept")];
      },
      rerank: async (_question, hits) => hits,
      grade: async () => ({ sufficient: true, reason: "Covered." }),
      rewrite: async () => ({ query: "unused" }),
    });

    const result = await graph.invoke({
      question: "CDC diabetes criteria",
      allowedCategories: ["cdc"],
    });

    assert.deepEqual(searches, [["CDC diabetes criteria"]]);
    assert.match(result.steps[0]?.detail ?? "", /original question/);
  });
});

function hit(chunkId: string): SearchHit {
  return {
    chunkId,
    documentId: "doc",
    documentName: "guide.pdf",
    category: "who",
    pageStart: 1,
    pageEnd: 1,
    content: chunkId,
    score: 1,
  };
}

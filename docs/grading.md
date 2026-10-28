# Grading

Grading does not use a ranking algorithm. BM25, vector search, reciprocal rank fusion, and the cross-encoder reranker only order the passages. The grade is a separate yes-or-no check from the same chat model that writes the answer, at temperature 0.

The order on one search is: BM25 and vectors find candidates, RRF merges them, the reranker reorders them, then this LLM check decides whether that set is enough to answer.

## What the grade node does

After retrieval, the grade node in `backend-server/src/services/agent/graph.ts` does one of two things.

If `citations` is empty, it skips the model and sets `sufficient` to false with the reason "No passages matched the query."

If there are passages, `backend-server/src/services/agent/run.ts` sends the question and a short excerpt of each passage (about 500 characters) and asks for JSON only:

```json
{"sufficient":false,"reason":"The passages cover treatment, not prevention."}
```

The instruction is: set `sufficient` to true only when those passages state the facts the question asks for. Off-topic text, a missing half of a comparison, or uncertainty is false. The model is told not to use outside knowledge. A tool result in the list counts as evidence for that calculation, not as a diagnosis. `parseGrade` reads the JSON with Zod. The reason is trimmed to 240 characters and stored on the trace.

## What happens after the grade

The next step is a plain rule, not another model. `shouldRewrite` in `backend-server/src/services/agent/decisions.ts` is:

```ts
sufficient === false && attempts <= maxRetries
```

With the default `AGENT_MAX_RETRIES=1`, a failed grade allows one rewrite and a second search. A passed grade stops the loop. If the grader itself cannot be reached, the node keeps the current passages and sets `sufficient` to true so a broken model does not trigger another search.

`agent.sufficient` on the chat response is this model opinion. It is not a hand label. How to score it against the PDFs is in [agentic-retrieval-evaluation.md](./agentic-retrieval-evaluation.md). The search that feeds the grade is in [v3.md](./v3.md).

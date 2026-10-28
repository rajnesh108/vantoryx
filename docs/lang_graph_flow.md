## LLM Usage and Cost Optimization

This is particularly important when designing Vantoryx to be cost-efficient.

### LLM Usage by Operation

| Operation | LLM Required? | Why |
|---|---|---|
| Validate incoming request | No | Handled by ordinary TypeScript validation |
| Create query plan | Usually | Understands intent and decomposes complex questions |
| Route to a search function | Not necessarily | Uses the plan output or deterministic rules |
| Generate query embedding | No generative LLM required | Uses an embedding model |
| Vector/BM25 search | No | Handled by the database or search service |
| Fuse search results | No | Uses a ranking algorithm such as Reciprocal Rank Fusion (RRF) |
| Rerank results | Not necessarily | Uses a cross-encoder or reranking model |
| Evaluate evidence | Optional | Uses rules, an LLM, or both |
| Refine the plan | Usually, if retrying | Uses feedback to generate an improved search plan |
| Generate final answer | Usually | Uses an LLM to synthesize evidence into a response |

The LLM is only one component of the overall system. Costs can be optimized by using deterministic rules for straightforward cases, a smaller model for planning and evaluation, and a stronger model for complex answer generation.

## Request Flow

| Step | What Happens | Component |
|---|---|---|
| 1. Request received | Express validates the question and creates a request ID. | Application code |
| 2. Plan generated | The LLM creates subqueries for symptoms and comparison. | LLM call |
| 3. Search executed | Hybrid retrieval invokes embedding, lexical search, fusion, and reranking services. | Database and retrieval services |
| 4. Evidence evaluated | The evaluator checks the retrieved evidence and identifies missing information. | LLM or rules |
| 5. Targeted retry | The planner creates a targeted search for missing information, if necessary. | LLM and retrieval services |
| 6. Final answer | The system generates an evidence-grounded answer and returns source metadata to the user. | Answer-generation service |

## Cost Optimization Strategies

- **Use deterministic routing:** Avoid unnecessary LLM calls for simple queries.
- **Reuse query embeddings:** Cache embeddings for repeated queries when appropriate.
- **Limit retries:** Configure a maximum number of retrieval attempts to prevent excessive costs and latency.
- **Use smaller models:** Prefer lightweight models for query planning and evidence evaluation when quality is sufficient.
- **Control retrieval size:** Limit the number of candidate chunks sent to reranking and answer generation.
- **Track token usage:** Record input tokens, output tokens, model usage, latency, and retry counts for each request.
- **Evaluate before scaling:** Measure retrieval quality and answer accuracy before increasing model complexity.

> **Key takeaway:** Agentic retrieval should improve retrieval quality without introducing unnecessary LLM calls. The goal is to balance answer quality, latency, and cost.

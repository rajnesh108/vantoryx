# Agentic Retrieval Evaluation and Optimization

## Overview

Agentic retrieval extends hybrid retrieval by allowing an agent to plan searches, break complex questions into sub-queries, assess retrieved evidence, and retry when the evidence is insufficient.

The goal is to determine when agentic retrieval improves answer quality over the existing hybrid retrieval approach, while keeping latency and cost under control.

## Handling Unanswerable Questions

The system should recognize when the available documents do not provide enough evidence to answer a question.

- Apply a hard limit to retries so the retrieval process cannot loop indefinitely.
- Evaluate whether the retrieved evidence is sufficient to support an answer.
- Return an explicit outcome such as `not_found` or `insufficient_evidence` when the source material does not support an answer.
- Avoid generating a confident answer when relevant evidence is missing.

The current workflow includes bounded retries and evidence grading. Explicit handling of unanswerable questions should be verified and added if it is not already implemented.

## Evaluation Dataset

Create a fixed test dataset containing three question types:

- **Simple lookup:** questions answerable from a single relevant passage.
- **Multi-hop:** questions that require evidence from multiple passages or retrieval steps.
- **Unanswerable:** questions for which the available documents do not contain sufficient evidence.

For each question, record the expected answer or expected unanswerable outcome. Where possible, label the relevant document chunks so retrieval metrics can be calculated.

## Comparing Hybrid and Agentic Retrieval

Run V2 Hybrid Retrieval and V3 Agentic Retrieval against the same test questions and document collection.

Compare results separately for simple lookup, multi-hop, and unanswerable questions. Useful measures include:

- **Recall@K:** whether relevant chunks appear among the top K retrieved results.
- **Answer quality:** whether the generated answer is correct and supported by evidence.
- **Evidence sufficiency:** whether the system correctly identifies when evidence is inadequate.
- **Latency:** total response time and the time added by planning or retries.
- **Cost:** LLM calls, input/output tokens, and estimated model cost.
- **Retry behavior:** number of retries and whether retries improve the result.

Recall@K requires ground-truth labels identifying which chunks are relevant to each question.

## Planner Subqueries and Retrieval Traces

For agentic retrieval, capture the planner's sub-queries alongside the retrieval results. This helps explain how the agent decomposed a question and whether each search contributed useful evidence.

Where practical, record:

- Original user question
- Generated planner sub-queries
- Retrieved chunk identifiers and ranking scores
- Evidence-grading outcome
- Retry count and query rewrites
- Final answer or unanswerable outcome
- Total latency, LLM calls, token usage, and estimated cost

These traces make it easier to investigate failures and identify cases where agentic planning adds unnecessary work.

## Reporting and Optimization

Summarize the results by question type and retrieval approach. In particular, identify:

- Cases where agentic retrieval improves Recall@K or answer quality
- Cases where hybrid retrieval performs just as well with lower latency or cost
- Unanswerable questions incorrectly answered with unsupported claims
- Retries that do not improve evidence quality
- Question types that benefit most from query decomposition

Use the results to refine routing, retry limits, evidence-sufficiency checks, and the decision about when to use agentic retrieval instead of standard hybrid retrieval.

## Success Criteria

The evaluation should make it possible to determine whether agentic retrieval provides measurable benefits over hybrid retrieval, and under what conditions those benefits justify additional latency and cost. Unanswerable questions should be handled explicitly, retries should remain bounded, and performance should be measured on a consistent test dataset.

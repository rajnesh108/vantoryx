This is particularly important when you want Vantoryx to be cost-efficient.

||Operation||LLM required?||Why||
|Validate incoming request|No|Ordinary TypeScript|
|Create query plan|Usually|Understand intent and decompose the question|
|Route to a search function|Not necessarily|Use plan output or deterministic rules|
|Generate query embedding|No generative LLM required|Embedding model|
|Vector/BM25 search|No|Database or search service|
|Fuse search results|No|Ranking algorithm|
|Rerank results|Not necessarily|Cross-encoder or reranking model|
|Evaluate evidence|Optional|Rules, LLM, or both|
|Refine the plan|Usually, if retrying|Use feedback to create a better search|
|Generate final answer|Usually|LLM synthesizes the evidence|

The LLM is only one component in the overall system. You can optimize costs by using rules for obvious cases, a small model for planning and evaluation, and a stronger model for complex final answers.

h2. Request flow

||Step||What happens||Component||
|1. Request received|Express validates the question and creates a request ID.|Application code|
|2. Plan generated|LLM creates three subqueries for symptoms and comparison.|LLM call|
|3. Search executed|Hybrid retrieval invokes embedding, lexical search, fusion, and reranking services.|Database and services|
|4. Evidence evaluated|Evaluator finds that hypertension evidence is missing.|LLM or rules|
|5. Targeted retry|The planner creates a targeted search for the missing information.|LLM + retrieval|
|6. Final answer|The system generates an evidence-grounded answer and returns source metadata to the user.| |

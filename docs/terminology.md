# Terminology

Terms used in Vantoryx for retrieval-augmented generation and the agent. A passage is the text that was found. A citation is that text turned into a numbered source on the answer.

| Term | Description |
|---|---|
| Agent | The LangGraph workflow that plans a search, picks document categories, grades the passages, and can retry or call a tool. It runs when `AGENT_ENABLED` is true. |
| Agent trace | The `agent` object on a chat response: the queries, categories, attempt count, grade, and the Plan, Route, Retrieve, Grade, Rewrite, and Tool steps. |
| Answer outcome | What the chat API did with a question: `answered`, `not_found` when no passage matched, or `insufficient_evidence` when the grade still failed after the retry budget. The last of these does not call the answer model. |
| BM25 | A keyword ranking method. It scores a chunk higher when the query's rare terms appear in that chunk, with less weight for very long chunks. Vantoryx runs it with PostgreSQL full-text search. |
| Category | The publisher stored on a PDF: `who`, `mohfw`, `aiims`, `icmr`, `cdc`, `nice`, or `other`. Routing can narrow a search to some of these. |
| Chunk | One stored piece of a PDF. Ingestion splits each file into overlapping chunks of about 1000 characters, then saves the text, page span, and embedding. |
| Chunking | Splitting a PDF into those overlapping chunks so search can return a few relevant pieces instead of the whole file. |
| Citation | One source the answer may use. It is a retrieved chunk or a tool result, numbered from the top of the list: the first item is `[1]`. The record holds the document name, category, pages, text, and score. |
| Context | The numbered sources pasted into the prompt before the question. The model is told to answer only from that text. |
| Cosine similarity | A measure of how close two vectors point. pgvector uses cosine distance to rank chunk embeddings against the question embedding. |
| Cross-encoder | A model that reads the question and one chunk together and scores that pair. The reranker is this kind of model (`BAAI/bge-reranker-base` by default). |
| Embedding | A vector of 768 numbers that stands for the meaning of a text. The embedding server builds one for every chunk and for each search query. |
| Evaluation | A fixed set of questions scored on hybrid retrieval and the agent. Recall, answer quality, sufficiency, latency, retries, and token cost are in [v5.md](./v5.md). |
| Grade | A yes-or-no check by the chat model, at temperature 0, on whether the current passages state the facts the question asks for. It returns `sufficient` and a short reason. It is not BM25, fusion, or the reranker. |
| Grounded answer | An answer whose factual sentences come from the numbered sources and carry a citation such as `[1]`. |
| Hybrid retrieval | Search that runs BM25 and vector search, then merges the two lists. This is the V2 path inside every agent retrieval. |
| Ingestion | The upload path: extract PDF text, chunk it, embed each chunk, and store the rows. A document is searchable when its status is `ready`. |
| LangGraph | The library that runs the agent as a graph of nodes: plan, route, retrieve, grade, rewrite, and tools. |
| LLM | The large language model that plans, grades, rewrites, chooses a tool, and writes the answer. Vantoryx calls any OpenAI-compatible chat API, including a local Ollama model. |
| MCP | Model Context Protocol. A standard way for the agent to call tools on a separate server. The bundled server exposes unit conversion and BMI over stdio. |
| Observation | A record of one chat question: path, outcome, latency, model calls, tokens, and cost. The API keeps the latest ones in memory. See [v6.md](./v6.md). |
| Passage | The text of a retrieved chunk, including the page span. The grader reads passages. A tool result is a citation, not a passage, because it did not come from a PDF page. |
| pgvector | The PostgreSQL extension that stores the 768-number embeddings and searches them with an HNSW index. |
| Prompt | The system rules plus the user message sent to the LLM. For an answer, the user message is the numbered sources and then the question. |
| Query planning | The plan step. The model turns one question into one to three search queries. A question with two independent parts can become two queries. |
| RAG | Retrieval-augmented generation. Search the indexed PDFs first, then ask the LLM to write an answer from the retrieved text. |
| Recall@K | The share of labeled phrases that appear in the top K retrieved passages. It is empty when a question has no labeled phrase, which is the case for the unanswerable questions. |
| Reciprocal rank fusion | The merge step, also called RRF. A chunk that ranks near the top of both the BM25 list and the vector list is placed ahead of a chunk that appears in only one list. |
| Reranker | The cross-encoder that reorders the fused chunks by how well each one matches the original question, then keeps `RERANK_TOP_K`. |
| Retrieval | Finding the chunks to show the model. One retrieval is BM25, vector search, fusion, and the reranker. `agent.attempts` counts how many of these ran. |
| Rewrite | A new search query written after a failed grade. It adds the terms the grade said were missing. The default budget is one rewrite. |
| Routing | The route step. It keeps the document categories the question names, and it cannot add a category the request left out. |
| Temperature | How much the model may vary its wording. Planning, routing, grading, rewriting, and tool choice use 0. The answer uses 0.1. |
| Token | A piece of text the model reads or writes. Token count is the usual measure of prompt size and model cost. |
| Tool | A function on an MCP server, such as `calculators/convert-glucose`. A successful call is appended as a citation with category `tool`. |
| Top-K | How many chunks are kept. `TOP_K` is the final list when the reranker is off. `BM25_TOP_K` and `VECTOR_TOP_K` are the candidate lists before fusion. |
| Vector | The list of numbers an embedding model returns. Two texts about the same fact tend to have vectors that point in a similar direction. |

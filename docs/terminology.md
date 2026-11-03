# Terminology

Terms used in Vantoryx for retrieval-augmented generation, the agent, and local model inference. A passage is the text that was found. A citation is that text turned into a numbered source on the answer.

| Term | Description |
|---|---|
| Agent | The LangGraph workflow that plans a search, picks document categories, grades the passages, and can retry or call a tool. It runs when `AGENT_ENABLED` is true. |
| Agent trace | The `agent` object on a chat response: the queries, categories, attempt count, grade, and the Plan, Route, Retrieve, Grade, Rewrite, and Tool steps. |
| Answer outcome | What the chat API did with a question: `answered`, `not_found` when no passage matched, or `insufficient_evidence` when the grade still failed after the retry budget. The last of these does not call the answer model. |
| Batch size | How many tokens llama.cpp processes together. `-b` is the logical batch size and `-ub` is the physical microbatch. A larger batch can speed prompt processing and uses more memory. See [llm-inference-optimization.md](./llm-inference-optimization.md). |
| BM25 | A keyword ranking method. It scores a chunk higher when the query's rare terms appear in that chunk, with less weight for very long chunks. Vantoryx runs it with PostgreSQL full-text search. |
| Category | The publisher stored on a PDF: `who`, `mohfw`, `aiims`, `icmr`, `cdc`, `nice`, or `other`. Routing can narrow a search to some of these. |
| Chunk | One stored piece of a PDF. Ingestion splits each file into overlapping chunks of about 1000 characters, then saves the text, page span, and embedding. |
| Chunking | Splitting a PDF into those overlapping chunks so search can return a few relevant pieces instead of the whole file. |
| Citation | One source the answer may use. It is a retrieved chunk or a tool result, numbered from the top of the list: the first item is `[1]`. The record holds the document name, category, pages, text, and score. |
| Context | The numbered sources pasted into the prompt before the question. The model is told to answer only from that text. |
| Context window | How many tokens the model can hold in one active sequence, such as 2,048, 4,096, or 8,192. A larger window fits a longer chat and more retrieved passages, and it grows the KV cache. See [llm-inference-optimization.md](./llm-inference-optimization.md). |
| Cosine similarity | A measure of how close two vectors point. pgvector uses cosine distance to rank chunk embeddings against the question embedding. |
| CPU vs GPU | A CPU has fewer strong cores and can run a model one step at a time. A GPU has thousands of small cores and runs the matrix math of an LLM in parallel, limited by VRAM. See [gpu-vs-cpu.md](./gpu-vs-cpu.md). |
| Cross-encoder | A model that reads the question and one chunk together and scores that pair. The reranker is this kind of model (`BAAI/bge-reranker-base` by default). |
| CUDA | NVIDIA's platform for running computation on its GPUs. A llama.cpp build with CUDA can place model layers on an NVIDIA GPU. The same GGUF can run on a CPU-only machine without it. See [local-llms-cpu-gpu.md](./local-llms-cpu-gpu.md). |
| Embedding | A vector of 768 numbers that stands for the meaning of a text. The embedding server builds one for every chunk and for each search query. |
| Evaluation | A fixed set of questions scored on hybrid retrieval and the agent. Recall, answer quality, sufficiency, latency, retries, and token cost are in [v5.md](./v5.md). |
| GGUF | GPT-Generated Unified Format. One file of quantized weights and metadata that llama.cpp loads. Levels such as Q8_0 and Q4_K_M trade some quality for less memory. See [gguf.md](./gguf.md). |
| GPU offloading | Moving some or all model layers from system RAM onto the GPU. In llama.cpp the layer count is `-ngl`. Layers left on the CPU stay in RAM. The GGUF file can stay the same. See [gpu-vs-cpu.md](./gpu-vs-cpu.md). |
| Grade | A yes-or-no check by the chat model, at temperature 0, on whether the current passages state the facts the question asks for. It returns `sufficient` and a short reason. It is not BM25, fusion, or the reranker. |
| Grounded answer | An answer whose factual sentences come from the numbered sources and carry a citation such as `[1]`. |
| Hybrid retrieval | Search that runs BM25 and vector search, then merges the two lists. This is the V2 path inside every agent retrieval. |
| Inference engine | The program that loads a model and runs a prompt through it: tokenization, the network layers, next-token probabilities, and the generated text. llama.cpp is the local engine. Ollama is another. See [understanding-llama-cpp.md](./understanding-llama-cpp.md). |
| Ingestion | The upload path: extract PDF text, chunk it, embed each chunk, and store the rows. A document is searchable when its status is `ready`. |
| KV cache | Stored Key and Value tensors from attention, so decode does not recompute them for tokens already seen. It speeds generation and grows with the context window. See [llm-inference-optimization.md](./llm-inference-optimization.md). |
| LangGraph | The library that runs the agent as a graph of nodes: plan, route, retrieve, grade, rewrite, and tools. |
| llama | Meta's family of language models. `llama3.1` is the model name in `LLM_MODEL` when Ollama is the provider. The model is separate from the program that runs it. |
| llama.cpp | The local program that loads a GGUF file and serves chat. In Vantoryx the provider is `llamacpp` and the server listens on port 8081. See [v7.md](./v7.md) and [understanding-llama-cpp.md](./understanding-llama-cpp.md). |
| LLM | The chat model behind planning, grading, tools, and the answer. A common provider interface calls a local llama.cpp or Ollama server, or a cloud OpenAI model. See [v7.md](./v7.md). |
| LLM inference | Running the model on a prompt to produce the next tokens. Planning, grading, tool choice, and the answer are all inference calls. See [llm-inference-optimization.md](./llm-inference-optimization.md). |
| MCP | Model Context Protocol. A standard way for the agent to call tools on a separate server. The bundled server exposes unit conversion and BMI over stdio. |
| Observation | A record of one chat question: path, outcome, latency, model calls, tokens, and cost. The API keeps the latest ones in memory. See [v6.md](./v6.md). |
| Passage | The text of a retrieved chunk, including the page span. The grader reads passages. A tool result is a citation, not a passage, because it did not come from a PDF page. |
| pgvector | The PostgreSQL extension that stores the 768-number embeddings and searches them with an HNSW index. |
| Prefill vs decode | Prefill reads the whole prompt at once and fills the KV cache. Decode then writes one new token at a time. Prefill is the heavy compute pass. Decode is where token speed shows up. See [prefill-vs-decode.md](./prefill-vs-decode.md). |
| Prompt | The system rules plus the user message sent to the LLM. For an answer, the user message is the numbered sources and then the question. |
| Quantization | Storing weights in fewer bits, such as Q8_0, Q5_K_M, or Q4_K_M, so the same model uses less RAM or VRAM. Fewer bits save memory and can lose some answer quality. See [gguf.md](./gguf.md). |
| Query planning | The plan step. The model turns one question into one to three search queries. A question with two independent parts can become two queries. |
| RAG | Retrieval-augmented generation. Search the indexed PDFs first, then ask the LLM to write an answer from the retrieved text. |
| Recall@K | The share of labeled phrases that appear in the top K retrieved passages. It is empty when a question has no labeled phrase, which is the case for the unanswerable questions. |
| Reciprocal rank fusion | The merge step, also called RRF. A chunk that ranks near the top of both the BM25 list and the vector list is placed ahead of a chunk that appears in only one list. |
| Reranker | The cross-encoder that reorders the fused chunks by how well each one matches the original question, then keeps `RERANK_TOP_K`. |
| Retrieval | Finding the chunks to show the model. One retrieval is BM25, vector search, fusion, and the reranker. `agent.attempts` counts how many of these ran. |
| Rewrite | A new search query written after a failed grade. It adds the terms the grade said were missing. The default budget is one rewrite. |
| Routing | The route step. It keeps the document categories the question names, and it cannot add a category the request left out. |
| Temperature | How much the model may vary its wording. Planning, routing, grading, rewriting, and tool choice use 0. The answer uses 0.1. |
| Time to first token | How long a user waits before the first generated token. Prefill dominates this wait. Also called TTFT. See [prefill-vs-decode.md](./prefill-vs-decode.md). |
| Token | A piece of text the model reads or writes. Token count is the usual measure of prompt size and model cost. |
| Tokens per second | How fast decode writes tokens after the first one. Also called TPS. It is often limited by how quickly weights and the KV cache can be read from memory. See [prefill-vs-decode.md](./prefill-vs-decode.md). |
| Tool | A function on an MCP server, such as `calculators/convert-glucose`. A successful call is appended as a citation with category `tool`. |
| Top-K | How many chunks are kept. `TOP_K` is the final list when the reranker is off. `BM25_TOP_K` and `VECTOR_TOP_K` are the candidate lists before fusion. |
| Vector | The list of numbers an embedding model returns. Two texts about the same fact tend to have vectors that point in a similar direction. |
| VRAM | Memory on the GPU. It holds model weights, the KV cache, and runtime buffers for layers that run there. A model that does not fit stays partly in RAM or does not load. See [gpu-vs-cpu.md](./gpu-vs-cpu.md). |

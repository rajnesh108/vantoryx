# LLM inference optimization: context window, KV cache, batching, and performance

Running an LLM locally is not just about loading a model and generating text.

To build efficient inference systems, we also need to understand how prompts are processed, how memory is managed, and how tokens are generated.

Let's explore four important concepts in llama.cpp.

## 1. Context window

The context window determines how many tokens a model can process and retain in its active context.

For example:

- 2,048 tokens
- 4,096 tokens
- 8,192 tokens

A larger context window allows longer conversations and more retrieved documents in RAG applications.

However, increasing context size can increase memory consumption, particularly for the KV cache.

## 2. KV cache (key-value cache)

During transformer inference, attention layers calculate Key and Value representations.

Instead of repeatedly calculating these representations for previously processed tokens, the inference engine can cache them.

This is called the KV cache.

Why is it important?

- Reduces repeated computation during token generation.
- Improves autoregressive decoding efficiency.
- Consumes additional memory as the context grows.

For local inference, KV cache memory management becomes especially important when working with longer contexts.

## 3. Batch size and microbatch size

Batching controls how input tokens are processed.

llama.cpp provides parameters such as:

- `-b 512` — logical batch size.
- `-ub 128` — physical microbatch size.

Appropriate configuration can improve prompt-processing throughput, although larger batches may require more memory.

## 4. Understanding inference performance

Two important metrics help evaluate local LLM performance:

**Time to first token (TTFT).** Measures how long a user waits before receiving the first generated token.

**Tokens per second (TPS).** Measures how quickly the model generates subsequent tokens.

Other metrics worth monitoring:

- Model loading time.
- RAM consumption.
- GPU VRAM consumption.
- CPU/GPU utilization.
- Prompt processing speed.

## Applying this to Vantoryx

I'm exploring how these parameters affect local inference across CPU-only and NVIDIA GPU environments.

The goal is to understand the relationship between:

Model size → Quantization → Hardware → Memory → Latency → Throughput.

This knowledge will help build a configurable and hardware-aware inference layer instead of depending entirely on default runtime settings.

Building AI systems requires understanding not only models, but also the infrastructure that executes them.

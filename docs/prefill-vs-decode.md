# Understanding LLM inference: prefill vs decode

Ever wondered what actually happens inside an LLM after you submit a prompt?

LLM inference consists of two important phases: **prefill and decode.**

Understanding these phases helps us optimize LLM performance, GPU utilization, latency, and inference costs.

## 1. Prefill phase – processing the input

When you send a prompt to an LLM:

- The input text is tokenized.
- All input tokens are processed together.
- The model computes attention and generates Key-Value (KV) cache entries.
- The model prepares the information needed to generate the next token.

**Key characteristics:**

- Highly parallel computation.
- Heavy matrix operations.
- Benefits significantly from GPU compute power.
- Influences Time To First Token (TTFT).

## 2. Decode phase – generating output

After prefill, the model starts generating the response.

- Predicts the next token.
- Samples or selects a token.
- Adds the generated token to the sequence.
- Repeats the process until generation is complete.

**Key characteristics:**

- Autoregressive generation (one token at a time).
- Uses previously generated KV cache.
- Often memory-bandwidth bound.
- Influences inter-token latency and generation speed (tokens per second).

## 3. Prefill vs decode

| Parameter | Prefill | Decode |
|---|---|---|
| Purpose | Process input | Generate output |
| Processing | Parallel tokens | Sequential tokens |
| Main bottleneck | Compute | Often memory bandwidth |
| KV cache | Created | Reused and updated |
| Performance metric | TTFT | Tokens/second |

## 4. Why does this matter for AI infrastructure?

Understanding these phases helps when:

- Selecting the right GPU.
- Optimizing inference engines.
- Managing GPU memory.
- Improving response latency.
- Supporting multiple concurrent users.
- Reducing inference costs.

Modern inference engines such as vLLM use techniques like PagedAttention and continuous batching to improve GPU memory utilization and throughput.

## Final thoughts

LLM inference isn't simply about loading model weights onto a GPU and generating text.

Prefill and decode have different computational characteristics and performance bottlenecks.

Understanding both is essential for designing efficient, scalable AI inference systems.

I'm exploring these concepts while building **Vantoryx – AI Systems & Inference Platform.**

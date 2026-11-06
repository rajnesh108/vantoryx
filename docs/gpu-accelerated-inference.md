# Understanding GPU-accelerated inference

## LLM inference lifecycle

1. **Input prompt.** Explain how artificial intelligence works.
2. **Tokenization.** Convert text into token IDs.
3. **Model computation.** Embeddings, attention, matrix multiplication, and neural network layers.
4. **Next-token prediction.** Calculate probabilities for the next token.
5. **Token generation.** Repeat until the response is complete.

All the computational work in steps 3–5 is where GPU acceleration becomes important.

## Why do we need a GPU for AI inference?

Let's compare CPU and GPU architectures.

**CPU — Central Processing Unit**

- A smaller number of powerful cores.
- Designed for general-purpose tasks.
- Excellent for sequential operations.
- Handles application logic and orchestration.

**GPU — Graphics Processing Unit**

- Many parallel processing units.
- Designed for parallel computation.
- Excellent for large matrix operations.
- Accelerates neural network computation.

Imagine you need to perform one million multiplication operations.

- A CPU can process work using its relatively small number of powerful cores.
- A GPU can distribute suitable operations across many processing units simultaneously.

## Understand GPU architecture for AI

### A. CUDA cores

CUDA cores are processing units inside NVIDIA GPUs.

They execute parallel operations required by GPU applications.

### B. Tensor cores

Tensor cores are specialized hardware designed to accelerate matrix operations.

They are particularly useful for deep learning workloads.

For example, FP16 and certain INT8 operations can benefit from Tensor Core acceleration on supported GPUs.

### C. VRAM

VRAM is the GPU's dedicated memory.

It stores:

- LLM model weights.
- Activations.
- KV cache.
- Intermediate computation data.

For example, a 7B model using FP16 needs approximately 14 GB just for its weights.

If your GPU has 8 GB VRAM, the entire model cannot fit in GPU memory without using quantization, offloading, or another strategy.

### D. CUDA

CUDA is NVIDIA's platform for GPU programming and computation.

You have the GPU hardware. CUDA is the platform that lets software interact with it. The name stands for Compute Unified Device Architecture.

It is NVIDIA's parallel computing platform and programming model. Developers use it to run general-purpose work on NVIDIA GPUs, including AI training and inference.

In simple terms, CUDA lets software such as PyTorch, llama.cpp, and vLLM perform computations on NVIDIA GPUs instead of relying entirely on CPUs.

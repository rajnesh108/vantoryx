# Running local LLMs on two different laptops: CPU vs NVIDIA GPU

Do we need an NVIDIA GPU to run local LLMs?

Not necessarily.

While working on Vantoryx – AI Systems & Inference Platform, I'm exploring how to run the same LLM application across two different machines: one with an NVIDIA GPU and another with CPU-only hardware.

The interesting part? We can use the same architecture on both machines.

## 1. Same model, different hardware

I'm using GGUF model format with llama.cpp as the inference engine.

**NVIDIA GPU laptop:**

- Model format: GGUF
- Inference engine: llama.cpp
- Execution: CUDA GPU + CPU
- Memory: GPU VRAM + system RAM
- Performance: Generally faster

**CPU-only laptop:**

- Model format: GGUF
- Inference engine: llama.cpp
- Execution: CPU
- Memory: System RAM
- Performance: Generally slower

## 2. One application, multiple inference configurations

The idea is to maintain a single LLM integration layer in Vantoryx.

Application → LLM Provider → llama.cpp → CPU / GPU

Only the inference configuration changes depending on available hardware.

This makes the application hardware-independent and easier to scale across development environments.

## 3. Benchmarking: theory vs reality

Rather than assuming GPU is always faster, I want to benchmark the same GGUF model on both machines.

Key performance metrics:

- **TTFT:** Time To First Token.
- **Tokens/sec:** How quickly the model generates responses.
- **Prompt processing:** Input token processing speed.
- **RAM usage:** System memory consumption.
- **VRAM usage:** GPU memory consumption.
- **CPU/GPU utilization:** Hardware resource utilization.

## 4. Why is this important?

Not everyone has access to expensive GPU hardware.

Building AI applications that support both CPU and GPU inference makes local AI development more accessible and flexible.

The goal is simple: **build once, run across different hardware configurations.**

This is another step in developing Vantoryx – AI Systems & Inference Platform.

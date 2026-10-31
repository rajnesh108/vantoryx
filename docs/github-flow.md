# GitHub Flow

# Vantoryx — AI Systems & Inference Platform

Aim - Buil an appliaction platform, starting with RAG and progressively adding hybrid retrieval, reranking, agentic workflows, MCP tools, 
evaluation, observability, local inference, GPU serving, quantization, AWS deployment, load testing, and cost/latency optimization.

| Version | What you build     | What you demonstrate                 |
| ------- | ------------------ | ------------------------------------ |
| **V1**  | Basic RAG          | Embeddings, chunking, pgvector       |
| **V2**  | Hybrid + reranking | BM25 + vector + reranker             |
| **V3**  | Agentic retrieval  | Query planning, routing, retries     |
| **V4**  | MCP                | External tools through MCP           |
| **V5**  | Evaluation         | RAG/agent quality measurement        |
| **V6**  | Observability      | Traces, latency, token/cost tracking |
| **V7**  | Local LLM          | Ollama/llama.cpp                     |
| **V8**  | GPU inference      | vLLM/TensorRT-LLM concepts           |
| **V9**  | Quantization       | FP16 → INT8/INT4                     |
| **V10** | AWS                | Production cloud architecture        |
| **V11** | Load testing       | concurrency, throughput, bottlenecks |
| **V12** | Optimization       | cost vs latency vs quality           |

## Table of Contents

- [Create one GitHub Issue per version](#create-one-github-issue-per-version)
- [Github branches creation](#github-branches-creation)
- [Recommended release tags](#recommended-release-tags)
- [Github feature branches naming](#github-feature-branches-naming)
- [Workflow](#workflow)
- [Exact Git workflow](#exact-git-workflow)

## Create one GitHub Issue per version

```text
#1  V1 - Basic RAG
#2  V2 - Hybrid Retrieval + Reranking
#3  V3 - Agentic Retrieval
#4  V4 - MCP Tools
#5  V5 - Evaluation
#6  V6 - Observability
#7  V7 - Local LLM
#8  V8 - GPU Inference
#9  V9 - Quantization
#10 V10 - AWS Deployment
#11 V11 - Load Testing
#12 V12 - Cost & Latency Optimization
```

## Github branches creation

```powershell
git checkout master
git checkout -b develop
git push -u origin develop

git checkout master
git checkout -b qa
git push -u origin qa

git checkout master
git checkout -b prod
git push -u origin prod

git checkout develop
git checkout -b version/v1-rag
git push -u origin version/v1-rag

git checkout develop
git checkout -b version/v2-hybrid-reranking
git push -u origin version/v2-hybrid-reranking

git checkout develop
git checkout -b version/v3-agentic-retrieval
git push -u origin version/v3-agentic-retrieval

git checkout develop
git checkout -b version/v4-mcp-tools
git push -u origin version/v4-mcp-tools

git checkout develop
git checkout -b version/v5-evaluation
git push -u origin version/v5-evaluation

git checkout develop
git checkout -b version/v6-observability
git push -u origin version/v6-observability

git checkout develop
git checkout -b version/v7-local-llm
git push -u origin version/v7-local-llm

git checkout develop
git checkout -b version/v8-gpu-inference
git push -u origin version/v8-gpu-inference

git checkout develop
git checkout -b version/v9-quantization
git push -u origin version/v9-quantization

git checkout develop
git checkout -b version/v10-aws
git push -u origin version/v10-aws

git checkout develop
git checkout -b version/v11-load-testing
git push -u origin version/v11-load-testing

git checkout develop
git checkout -b version/v12-cost-latency-optimization
git push -u origin version/v12-cost-latency-optimization
```

## Recommended release tags

When each version is actually completed, tag it:

```powershell
git tag -a v1.0.0 -m "Vantoryx V1 - Basic RAG"
git tag -a v2.0.0 -m "Vantoryx V2 - Hybrid Retrieval and Reranking"
git tag -a v3.0.0 -m "Vantoryx V3 - Agentic Retrieval"
git tag -a v4.0.0 -m "Vantoryx V4 - MCP Tools"
git tag -a v5.0.0 -m "Vantoryx V5 - Evaluation"
git tag -a v6.0.0 -m "Vantoryx V6 - Observability"
git tag -a v7.0.0 -m "Vantoryx V7 - Local LLM"
git tag -a v8.0.0 -m "Vantoryx V8 - GPU Inference"
git tag -a v9.0.0 -m "Vantoryx V9 - Quantization"
git tag -a v10.0.0 -m "Vantoryx V10 - AWS Deployment"
git tag -a v11.0.0 -m "Vantoryx V11 - Load Testing"
git tag -a v12.0.0 -m "Vantoryx V12 - Cost and Latency Optimization"
```

## Github feature branches naming

```text
feature/1-basic-rag
feature/2-hybrid-reranking
feature/3-agentic-retrieval
feature/4-mcp-tools
feature/5-evaluation
feature/6-observability
feature/7-local-llm
feature/8-gpu-inference
feature/9-quantization
feature/10-aws
feature/11-load-testing
feature/12-cost-latency
```

## Workflow

```text
develop
   │
   ├── feature/rag-ingestion
   ├── feature/embedding-service
   ├── feature/pgvector
   └── feature/rag-api
          │
          ▼
        develop
          │
          ▼
       version/v1-rag
          │
          ▼
     release/v1.0.0-qa
          │
          ▼
          qa
          │
          ▼
         prod
          │
          ▼
        master
          │
          ▼
       v1.0.0 tag
```

## Exact Git workflow

### 1. Start from develop

```powershell
git checkout develop
git pull origin develop
```

### 2. Create V1 feature branches

```powershell
git checkout -b feature/1-basic-rag
git push -u origin feature/1-basic-rag
```

After completing the work:

```powershell
git checkout develop
git pull origin develop
git merge --no-ff feature/1-basic-rag -m "feat: implement Basic RAG"
git push origin develop
```

### 3. Push/sync V1 into the version branch

If `version/v1-rag` already exists:

```powershell
git checkout version/v1-rag
git pull origin version/v1-rag
git merge --no-ff develop -m "release: prepare Vantoryx V1 RAG"
git push origin version/v1-rag
```

### 4. Create the QA release branch

```powershell
git checkout version/v1-rag
git pull origin version/v1-rag

git checkout -b release/v1.0.0-qa
git push -u origin release/v1.0.0-qa
```

### 5. Merge the QA release into qa

```powershell
git checkout qa
git pull origin qa

git merge --no-ff release/v1.0.0-qa -m "release: Vantoryx v1.0.0 QA"
git push origin qa
```

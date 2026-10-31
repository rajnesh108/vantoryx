import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultModel,
  modelIsLoaded,
  modelNamesFromOllamaTags,
  modelNamesFromOpenAi,
  ollamaTagsUrl,
  parseProvider,
  probeLocalLlm,
  resolveLlmBaseUrl,
} from "../src/services/localLlm";

describe("local model providers", () => {
  it("picks the default address for each server", () => {
    assert.equal(parseProvider(undefined), "ollama");
    assert.equal(parseProvider("llama.cpp"), "llamacpp");
    assert.equal(parseProvider("openai"), "openai");
    assert.equal(resolveLlmBaseUrl("ollama", ""), "http://127.0.0.1:11434/v1");
    assert.equal(resolveLlmBaseUrl("llamacpp", "  "), "http://127.0.0.1:8081/v1");
    assert.equal(resolveLlmBaseUrl("openai", ""), "https://api.openai.com/v1");
    assert.equal(resolveLlmBaseUrl("ollama", "http://127.0.0.1:11434/v1/"), "http://127.0.0.1:11434/v1");
    assert.equal(defaultModel("llamacpp", "C:\\models\\guide.gguf"), "guide.gguf");
    assert.throws(() => parseProvider("lmstudio"), /LLM_PROVIDER/);
    assert.throws(() => parseProvider("bedrock"), /LLM_PROVIDER/);
    assert.throws(() => resolveLlmBaseUrl("ollama", "ftp://127.0.0.1/v1"), /http or https/);
  });

  it("matches a tagged Ollama model and reads both list shapes", () => {
    assert.equal(modelIsLoaded("llama3.1", ["llama3.1:latest"]), true);
    assert.equal(modelIsLoaded("llama3.1", ["mistral:latest"]), false);
    assert.deepEqual(modelNamesFromOpenAi({ data: [{ id: "local-model" }, { id: "  " }] }), ["local-model"]);
    assert.deepEqual(modelNamesFromOllamaTags({ models: [{ name: "llama3.1:latest" }] }), ["llama3.1:latest"]);
    assert.equal(ollamaTagsUrl("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/api/tags");
  });

  it("falls back to Ollama tags when the OpenAI model list is down", async () => {
    const calls: string[] = [];
    const probe = await probeLocalLlm({
      provider: "ollama",
      model: "llama3.1",
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "",
      timeoutMs: 1000,
      fetchImpl: async (url) => {
        calls.push(String(url));
        if (String(url).endsWith("/models")) {
          return new Response("nope", { status: 404 });
        }
        return json({ models: [{ name: "llama3.1:latest" }] });
      },
    });
    assert.deepEqual(calls, ["http://127.0.0.1:11434/v1/models", "http://127.0.0.1:11434/api/tags"]);
    assert.equal(probe.status, "ok");
    assert.equal(probe.label, "Ollama");
  });

  it("reports a llama.cpp server that is up without the configured model", async () => {
    const probe = await probeLocalLlm({
      provider: "llamacpp",
      model: "guide.gguf",
      baseUrl: "http://127.0.0.1:8081/v1",
      apiKey: "",
      timeoutMs: 1000,
      fetchImpl: async () => json({ data: [{ id: "other.gguf" }] }),
    });
    assert.equal(probe.status, "model-missing");
    assert.deepEqual(probe.models, ["other.gguf"]);
  });

  it("reports OpenAI unreachable when the model list fails", async () => {
    const probe = await probeLocalLlm({
      provider: "openai",
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      timeoutMs: 1000,
      fetchImpl: async () => {
        throw new Error("connect refused");
      },
    });
    assert.equal(probe.status, "unavailable");
    assert.equal(probe.detail, "connect refused");
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config } from "../src/config";
import { completeChat } from "../src/services/llm";
import { chatTargetFor, listLlmOptions, withChatTarget } from "../src/services/llmChoice";

describe("model choice", () => {
  it("keeps llama.cpp on port 8081 and refuses OpenAI without a key", () => {
    const llama = chatTargetFor("llamacpp", "guide.gguf");
    assert.equal(llama.baseUrl, "http://127.0.0.1:8081/v1");
    assert.equal(llama.model, "guide.gguf");
    assert.equal(llama.apiKey, "");
    if (config.llm.provider !== "openai" && !process.env.OPENAI_API_KEY?.trim()) {
      assert.throws(() => chatTargetFor("openai", "gpt-4o-mini"), /OPENAI_API_KEY/);
    }
  });

  it("lists running Ollama models and marks the other providers unavailable", async () => {
    const catalog = await listLlmOptions(async (url) => {
      const value = String(url);
      if (value.startsWith("http://127.0.0.1:11434/")) {
        return json({ models: [{ name: "llama3.1:latest" }, { name: "mistral:latest" }] });
      }
      if (value.startsWith("http://127.0.0.1:8081/")) throw new Error("connect refused");
      throw new Error(`unexpected ${value}`);
    });
    const names = catalog.options.filter((option) => option.provider === "ollama" && option.available).map((option) => option.model);
    assert.deepEqual(names, ["llama3.1:latest", "mistral:latest"]);
    assert.equal(catalog.options.find((option) => option.provider === "llamacpp")?.available, false);
    assert.equal(catalog.options.find((option) => option.provider === "openai")?.available, false);
  });

  it("sends the selected model to that provider", async () => {
    const original = globalThis.fetch;
    let requested = "";
    let body = "";
    globalThis.fetch = async (url, init) => {
      requested = String(url);
      body = String(init?.body);
      return json({
        choices: [{ message: { content: "answer" } }],
        model: "guide.gguf",
        usage: { prompt_tokens: 2, completion_tokens: 1 },
      });
    };
    try {
      const result = await withChatTarget(chatTargetFor("llamacpp", "guide.gguf"), () =>
        completeChat([{ role: "user", content: "hello" }], 0)
      );
      assert.equal(requested, "http://127.0.0.1:8081/v1/chat/completions");
      assert.equal(JSON.parse(body).model, "guide.gguf");
      assert.equal(result.model, "guide.gguf");
    } finally {
      globalThis.fetch = original;
    }
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

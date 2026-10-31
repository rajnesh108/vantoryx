import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeOpenAiChat } from "../src/services/chatProvider";

describe("chat providers", () => {
  it("posts an OpenAI-compatible completion, including llama.cpp", async () => {
    let body = "";
    const completion = await completeOpenAiChat({
      baseUrl: "http://127.0.0.1:8081/v1",
      apiKey: "",
      model: "guide.gguf",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0,
      timeoutMs: 1000,
      fetchImpl: async (_url, init) => {
        body = String(init?.body);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "answer" } }],
            model: "guide.gguf",
            usage: { prompt_tokens: 4, completion_tokens: 2 },
          }),
          { status: 200 }
        );
      },
    });
    assert.equal(JSON.parse(body).model, "guide.gguf");
    assert.equal(completion.text, "answer");
    assert.equal(completion.promptTokens, 4);
    assert.equal(completion.completionTokens, 2);
  });
});
